// Turn a shared map link (the kind people send on WhatsApp) into coordinates.
// Short links are expanded by following their redirects, but only on Google's
// map hosts, so the server never fetches an arbitrary address for a caller.
import { fail } from '../lib/errors.js';
import { parseLocationText } from '@velan/shared/geo.js';

const HOSTS = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|maps\.google\.[a-z.]+|(www\.)?google\.[a-z.]+)$/i;

export async function resolveMapLink(raw) {
  const direct = parseLocationText(raw);
  if (direct) return direct;
  let url;
  try { url = new URL(String(raw || '').trim()); } catch { fail('BAD_REQUEST'); }
  for (let hop = 0; hop < 4; hop += 1) {
    if (url.protocol !== 'https:' || !HOSTS.test(url.hostname)) fail('BAD_REQUEST');
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'Mozilla/5.0 (VelanBiryani)' } });
    const next = res.headers.get('location');
    const found = parseLocationText(next || url.href);
    if (found) return found;
    if (!next) {
      // Some links land on a page that carries the place in its markup.
      const body = (await res.text()).slice(0, 400_000);
      const inPage = parseLocationText(body.match(/https:\/\/www\.google\.[a-z.]+\/maps\/[^"'\s<>]+/i)?.[0] || '')
        || parseLocationText(body.match(/center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/)?.slice(1).join(',') || '');
      if (inPage) return inPage;
      break;
    }
    url = new URL(next, url);
  }
  fail('NOT_FOUND', 404);
}
