import { DB, brandName, customerName, supplierName } from './state.js';
import { taka, dateBn, todayISO, emptyState, escapeHTML } from './utils.js';
import { runSyncGuardAudit } from './backup-sync.js';

/* ============================================================ DASHBOARD */
/* payment_method অনুযায়ী একটা array থেকে amount filter করার helper */
function sumByMethod(arr, method, amtKey = 'amount') {
  return arr.filter(x => x.payment_method === method).reduce((s, x) => s + (x[amtKey] || 0), 0);
}

export function computeTotals() {
  const salesPaid = DB.sales.reduce((s, x) => s + x.paid, 0);
  const custDuePayments = DB.payments_customer.reduce((s, x) => s + x.amount, 0);
  const investTotal = DB.investments.reduce((s, x) => s + x.amount, 0);
  const custAdvReceived = DB.advances_customer.reduce((s, x) => s + x.amount, 0);
  const purchasePaid = DB.purchases.reduce((s, x) => s + x.paid, 0);
  const expenseTotal = DB.expenses.reduce((s, x) => s + x.amount, 0);
  const supAdvGiven = DB.advances_supplier.reduce((s, x) => s + x.amount, 0);
  const supDuePayments = DB.payments_supplier.reduce((s, x) => s + x.amount, 0);

  // নোট: ছাড় (discount) প্রকৃত ক্যাশ নয় — ক্রয়/বিক্রয়ের সময় total থেকে ছাড় বাদ দিয়েই
  // paid ও due হিসাব হয় (দেখুন purchases.js/sales.js এর afterDiscount)। তাই এখানে
  // discount কে আলাদা করে ক্যাশ ইন/আউটে যোগ করলে ডাবল-কাউন্ট হয়ে যায় — তাই বাদ দেওয়া হলো।
  const totalIn = salesPaid + custDuePayments + investTotal + custAdvReceived;
  const totalOut = purchasePaid + expenseTotal + supAdvGiven + supDuePayments;
  const custDue = DB.customers.reduce((s, c) => s + c.due, 0);
  const supDue = DB.suppliers.reduce((s, x) => s + x.due, 0);
  const custAdvBalance = DB.customers.reduce((s, c) => s + c.advance, 0);
  const supAdvBalance = DB.suppliers.reduce((s, x) => s + x.advance, 0);
  const stockValue = DB.products.reduce((s, p) => s + p.qty * p.buy_price, 0);

  // প্রতিটি মাধ্যম অনুযায়ী মোট ঢুকেছে (IN)
  const allIn = [
    ...DB.sales.map(x=>({...x,amount:x.paid})),
    ...DB.payments_customer,
    ...DB.investments,
    ...DB.advances_customer,
  ];
  // প্রতিটি মাধ্যম অনুযায়ী মোট বেরিয়েছে (OUT)
  const allOut = [
    ...DB.purchases.map(x=>({...x,amount:x.paid})),
    ...DB.expenses,
    ...DB.advances_supplier,
    ...DB.payments_supplier,
  ];

  const cashBalance   = sumByMethod(allIn,'cash')   - sumByMethod(allOut,'cash');
  const bankBalance   = sumByMethod(allIn,'bank')   - sumByMethod(allOut,'bank');
  const mobileBalance = sumByMethod(allIn,'mobile_banking') - sumByMethod(allOut,'mobile_banking');
  const totalBalance  = cashBalance + bankBalance + mobileBalance;

  return { totalIn, totalOut, cash: totalIn - totalOut, custDue, supDue, stockValue, investTotal, custAdvBalance, supAdvBalance,
           cashBalance, bankBalance, mobileBalance, totalBalance };
}

export function renderDashboard() {
  const t = computeTotals();
  document.getElementById('todayLabel').textContent = dateBn(todayISO());
  document.getElementById('dashIn').textContent = taka(t.totalIn);
  document.getElementById('dashOut').textContent = taka(t.totalOut);
  document.getElementById('dashCash').textContent = taka(t.totalBalance);
  document.getElementById('dashCashCash').textContent = taka(t.cashBalance);
  document.getElementById('dashCashBank').textContent = taka(t.bankBalance);
  document.getElementById('dashCashMobile').textContent = taka(t.mobileBalance);
  document.getElementById('dashCustDue').textContent = taka(t.custDue);
  document.getElementById('dashSupDue').textContent = taka(t.supDue);
  document.getElementById('dashStock').textContent = taka(t.stockValue);
  document.getElementById('dashInvest').textContent = taka(t.investTotal);
  document.getElementById('dashCustAdv').textContent = taka(t.custAdvBalance);
  document.getElementById('dashSupAdv').textContent = taka(t.supAdvBalance);

  const syncWrap = document.getElementById('dashSyncGuardWrap');
  if (syncWrap) {
    const audit = runSyncGuardAudit();
    if (!audit.isHealthy) {
      syncWrap.style.display = 'block';
      syncWrap.innerHTML = `
        <div style="background:var(--danger-bg);color:var(--danger);border:1px solid var(--danger);border-radius:10px;padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;font-size:13px;">
          <span>⚠️ <b>সিঙ্ক ওয়ার্নিং:</b> হিসাবের জায়গায় ${audit.issuesCount} টি অমিল পাওয়া গেছে।</span>
          <button class="btn btn-gold btn-sm" onclick="fixSyncGuardDiscrepancies()">🔄 রিক্যালকুলেট ও ফিক্স করুন</button>
        </div>`;
    } else {
      syncWrap.style.display = 'none';
    }
  }

  const low = DB.products.filter(p => p.qty <= 3);
  document.getElementById('lowStockList').innerHTML = low.length ? low.map(p => {
    const meta = [p.color, p.size].filter(Boolean).join(', ');
    const metaStr = meta ? ` (${escapeHTML(meta)})` : '';
    return `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13.5px;">
      <span>${escapeHTML(p.name)} — ${escapeHTML(brandName(p.brand_id))}${metaStr}</span>
      <span class="tag low">মাত্র ${p.qty} পিস</span>
    </div>`;
  }).join('') : `<div class="helper">সব প্রোডাক্টের স্টক ঠিক আছে।</div>`;

  const recents = [
    ...DB.sales.map(x => ({ date: x.date, text: `বিক্রয় (${x.sale_type === 'wholesale' ? 'পাইকারি' : 'খুচরা'}) — ${escapeHTML(customerName(x.customer_id))}`, amount: x.paid, dir: 'in' })),
    ...DB.payments_customer.map(x => ({ date: x.date, text: `বকেয়া আদায় — ${escapeHTML(customerName(x.customer_id))}`, amount: x.amount, dir: 'in' })),
    ...DB.investments.map(x => ({ date: x.date, text: `ইনভেস্টমেন্ট — ${escapeHTML(x.person)}`, amount: x.amount, dir: 'in' })),
    ...DB.advances_customer.map(x => ({ date: x.date, text: `গ্রাহক অগ্রিম — ${escapeHTML(customerName(x.customer_id))}`, amount: x.amount, dir: 'in' })),
    ...DB.purchases.map(x => ({ date: x.date, text: `ক্রয় (${escapeHTML(brandName(x.brand_id))}) — ${escapeHTML(supplierName(x.supplier_id))}`, amount: x.paid, dir: 'out' })),
    ...DB.expenses.map(x => ({ date: x.date, text: `খরচ — ${escapeHTML(x.category)}`, amount: x.amount, dir: 'out' })),
    ...DB.payments_supplier.map(x => ({ date: x.date, text: `সাপ্লায়ার বকেয়া পরিশোধ — ${escapeHTML(supplierName(x.supplier_id))}`, amount: x.amount, dir: 'out' })),
    ...DB.advances_supplier.map(x => ({ date: x.date, text: `সাপ্লায়ার অগ্রিম — ${escapeHTML(supplierName(x.supplier_id))}`, amount: x.amount, dir: 'out' })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  document.getElementById('recentList').innerHTML = recents.length ? recents.map(r => `
    <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:13.5px;">
      <span>${escapeHTML(r.text)}<br><span class="helper">${dateBn(r.date)}</span></span>
      <span class="num" style="color:${r.dir === 'in' ? 'var(--success)' : 'var(--danger)'};font-weight:700;">${r.dir === 'in' ? '+' : '-'}${taka(r.amount)}</span>
    </div>`).join('') : emptyState('এখনো কোনো লেনদেন নেই', '');
}
