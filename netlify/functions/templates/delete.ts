import type { Handler } from '@netlify/functions';
import { getFirestore, getStorageBucket } from '../_lib/firebaseAdmin';
import { withAuth, json, error, requireAdmin } from '../_lib/http';

const handler: Handler = withAuth(async (req) => {
  try {
    requireAdmin(req);
    const { id } = req.body || {};
    if (!id) return error(400, 'bad_request', 'id required');
    const db = getFirestore();
    const ref = db.collection('templates').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) return error(404, 'not_found', 'template not found');

    // Delete files under the template folder
    const bucket = getStorageBucket();
    await bucket.deleteFiles({ prefix: `templates/${ref.id}/` }).catch(() => {});
    await ref.delete();
    return json(200, { ok: true });
  } catch (e: any) {
    return error(500, 'internal', e?.message || 'error');
  }
});

export { handler };

