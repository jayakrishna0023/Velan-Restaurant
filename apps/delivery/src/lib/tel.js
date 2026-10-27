const intl = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `91${digits}` : digits;
};

/** tel: link for an Indian mobile number stored as 10 digits (or anything typed by staff). */
export function telHref(phone) {
  const n = intl(phone);
  return n ? `tel:+${n}` : undefined;
}

/** WhatsApp chat with a ready-typed message. */
export function waHref(phone, text) {
  const n = intl(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : undefined;
}
