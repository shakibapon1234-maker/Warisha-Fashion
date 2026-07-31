import { DB, brandName, customerName, supplierName } from './state.js';
import { taka, dateBn, todayISO, emptyState } from './utils.js';

/* ============================================================ DASHBOARD */
export function computeTotals() {
  const salesPaid = DB.sales.reduce((s, x) => s + x.paid, 0);
  const custDuePayments = DB.payments_customer.reduce((s, x) => s + x.amount, 0);
  const investTotal = DB.investments.reduce((s, x) => s + x.amount, 0);
  const custAdvReceived = DB.advances_customer.reduce((s, x) => s + x.amount, 0);
  const purchasePaid = DB.purchases.reduce((s, x) => s + x.paid, 0);
  const expenseTotal = DB.expenses.reduce((s, x) => s + x.amount, 0);
  const supAdvGiven = DB.advances_supplier.reduce((s, x) => s + x.amount, 0);
  const supDuePayments = DB.payments_supplier.reduce((s, x) => s + x.amount, 0);

  const totalIn = salesPaid + custDuePayments + investTotal + custAdvReceived;
  const totalOut = purchasePaid + expenseTotal + supAdvGiven + supDuePayments;
  const custDue = DB.customers.reduce((s, c) => s + c.due, 0);
  const supDue = DB.suppliers.reduce((s, x) => s + x.due, 0);
  const custAdvBalance = DB.customers.reduce((s, c) => s + c.advance, 0);
  const supAdvBalance = DB.suppliers.reduce((s, x) => s + x.advance, 0);
  const stockValue = DB.products.reduce((s, p) => s + p.qty * p.buy_price, 0);
  return { totalIn, totalOut, cash: totalIn - totalOut, custDue, supDue, stockValue, investTotal, custAdvBalance, supAdvBalance };
}

export function renderDashboard() {
  const t = computeTotals();
  document.getElementById('todayLabel').textContent = dateBn(todayISO());
  document.getElementById('dashIn').textContent = taka(t.totalIn);
  document.getElementById('dashOut').textContent = taka(t.totalOut);
  document.getElementById('dashCash').textContent = taka(t.cash);
  document.getElementById('dashCustDue').textContent = taka(t.custDue);
  document.getElementById('dashSupDue').textContent = taka(t.supDue);
  document.getElementById('dashStock').textContent = taka(t.stockValue);
  document.getElementById('dashInvest').textContent = taka(t.investTotal);
  document.getElementById('dashCustAdv').textContent = taka(t.custAdvBalance);
  document.getElementById('dashSupAdv').textContent = taka(t.supAdvBalance);

  const low = DB.products.filter(p => p.qty <= 3);
  document.getElementById('lowStockList').innerHTML = low.length ? low.map(p => `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13.5px;">
      <span>${p.name} — ${brandName(p.brand_id)} (${p.color}, ${p.size})</span>
      <span class="tag low">মাত্র ${p.qty} পিস</span>
    </div>`).join('') : `<div class="helper">সব প্রোডাক্টের স্টক ঠিক আছে।</div>`;

  const recents = [
    ...DB.sales.map(x => ({ date: x.date, text: `বিক্রয় (${x.sale_type === 'wholesale' ? 'পাইকারি' : 'খুচরা'}) — ${customerName(x.customer_id)}`, amount: x.paid, dir: 'in' })),
    ...DB.payments_customer.map(x => ({ date: x.date, text: `বকেয়া আদায় — ${customerName(x.customer_id)}`, amount: x.amount, dir: 'in' })),
    ...DB.investments.map(x => ({ date: x.date, text: `ইনভেস্টমেন্ট — ${x.person}`, amount: x.amount, dir: 'in' })),
    ...DB.advances_customer.map(x => ({ date: x.date, text: `গ্রাহক অগ্রিম — ${customerName(x.customer_id)}`, amount: x.amount, dir: 'in' })),
    ...DB.purchases.map(x => ({ date: x.date, text: `ক্রয় (${brandName(x.brand_id)}) — ${supplierName(x.supplier_id)}`, amount: x.paid, dir: 'out' })),
    ...DB.expenses.map(x => ({ date: x.date, text: `খরচ — ${x.category}`, amount: x.amount, dir: 'out' })),
    ...DB.payments_supplier.map(x => ({ date: x.date, text: `সাপ্লায়ার বকেয়া পরিশোধ — ${supplierName(x.supplier_id)}`, amount: x.amount, dir: 'out' })),
    ...DB.advances_supplier.map(x => ({ date: x.date, text: `সাপ্লায়ার অগ্রিম — ${supplierName(x.supplier_id)}`, amount: x.amount, dir: 'out' })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  document.getElementById('recentList').innerHTML = recents.length ? recents.map(r => `
    <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:13.5px;">
      <span>${r.text}<br><span class="helper">${dateBn(r.date)}</span></span>
      <span class="num" style="color:${r.dir === 'in' ? 'var(--success)' : 'var(--danger)'};font-weight:700;">${r.dir === 'in' ? '+' : '-'}${taka(r.amount)}</span>
    </div>`).join('') : emptyState('এখনো কোনো লেনদেন নেই', '');
}
