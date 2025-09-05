import type { Handler } from '@netlify/functions';
import { getFirestore, getStorageBucket } from '../_lib/firebaseAdmin';
import { withAuth, json, error, requireAdmin } from '../_lib/http';

const CONTENT_WHITELIST = [
  'application/pdf', 'application/zip', 'application/x-zip-compressed',
  'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/json',
  'image/png', 'image/jpeg', 'image/webp', 'text/plain'
];

function validFilename(name: string): boolean {
  if (!name || name.length > 180) return false;
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
  const forbidden = /[\0\n\r]/;
  if (forbidden.test(name)) return false;
  const ext = (name.split('.').pop() || '').toLowerCase();
  const allowedExt = new Set(['pdf','zip','csv','xls','xlsx','json','png','jpg','jpeg','webp','txt']);
  return allowedExt.has(ext);
}

// Get a signed upload URL for an existing template (file replacement)
const handler: Handler = withAuth(async (req) => {
  try {
    requireAdmin(req);
    const { id, filename, contentType, size } = req.body || {};
    if (!id || !filename || !contentType) return error(400, 'bad_request', 'id, filename, contentType required');
    if (!validFilename(String(filename))) return error(400, 'bad_request', 'invalid filename');
    if (!CONTENT_WHITELIST.includes(contentType)) return error(400, 'unsupported_type', 'contentType not allowed');
    if (size && size > 200 * 1024 * 1024) return error(400, 'too_large', 'max 200MB');

    const db = getFirestore();
    const ref = db.collection('templates').doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) return error(404, 'not_found', 'template not found');
    const storagePath = `templates/${ref.id}/${filename}`;

    // Update metadata
    await ref.update({ filename, mime: contentType, size: size || 0, storagePath, updatedAt: new Date() });

    const bucket = getStorageBucket();
    const file = bucket.file(storagePath);
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 30 * 60 * 1000,
      contentType,
    } as any);
    return json(200, { id: ref.id, uploadUrl, storagePath });
  } catch (e: any) {
    return error(500, 'internal', e?.message || 'error');
  }
});

export { handler };
