import type { Handler } from '@netlify/functions';
import { getAuth, getFirestore } from '../_lib/firebaseAdmin';
import { withAuth, json, error, isSuperAdmin } from '../_lib/http';

const handler: Handler = withAuth(async (req) => {
  try {
    if (!isSuperAdmin(req)) return error(403, 'forbidden', 'Only superadmin can call this');
    const { email, make } = req.body || {};
    if (!email || typeof make !== 'boolean') return error(400, 'bad_request', 'email and make(boolean) required');
    const auth = getAuth();
    const user = await auth.getUserByEmail(email).catch(() => null);
    if (!user) return error(404, 'not_found', 'User not found');
    await auth.setCustomUserClaims(user.uid, make ? { role: 'admin' } : {});
    const db = getFirestore();
    const ref = db.collection('admins').doc(email);
    if (make) {
      await ref.set({ email, addedBy: req.email, addedAt: new Date() }, { merge: true });
    } else {
      await ref.delete();
    }
    return json(200, { ok: true });
  } catch (e: any) {
    return error(500, 'internal', e?.message || 'error');
  }
});

export { handler };

