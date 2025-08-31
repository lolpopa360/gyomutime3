import type { Handler } from '@netlify/functions';
import { getFirestore, getStorageBucket } from '../_lib/firebaseAdmin';
import { withAuth, json, error, requireAdmin } from '../_lib/http';
import { z } from 'zod';
import { firestore as AdminFirestore } from 'firebase-admin';

const Body = z.object({
  submissionId: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().int().nonnegative().max(200 * 1024 * 1024).optional(),
});

const handler: Handler = withAuth(async (req) => {
  try {
    requireAdmin(req);
    const parsed = Body.safeParse(req.body || {});
    if (!parsed.success) return error(400, 'bad_request', parsed.error.message);
    const { submissionId, filename, contentType, size } = parsed.data;
    const db = getFirestore();
    const ref = db.collection('submissions').doc(submissionId);
    const snap = await ref.get();
    if (!snap.exists) return error(404, 'not_found', 'submission not found');
    const storagePath = `results/${submissionId}/${filename}`;
    const bucket = getStorageBucket();
    const file = bucket.file(storagePath);
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4', action: 'write', expires: Date.now() + 30 * 60 * 1000, contentType,
    } as any);
    const resultMeta = { name: filename, size: size || 0, storagePath, contentType };
    await ref.update({
      results: AdminFirestore.FieldValue.arrayUnion(resultMeta),
      updatedAt: new Date(),
    });
    return json(200, { uploadUrl, storagePath });
  } catch (e: any) {
    if (e?.message === 'forbidden') return error(403, 'forbidden', 'admin only');
    return error(500, 'internal', e?.message || 'error');
  }
});

export { handler };
