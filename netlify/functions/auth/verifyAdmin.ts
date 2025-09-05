import type { Handler } from '@netlify/functions';
import { withAuth, json, error } from '../_lib/http';
import { getFirestore, getAuth } from '../_lib/firebaseAdmin';

// Firestore document path to store admin config
const ADMIN_DOC_PATH = 'config/admin';
const ADMIN_EMAIL = 'yangchanhee11@gmail.com';

const handler: Handler = withAuth(async (req) => {
  try {
    if (req.method !== 'POST') return error(405, 'method_not_allowed', 'POST only');
    const { code } = (req.body || {}) as { code?: string };
    if (!code) return error(400, 'bad_request', 'code required');

    // Must be logged in as admin email
    if (!req.email || req.email !== ADMIN_EMAIL) return error(403, 'forbidden', 'admin email required');

    const db = getFirestore();
    const snap = await db.doc(ADMIN_DOC_PATH).get();
    if (!snap.exists) return error(403, 'forbidden', 'admin code not set');
    const stored = (snap.data()?.code as string);
    if (!stored || String(code) !== String(stored)) return error(401, 'unauthorized', 'invalid code');

    // Require email verified claim
    if (!(req.token?.email_verified === true)) return error(403, 'forbidden', 'email not verified');

    // Grant admin role claim
    const auth = getAuth();
    if (!req.uid) return error(401, 'unauthorized', 'missing uid');
    await auth.setCustomUserClaims(req.uid, { role: 'admin' });
    await db.collection('admins').doc(ADMIN_EMAIL).set({ email: ADMIN_EMAIL, verifiedBy: req.email, verifiedAt: new Date() }, { merge: true });
    return json(200, { ok: true });
  } catch (e: any) {
    return error(500, 'internal', e?.message || 'error');
  }
});

export { handler };
