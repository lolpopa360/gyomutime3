import type { Handler } from '@netlify/functions';
import { getFirestore } from '../_lib/firebaseAdmin';
import { json, error } from '../_lib/http';

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'GET') return error(405, 'method_not_allowed', 'Use GET');

  const termId = event.queryStringParameters?.termId;
  if (!termId) return error(400, 'bad_request', 'termId is required');
  try {
    const db = getFirestore();
    const snap = await db.collection('electivesConfigs').doc(termId).get();
    if (!snap.exists) return error(404, 'not_found', 'config not found');
    return json(200, { id: termId, ...snap.data() });
  } catch (e: any) {
    return error(500, 'internal', e?.message || 'get failed');
  }
};

export { handler };

