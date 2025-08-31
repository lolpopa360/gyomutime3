import type { Handler } from '@netlify/functions';
import { withAuth, json, error, requireAdmin } from '../_lib/http';

const handler: Handler = withAuth(async (req) => {
  try {
    requireAdmin(req);
    const { to, subject, html } = (req.body || {}) as any;
    if (!to || !subject || !html) return error(400, 'bad_request', 'to, subject, html required');
    const key = process.env.RESEND_API_KEY;
    if (!key) return error(501, 'not_configured', 'Email provider not configured');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'no-reply@gyomutime.app', to, subject, html })
    });
    if (!res.ok) return error(500, 'email_error', await res.text());
    return json(200, { ok: true });
  } catch (e: any) {
    if (e?.message === 'forbidden') return error(403, 'forbidden', 'admin only');
    return error(500, 'internal', e?.message || 'error');
  }
});

export { handler };

