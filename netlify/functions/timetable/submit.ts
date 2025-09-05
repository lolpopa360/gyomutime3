import type { Handler } from '@netlify/functions';
import { getFirestore } from '../_lib/firebaseAdmin';
import { json, error } from '../_lib/http';
import { z } from 'zod';

const Teacher = z.object({
  name: z.string().min(1),
  info: z.string().optional(),
  maxConsecutive: z.number().int().min(0).max(20).optional(),
  bannedRooms: z.array(z.string()).optional(),
  perDayMax: z.object({
    mon: z.number().int().min(0).max(20).optional(),
    tue: z.number().int().min(0).max(20).optional(),
    wed: z.number().int().min(0).max(20).optional(),
    thu: z.number().int().min(0).max(20).optional(),
    fri: z.number().int().min(0).max(20).optional(),
  }).optional(),
});

const Body = z.object({
  submissionId: z.string().min(1),
  weekdayPeriods: z.object({ mon:z.number(), tue:z.number(), wed:z.number(), thu:z.number(), fri:z.number() }).optional(),
  move: z.object({ grades: z.array(z.string()), maxConsecutive: z.number().int().min(0).max(10) }).optional(),
  excludeRule: z.string().max(2000).optional(),
  teachers: z.object({ rooms: z.array(z.string()).optional(), list: z.array(Teacher).optional(), globalMax: z.number().int().min(0).max(20).optional() }).optional(),
});

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return error(405, 'method_not_allowed', 'Use POST');
  try {
    const body = JSON.parse(event.body || '{}');
    const parsed = Body.safeParse(body);
    if (!parsed.success) return error(400, 'bad_request', parsed.error.message);
    const data = parsed.data;
    const db = getFirestore();
    const doc = db.collection('timetableRequests').doc(data.submissionId);
    const now = new Date();
    await doc.set({ id: data.submissionId, createdAt: now, updatedAt: now, ...data }, { merge: true });
    return json(200, { id: data.submissionId, ok: true });
  } catch (e: any) {
    return error(500, 'internal', e?.message || 'submit failed');
  }
};

export { handler };
