import type { Handler } from '@netlify/functions';
import { withAuth, json, error } from '../_lib/http';
import { getAuth, getFirestore } from '../_lib/firebaseAdmin';

const ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'yangchanhee11@gmail.com';

const handler: Handler = withAuth(async (req) => {
  try {
    if (req.method !== 'POST') return error(405, 'method_not_allowed', 'POST only');
    if (!req.email) return error(401, 'unauthorized', 'email missing');
    // Only allow bootstrap for the configured admin email
    if (req.email !== ADMIN_EMAIL) return error(403, 'forbidden', 'not allowed');

    // Require verified email for bootstrap
    if (!(req.token?.email_verified === true)) return error(403, 'forbidden', 'email not verified');
    const auth = getAuth();
    await auth.setCustomUserClaims(req.uid!, { role: 'admin' });
    await getFirestore().collection('admins').doc(req.email).set({ email: req.email, bootstrappedAt: new Date() }, { merge: true });
    return json(200, { ok: true });
  } catch (e: any) {
    return error(500, 'internal', e?.message || 'error');
  }
});

export { handler };
