// Human sentences for audit-log entries, in English or Tamil.

const ICON = {
  order: 'receipt', menu: 'utensils', category: 'list', coupon: 'ticket', rider: 'scooter',
  settings: 'sliders', store: 'store', review: 'message',
};
const TONE = {
  'order.placed': 'saffron', 'order.delivered': 'leaf', 'order.rejected': 'maroon', 'order.cancelled': 'maroon',
  'order.rated': 'gold', 'rider.settled': 'leaf', 'store.paused': 'maroon', 'store.open': 'leaf', 'menu.restock': 'leaf',
};

export function activityMeta(a) {
  return { icon: ICON[a.kind.split('.')[0]] || 'activity', tone: TONE[a.kind] || 'muted' };
}

export function activityText(a, L) {
  const { tr, money, t } = L;
  const d = a.data || {};
  const who = a.actor?.name || tr('Customer', 'வாடிக்கையாளர்');
  const n = d.number ? `#${d.number}` : '';
  switch (a.kind) {
    case 'order.placed': return d.source === 'online'
      ? tr(`New order ${n} · ${money(d.total)} from ${d.customer}`, `புதிய ஆர்டர் ${n} · ${money(d.total)} — ${d.customer}`)
      : tr(`Counter order ${n} · ${money(d.total)}`, `கவுண்டர் ஆர்டர் ${n} · ${money(d.total)}`);
    case 'order.accepted': return tr(`${n} accepted by ${who}`, `${n} — ${who} ஏற்றார்`);
    case 'order.preparing': return tr(`${n} is cooking`, `${n} சமைக்கப்படுகிறது`);
    case 'order.ready': return tr(`${n} is packed and ready`, `${n} தயார்`);
    case 'order.out_for_delivery': return tr(`${n} picked up by ${who}`, `${n} — ${who} எடுத்துச் சென்றார்`);
    case 'order.delivered': return tr(`${n} delivered`, `${n} டெலிவரி ஆனது`);
    case 'order.rejected': return tr(`${n} rejected${d.reason ? `: ${d.reason}` : ''}`, `${n} நிராகரிக்கப்பட்டது${d.reason ? `: ${d.reason}` : ''}`);
    case 'order.cancelled': return tr(`${n} cancelled by ${who}`, `${n} — ${who} ரத்து செய்தார்`);
    case 'order.assigned': return tr(`${n} assigned to ${d.rider}${d.auto ? ' (auto)' : ''}`, `${n} — ${d.rider}க்கு ஒதுக்கப்பட்டது${d.auto ? ' (தானாக)' : ''}`);
    case 'order.unassigned': return tr(`${n} rider removed`, `${n} டெலிவரி பார்ட்னர் நீக்கப்பட்டார்`);
    case 'order.paid': return tr(`${n} marked paid · ${money(d.total)}`, `${n} செலுத்தப்பட்டது · ${money(d.total)}`);
    case 'order.rated': return tr(`${n} rated ${d.food}★ by ${who}`, `${n} — ${who} ${d.food}★ மதிப்பிட்டார்`);
    case 'menu.create': return tr(`Added ${d.name} to the menu`, `${d.name} மெனுவில் சேர்க்கப்பட்டது`);
    case 'menu.update': return tr(`Updated ${d.name}`, `${d.name} புதுப்பிக்கப்பட்டது`);
    case 'menu.price': return tr(`${d.name}: price ${money(d.from)} → ${money(d.to)}`, `${d.name}: விலை ${money(d.from)} → ${money(d.to)}`);
    case 'menu.delete': return tr(`Removed ${d.name}`, `${d.name} நீக்கப்பட்டது`);
    case 'menu.bulk': return tr(`Updated ${d.count} dishes`, `${d.count} உணவுகள் புதுப்பிக்கப்பட்டன`);
    case 'menu.restock': return tr("Today's stock was reset", 'இன்றைய இருப்பு மீட்டமைக்கப்பட்டது');
    case 'category.create': case 'category.update': return tr(`Category ${d.name} saved`, `${d.name} பிரிவு சேமிக்கப்பட்டது`);
    case 'category.delete': return tr(`Category ${d.name} deleted`, `${d.name} பிரிவு நீக்கப்பட்டது`);
    case 'coupon.create': case 'coupon.update': return tr(`Coupon ${d.code} saved`, `${d.code} கூப்பன் சேமிக்கப்பட்டது`);
    case 'coupon.delete': return tr(`Coupon ${d.code} deleted`, `${d.code} கூப்பன் நீக்கப்பட்டது`);
    case 'rider.online': return tr(`${who} is online`, `${who} ஆன்லைனில்`);
    case 'rider.offline': return tr(`${who} went offline`, `${who} ஆஃப்லைன்`);
    case 'rider.create': return tr(`${d.name} joined the delivery team`, `${d.name} டெலிவரி குழுவில் சேர்ந்தார்`);
    case 'rider.update': return tr(`${d.name}'s profile updated`, `${d.name} விவரம் புதுப்பிக்கப்பட்டது`);
    case 'rider.settled': return tr(`${d.name} settled ${money(d.amount)} cash`, `${d.name} ${money(d.amount)} ரொக்கம் செட்டில் செய்தார்`);
    case 'settings.update': return tr('Settings updated', 'அமைப்புகள் புதுப்பிக்கப்பட்டன');
    case 'store.open': return tr('Store opened for orders', 'ஆர்டர்களுக்காக கடை திறக்கப்பட்டது');
    case 'store.paused': return tr('Orders paused', 'ஆர்டர்கள் நிறுத்தப்பட்டன');
    case 'review.update': return tr(`Review on ${n} updated`, `${n} மதிப்புரை புதுப்பிக்கப்பட்டது`);
    default: return t(a.kind);
  }
}
