// Simple, toggleable logger for development debugging
// Enable by adding ?debug=1 to the URL or localStorage.setItem('debug','1')

const getTime = () => new Date().toISOString();

class Logger {
  constructor(initialEnabled = false) {
    this._enabled = initialEnabled;
  }

  setEnabled(v) {
    this._enabled = Boolean(v);
  }

  isEnabled() {
    return this._enabled;
  }

  _fmt(level, args) {
    const prefix = `[${getTime()}][${level}]`;
    try {
      return [prefix, ...args];
    } catch (_) {
      return [prefix, '<<unserializable>>'];
    }
  }

  debug(...args) { if (this._enabled) console.debug(...this._fmt('DEBUG', args)); }
  info (...args) { if (this._enabled) console.info (...this._fmt('INFO',  args)); }
  warn (...args) { if (this._enabled) console.warn (...this._fmt('WARN',  args)); }
  error(...args) {               console.error(...this._fmt('ERROR', args)); }
}

export const logger = new Logger(false);

// Helper to initialize from URL/localStorage, returns current enabled state
export function initLoggerFromEnv() {
  const url = new URL(window.location.href);
  const qsDebug = url.searchParams.get('debug');
  if (qsDebug === '1' || qsDebug === 'true') {
    localStorage.setItem('debug', '1');
  }
  const enabled = localStorage.getItem('debug') === '1';
  logger.setEnabled(enabled);
  return enabled;
}

