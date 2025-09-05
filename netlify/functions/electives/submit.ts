import type { Handler } from '@netlify/functions';
import { getFirestore } from '../_lib/firebaseAdmin';
import { json, error } from '../_lib/http';
import { z } from 'zod';

const Subject = z.object({
  name: z.string().min(1),
  applicants: z.number().int().min(0),
  cap: z.number().int().min(0).max(10000).default(0),
  sections: z.number().int().min(0).max(1000).default(0),
});

const Body = z.object({
  termId: z.string().min(1).max(100).optional(),
  contact: z.object({ name: z.string().min(1), email: z.string().email() }),
  constraints: z.object({ maxPerClass: z.number().int().min(1).max(500), minSlots: z.number().int().min(0).max(50), maxSlots: z.number().int().min(0).max(50) }).partial(),
  notes: z.string().max(5000).optional(),
  source: z.object({ filename: z.string().nullable().optional(), startIdx: z.number().int().optional() }).optional(),
  table: z.object({ subjects: z.array(Subject).min(1) }),
  teachers: z.object({
    rooms: z.array(z.string()).optional(),
    list: z.array(z.object({
      name: z.string().min(1),
      info: z.string().optional(),
      maxConsecutive: z.number().int().min(0).max(20).optional(),
      bannedRooms: z.array(z.string()).optional(),
    })).optional()
  }).optional(),
});

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return error(405, 'method_not_allowed', 'Use POST');
  try {
    const body = JSON.parse(event.body || '{}');
    const parsed = Body.safeParse(body);
    if (!parsed.success) return error(400, 'bad_request', parsed.error.message);

    const data = parsed.data;
    const db = getFirestore();
    const col = db.collection('electivesRequests');
    const doc = col.doc();
    const now = new Date();
    await doc.set({ id: doc.id, createdAt: now, updatedAt: now, ...data, status: 'submitted' });
    return json(200, { id: doc.id, ok: true });
  } catch (e: any) {
    return error(500, 'internal', e?.message || 'submit failed');
  }
};

export { handler };
