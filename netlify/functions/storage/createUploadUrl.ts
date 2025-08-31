import type { Handler } from '@netlify/functions';
import { getFirestore, getStorageBucket } from '../_lib/firebaseAdmin';
import { withAuth, json, error } from '../_lib/http';
import { v4 as uuidv4 } from 'uuid';

const CONTENT_WHITELIST = [
  'application/pdf', 'application/zip', 'application/x-zip-compressed',
  'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json',
  'image/png', 'image/jpeg', 'image/webp'
];

const handler: Handler = withAuth(async (req) => {
  try {
    const { submissionId, filename, contentType, size } = req.body || {};
    if (!filename || !contentType) return error(400, 'bad_request', 'filename and contentType required');
    if (!CONTENT_WHITELIST.includes(contentType)) return error(400, 'unsupported_type', 'contentType not allowed');
    if (size && size > 200 * 1024 * 1024) return error(400, 'too_large', 'max 200MB');

    const db = getFirestore();
    let sid = submissionId as string | undefined;
    if (sid) {
      const snap = await db.collection('submissions').doc(sid).get();
      if (!snap.exists) return error(404, 'not_found', 'submission not found');
      const data = snap.data()!;
      if (data.ownerUid !== req.uid && req.token?.role !== 'admin') return error(403, 'forbidden', 'not owner');
    } else {
      // allocate a temp submissionId
      sid = uuidv4();
    }
    const path = `uploads/${req.uid}/${sid}/${filename}`;
    const bucket = getStorageBucket();
    const file = bucket.file(path);
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 30 * 60 * 1000, // 30m
      contentType,
    } as any);
    return json(200, { uploadUrl: url, storagePath: path, submissionId: sid });
  } catch (e: any) {
    return error(500, 'internal', e?.message || 'error');
  }
});

export { handler };

