// English / Tamil for every app. One switch, remembered per browser.
//   const { t, tr, pick, other, money, time } = useLang();
//   t('status.ready')               -> dictionary word
//   tr('Order now', 'ஆர்டர் செய்')    -> inline pair for one-off copy
//   pick(item, 'name')              -> item.nameTa in Tamil (falls back to English)
//   other(item, 'name')             -> the other language, for bilingual subtitles
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { COMMON } from './dict.js';

const KEY = 'velan.lang';
const Ctx = createContext(null);

const read = () => { try { return localStorage.getItem(KEY) === 'ta' ? 'ta' : 'en'; } catch { return 'en'; } };
const fill = (text, params) => text.replace(/\{(\w+)\}/g, (_, k) => (params?.[k] ?? `{${k}}`));

const IST = 'Asia/Kolkata';
const MONTHS_TA = ['ஜன.', 'பிப்.', 'மார்ச்', 'ஏப்.', 'மே', 'ஜூன்', 'ஜூலை', 'ஆக.', 'செப்.', 'அக்.', 'நவ.', 'டிச.'];
const DAYS_TA = ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function istParts(d) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(new Date(d));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    y: Number(get('year')), m: Number(get('month')) - 1, d: Number(get('day')),
    h: Number(get('hour')), min: get('minute'), wd: DAYS_EN.indexOf(get('weekday')),
  };
}

export function makeI18n(lang, dict) {
  const ta = lang === 'ta';
  const all = { ...COMMON, ...dict };
  const t = (key, params) => {
    const k = params?.n === 1 && all[`${key}_one`] ? `${key}_one` : key;
    const pair = all[k];
    if (!pair) return key;
    const p = ta && params ? { ...params, name: params.nameTa || params.name } : params;
    return fill(ta ? pair[1] || pair[0] : pair[0], p);
  };
  const tr = (en, tamil, params) => fill(ta ? tamil || en : en, params);
  // Tamil twin of a field: nameTa, taglineTa… (dishes store description's twin as descTa).
  const taField = (field) => (field === 'description' ? 'descTa' : `${field}Ta`);
  const pick = (obj, field) => (ta && obj?.[taField(field)]) || obj?.[field] || '';
  const other = (obj, field) => (ta ? obj?.[field] : obj?.[taField(field)]) || '';

  const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
  const num = (n) => (Number(n) || 0).toLocaleString('en-IN');

  const clock = (hh, mm) => {
    if (!ta) return `${((hh + 11) % 12) + 1}:${mm} ${hh < 12 ? 'AM' : 'PM'}`;
    const period = hh < 5 ? 'இரவு' : hh < 12 ? 'காலை' : hh < 16 ? 'மதியம்' : hh < 19 ? 'மாலை' : 'இரவு';
    return `${period} ${((hh + 11) % 12) + 1}:${mm}`;
  };
  const time = (d) => { if (!d) return ''; const p = istParts(d); return clock(p.h, p.min); };
  /** "11:00" (24h settings value) -> "11:00 AM" / "காலை 11:00" */
  const hhmm = (s) => { const [h, m] = String(s || '0:00').split(':'); return clock(Number(h), String(m || '00').padStart(2, '0')); };
  const date = (d, { weekday = false } = {}) => {
    if (!d) return '';
    const p = istParts(d);
    const month = ta ? MONTHS_TA[p.m] : new Date(Date.UTC(2000, p.m, 1)).toLocaleString('en', { month: 'short', timeZone: 'UTC' });
    const wd = weekday ? `${ta ? DAYS_TA[p.wd] : DAYS_EN[p.wd]}, ` : '';
    return `${wd}${p.d} ${month}`;
  };
  const dateTime = (d) => `${date(d)} · ${time(d)}`;
  const dayName = (i, short = true) => (ta ? DAYS_TA[i] : short ? DAYS_EN[i] : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]);
  const relative = (d) => {
    const s = (Date.now() - new Date(d)) / 1000;
    if (s < 45) return t('justNow');
    if (s < 3600) return t('minAgo', { n: Math.round(s / 60) });
    if (s < 86400) return t('hrAgo', { n: Math.round(s / 3600) });
    if (s < 172800) return t('yesterday');
    if (s < 7 * 86400) return t('daysAgo', { n: Math.floor(s / 86400) });
    return date(d);
  };
  const mins = (n) => t('mins', { n: Math.round(n) });
  const km = (n) => t('km', { n: (Math.round(Number(n) * 10) / 10).toLocaleString('en-IN') });
  const status = (o) => (o.status === 'delivered' && o.type === 'pickup' ? t('status.pickedUp') : t(`status.${o.status}`));
  const error = (err) => {
    if (!err) return '';
    if (err.code && all[`err.${err.code}`]) return t(`err.${err.code}`, err.params);
    return err.message || t('err.SERVER');
  };

  return { lang, ta, t, tr, pick, other, money, num, time, hhmm, date, dateTime, dayName, relative, mins, km, status, error };
}

export function LangProvider({ dict = {}, children }) {
  const [lang, setLang] = useState(read);
  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem(KEY, lang); } catch { /* private mode */ }
  }, [lang]);
  const value = useMemo(() => ({ ...makeI18n(lang, dict), setLang }), [lang, dict]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
