import { sb } from './supabaseClient.js';
import { DB, loadAll, customerName, brandName, ensureCustomer } from './state.js';
import { taka, val, todayISO, dateBn, emptyState, setLoading, paymentMethodOptions } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { renderCatalog } from './catalog.js';
import { resolvePaymentSelection, paymentMethodDisplay } from './payment-accounts.js';

/* ============================================================ SALES */
let salesFilter = 'all';
export function setSalesFilter(k) { salesFilter = k; buildSalesFilterSeg(); renderSales(); }
export function buildSalesFilterSeg() {
  const opts = [['all', 'সব'], ['wholesale', 'পাইকারি'], ['retail', 'খুচরা']];
  document.getElementById('salesFilterSeg').innerHTML = opts.map(([k, l]) =>
    `<button class="${salesFilter === k ? 'active' : ''}" onclick="setSalesFilter('${k}')">${l}</button>`).join('');
}
export function renderSales() {
  const wrap = document.getElementById('salesTable');
  let rows = [...DB.sales];
  if (salesFilter !== 'all') rows = rows.filter(s => s.sale_type === salesFilter);
  const query = (document.getElementById('saleSearchInput')?.value || '').trim().toLowerCase();
  if (query) {
    rows = rows.filter(s => {
      const memo = (s.memo_no || '').toLowerCase();
      const cust = customerName(s.customer_id).toLowerCase();
      const items = s.items.map(i => i.name).join(' ').toLowerCase();
      return memo.includes(query) || cust.includes(query) || items.includes(query);
    });
  }
  rows.sort((a, b) => b.date.localeCompare(a.date));
  if (!rows.length) { wrap.innerHTML = emptyState('কোনো বিক্রয় নেই', 'ফিল্টার বা অনুসন্ধানের শব্দ পাল্টে দেখুন'); return; }
  wrap.innerHTML = `
    <table>
      <thead><tr><th>তারিখ</th><th>মেমো নম্বর</th><th>ধরন</th><th>কাস্টমার</th><th>প্রোডাক্ট</th><th>মোট</th><th>পেইড</th><th>মাধ্যম</th><th>বাকি</th><th></th></tr></thead>
      <tbody>
        ${rows.map(s => `
          <tr>
            <td>${dateBn(s.date)}</td>
            <td>${s.memo_no ? `<strong>${s.memo_no}</strong>` : '<span class="helper">-</span>'}</td>
            <td><span class="tag ${s.sale_type}">${s.sale_type === 'wholesale' ? 'পাইকারি' : 'খুচরা'}</span></td>
            <td>${customerName(s.customer_id)}</td>
            <td>${s.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</td>
            <td class="num">${taka(s.total)}</td><td class="num">${taka(s.paid)}</td>
            <td><span class="tag ${s.payment_method}">${paymentMethodDisplay(s.payment_method, s.payment_account_id)}</span></td>
            <td class="num">${s.due > 0 ? `<span class="tag due">${taka(s.due)}</span>` : `<span class="tag paid">নেই</span>`}</td>
            <td><div class="row-actions">
              <button class="btn btn-ghost btn-sm" onclick="openEditSaleModal('${s.id}')">এডিট</button>
              <button class="btn btn-danger-ghost btn-sm" onclick="deleteSale('${s.id}')">ডিলিট</button>
            </div></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}
let saleItems = []; let currentSaleType = 'retail';
export function openSaleModal() {
  saleItems = [{ product_id: '', qty: 1, price: 0 }]; currentSaleType = 'retail';
  openModal(`
    <h3>নতুন বিক্রয়</h3><div class="stitch"></div>
    <div class="field"><label>ধরন</label>
      <div class="seg" id="saleTypeSeg"></div>
    </div>
    <div class="row2">
      <div class="field"><label>কাস্টমারের নাম</label><input id="f_cname" list="custList" placeholder="নাম লিখুন">
        <datalist id="custList">${DB.customers.map(c => `<option value="${c.name}">`).join('')}</datalist>
      </div>
      <div class="field"><label>ফোন (ঐচ্ছিক)</label><input id="f_cphone" placeholder="017..."></div>
    </div>
    <div id="itemRows"></div>
    <button class="btn btn-ghost btn-sm" onclick="addSaleRow()">+ আরও প্রোডাক্ট</button>
    <div class="row2" style="margin-top:12px;">
      <div class="field"><label>তারিখ</label><input id="f_sdate" type="date" value="${todayISO()}"></div>
      <div class="field"><label>মেমো নম্বর (ঐচ্ছিক)</label><input id="f_smemo" placeholder="যেমন: S-101"></div>
    </div>
    <div class="row2">
      <div class="field"><label>পেইড হয়েছে</label><input id="f_paid" type="number" value="0" oninput="updateSaleTotals()"></div>
      <div class="field"><label>পেমেন্ট মাধ্যম <span style="color:var(--danger)">*</span></label><select id="f_smethod" onchange="onPaymentMethodChange('f_s')">${paymentMethodOptions('cash')}</select></div>
    </div>
    <div class="field" id="f_sAccountWrap"></div>
    <div class="totals-box">
      <div class="r"><span>সর্বমোট</span><b id="sTotal" class="num">৳০</b></div>
      <div class="r"><span>বাকি থাকবে</span><b id="sDue" class="num" style="color:var(--gold-600)">৳০</b></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">বাতিল</button>
      <button class="btn btn-primary" onclick="saveSale()">বিক্রয় সেভ করুন</button>
    </div>`);
  buildSaleTypeSeg();
  renderSaleRows();
}
export function setSaleType(t) {
  currentSaleType = t;
  buildSaleTypeSeg();
}
export function buildSaleTypeSeg() {
  const el = document.getElementById('saleTypeSeg');
  if (!el) return;
  const opts = [['retail', 'খুচরা'], ['wholesale', 'পাইকারি']];
  el.innerHTML = opts.map(([k, l]) =>
    `<button class="${currentSaleType === k ? 'active' : ''}" onclick="setSaleType('${k}')">${l}</button>`).join('');
}
export function syncSaleRowsFromDOM() {
  const container = document.getElementById('itemRows');
  if (!container) return;
  const rows = container.querySelectorAll('.item-row');
  rows.forEach((rowEl, idx) => {
    if (!saleItems[idx]) return;
    const sel = rowEl.querySelector('select');
    const inputs = rowEl.querySelectorAll('input');
    if (sel) {
      saleItems[idx].product_id = sel.value;
      const p = DB.products.find(x => x.id === sel.value);
      if (p) saleItems[idx].name = p.name;
    }
    if (inputs[0]) saleItems[idx].qty = Number(inputs[0].value || 1);
    if (inputs[1]) saleItems[idx].price = Number(inputs[1].value || 0);
  });
}
function productOptions(selectedId) { return DB.products.map(p => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.name} — ${brandName(p.brand_id)} (স্টক ${p.qty})</option>`).join(''); }
export function renderSaleRows() {
  document.getElementById('itemRows').innerHTML = saleItems.map((it, idx) => `
    <div class="item-row">
      <div class="row3">
        <div class="field" style="margin:0;"><label>প্রোডাক্ট</label>
          <select onchange="onSaleProductChange(${idx}, this.value)"><option value="">-- বাছাই করুন --</option>${productOptions(it.product_id)}</select>
        </div>
        <div class="field" style="margin:0;"><label>Quantity</label><input type="number" min="1" value="${it.qty}" oninput="onSaleQtyInput(${idx}, this.value)" onchange="onSaleQtyChange(${idx}, this.value)"></div>
        <div class="field" style="margin:0;"><label>দাম/পিস</label><input type="number" value="${it.price}" oninput="onSalePriceInput(${idx}, this.value)" onchange="onSalePriceChange(${idx}, this.value)"></div>
        ${saleItems.length > 1 ? `<button class="remove-row" onclick="removeSaleRow(${idx})">✕</button>` : '<span></span>'}
      </div>
      <div class="line-total">লাইন টোটাল: ${taka(it.qty * it.price)}</div>
    </div>`).join('');
  updateSaleTotals();
}
export function onSaleProductChange(idx, pid) {
  const p = DB.products.find(x => x.id === pid);
  saleItems[idx].product_id = pid;
  saleItems[idx].name = p ? p.name : '';
  if (p && !saleItems[idx].price) {
    saleItems[idx].price = p.buy_price || 0;
  }
  renderSaleRows();
}
// oninput: শুধু total আপডেট, DOM re-render না — typing স্বাভাবিক থাকে
export function onSaleQtyInput(idx, v)   { saleItems[idx].qty   = Number(v || 1); updateSaleTotals(); }
export function onSalePriceInput(idx, v) { saleItems[idx].price = Number(v || 0); updateSaleTotals(); }
// onchange: blur/Enter-এ row re-render করে line-total ঠিক দেখায়
export function onSaleQtyChange(idx, v)   { saleItems[idx].qty   = Number(v || 1); renderSaleRows(); }
export function onSalePriceChange(idx, v) { saleItems[idx].price = Number(v || 0); renderSaleRows(); }
export function addSaleRow() {
  syncSaleRowsFromDOM();
  saleItems.push({ product_id: '', qty: 1, price: 0 });
  renderSaleRows();
}
export function removeSaleRow(idx) {
  syncSaleRowsFromDOM();
  saleItems.splice(idx, 1);
  renderSaleRows();
}
export function updateSaleTotals() {
  const total = saleItems.reduce((s, i) => s + i.qty * i.price, 0);
  const paid = Number(val('f_paid') || 0);
  document.getElementById('sTotal').textContent = taka(total);
  document.getElementById('sDue').textContent = taka(Math.max(0, total - paid));
}
export async function saveSale() {
  syncSaleRowsFromDOM();
  const cname = val('f_cname');
  if (!cname) { alert('কাস্টমারের নাম দিন'); return; }
  const validItems = saleItems.filter(i => i.product_id && i.qty > 0);
  if (!validItems.length) { alert('অন্তত একটা প্রোডাক্ট বাছাই করুন'); return; }
  const total = validItems.reduce((s, i) => s + i.qty * i.price, 0);
  const paid = Number(val('f_paid') || 0);
  const due = Math.max(0, total - paid);

  setLoading(true);
  try {
    const paymentSel = await resolvePaymentSelection('f_s');
    if (!paymentSel) return;

    const customer = await ensureCustomer(cname, val('f_cphone'));
    const memoNo = val('f_smemo').trim();
    const { data: saleRow, error: serr } = await sb.from('sales').insert({
      date: val('f_sdate') || todayISO(), memo_no: memoNo, sale_type: currentSaleType, customer_id: customer.id, total, paid, due,
      payment_method: paymentSel.payment_method, payment_account_id: paymentSel.payment_account_id
    }).select().single();
    if (serr) { alert('বিক্রয় সেভ ব্যর্থ: ' + serr.message); return; }

    const itemRows = validItems.map(i => ({ sale_id: saleRow.id, product_id: i.product_id, name: i.name, qty: i.qty, price: i.price }));
    await sb.from('sale_items').insert(itemRows);

    for (const it of validItems) {
      const p = DB.products.find(x => x.id === it.product_id);
      const newQty = Math.max(0, (p ? p.qty : 0) - it.qty);
      await sb.from('products').update({ qty: newQty }).eq('id', it.product_id);
    }
    await sb.from('customers').update({ due: customer.due + due }).eq('id', customer.id);

    closeModal(); await loadAll(); renderSales(); renderCatalog();
  } finally { setLoading(false); }
}

export function openEditSaleModal(id) {
  const s = DB.sales.find(x => x.id === id);
  if (!s) return;
  saleItems = s.items.map(i => ({
    product_id: i.product_id,
    name: i.name,
    qty: i.qty,
    price: i.price
  }));
  currentSaleType = s.sale_type || 'retail';
  const cust = DB.customers.find(c => c.id === s.customer_id);
  const custName = cust ? cust.name : '';
  const custPhone = cust ? cust.phone || '' : '';

  openModal(`
    <h3>বিক্রয় এডিট করুন</h3><div class="stitch"></div>
    <div class="field"><label>ধরন</label>
      <div class="seg" id="saleTypeSeg"></div>
    </div>
    <div class="row2">
      <div class="field"><label>কাস্টমারের নাম</label><input id="f_cname" list="custList" value="${custName}" placeholder="নাম লিখুন">
        <datalist id="custList">${DB.customers.map(c => `<option value="${c.name}">`).join('')}</datalist>
      </div>
      <div class="field"><label>ফোন (ঐচ্ছিক)</label><input id="f_cphone" value="${custPhone}" placeholder="017..."></div>
    </div>
    <div id="itemRows"></div>
    <button class="btn btn-ghost btn-sm" onclick="addSaleRow()">+ আরও প্রোডাক্ট</button>
    <div class="row2" style="margin-top:12px;">
      <div class="field"><label>তারিখ</label><input id="f_sdate" type="date" value="${s.date}"></div>
      <div class="field"><label>মেমো নম্বর (ঐচ্ছিক)</label><input id="f_smemo" value="${s.memo_no || ''}" placeholder="যেমন: S-101"></div>
    </div>
    <div class="row2">
      <div class="field"><label>পেইড হয়েছে</label><input id="f_paid" type="number" value="${s.paid}" oninput="updateSaleTotals()"></div>
      <div class="field"><label>পেমেন্ট মাধ্যম <span style="color:var(--danger)">*</span></label><select id="f_smethod" onchange="onPaymentMethodChange('f_s')">${paymentMethodOptions(s.payment_method)}</select></div>
    </div>
    <div class="field" id="f_sAccountWrap"></div>
    <div class="totals-box">
      <div class="r"><span>সর্বমোট</span><b id="sTotal" class="num">৳০</b></div>
      <div class="r"><span>বাকি থাকবে</span><b id="sDue" class="num" style="color:var(--gold-600)">৳০</b></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">বাতিল</button>
      <button class="btn btn-primary" onclick="saveEditSale('${s.id}')">আপডেট করুন</button>
    </div>`);

  buildSaleTypeSeg();
  if (s.payment_method !== 'cash') {
    import('./payment-accounts.js').then(m => m.renderPaymentAccountField('f_s', s.payment_method, s.payment_account_id));
  }
  renderSaleRows();
}
export function updateEditSaleDue(id) {
  updateSaleTotals();
}
export async function saveEditSale(id) {
  const oldS = DB.sales.find(x => x.id === id);
  if (!oldS) return;

  syncSaleRowsFromDOM();
  const cname = val('f_cname');
  if (!cname) { alert('কাস্টমারের নাম দিন'); return; }
  const validItems = saleItems.filter(i => i.product_id && i.qty > 0);
  if (!validItems.length) { alert('অন্তত একটা প্রোডাক্ট বাছাই করুন'); return; }
  const total = validItems.reduce((s, i) => s + i.qty * i.price, 0);
  const paid = Number(val('f_paid') || 0);
  const due = Math.max(0, total - paid);

  setLoading(true);
  try {
    const paymentSel = await resolvePaymentSelection('f_s');
    if (!paymentSel) return;

    for (const oldIt of oldS.items) {
      const p = DB.products.find(x => x.id === oldIt.product_id);
      const revertedQty = (p ? p.qty : 0) + oldIt.qty;
      await sb.from('products').update({ qty: revertedQty }).eq('id', oldIt.product_id);
    }

    const oldCust = DB.customers.find(c => c.id === oldS.customer_id);
    if (oldCust) {
      const revertedDue = Math.max(0, oldCust.due - oldS.due);
      await sb.from('customers').update({ due: revertedDue }).eq('id', oldCust.id);
    }

    const customer = await ensureCustomer(cname, val('f_cphone'));
    const memoNo = val('f_smemo').trim();

    const { error: serr } = await sb.from('sales').update({
      date: val('f_sdate') || oldS.date,
      memo_no: memoNo,
      sale_type: currentSaleType,
      customer_id: customer.id,
      total,
      paid,
      due,
      payment_method: paymentSel.payment_method,
      payment_account_id: paymentSel.payment_account_id
    }).eq('id', id);
    if (serr) { alert('বিক্রয় আপডেট ব্যর্থ: ' + serr.message); return; }

    await sb.from('sale_items').delete().eq('sale_id', id);
    const itemRows = validItems.map(i => ({ sale_id: id, product_id: i.product_id, name: i.name, qty: i.qty, price: i.price }));
    await sb.from('sale_items').insert(itemRows);

    for (const it of validItems) {
      const p = DB.products.find(x => x.id === it.product_id);
      const newQty = Math.max(0, (p ? p.qty : 0) - it.qty);
      await sb.from('products').update({ qty: newQty }).eq('id', it.product_id);
    }
    const currentCust = DB.customers.find(c => c.id === customer.id) || customer;
    await sb.from('customers').update({ due: currentCust.due + due }).eq('id', customer.id);

    closeModal(); await loadAll(); renderSales(); renderCatalog();
  } finally { setLoading(false); }
}

export async function deleteSale(id) {
  if (!confirm('এই বিক্রয়টি ডিলিট করবেন? স্টক ও বকেয়া আগের অবস্থায় ফিরে যাবে।')) return;
  const s = DB.sales.find(x => x.id === id);
  setLoading(true);
  try {
    for (const it of s.items) {
      const p = DB.products.find(x => x.id === it.product_id);
      const newQty = (p ? p.qty : 0) + it.qty;
      await sb.from('products').update({ qty: newQty }).eq('id', it.product_id);
    }
    const c = DB.customers.find(x => x.id === s.customer_id);
    if (c) { await sb.from('customers').update({ due: Math.max(0, c.due - s.due) }).eq('id', c.id); }
    await sb.from('sales').delete().eq('id', id);
    await loadAll(); renderSales(); renderCatalog();
  } finally { setLoading(false); }
}

window.setSalesFilter = setSalesFilter;
window.openSaleModal = openSaleModal;
window.setSaleType = setSaleType;
window.onSaleProductChange = onSaleProductChange;
window.onSaleQtyChange = onSaleQtyChange;
window.onSalePriceChange = onSalePriceChange;
window.addSaleRow = addSaleRow;
window.removeSaleRow = removeSaleRow;
window.updateSaleTotals = updateSaleTotals;
window.saveSale = saveSale;
window.openEditSaleModal = openEditSaleModal;
window.updateEditSaleDue = updateEditSaleDue;
window.saveEditSale = saveEditSale;
window.deleteSale = deleteSale;
window.onSaleQtyInput = onSaleQtyInput;
window.onSalePriceInput = onSalePriceInput;
