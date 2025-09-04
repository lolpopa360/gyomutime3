import type { Handler } from '@netlify/functions';
import { withAuth, json, error, requireAdmin } from '../_lib/http';
import { getAuth } from '../_lib/firebaseAdmin';

interface SearchBody {
  q?: string;
  pageToken?: string;
  limit?: number;
}

const MAX_LIMIT = 50; // maximum page size
const MAX_SCAN_PAGES = 10; // safety cap when scanning for filtered results

const handler: Handler = withAuth(async (req) => {
  try {
    // Only admins may query users
    requireAdmin(req);

    if (req.method !== 'POST') return error(405, 'method_not_allowed', 'POST only');

    const { q, pageToken, limit } = (req.body || {}) as SearchBody;
    const pageSize = Math.max(1, Math.min(Number(limit) || 20, MAX_LIMIT));

    const auth = getAuth();

    // No query: return one page straight
    if (!q) {
      const res = await auth.listUsers(pageSize, pageToken);
      const users = res.users.map((u) => ({
        uid: u.uid,
        email: u.email || '',
        displayName: u.displayName || '',
        disabled: u.disabled || false,
        role: (u.customClaims as any)?.role || undefined,
      }));
      return json(200, { users, nextPageToken: res.pageToken || null });
    }

    // With query: scan a few pages and filter by substring
    const needle = String(q).toLowerCase();
    let token = pageToken || undefined;
    const out: any[] = [];
    let pages = 0;

    while (out.length < pageSize && pages < MAX_SCAN_PAGES) {
      const res = await auth.listUsers(1000, token);
      for (const u of res.users) {
        const email = (u.email || '').toLowerCase();
        const name = (u.displayName || '').toLowerCase();
        if (email.includes(needle) || name.includes(needle)) {
          out.push({
            uid: u.uid,
            email: u.email || '',
            displayName: u.displayName || '',
            disabled: u.disabled || false,
            role: (u.customClaims as any)?.role || undefined,
          });
          if (out.length >= pageSize) break;
        }
      }
      if (!res.pageToken || out.length >= pageSize) {
        return json(200, { users: out, nextPageToken: res.pageToken || null });
      }
      token = res.pageToken;
      pages++;
    }

    return json(200, { users: out, nextPageToken: null });
  } catch (e: any) {
    if (e?.message === 'Admin privileges required') {
      return error(403, 'forbidden', 'Admin privileges required');
    }
    return error(500, 'internal', e?.message || 'error');
  }
});

export { handler };

