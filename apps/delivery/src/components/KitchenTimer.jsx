import { useLang } from '@velan/shared/i18n.jsx';
import { useNow } from '@velan/shared/hooks.js';
import { Icon } from '@velan/shared/components/Icon.jsx';

/** "Ready in 8 min" / "Packed — go pick up" / "Kitchen late by 3 min". */
export function kitchenState(order, now) {
  if (order.status === 'ready') return { tone: 'leaf', key: 'readyNow', icon: 'package' };
  if (order.status === 'placed') return { tone: 'muted', key: 'waitingKitchen', icon: 'clock' };
  if (!order.readyBy) return { tone: 'gold', key: 'waitingKitchen', icon: 'chefHat' };
  const mins = Math.round((new Date(order.readyBy) - now) / 60000);
  if (mins < 0) return { tone: 'maroon', key: 'overdue', n: -mins, icon: 'alert' };
  return { tone: 'gold', key: 'readyIn', n: Math.max(1, mins), icon: 'chefHat' };
}

export default function KitchenTimer({ order, big = false }) {
  const { t } = useLang();
  const now = useNow(10000);
  const k = kitchenState(order, now);
  return (
    <span className={`r-kitchen ${big ? 'big' : ''}`} data-tone={k.tone}>
      <Icon name={k.icon} size={big ? 20 : 15} />
      {t(k.key, { n: k.n })}
    </span>
  );
}
