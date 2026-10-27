import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';

let client = null;

export function getSupabase() {
  if (!client && SUPABASE_URL && SUPABASE_KEY) {
    try {
      client = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false },
      });
    } catch (err) {
      console.warn('[Supabase] Initialization error:', err.message);
    }
  }
  return client;
}

/** Asynchronously sync a document write or deletion to Supabase. */
export async function syncToSupabase(collectionName, item, isDelete = false) {
  const sb = getSupabase();
  if (!sb) return;

  try {
    if (collectionName === 'kv') {
      if (isDelete) {
        await sb.from('kv').delete().eq('key', item.key);
      } else {
        await sb.from('kv').upsert({ key: item.key, value: item.value });
      }
      return;
    }

    if (isDelete) {
      await sb.from(collectionName).delete().eq('id', typeof item === 'string' ? item : item.id);
    } else {
      await sb.from(collectionName).upsert({ id: item.id, data: item });
    }
  } catch (err) {
    // Non-blocking background sync warning
    console.debug(`[Supabase] Sync write to ${collectionName} failed:`, err.message);
  }
}

/** Pull latest data from Supabase into local store on startup. */
export async function pullFromSupabase(db, kv) {
  const sb = getSupabase();
  if (!sb) return false;

  try {
    const { data: kvRows, error: kvErr } = await sb.from('kv').select('*');
    if (kvErr) {
      if (kvErr.code === 'PGRST205') {
        console.log('[Supabase] Tables not detected yet in Supabase. Please run supabase_schema.sql in your Supabase SQL Editor.');
      }
      return false;
    }

    if (kvRows && kvRows.length) {
      for (const row of kvRows) {
        if (kv.rawSet) kv.rawSet(row.key, row.value);
        else kv.set(row.key, row.value);
      }
    }

    const collections = ['categories', 'menu', 'coupons', 'users', 'addresses', 'orders', 'settlements', 'activity'];
    for (const name of collections) {
      const col = db[name];
      if (!col) continue;
      const { data: rows, error } = await sb.from(name).select('*');
      if (error || !rows) continue;
      for (const row of rows) {
        if (row.data) (col.rawPut || col.put).call(col, row.data);
      }
    }
    console.log('[Supabase] Successfully synchronized with remote Supabase database.');
    return true;
  } catch (err) {
    console.debug('[Supabase] Pull sync deferred:', err.message);
    return false;
  }
}
