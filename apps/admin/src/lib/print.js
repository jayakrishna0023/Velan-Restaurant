// 58 mm thermal bill, printed through a hidden iframe so the console stays put.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function printBill(order, settings, L) {
  const s = settings || {};
  const money = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const rows = order.items.map((i) => `
    <tr><td colspan="3" class="name">${esc(i.name)}${i.nameTa ? `<br><span class="ta">${esc(i.nameTa)}</span>` : ''}</td></tr>
    <tr><td>${i.qty} × ${money(i.price)}</td><td></td><td class="r">${money(i.qty * i.price)}</td></tr>`).join('');
  const b = order.bill;
  const line = (label, v, strong) => `<tr class="${strong ? 'strong' : ''}"><td colspan="2">${label}</td><td class="r">${v}</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>#${order.number}</title>
<style>
  @page { size: 58mm auto; margin: 2mm; }
  * { box-sizing: border-box; }
  body { width: 54mm; margin: 0 auto; font: 11px/1.35 'Courier New', monospace; color: #000; }
  h1 { font-size: 14px; margin: 0; text-align: center; }
  .c { text-align: center; } .r { text-align: right; } .ta { font-family: 'Noto Sans Tamil', sans-serif; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; } td { padding: 1px 0; vertical-align: top; }
  .name { padding-top: 4px; font-weight: bold; }
  hr { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
  .strong td { font-weight: bold; font-size: 13px; padding-top: 3px; }
  .big { font-size: 18px; font-weight: bold; text-align: center; letter-spacing: 1px; }
</style></head><body>
  <h1>${esc(s.name || 'Velan Biryani Center')}</h1>
  <div class="c ta">${esc(s.nameTa || '')}</div>
  <div class="c">${esc(s.address || '')}</div>
  ${s.phone ? `<div class="c">Ph: ${esc(s.phone)}</div>` : ''}
  ${s.gstin ? `<div class="c">GSTIN: ${esc(s.gstin)}</div>` : ''}
  ${s.fssai ? `<div class="c">FSSAI: ${esc(s.fssai)}</div>` : ''}
  <hr>
  <div class="big">#${order.number}</div>
  <div class="c">${esc(L.dateTime(order.createdAt))} · ${esc(L.t(`type.${order.type}`))} · ${esc(L.t(`source.${order.source}`))}</div>
  <div>${esc(order.customerName)}${order.phone ? ` · ${esc(order.phone)}` : ''}</div>
  ${order.address ? `<div>${esc(order.address.line)}${order.address.landmark ? `, ${esc(order.address.landmark)}` : ''}</div>` : ''}
  <hr>
  <table>${rows}</table>
  <hr>
  <table>
    ${line(L.t('bill.subtotal'), money(b.subtotal))}
    ${b.packing ? line(L.t('bill.packing'), money(b.packing)) : ''}
    ${order.type === 'delivery' ? line(L.t('bill.deliveryFee'), b.deliveryFee ? money(b.deliveryFee) : L.t('bill.free')) : ''}
    ${b.discount ? line(`${L.t('bill.discount')}${b.couponCode ? ` (${esc(b.couponCode)})` : ''}`, `-${money(b.discount)}`) : ''}
    ${b.tax ? line(L.t('bill.tax'), money(b.tax)) : ''}
    ${line(L.t('total'), money(b.total), true)}
  </table>
  <div>${esc(L.t(`pay.${order.payment.method}`))} · ${esc(L.t(order.payment.status === 'paid' ? 'pay.paid' : 'pay.pending'))}</div>
  ${order.notes ? `<hr><div>Note: ${esc(order.notes)}</div>` : ''}
  <hr>
  <div class="c">Thank you! · <span class="ta">நன்றி! மீண்டும் வருக</span></div>
</body></html>`;

  const frame = document.createElement('iframe');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  frame.srcdoc = html;
  frame.onload = () => {
    setTimeout(() => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 60_000);
    }, 250);
  };
  document.body.appendChild(frame);
}
