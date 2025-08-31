import type { Handler } from '@netlify/functions';
import { withAuth, json, error, isSuperAdmin } from '../_lib/http';
import { getFirestore } from '../_lib/firebaseAdmin';

const ADMIN_DOC_PATH = 'config/admin';

const handler: Handler = withAuth(async (req) => {
  try {
    if (!isSuperAdmin(req)) return error(403, 'forbidden', 'Only superadmin can call this');
    if (req.method !== 'POST') return error(405, 'method_not_allowed', 'POST only');
    const { code } = (req.body || {}) as { code?: string };
    if (!code || String(code).length < 4) return error(400, 'bad_request', 'valid code required');
    const db = getFirestore();
    await db.doc(ADMIN_DOC_PATH).set({ code: String(code), updatedBy: req.email, updatedAt: new Date() }, { merge: true });
    return json(200, { ok: true });
  } catch (e: any) {
    return error(500, 'internal', e?.message || 'error');
  }
});

export { handler };

