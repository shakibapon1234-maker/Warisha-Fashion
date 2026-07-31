import { DB, brandName, customerName, supplierName } from './state.js';
import { taka, val, dateBn, emptyState } from './utils.js';

/* ============================================================ REPORTS */
export function renderReport() {
  const from = val('repFrom') || '0000-00-00'; const to = val('repTo') || '9999-99-99';
  const inRange = d => d >= from && d <= to;

  const sales = DB.sales.filter(s => inRange(s.date));
  const purchases = DB.purchases.filter(p => inRange(p.date));
  const expenses = DB.expenses.filter(e => inRange(e.date));
  const custPay = DB.payments_customer.filter(p => inRange(p.date));
  const supPay = DB.payments_supplier.filter(p => inRange(p.date));
  const invest = DB.investments.filter(i => inRange(i.date));
  const custAdv = DB.advances_customer.filter(a => inRange(a.date));
  const supAdv = DB.advances_supplier.filter(a => inRange(a.date));

  const totalIn = sales.reduce((s, x) => s + x.paid, 0) + custPay.reduce((s, x) => s + x.amount, 0) + invest.reduce((s, x) => s + x.amount, 0) + custAdv.reduce((s, x) => s + x.amount, 0);
  const totalOut = purchases.reduce((s, x) => s + x.paid, 0) + expenses.reduce((s, x) => s + x.amount, 0) + supPay.reduce((s, x) => s + x.amount, 0) + supAdv.reduce((s, x) => s + x.amount, 0);

  document.getElementById('reportCards').innerHTML = `
    <div class="card in"><div class="label">ঢুকেছে</div><div class="value num">${taka(totalIn)}</div></div>
    <div class="card out"><div class="label">বেরিয়েছে</div><div class="value num">${taka(totalOut)}</div></div>
    <div class="card cash"><div class="label">নিট</div><div class="value num">${taka(totalIn - totalOut)}</div></div>`;

  const rows = [
    ...sales.map(x => ({ date: x.date, type: `বিক্রয় (${x.sale_type === 'wholesale' ? 'পাইকারি' : 'খুচরা'})`, desc: customerName(x.customer_id), amt: x.paid, dir: 'in' })),
    ...custPay.map(x => ({ date: x.date, type: 'বকেয়া আদায়', desc: customerName(x.customer_id), amt: x.amount, dir: 'in' })),
    ...invest.map(x => ({ date: x.date, type: 'ইনভেস্টমেন্ট', desc: x.person, amt: x.amount, dir: 'in' })),
    ...custAdv.map(x => ({ date: x.date, type: 'গ্রাহক অগ্রিম', desc: customerName(x.customer_id), amt: x.amount, dir: 'in' })),
    ...purchases.map(x => ({ date: x.date, type: `ক্রয় (${brandName(x.brand_id)})`, desc: supplierName(x.supplier_id), amt: x.paid, dir: 'out' })),
    ...expenses.map(x => ({ date: x.date, type: 'খরচ', desc: x.category, amt: x.amount, dir: 'out' })),
    ...supPay.map(x => ({ date: x.date, type: 'সাপ্লায়ার দেনা পরিশোধ', desc: supplierName(x.supplier_id), amt: x.amount, dir: 'out' })),
    ...supAdv.map(x => ({ date: x.date, type: 'সাপ্লায়ার অগ্রিম', desc: supplierName(x.supplier_id), amt: x.amount, dir: 'out' })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const wrap = document.getElementById('reportTable');
  wrap.innerHTML = rows.length ? `
    <table><thead><tr><th>তারিখ</th><th>ধরন</th><th>বিবরণ</th><th>টাকা</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${dateBn(r.date)}</td><td>${r.type}</td><td>${r.desc}</td>
      <td class="num" style="color:${r.dir === 'in' ? 'var(--success)' : 'var(--danger)'};font-weight:700;">${r.dir === 'in' ? '+' : '-'}${taka(r.amt)}</td></tr>`).join('')}</tbody></table>`
    : emptyState('কোনো লেনদেন পাওয়া যায়নি', 'তারিখের রেঞ্জ পরিবর্তন করে দেখুন');
}

window.renderReport = renderReport;
