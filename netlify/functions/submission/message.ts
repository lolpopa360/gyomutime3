import type { Handler } from '@netlify/functions';
import { getFirestore } from '../_lib/firebaseAdmin';
import { withAuth, json, error } from '../_lib/http';
import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';

const Body = z.object({
  submissionId: z.string().min(1),
  text: z.string().min(1).max(1000),
  by: z.enum(['user','admin']).optional(),
});

const handler: Handler = withAuth(async (req) => {
  try {
    const parsed = Body.safeParse(req.body || {});
    if (!parsed.success) return error(400, 'bad_request', parsed.error.message);
    const { submissionId, text, by } = parsed.data;
    const db = getFirestore();
    const ref = db.collection('submissions').doc(submissionId);
    const snap = await ref.get();
    if (!snap.exists) return error(404, 'not_found', 'submission not found');
    const data = snap.data()!;
    const role = req.token?.role === 'admin' ? 'admin' : 'user';
    if (role === 'user' && data.ownerUid !== req.uid) return error(403, 'forbidden', 'not owner');
    const safe = sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
    const msg = { by: role, text: safe, at: new Date() };
    await ref.update({ messages: (snap.get('messages') || []).concat([msg]), updatedAt: new Date() });
    return json(200, { ok: true });
  } catch (e: any) {
    return error(500, 'internal', e?.message || 'error');
  }
});

export { handler };

