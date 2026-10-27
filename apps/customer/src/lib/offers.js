/** One-line description of a coupon: "20% off up to ₹100", "₹50 off", "Free delivery". */
export function offerLine(o, { tr, money }) {
  if (o.type === 'percent') return tr('{v}% off{max}', '{v}% தள்ளுபடி{max}', { v: o.value, max: o.maxDiscount ? tr(' up to {m}', ' ({m} வரை)', { m: money(o.maxDiscount) }) : '' });
  if (o.type === 'flat') return tr('{v} off', '{v} தள்ளுபடி', { v: money(o.value) });
  return tr('Free delivery', 'இலவச டெலிவரி');
}
