// App chrome: greeting header and the bottom tab bar.
import { motion } from 'framer-motion';
import { useLang } from '@velan/shared/i18n.jsx';
import { Icon } from '@velan/shared/components/Icon.jsx';
import { Sign } from '@velan/shared/components/Poster.jsx';
import { initials } from '@velan/shared/hooks.js';
import { spring } from '@velan/shared/components/ui.jsx';
import { useRider } from '../RiderProvider.jsx';

function greeting(tr) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date()));
  if (h < 12) return tr('Good morning', 'காலை வணக்கம்');
  if (h < 17) return tr('Good afternoon', 'மதிய வணக்கம்');
  return tr('Good evening', 'மாலை வணக்கம்');
}

export function Header() {
  const { tr } = useLang();
  const { me, online } = useRider();
  return (
    <header className="r-head">
      <div className="r-avatar">
        <span>{initials(me?.name)}</span>
        <i className={online ? 'on' : ''} />
      </div>
      <div className="grow">
        <div className="r-head-hello">{greeting(tr)}</div>
        <div className="r-head-name ellipsis">{me?.name || '…'}</div>
      </div>
      {me?.vehicle && <span className="r-plate">{me.vehicle}</span>}
      <Sign />
    </header>
  );
}

const TABS = [
  { key: 'orders', icon: 'package' },
  { key: 'earnings', icon: 'wallet' },
  { key: 'profile', icon: 'user' },
];

export function TabBar({ tab, onChange, badge }) {
  const { t } = useLang();
  return (
    <nav className="r-tabs" aria-label="Sections">
      {/* On a laptop the tabs become a side rail with the shop sign on top. */}
      <div className="r-rail-brand" aria-hidden="true"><Sign size="lg" /></div>
      {TABS.map((x) => (
        <button key={x.key} type="button" className={tab === x.key ? 'active' : ''} aria-current={tab === x.key ? 'page' : undefined}
          onClick={() => onChange(x.key)}>
          {tab === x.key && <motion.span layoutId="r-tab-pill" className="r-tab-pill" transition={spring} />}
          <span className="r-tab-icon">
            <Icon name={x.icon} size={22} />
            {x.key === 'orders' && badge > 0 && <motion.b key={badge} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={spring}>{badge}</motion.b>}
          </span>
          <span className="r-tab-label">{t(`tab.${x.key}`)}</span>
        </button>
      ))}
    </nav>
  );
}
