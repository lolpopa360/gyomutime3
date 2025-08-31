import type { Handler } from '@netlify/functions';
import { getFirestore } from '../_lib/firebaseAdmin';
import { withAuth, json, error, requireAdmin } from '../_lib/http';
import { z } from 'zod';

const Body = z.object({
  submissionId: z.string().min(1),
  status: z.enum(['uploaded','processing','completed','rejected'])
});

const handler: Handler = withAuth(async (req) => {
  try {
    requireAdmin(req);
    const parsed = Body.safeParse(req.body || {});
    if (!parsed.success) return error(400, 'bad_request', parsed.error.message);
    const { submissionId, status } = parsed.data;
    const db = getFirestore();
    const ref = db.collection('submissions').doc(submissionId);
    const snap = await ref.get();
    if (!snap.exists) return error(404, 'not_found', 'submission not found');
    await ref.update({ status, updatedAt: new Date() });
    return json(200, { ok: true });
  } catch (e: any) {
    if (e?.message === 'forbidden') return error(403, 'forbidden', 'admin only');
    return error(500, 'internal', e?.message || 'error');
  }
});

export { handler };

