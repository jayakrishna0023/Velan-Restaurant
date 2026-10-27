import { kv } from '../db/database.js';
import { bus } from '../lib/bus.js';
import { fail } from '../lib/errors.js';
import { storeStatus } from '@velan/shared/domain.js';
import { logActivity } from './activity.js';

export const DEFAULT_SETTINGS = {
  name: 'Velan Biryani Center',
  nameTa: 'வேலன் பிரியாணி சென்டர்',
  tagline: 'Dum biryani, slow-cooked the Uniyur way',
  taglineTa: 'உன்னியூர் சுவையில் தம் பிரியாணி',
  about: 'On Nerur Bridge Road by the Kaveri, we seal every handi with dough and let the biryani finish on slow dum — seeraga samba rice, country spices ground every morning, and meat bought fresh from local farms.',
  aboutTa: 'காவிரிக் கரையோரம், நெரூர் பாலம் சாலையில் — ஒவ்வொரு அண்டாவையும் மாவால் மூடி, மெல்லிய தம்மில் பிரியாணி தயாராகிறது. சீரக சம்பா அரிசி, தினமும் அரைக்கும் நாட்டு மசாலா, உள்ளூர் பண்ணைகளின் புதிய இறைச்சி.',
  address: 'Nerur Bridge Road, Uniyur, near Nerur, Karur District, Tamil Nadu',
  addressTa: 'நெரூர் பாலம் சாலை, உன்னியூர், நெரூர் அருகில், கரூர் மாவட்டம், தமிழ்நாடு',
  phone: '',
  whatsapp: '',
  email: '',
  instagram: '',
  upiId: '',
  fssai: '',
  gstin: '',
  // Uniyur near the Nerur bridge (OpenStreetMap). Drag the pin in Admin → Settings.
  lat: 11.0018182,
  lng: 78.1764149,
  openTime: '11:00',
  closeTime: '22:30',
  weeklyOff: null,
  enforceHours: false,
  isOpen: true,
  acceptCash: true,
  acceptUpi: true,
  deliveryRadiusKm: 10,
  baseFee: 20,
  baseKm: 2,
  perKm: 6,
  freeAbove: 499,
  minOrder: 100,
  packingCharge: 0,
  gstPercent: 0,
  avgPrepMins: 20,
  autoAssign: false,
  riderPayBase: 25,
  riderPayPerKm: 5,
  announcement: { active: true, text: 'Sunday special: Mutton biryani with bread halwa', textTa: 'ஞாயிறு ஸ்பெஷல்: மட்டன் பிரியாணி + பிரெட் அல்வா' },
};

const NUMBER_FIELDS = ['lat', 'lng', 'deliveryRadiusKm', 'baseFee', 'baseKm', 'perKm', 'freeAbove', 'minOrder',
  'packingCharge', 'gstPercent', 'avgPrepMins', 'riderPayBase', 'riderPayPerKm'];
const BOOL_FIELDS = ['enforceHours', 'isOpen', 'acceptCash', 'acceptUpi', 'autoAssign'];
const TEXT_FIELDS = ['name', 'nameTa', 'tagline', 'taglineTa', 'about', 'aboutTa', 'address', 'addressTa', 'phone',
  'whatsapp', 'email', 'instagram', 'upiId', 'fssai', 'gstin', 'openTime', 'closeTime'];

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...kv.get('settings', {}) };
}

/** Settings plus the computed open/closed status, for every app. */
export function publicSettings() {
  const s = getSettings();
  return { ...s, status: storeStatus(s) };
}

export function updateSettings(patch, actor) {
  const s = getSettings();
  const changed = [];
  for (const k of TEXT_FIELDS) if (k in patch) { s[k] = String(patch[k] ?? '').trim().slice(0, 600); changed.push(k); }
  for (const k of NUMBER_FIELDS) {
    if (!(k in patch)) continue;
    const v = Number(patch[k]);
    if (!Number.isFinite(v) || (k !== 'lat' && k !== 'lng' && v < 0)) fail('BAD_REQUEST', 400);
    s[k] = v;
    changed.push(k);
  }
  for (const k of BOOL_FIELDS) if (k in patch) { s[k] = Boolean(patch[k]); changed.push(k); }
  if ('weeklyOff' in patch) {
    const v = patch.weeklyOff;
    s.weeklyOff = v === null || v === '' || v === undefined ? null : Math.min(6, Math.max(0, Number(v)));
    changed.push('weeklyOff');
  }
  if (patch.announcement && typeof patch.announcement === 'object') {
    const a = patch.announcement;
    s.announcement = { active: Boolean(a.active), text: String(a.text || '').slice(0, 160), textTa: String(a.textTa || '').slice(0, 160) };
    changed.push('announcement');
  }
  if (!/^\d{1,2}:\d{2}$/.test(s.openTime) || !/^\d{1,2}:\d{2}$/.test(s.closeTime)) fail('BAD_REQUEST', 400);
  kv.set('settings', s);
  if (changed.length) {
    if (changed.length === 1 && changed[0] === 'isOpen') {
      logActivity(actor, s.isOpen ? 'store.open' : 'store.paused', {});
    } else {
      logActivity(actor, 'settings.update', { fields: changed });
    }
  }
  bus.emit('settings', publicSettings());
  return publicSettings();
}
