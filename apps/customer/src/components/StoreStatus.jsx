import { useLang } from '@velan/shared/i18n.jsx';
import { useNow } from '@velan/shared/hooks.js';
import { storeStatus } from '@velan/shared/domain.js';
import { useSite } from '../state/site.js';

/** "● Open now · closes 10:30 PM" pill, recomputed every minute. */
export default function StoreStatus({ dark = false }) {
  const { t, hhmm } = useLang();
  const settings = useSite((s) => s.settings);
  useNow(60_000);
  if (!settings) return null;
  const st = storeStatus(settings);
  const tone = st.open ? (st.closingSoon ? 'saffron' : 'leaf') : 'maroon';
  let text;
  if (st.open) text = `${t('openNow')} · ${t('closesAt', { time: hhmm(settings.closeTime) })}`;
  else if (st.reason === 'paused') text = t('paused');
  else text = `${t('closed')} · ${t('opensAt', { time: hhmm(settings.openTime) })}`;
  return (
    <span className={`store-status ${dark ? 'on-dark' : ''}`} data-tone={tone}>
      <span className="pulse-dot" />
      {text}
    </span>
  );
}
