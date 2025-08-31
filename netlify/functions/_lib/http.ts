import type { Handler, HandlerEvent } from '@netlify/functions';
import { getAuth } from './firebaseAdmin';
import * as crypto from 'crypto';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS';

export interface AuthedRequest<T = any> {
  method: Method;
  headers: Record<string, string>;
  body?: T;
  uid?: string;
  email?: string;
  token?: any; // decoded token
  ip?: string;
  userAgent?: string;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const rateLimitStore: RateLimitStore = {};

// Security headers
const SECURITY_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'x-xss-protection': '1; mode=block',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'content-security-policy': "default-src 'self'",
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'geolocation=(), microphone=(), camera=()',
};

// CORS headers
const CORS_HEADERS = {
  'access-control-allow-origin': process.env.ALLOWED_ORIGINS || '*',
  'access-control-allow-headers': 'Content-Type, Authorization',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-max-age': '86400',
};

export function json(statusCode: number, data: any) {
  return {
    statusCode,
    headers: {
      ...SECURITY_HEADERS,
      ...CORS_HEADERS,
    },
    body: JSON.stringify(data),
  };
}

export function error(statusCode: number, code: string, message: string, details?: any) {
  // Log errors for monitoring
  if (statusCode >= 500) {
    console.error(`[ERROR] ${code}: ${message}`, details);
  }
  
  return json(statusCode, { 
    error: { 
      code, 
      message,
      timestamp: new Date().toISOString(),
      // Only include details in development
      ...(process.env.NODE_ENV === 'development' && details ? { details } : {})
    } 
  });
}

// Rate limiting helper
function checkRateLimit(identifier: string): boolean {
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
  
  const now = Date.now();
  const record = rateLimitStore[identifier];
  
  // Clean up old entries
  if (record && now > record.resetTime) {
    delete rateLimitStore[identifier];
  }
  
  if (!rateLimitStore[identifier]) {
    rateLimitStore[identifier] = {
      count: 1,
      resetTime: now + windowMs,
    };
    return true;
  }
  
  if (rateLimitStore[identifier].count >= maxRequests) {
    return false;
  }
  
  rateLimitStore[identifier].count++;
  return true;
}

// Input validation helper
export function validateInput<T>(input: any, schema: {
  [K in keyof T]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    maxLength?: number;
    minLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: any[];
  };
}): T {
  const errors: string[] = [];
  const result: any = {};

  for (const [key, rules] of Object.entries(schema) as any) {
    const value = input?.[key];
    
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${key} is required`);
      continue;
    }
    
    if (value === undefined || value === null) {
      continue;
    }
    
    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rules.type) {
      errors.push(`${key} must be of type ${rules.type}`);
      continue;
    }
    
    // String validations
    if (rules.type === 'string') {
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${key} exceeds maximum length of ${rules.maxLength}`);
      }
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${key} must be at least ${rules.minLength} characters`);
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`${key} has invalid format`);
      }
    }
    
    // Number validations
    if (rules.type === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`${key} must be at least ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`${key} must not exceed ${rules.max}`);
      }
    }
    
    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${key} must be one of: ${rules.enum.join(', ')}`);
    }
    
    result[key] = value;
  }
  
  if (errors.length > 0) {
    throw new ValidationError(errors.join('; '));
  }
  
  return result as T;
}

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Enhanced auth middleware with rate limiting
export function withAuth(handler: (req: AuthedRequest) => Promise<any> | any): Handler {
  return async (event: HandlerEvent) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return json(200, { ok: true });
    }

    // Extract client info for rate limiting
    const clientIp = event.headers['x-forwarded-for'] || 
                    event.headers['client-ip'] || 
                    'unknown';
    const userAgent = event.headers['user-agent'] || 'unknown';
    
    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      return error(429, 'rate_limit_exceeded', 'Too many requests. Please try again later.');
    }

    // Validate authorization header
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return error(401, 'unauthorized', 'Missing or invalid Bearer token');
    }
    
    const idToken = authHeader.slice('Bearer '.length).trim();
    
    if (!idToken) {
      return error(401, 'unauthorized', 'Empty token provided');
    }

    try {
      // Verify Firebase ID token
      const decoded = await getAuth().verifyIdToken(idToken);
      
      // Parse request body safely
      let body;
      if (event.body) {
        try {
          body = JSON.parse(event.body);
        } catch (e) {
          return error(400, 'invalid_json', 'Request body contains invalid JSON');
        }
      }
      
      // Build authenticated request object
      const req: AuthedRequest = {
        method: event.httpMethod as Method,
        headers: event.headers as any,
        body,
        uid: decoded.uid,
        email: decoded.email,
        token: decoded,
        ip: clientIp,
        userAgent,
      };
      
      // Call the handler
      const res = await handler(req);
      return res;
    } catch (e: any) {
      // Handle specific Firebase auth errors
      if (e.code === 'auth/id-token-expired') {
        return error(401, 'token_expired', 'Authentication token has expired');
      }
      if (e.code === 'auth/id-token-revoked') {
        return error(401, 'token_revoked', 'Authentication token has been revoked');
      }
      if (e.code === 'auth/argument-error') {
        return error(401, 'invalid_token', 'Malformed authentication token');
      }
      if (e.name === 'ValidationError') {
        return error(400, 'validation_error', e.message);
      }
      
      // Log unexpected errors
      console.error('[AUTH ERROR]', e);
      
      return error(401, 'authentication_failed', 'Authentication failed');
    }
  };
}

// Helper to require admin role
export function requireAdmin(req: AuthedRequest): void {
  if (req.token?.role !== 'admin') {
    throw new Error('Admin privileges required');
  }
}

// Helper to check if user is super admin
export function isSuperAdmin(req: AuthedRequest): boolean {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'yangchanhee11@gmail.com';
  return req.email === superAdminEmail;
}

// Helper to sanitize user input
export function sanitizeInput(input: string): string {
  // Remove any potential XSS vectors
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

// Helper to generate secure random tokens
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// Helper for consistent logging
export function log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data ? { data } : {}),
  };
  
  switch (level) {
    case 'error':
      console.error(JSON.stringify(logEntry));
      break;
    case 'warn':
      console.warn(JSON.stringify(logEntry));
      break;
    default:
      console.log(JSON.stringify(logEntry));
  }
}
