import type { Handler } from '@netlify/functions';
import { getFirestore, getStorageBucket } from '../_lib/firebaseAdmin';
import { json, error } from '../_lib/http';

// Public download link generator for templates
const handler: Handler = async (event) => {
  try {
    let body: any = {};
    if (event.body) {
      try { body = JSON.parse(event.body); } catch { return error(400, 'invalid_json', 'Invalid JSON'); }
    }
    const { id } = body || {};
    if (!id) return error(400, 'bad_request', 'id required');

    const db = getFirestore();
    const ref = db.collection('templates').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) return error(404, 'not_found', 'template not found');
    const data: any = snap.data();
    const storagePath: string = data.storagePath;
    if (!storagePath) return error(500, 'internal', 'missing storagePath');

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
};

export { handler };

