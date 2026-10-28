import { app } from '../server/src/app.js';
import { db, kv } from '../server/src/db/database.js';
import { pullFromSupabase } from '../server/src/db/supabase.js';
import { seedIfEmpty } from '../server/src/db/seed.js';

let readyPromise = null;
async function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      try {
        const synced = await pullFromSupabase(db, kv);
        if (!synced) {
          seedIfEmpty();
        }
      } catch (err) {
        console.error('[API Cold Start] Sync error:', err);
        try { seedIfEmpty(); } catch {}
      }
    })();
  }
  return readyPromise;
}

export default async function handler(req, res) {
  await ensureReady();

  // On Vercel, the original path is preserved in x-matched-path or req.url
  const matched = req.headers?.['x-matched-path'];
  if (matched && matched.startsWith('/api')) {
    const query = req.url?.includes('?') && !matched.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = matched + query;
  } else if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  return app(req, res);
}
