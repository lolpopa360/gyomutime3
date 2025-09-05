import type { Handler } from '@netlify/functions';
import { getFirestore } from '../_lib/firebaseAdmin';
import { json, error } from '../_lib/http';
import { z } from 'zod';

const Block = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  maxRooms: z.number().int().min(0).max(999).default(0),
});

const Subject = z.object({
  name: z.string().min(1),
  applicants: z.number().int().min(0).max(100000),
  minSections: z.number().int().min(0).max(1000),
  maxSections: z.number().int().min(0).max(1000),
  blocks: z.record(z.object({ sections: z.number().int().min(0).max(1000), cap: z.number().int().min(0).max(10000) }))
});

const Body = z.object({
  termId: z.string().min(1).max(100),
  blocks: z.array(Block).min(1).max(20),
  subjects: z.array(Subject).min(1),
  meta: z.any().optional(),
});

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return error(405, 'method_not_allowed', 'Use POST');

  try {
    const body = JSON.parse(event.body || '{}');
    const parsed = Body.safeParse(body);
    if (!parsed.success) return error(400, 'bad_request', parsed.error.message);

    const { termId, blocks, subjects, meta } = parsed.data;
    const db = getFirestore();
    const doc = db.collection('electivesConfigs').doc(termId);
    const now = new Date();

    await doc.set({
      termId,
      blocks,
      subjects,
      meta: meta || null,
      updatedAt: now,
      createdAt: (await doc.get()).exists ? (await doc.get()).get('createdAt') || now : now,
      public: true,
    }, { merge: true });

    return json(200, { id: termId, ok: true });
  } catch (e: any) {
    return error(500, 'internal', e?.message || 'save failed');
  }
};

export { handler };

