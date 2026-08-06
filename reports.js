import { DB, brandName, customerName, supplierName } from './state.js';
import { taka, val, dateBn, todayISO, emptyState } from './utils.js';
import { paymentMethodDisplay } from './payment-accounts.js';
import { downloadCSV, printSection } from './export.js';

/* ============================================================ REPORTS & EXPORT */

export function setQuickDate(preset) {
  const fromEl = document.getElementById('repFrom');
  const toEl = document.getElementById('repTo');
  if (!fromEl || !toEl) return;

  const today = new Date();
  const iso = d => d.toISOString().split('T')[0];

  if (preset === 'today') {
    fromEl.value = iso(today);
    toEl.value = iso(today);
  } else if (preset === 'yesterday') {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    fromEl.value = iso(y);
    toEl.value = iso(y);
  } else if (preset === 'this_week') {
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(today.setDate(diff));
    fromEl.value = iso(startOfWeek);
    toEl.value = iso(new Date());
  } else if (preset === 'this_month') {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    fromEl.value = iso(startOfMonth);
    toEl.value = iso(new Date());
  } else if (preset === 'all') {
    fromEl.value = '';
    toEl.value = '';
  }
  renderReport();
}

let cachedReportRows = [];
let cachedReportSummary = { totalIn: 0, totalOut: 0, net: 0, fromStr: '', toStr: '' };

export function renderReport() {
  const from = val('repFrom') || '0000-00-00';
  const to = val('repTo') || '9999-99-99';
  const inRange = d => d >= from && d <= to;

  const sales = DB.sales.filter(s => inRange(s.date));
  const purchases = DB.purchases.filter(p => inRange(p.date));
  const expenses = DB.expenses.filter(e => inRange(e.date));
  const custPay = DB.payments_customer.filter(p => inRange(p.date));
  const supPay = DB.payments_supplier.filter(p => inRange(p.date));
  const invest = DB.investments.filter(i => inRange(i.date));
  const custAdv = DB.advances_customer.filter(a => inRange(a.date));
  const supAdv = DB.advances_supplier.filter(a => inRange(a.date));

  const totalIn = sales.reduce((s, x) => s + x.paid, 0)
    + custPay.reduce((s, x) => s + x.amount, 0)
    + invest.reduce((s, x) => s + x.amount, 0)
    + custAdv.reduce((s, x) => s + x.amount, 0)
    + purchases.reduce((s, x) => s + (x.discount || 0), 0); // ক্রয় ছাড় = ক্যাশ ইন
  const totalOut = purchases.reduce((s, x) => s + x.paid, 0)
    + expenses.reduce((s, x) => s + x.amount, 0)
    + supPay.reduce((s, x) => s + x.amount, 0)
    + supAdv.reduce((s, x) => s + x.amount, 0)
    + sales.reduce((s, x) => s + (x.discount || 0), 0); // বিক্রয় ছাড় = ক্যাশ আউট
  const net = totalIn - totalOut;

  cachedReportSummary = {
    totalIn, totalOut, net,
    fromStr: val('repFrom') ? dateBn(val('repFrom')) : 'শুরু থেকে',
    toStr: val('repTo') ? dateBn(val('repTo')) : 'আজ পর্যন্ত'
  };

  const cardsWrap = document.getElementById('reportCards');
  if (cardsWrap) {
    cardsWrap.innerHTML = `
      <div class="card in"><div class="label">মোট ঢুকেছে (ক্যাশ ইন)</div><div class="value num">${taka(totalIn)}</div></div>
      <div class="card out"><div class="label">মোট বেরিয়েছে (ক্যাশ আউট)</div><div class="value num">${taka(totalOut)}</div></div>
      <div class="card cash"><div class="label">নিট কায়িক জমা (ক্যাশ ব্যালেন্স)</div><div class="value num" style="color:${net >= 0 ? 'var(--gold-300)' : 'var(--danger)'};">${taka(net)}</div></div>`;
  }

  const rows = [
    ...sales.map(x => ({ date: x.date, type: `বিক্রয় (${x.sale_type === 'wholesale' ? 'পাইকারি' : 'খুচরা'})`, desc: customerName(x.customer_id), amt: x.paid, dir: 'in', method: paymentMethodDisplay(x.payment_method, x.payment_account_id) })),
    ...custPay.map(x => ({ date: x.date, type: 'বকেয়া আদায়', desc: customerName(x.customer_id), amt: x.amount, dir: 'in', method: paymentMethodDisplay(x.payment_method, x.payment_account_id) })),
    ...invest.map(x => ({ date: x.date, type: 'ইনভেস্টমেন্ট', desc: x.person, amt: x.amount, dir: 'in', method: paymentMethodDisplay(x.payment_method, x.payment_account_id) })),
    ...custAdv.map(x => ({ date: x.date, type: 'গ্রাহক অগ্রিম', desc: customerName(x.customer_id), amt: x.amount, dir: 'in', method: paymentMethodDisplay(x.payment_method, x.payment_account_id) })),
    // ক্রয়ে পাওয়া ছাড় → ক্যাশ ইন
    ...purchases.filter(x => (x.discount||0) > 0).map(x => ({ date: x.date, type: 'ক্রয় ছাড় (সাপ্লায়ার দিয়েছে)', desc: supplierName(x.supplier_id), amt: x.discount, dir: 'in', method: paymentMethodDisplay(x.payment_method, x.payment_account_id) })),
    ...purchases.map(x => ({ date: x.date, type: `ক্রয় (${brandName(x.brand_id)})`, desc: supplierName(x.supplier_id), amt: x.paid, dir: 'out', method: paymentMethodDisplay(x.payment_method, x.payment_account_id) })),
    ...expenses.map(x => ({ date: x.date, type: 'খরচ', desc: x.category, amt: x.amount, dir: 'out', method: paymentMethodDisplay(x.payment_method, x.payment_account_id) })),
    ...supPay.map(x => ({ date: x.date, type: 'সাপ্লায়ার দেনা পরিশোধ', desc: supplierName(x.supplier_id), amt: x.amount, dir: 'out', method: paymentMethodDisplay(x.payment_method, x.payment_account_id) })),
    ...supAdv.map(x => ({ date: x.date, type: 'সাপ্লায়ার অগ্রিম', desc: supplierName(x.supplier_id), amt: x.amount, dir: 'out', method: paymentMethodDisplay(x.payment_method, x.payment_account_id) })),
    // বিক্রয়ে দেওয়া ছাড় → ক্যাশ আউট
    ...sales.filter(x => (x.discount||0) > 0).map(x => ({ date: x.date, type: 'বিক্রয় ছাড় (কাস্টমারকে দেওয়া)', desc: customerName(x.customer_id), amt: x.discount, dir: 'out', method: paymentMethodDisplay(x.payment_method, x.payment_account_id) })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  cachedReportRows = rows;

  const wrap = document.getElementById('reportTable');
  if (wrap) {
    wrap.innerHTML = rows.length ? `
      <table><thead><tr><th>তারিখ</th><th>ধরন</th><th>বিবরণ</th><th>পেমেন্ট মাধ্যম</th><th>টাকা</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${dateBn(r.date)}</td><td>${r.type}</td><td>${r.desc}</td>
        <td><span class="tag ${r.dir === 'in' ? 'cash' : 'bank'}">${r.method}</span></td>
        <td class="num" style="color:${r.dir === 'in' ? 'var(--success)' : 'var(--danger)'};font-weight:700;">${r.dir === 'in' ? '+' : '-'}${taka(r.amt)}</td>
      </tr>`).join('')}</tbody></table>`
      : emptyState('কোনো লেনদেন পাওয়া যায়নি', 'তারিখের রেঞ্জ পরিবর্তন করে দেখুন');
  }
}

export function exportReportPDF() {
  if (!cachedReportRows.length) { alert('প্রিন্ট করার জন্য কোনো লেনদেন পাওয়া যায়নি'); return; }
  const rangeStr = `${cachedReportSummary.fromStr} হতে ${cachedReportSummary.toStr}`;
  const cardsHtml = `
    <div class="card"><div class="lbl">মোট ঢুকেছে (ক্যাশ ইন)</div><div class="val">${taka(cachedReportSummary.totalIn)}</div></div>
    <div class="card"><div class="lbl">মোট বেরিয়েছিল (ক্যাশ আউট)</div><div class="val">${taka(cachedReportSummary.totalOut)}</div></div>
    <div class="card"><div class="lbl">নিট ব্যালেন্স</div><div class="val">${taka(cachedReportSummary.net)}</div></div>`;
  const headerHtml = `<tr><th>তারিখ</th><th>ধরন</th><th>বিবরণ</th><th>পেমেন্ট মাধ্যম</th><th class="num">পরিমাণ</th></tr>`;
  const bodyHtml = cachedReportRows.map(r => `
    <tr>
      <td>${dateBn(r.date)}</td><td>${r.type}</td><td>${r.desc}</td><td>${r.method}</td>
      <td class="num" style="color:${r.dir === 'in' ? '#2F7A4F' : '#B23A3A'};font-weight:700;">${r.dir === 'in' ? '+' : '-'}${taka(r.amt)}</td>
    </tr>`).join('');

  printSection('হিসাবের সামারি রিপোর্ট', rangeStr, cardsHtml, headerHtml, bodyHtml);
}

export function exportReportExcel() {
  if (!cachedReportRows.length) { alert('ডাউনলোড করার জন্য কোনো লেনদেন পাওয়া যায়নি'); return; }
  const headers = ['তারিখ', 'ধরন', 'বিবরণ', 'পেমেন্ট মাধ্যম', 'লেনদেনের দিক', 'পরিমাণ (টাকা)'];
  const rows = cachedReportRows.map(r => [
    r.date, r.type, r.desc, r.method, r.dir === 'in' ? 'ইন (+)' : 'আউট (-)', r.amt
  ]);
  downloadCSV(`warisha_report_${todayISO()}.csv`, headers, rows);
}

/* Module Specific Exports */
export function exportPurchasesExcel() {
  if (!DB.purchases.length) { alert('ডাউনলোড করার জন্য কোনো ক্রয় পাওয়া যায়নি'); return; }
  const headers = ['তারিখ', 'মেমো নম্বর', 'ব্র্যান্ড', 'সাপ্লায়ার/সোর্স', 'প্রোডাক্টসমূহ', 'মোট টাকা', 'পেইড টাকা', 'বাকি টাকা', 'পেমেন্ট মাধ্যম'];
  const rows = DB.purchases.map(p => [
    p.date, p.memo_no || '', brandName(p.brand_id), supplierName(p.supplier_id),
    p.items.map(i => `${i.name} x ${i.qty}`).join('; '), p.total, p.paid, p.due,
    paymentMethodDisplay(p.payment_method, p.payment_account_id)
  ]);
  downloadCSV(`purchases_${todayISO()}.csv`, headers, rows);
}

export function exportPurchasesPDF() {
  if (!DB.purchases.length) { alert('প্রিন্ট করার জন্য কোনো ক্রয় পাওয়া যায়নি'); return; }
  const headerHtml = `<tr><th>তারিখ</th><th>মেমো</th><th>ব্র্যান্ড</th><th>সাপ্লায়ার</th><th>প্রোডাক্ট</th><th class="num">মোট</th><th class="num">পেইড</th><th>মাধ্যম</th><th class="num">বাকি</th></tr>`;
  const bodyHtml = DB.purchases.map(p => `
    <tr>
      <td>${dateBn(p.date)}</td><td>${p.memo_no || '-'}</td><td>${brandName(p.brand_id)}</td><td>${supplierName(p.supplier_id)}</td>
      <td>${p.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</td>
      <td class="num">${taka(p.total)}</td><td class="num">${taka(p.paid)}</td>
      <td>${paymentMethodDisplay(p.payment_method, p.payment_account_id)}</td><td class="num">${taka(p.due)}</td>
    </tr>`).join('');
  printSection('ক্রয় হিসাব রিপোর্ট', '', '', headerHtml, bodyHtml);
}

export function exportSalesExcel() {
  if (!DB.sales.length) { alert('ডাউনলোড করার জন্য কোনো বিক্রয় পাওয়া যায়নি'); return; }
  const headers = ['তারিখ', 'মেমো নম্বর', 'বিক্রয়ের ধরন', 'কাস্টমার', 'প্রোডাক্টসমূহ', 'মোট টাকা', 'পেইড টাকা', 'বাকি টাকা', 'পেমেন্ট মাধ্যম'];
  const rows = DB.sales.map(s => [
    s.date, s.memo_no || '', s.sale_type === 'wholesale' ? 'পাইকারি' : 'খুচরা', customerName(s.customer_id),
    s.items.map(i => `${i.name} x ${i.qty}`).join('; '), s.total, s.paid, s.due,
    paymentMethodDisplay(s.payment_method, s.payment_account_id)
  ]);
  downloadCSV(`sales_${todayISO()}.csv`, headers, rows);
}

export function exportSalesPDF() {
  if (!DB.sales.length) { alert('প্রিন্ট করার জন্য কোনো বিক্রয় পাওয়া যায়নি'); return; }
  const headerHtml = `<tr><th>তারিখ</th><th>মেমো</th><th>ধরন</th><th>কাস্টমার</th><th>প্রোডাক্ট</th><th class="num">মোট</th><th class="num">পেইড</th><th>মাধ্যম</th><th class="num">বাকি</th></tr>`;
  const bodyHtml = DB.sales.map(s => `
    <tr>
      <td>${dateBn(s.date)}</td><td>${s.memo_no || '-'}</td><td>${s.sale_type === 'wholesale' ? 'পাইকারি' : 'খুচরা'}</td><td>${customerName(s.customer_id)}</td>
      <td>${s.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</td>
      <td class="num">${taka(s.total)}</td><td class="num">${taka(s.paid)}</td>
      <td>${paymentMethodDisplay(s.payment_method, s.payment_account_id)}</td><td class="num">${taka(s.due)}</td>
    </tr>`).join('');
  printSection('বিক্রয় হিসাব রিপোর্ট', '', '', headerHtml, bodyHtml);
}

export function exportExpensesExcel() {
  if (!DB.expenses.length) { alert('ডাউনলোড করার জন্য কোনো খরচ পাওয়া যায়নি'); return; }
  const headers = ['তারিখ', 'খাত', 'নোট', 'টাকা', 'পেমেন্ট মাধ্যম'];
  const rows = DB.expenses.map(e => [
    e.date, e.category, e.note || '', e.amount, paymentMethodDisplay(e.payment_method, e.payment_account_id)
  ]);
  downloadCSV(`expenses_${todayISO()}.csv`, headers, rows);
}

export function exportExpensesPDF() {
  if (!DB.expenses.length) { alert('প্রিন্ট করার জন্য কোনো খরচ পাওয়া যায়নি'); return; }
  const headerHtml = `<tr><th>তারিখ</th><th>খাত</th><th>নোট</th><th class="num">টাকা</th><th>পেমেন্ট মাধ্যম</th></tr>`;
  const bodyHtml = DB.expenses.map(e => `
    <tr>
      <td>${dateBn(e.date)}</td><td>${e.category}</td><td>${e.note || '-'}</td>
      <td class="num">${taka(e.amount)}</td><td>${paymentMethodDisplay(e.payment_method, e.payment_account_id)}</td>
    </tr>`).join('');
  printSection('দোকানের খরচ রিপোর্ট', '', '', headerHtml, bodyHtml);
}

window.renderReport = renderReport;
window.setQuickDate = setQuickDate;
window.exportReportPDF = exportReportPDF;
window.exportReportExcel = exportReportExcel;
window.exportPurchasesExcel = exportPurchasesExcel;
window.exportPurchasesPDF = exportPurchasesPDF;
window.exportSalesExcel = exportSalesExcel;
window.exportSalesPDF = exportSalesPDF;
window.exportExpensesExcel = exportExpensesExcel;
window.exportExpensesPDF = exportExpensesPDF;
