import type { Handler } from '@netlify/functions';
import { getFirestore, getStorageBucket } from '../_lib/firebaseAdmin';
import { withAuth, json, error } from '../_lib/http';

const handler: Handler = withAuth(async (req) => {
  try {
    const { storagePath } = req.body || {};
    if (!storagePath) return error(400, 'bad_request', 'storagePath required');

    // Determine permission based on path
    const isUpload = storagePath.startsWith('uploads/');
    const isResult = storagePath.startsWith('results/');
    if (!isUpload && !isResult) return error(400, 'bad_request', 'invalid path');

    // If uploads, allow owner/admin; if results, allow owner/admin
    let allowed = false;
    if (isUpload) {
      // uploads/{uid}/{submissionId}/file
      const parts = storagePath.split('/');
      const ownerUid = parts[1];
      allowed = (ownerUid === req.uid) || (req.token?.role === 'admin');
    } else if (isResult) {
      // results/{submissionId}/file -> check submission owner
      const submissionId = storagePath.split('/')[1];
      const snap = await getFirestore().collection('submissions').doc(submissionId).get();
      if (!snap.exists) return error(404, 'not_found', 'submission not found');
      const data = snap.data()!;
      allowed = (data.ownerUid === req.uid) || (req.token?.role === 'admin');
    }

    if (!allowed) return error(403, 'forbidden', 'not allowed');

    const bucket = getStorageBucket();
    const file = bucket.file(storagePath);
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
      responseDisposition: 'attachment',
    } as any);
    return json(200, { downloadUrl: url, expiresIn: 15 * 60 });
  } catch (e: any) {
    return error(500, 'internal', e?.message || 'error');
  }
});

export { handler };

