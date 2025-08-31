import type { Handler } from '@netlify/functions';
import { getFirestore } from '../_lib/firebaseAdmin';
import { withAuth, json, error } from '../_lib/http';
import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';

const FileMeta = z.object({
  name: z.string().min(1),
  size: z.number().int().nonnegative().max(200 * 1024 * 1024).optional(),
  contentType: z.string().min(1),
});

const GroupingMeta = z.object({
  contactName: z.string().min(1).max(120),
  contactEmail: z.string().email(),
  maxPerClass: z.number().int().positive().max(200).optional(),
  minSlots: z.number().int().min(0).max(20).optional(),
  maxSlots: z.number().int().min(0).max(20).optional(),
  notes: z.string().max(5000).optional(),
}).partial({ maxPerClass: true, minSlots: true, maxSlots: true, notes: true });

const Body = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(5000).optional().default(''),
  category: z.enum(['기타','이미지','문서','데이터','코드']),
  filesMeta: z.array(FileMeta).min(1),
  meta: z.object({ grouping: GroupingMeta.optional() }).partial().optional(),
});

const handler: Handler = withAuth(async (req) => {
  try {
    const parsed = Body.safeParse(req.body || {});
    if (!parsed.success) return error(400, 'bad_request', parsed.error.message);
    const { title, description, category, filesMeta, meta } = parsed.data;
    const db = getFirestore();
    const now = new Date();
    const docRef = db.collection('submissions').doc();
    const files = filesMeta.map(f => ({ name: f.name, size: f.size || 0, storagePath: `uploads/${req.uid}/${docRef.id}/${f.name}` , contentType: f.contentType }));
    const safeDescription = sanitizeHtml(description || '', { allowedTags: [], allowedAttributes: {} });
    let safeMeta: any = undefined;
    if (meta?.grouping) {
      const g = meta.grouping as any;
      safeMeta = {
        grouping: {
          contactName: sanitizeHtml(g.contactName || '', { allowedTags: [], allowedAttributes: {} }),
          contactEmail: sanitizeHtml(g.contactEmail || '', { allowedTags: [], allowedAttributes: {} }),
          maxPerClass: typeof g.maxPerClass === 'number' ? g.maxPerClass : undefined,
          minSlots: typeof g.minSlots === 'number' ? g.minSlots : undefined,
          maxSlots: typeof g.maxSlots === 'number' ? g.maxSlots : undefined,
          notes: sanitizeHtml(g.notes || '', { allowedTags: [], allowedAttributes: {} }),
        }
      };
    }
    await docRef.set({
      id: docRef.id,
      ownerUid: req.uid,
      ownerEmail: req.email,
      title,
      description: safeDescription,
      category,
      status: 'uploaded',
      createdAt: now,
      updatedAt: now,
      files,
      results: [],
      meta: safeMeta,
      messages: [],
    });
    return json(200, { id: docRef.id, files });
  } catch (e: any) {
    return error(500, 'internal', e?.message || 'error');
  }
});

export { handler };
