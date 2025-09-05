import type { Handler } from '@netlify/functions';
import { getFirestore } from '../_lib/firebaseAdmin';
import { withAuth, json, error, requireAdmin } from '../_lib/http';

const handler: Handler = withAuth(async (req) => {
  try {
    requireAdmin(req);
    const { id, title, description } = req.body || {};
    if (!id) return error(400, 'bad_request', 'id required');
    const db = getFirestore();
    const ref = db.collection('templates').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) return error(404, 'not_found', 'template not found');
    const payload: any = { updatedAt: new Date() };
    if (typeof title === 'string') payload.title = title;
    if (typeof description === 'string') payload.description = description;
    await ref.update(payload);
    return json(200, { ok: true });
  } catch (e: any) {
    return error(500, 'internal', e?.message || 'error');
  }
});

export { handler };

