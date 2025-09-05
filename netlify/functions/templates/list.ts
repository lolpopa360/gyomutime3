import type { Handler } from '@netlify/functions';
import { getFirestore } from '../_lib/firebaseAdmin';
import { json, error } from '../_lib/http';

// Public template list (no auth required)
const handler: Handler = async () => {
  try {
    const db = getFirestore();
    const snap = await db.collection('templates').orderBy('createdAt', 'desc').get();
    const items = snap.docs.map(d => {
      const data: any = d.data();
      return {
        id: d.id,
        title: data.title || '',
        description: data.description || '',
        filename: data.filename || '',
        mime: data.mime || data.contentType || 'application/octet-stream',
        size: data.size || 0,
      };
    });
    return json(200, { items });
  } catch (e: any) {
    return error(500, 'internal', e?.message || 'error');
  }
};

export { handler };

