import { sb } from './supabaseClient.js';
import { DB, loadAll } from './state.js';
import { brandName, supplierName, ensureSupplier } from './state.js';
import { taka, val, todayISO, dateBn, emptyState, paymentMethodOptions, setLoading } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { renderCatalog } from './catalog.js';
import { resolvePaymentSelection, paymentMethodDisplay } from './payment-accounts.js';

/* ============================================================ PURCHASES */
export function renderPurchases() {
  const wrap = document.getElementById('purchasesTable');
  if (!DB.purchases.length) { wrap.innerHTML = emptyState('কোনো ক্রয় নেই', 'প্রথম ক্রয়টি যোগ করুন'); return; }
  const query = (document.getElementById('purchaseSearchInput')?.value || '').trim().toLowerCase();
  let rows = [...DB.purchases].sort((a, b) => b.date.localeCompare(a.date));
  if (query) {
    rows = rows.filter(p => {
      const memo = (p.memo_no || '').toLowerCase();
      const brand = brandName(p.brand_id).toLowerCase();
      const supplier = supplierName(p.supplier_id).toLowerCase();
      const items = p.items.map(i => i.name).join(' ').toLowerCase();
      return memo.includes(query) || brand.includes(query) || supplier.includes(query) || items.includes(query);
    });
  }
  if (!rows.length) { wrap.innerHTML = emptyState('কোনো ক্রয় পাওয়া যায়নি', 'অনুগ্রহ করে অনুসন্ধানের শব্দ মিলিয়ে দেখুন'); return; }
  wrap.innerHTML = `
    <table>
      <thead><tr><th>তারিখ</th><th>মেমো নম্বর</th><th>ব্র্যান্ড</th><th>সোর্স</th><th>প্রোডাক্ট</th><th>মোট</th><th>ছাড়</th><th>পেইড</th><th>মাধ্যম</th><th>বাকি</th><th></th></tr></thead>
      <tbody>
        ${rows.map(p => `
          <tr>
            <td>${dateBn(p.date)}</td>
            <td>${p.memo_no ? `<strong>${p.memo_no}</strong>` : '<span class="helper">-</span>'}</td>
            <td>${brandName(p.brand_id)}</td><td>${supplierName(p.supplier_id)}</td>
            <td>${p.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</td>
            <td class="num">${taka(p.total)}</td>
            <td class="num">${p.discount > 0 ? `<span class="tag" style="background:rgba(16,185,129,0.15);color:#10b981">${taka(p.discount)}</span>` : '<span class="helper">-</span>'}</td>
            <td class="num">${taka(p.paid)}</td>
            <td><span class="tag ${p.payment_method}">${paymentMethodDisplay(p.payment_method, p.payment_account_id)}</span></td>
            <td class="num">${p.due > 0 ? `<span class="tag due">${taka(p.due)}</span>` : `<span class="tag paid">নেই</span>`}</td>
            <td><div class="row-actions">
              <button class="btn btn-ghost btn-sm" onclick="openEditPurchaseModal('${p.id}')">এডিট</button>
              <button class="btn btn-danger-ghost btn-sm" onclick="deletePurchase('${p.id}')">ডিলিট</button>
            </div></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}
let purchaseItems = [];
export function openPurchaseModal() {
  purchaseItems = [{ product_id: '', qty: 1, cost: 0 }];
  const brandOpts = DB.brands.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  openModal(`
    <h3>নতুন ক্রয়</h3><div class="stitch"></div>
    <div class="row2">
      <div class="field"><label>ব্র্যান্ড</label><select id="f_pubrand" onchange="renderPurchaseRows()">
        <option value="">-- বাছাই করুন --</option>${brandOpts}<option value="__newbrand__">➕ নতুন ব্র্যান্ড</option></select>
      </div>
      <div class="field" id="newBrandField" style="display:none;"><label>নতুন ব্র্যান্ডের নাম</label><input id="f_newbrand"></div>
      <div class="field"><label>সোর্স/কার কাছ থেকে কিনলেন</label><input id="f_source" list="supList" placeholder="দোকান বা ব্যক্তির নাম">
        <datalist id="supList">${DB.suppliers.map(s => `<option value="${s.name}">`).join('')}</datalist>
      </div>
    </div>
    <div id="pItemRows"></div>
    <button class="btn btn-ghost btn-sm" onclick="addPurchaseRow()">+ আরও প্রোডাক্ট</button>
    <div class="row2" style="margin-top:12px;">
      <div class="field"><label>তারিখ</label><input id="f_pdate" type="date" value="${todayISO()}"></div>
      <div class="field"><label>মেমো নম্বর (ঐচ্ছিক)</label><input id="f_pmemo" placeholder="যেমন: M-101"></div>
    </div>
    <div class="row2">
      <div class="field"><label>ছাড় (টাকা)</label><input id="f_pdiscount" type="number" value="0" oninput="updatePurchaseTotals()"></div>
      <div class="field"><label>পেইড হয়েছে</label><input id="f_ppaid" type="number" value="0" oninput="updatePurchaseTotals()"></div>
    </div>
    <div class="field"><label>পেমেন্ট মাধ্যম <span style="color:var(--danger)">*</span></label><select id="f_pmethod" onchange="onPaymentMethodChange('f_p')">${paymentMethodOptions('cash')}</select></div>
    <div class="field" id="f_pAccountWrap"></div>
    <div class="totals-box">
      <div class="r"><span>সর্বমোট</span><b id="pTotal" class="num">৳০</b></div>
      <div class="r"><span>ছাড়ের পরে</span><b id="pAfterDiscount" class="num">৳০</b></div>
      <div class="r"><span>সাপ্লায়ারকে বাকি থাকবে</span><b id="pDue" class="num" style="color:var(--gold-600)">৳০</b></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">বাতিল</button>
      <button class="btn btn-primary" onclick="savePurchase()">ক্রয় সেভ করুন</button>
    </div>`);
  document.getElementById('f_pubrand').addEventListener('change', function () {
    document.getElementById('newBrandField').style.display = this.value === '__newbrand__' ? 'block' : 'none';
  });
  renderPurchaseRows();
}
function currentPurchaseBrandProducts() {
  const bid = val('f_pubrand');
  if (!bid || bid === '__newbrand__') return DB.products;
  return DB.products.filter(p => p.brand_id === bid);
}
export function syncPurchaseRowsFromDOM() {
  const container = document.getElementById('pItemRows');
  if (!container) return;
  const rows = container.querySelectorAll('.item-row');
  rows.forEach((rowEl, idx) => {
    if (!purchaseItems[idx]) return;
    const sel = rowEl.querySelector('select');
    const inputs = rowEl.querySelectorAll('input');
    if (sel) purchaseItems[idx].product_id = sel.value;
    if (inputs[0]) purchaseItems[idx].qty = Number(inputs[0].value || 1);
    if (inputs[1]) purchaseItems[idx].cost = Number(inputs[1].value || 0);
    if (purchaseItems[idx].product_id === '__new__') {
      if (inputs[2]) purchaseItems[idx].new_name = inputs[2].value;
      if (inputs[3]) purchaseItems[idx].new_meta = inputs[3].value;
    }
  });
}
export function renderPurchaseRows() {
  const prods = currentPurchaseBrandProducts();
  document.getElementById('pItemRows').innerHTML = purchaseItems.map((it, idx) => `
    <div class="item-row">
      <div class="row3">
        <div class="field" style="margin:0;"><label>প্রোডাক্ট</label>
          <select onchange="onPurchaseProductChange(${idx}, this.value)">
            <option value="">-- বাছাই বা নতুন --</option>
            ${prods.map(p => `<option value="${p.id}" ${p.id === it.product_id ? 'selected' : ''}>${p.name} — ${brandName(p.brand_id)} (স্টক ${p.qty})</option>`).join('')}
            <option value="__new__" ${it.product_id === '__new__' ? 'selected' : ''}>➕ নতুন প্রোডাক্ট</option>
          </select>
        </div>
        <div class="field" style="margin:0;"><label>Quantity</label><input type="number" min="1" value="${it.qty}" oninput="onPurchaseQtyInput(${idx}, this.value)" onchange="onPurchaseQtyChange(${idx}, this.value)"></div>
        <div class="field" style="margin:0;"><label>ক্রয়মূল্য/পিস</label><input type="number" value="${it.cost}" oninput="onPurchaseCostInput(${idx}, this.value)" onchange="onPurchaseCostChange(${idx}, this.value)"></div>
        ${purchaseItems.length > 1 ? `<button class="remove-row" onclick="removePurchaseRow(${idx})">✕</button>` : '<span></span>'}
      </div>
      ${it.product_id === '__new__' ? `
        <div class="row2" style="margin-top:6px;">
          <input placeholder="নতুন প্রোডাক্টের নাম" value="${it.new_name || ''}" oninput="onPurchaseNewNameChange(${idx}, this.value)">
          <input placeholder="ক্যাটাগরি/সাইজ/রং" value="${it.new_meta || ''}" oninput="onPurchaseNewMetaChange(${idx}, this.value)">
        </div>` : ''}
      <div class="line-total">লাইন টোটাল: ${taka(it.qty * it.cost)}</div>
    </div>`).join('');
  updatePurchaseTotals();
}
export function onPurchaseProductChange(idx, pid) {
  purchaseItems[idx].product_id = pid;
  if (pid && pid !== '__new__') {
    const p = DB.products.find(x => x.id === pid);
    if (p) {
      purchaseItems[idx].name = p.name;
      purchaseItems[idx].cost = p.buy_price;
      const brandSel = document.getElementById('f_pubrand');
      if (brandSel && !brandSel.value) {
        brandSel.value = p.brand_id;
      }
    }
  }
  renderPurchaseRows();
}
// oninput: শুধু total আপডেট করে, DOM re-render করে না — typing বাধাগ্রস্ত হয় না
export function onPurchaseQtyInput(idx, v)  { purchaseItems[idx].qty  = Number(v || 1); updatePurchaseTotals(); }
export function onPurchaseCostInput(idx, v) { purchaseItems[idx].cost = Number(v || 0); updatePurchaseTotals(); }
// onchange: blur/Enter-এ পুরো row re-render করে line-total আপডেটের জন্য
export function onPurchaseQtyChange(idx, v)  { purchaseItems[idx].qty  = Number(v || 1); renderPurchaseRows(); }
export function onPurchaseCostChange(idx, v) { purchaseItems[idx].cost = Number(v || 0); renderPurchaseRows(); }
export function onPurchaseNewNameChange(idx, v) { purchaseItems[idx].new_name = v; }
export function onPurchaseNewMetaChange(idx, v) { purchaseItems[idx].new_meta = v; }
export function addPurchaseRow() {
  syncPurchaseRowsFromDOM();
  purchaseItems.push({ product_id: '', qty: 1, cost: 0 });
  renderPurchaseRows();
}
export function removePurchaseRow(idx) {
  syncPurchaseRowsFromDOM();
  purchaseItems.splice(idx, 1);
  renderPurchaseRows();
}
export function updatePurchaseTotals() {
  const total = purchaseItems.reduce((s, i) => s + i.qty * i.cost, 0);
  const discount = Number(val('f_pdiscount') || 0);
  const paid = Number(val('f_ppaid') || 0);
  const afterDiscount = Math.max(0, total - discount);
  if (document.getElementById('pTotal')) document.getElementById('pTotal').textContent = taka(total);
  if (document.getElementById('pAfterDiscount')) document.getElementById('pAfterDiscount').textContent = taka(afterDiscount);
  if (document.getElementById('pDue')) document.getElementById('pDue').textContent = taka(Math.max(0, afterDiscount - paid));
}
export async function savePurchase() {
  syncPurchaseRowsFromDOM();
  let brandId = val('f_pubrand');
  if (!brandId) { alert('ব্র্যান্ড বাছাই করুন'); return; }
  const sourceName = val('f_source');
  if (!sourceName) { alert('সোর্স/সাপ্লায়ারের নাম দিন'); return; }
  const validItems = purchaseItems.filter(i => i.product_id && i.qty > 0);
  if (!validItems.length) { alert('অন্তত একটা প্রোডাক্ট বাছাই করুন'); return; }

  setLoading(true);
  try {
    const paymentSel = await resolvePaymentSelection('f_p');
    if (!paymentSel) return;

    if (brandId === '__newbrand__') {
      const bname = val('f_newbrand');
      if (!bname) { alert('নতুন ব্র্যান্ডের নাম দিন'); return; }
      const { data, error } = await sb.from('brands').insert({ name: bname }).select().single();
      if (error) { alert('ব্র্যান্ড তৈরি ব্যর্থ: ' + error.message); return; }
      DB.brands.push(data); brandId = data.id;
    }

    const resolvedItems = [];
    for (const it of validItems) {
      if (it.product_id === '__new__') {
        if (!it.new_name) { alert('নতুন প্রোডাক্টের নাম দিন'); return; }
        const { data, error } = await sb.from('products').insert({ brand_id: brandId, name: it.new_name, category: it.new_meta || '', buy_price: it.cost, qty: 0 }).select().single();
        if (error) { alert('প্রোডাক্ট তৈরি ব্যর্থ: ' + error.message); return; }
        resolvedItems.push({ product_id: data.id, name: data.name, qty: it.qty, cost: it.cost });
      } else {
        resolvedItems.push({ product_id: it.product_id, name: it.name, qty: it.qty, cost: it.cost });
      }
    }

    const total = resolvedItems.reduce((s, i) => s + i.qty * i.cost, 0);
    const discount = Number(val('f_pdiscount') || 0);
    const afterDiscount = Math.max(0, total - discount);
    const paid = Math.min(Number(val('f_ppaid') || 0), afterDiscount); // ছাড়ের চেয়ে বেশি পেমেন্ট হতে পারবে না
    const due = Math.max(0, afterDiscount - paid);
    const supplier = await ensureSupplier(sourceName);
    const memoNo = val('f_pmemo').trim();

    const { data: purchaseRow, error: perr } = await sb.from('purchases').insert({
      date: val('f_pdate') || todayISO(), memo_no: memoNo, brand_id: brandId, supplier_id: supplier.id, total, discount, paid, due,
      payment_method: paymentSel.payment_method, payment_account_id: paymentSel.payment_account_id
    }).select().single();
    if (perr) { alert('ক্রয় সেভ ব্যর্থ: ' + perr.message); return; }

    const itemRows = resolvedItems.map(i => ({ purchase_id: purchaseRow.id, product_id: i.product_id, name: i.name, qty: i.qty, cost: i.cost }));
    await sb.from('purchase_items').insert(itemRows);

    for (const it of resolvedItems) {
      const p = DB.products.find(x => x.id === it.product_id);
      const newQty = (p ? p.qty : 0) + it.qty;
      await sb.from('products').update({ qty: newQty, buy_price: it.cost }).eq('id', it.product_id);
    }
    await sb.from('suppliers').update({ due: supplier.due + due }).eq('id', supplier.id);

    closeModal(); await loadAll(); renderPurchases(); renderCatalog();
  } finally { setLoading(false); }
}
export function openEditPurchaseModal(id) {
  const p = DB.purchases.find(x => x.id === id);
  if (!p) return;
  purchaseItems = p.items.map(i => ({
    product_id: i.product_id,
    name: i.name,
    qty: i.qty,
    cost: i.cost
  }));
  const brandOpts = DB.brands.map(b => `<option value="${b.id}" ${b.id === p.brand_id ? 'selected' : ''}>${b.name}</option>`).join('');
  const sup = DB.suppliers.find(s => s.id === p.supplier_id);
  const supName = sup ? sup.name : '';

  openModal(`
    <h3>ক্রয় এডিট করুন</h3><div class="stitch"></div>
    <div class="row2">
      <div class="field"><label>ব্র্যান্ড</label><select id="f_pubrand" onchange="renderPurchaseRows()">
        <option value="">-- বাছাই করুন --</option>${brandOpts}<option value="__newbrand__">➕ নতুন ব্র্যান্ড</option></select>
      </div>
      <div class="field" id="newBrandField" style="display:none;"><label>নতুন ব্র্যান্ডের নাম</label><input id="f_newbrand"></div>
      <div class="field"><label>সোর্স/কার কাছ থেকে কিনলেন</label><input id="f_source" list="supList" value="${supName}" placeholder="দোকান বা ব্যক্তির নাম">
        <datalist id="supList">${DB.suppliers.map(s => `<option value="${s.name}">`).join('')}</datalist>
      </div>
    </div>
    <div id="pItemRows"></div>
    <button class="btn btn-ghost btn-sm" onclick="addPurchaseRow()">+ আরও প্রোডাক্ট</button>
    <div class="row2" style="margin-top:12px;">
      <div class="field"><label>তারিখ</label><input id="f_pdate" type="date" value="${p.date}"></div>
      <div class="field"><label>মেমো নম্বর (ঐচ্ছিক)</label><input id="f_pmemo" value="${p.memo_no || ''}" placeholder="যেমন: M-101"></div>
    </div>
    <div class="row2">
      <div class="field"><label>ছাড় (টাকা)</label><input id="f_pdiscount" type="number" value="${p.discount || 0}" oninput="updatePurchaseTotals()"></div>
      <div class="field"><label>পেইড হয়েছে</label><input id="f_ppaid" type="number" value="${p.paid}" oninput="updatePurchaseTotals()"></div>
    </div>
    <div class="field"><label>পেমেন্ট মাধ্যম <span style="color:var(--danger)">*</span></label><select id="f_pmethod" onchange="onPaymentMethodChange('f_p')">${paymentMethodOptions(p.payment_method)}</select></div>
    <div class="field" id="f_pAccountWrap"></div>
    <div class="totals-box">
      <div class="r"><span>সর্বমোট</span><b id="pTotal" class="num">৳০</b></div>
      <div class="r"><span>ছাড়ের পরে</span><b id="pAfterDiscount" class="num">৳০</b></div>
      <div class="r"><span>সাপ্লায়ারকে বাকি থাকবে</span><b id="pDue" class="num" style="color:var(--gold-600)">৳০</b></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">বাতিল</button>
      <button class="btn btn-primary" onclick="saveEditPurchase('${p.id}')">আপডেট করুন</button>
    </div>`);

  document.getElementById('f_pubrand').addEventListener('change', function () {
    document.getElementById('newBrandField').style.display = this.value === '__newbrand__' ? 'block' : 'none';
  });
  if (p.payment_method !== 'cash') {
    import('./payment-accounts.js').then(m => m.renderPaymentAccountField('f_p', p.payment_method, p.payment_account_id));
  }
  renderPurchaseRows();
}
export function updateEditPurchaseDue(id) {
  updatePurchaseTotals();
}
export async function saveEditPurchase(id) {
  const oldP = DB.purchases.find(x => x.id === id);
  if (!oldP) return;

  syncPurchaseRowsFromDOM();
  let brandId = val('f_pubrand');
  if (!brandId) { alert('ব্র্যান্ড বাছাই করুন'); return; }
  const sourceName = val('f_source');
  if (!sourceName) { alert('সোর্স/সাপ্লায়ারের নাম দিন'); return; }
  const validItems = purchaseItems.filter(i => i.product_id && i.qty > 0);
  if (!validItems.length) { alert('অন্তত একটা প্রোডাক্ট বাছাই করুন'); return; }

  setLoading(true);
  try {
    const paymentSel = await resolvePaymentSelection('f_p');
    if (!paymentSel) return;

    // 1. Revert old product stock
    for (const oldIt of oldP.items) {
      const prod = DB.products.find(x => x.id === oldIt.product_id);
      const revertedQty = Math.max(0, (prod ? prod.qty : 0) - oldIt.qty);
      await sb.from('products').update({ qty: revertedQty }).eq('id', oldIt.product_id);
    }

    // 2. Revert old supplier due
    const oldSup = DB.suppliers.find(x => x.id === oldP.supplier_id);
    if (oldSup) {
      const revertedDue = Math.max(0, oldSup.due - oldP.due);
      await sb.from('suppliers').update({ due: revertedDue }).eq('id', oldSup.id);
    }

    // 3. Resolve new brand if added
    if (brandId === '__newbrand__') {
      const bname = val('f_newbrand');
      if (!bname) { alert('নতুন ব্র্যান্ডের নাম দিন'); return; }
      const { data, error } = await sb.from('brands').insert({ name: bname }).select().single();
      if (error) { alert('ব্র্যান্ড তৈরি ব্যর্থ: ' + error.message); return; }
      DB.brands.push(data); brandId = data.id;
    }

    // 4. Resolve product items
    const resolvedItems = [];
    for (const it of validItems) {
      if (it.product_id === '__new__') {
        if (!it.new_name) { alert('নতুন প্রোডাক্টের নাম দিন'); return; }
        const { data, error } = await sb.from('products').insert({ brand_id: brandId, name: it.new_name, category: it.new_meta || '', buy_price: it.cost, qty: 0 }).select().single();
        if (error) { alert('প্রোডাক্ট তৈরি ব্যর্থ: ' + error.message); return; }
        resolvedItems.push({ product_id: data.id, name: data.name, qty: it.qty, cost: it.cost });
      } else {
        resolvedItems.push({ product_id: it.product_id, name: it.name, qty: it.qty, cost: it.cost });
      }
    }

    const total = resolvedItems.reduce((s, i) => s + i.qty * i.cost, 0);
    const discount = Number(val('f_pdiscount') || 0);
    const afterDiscount = Math.max(0, total - discount);
    const paid = Math.min(Number(val('f_ppaid') || 0), afterDiscount); // ছাড়ের চেয়ে বেশি পেমেন্ট হতে পারবে না
    const due = Math.max(0, afterDiscount - paid);
    const supplier = await ensureSupplier(sourceName);
    const memoNo = val('f_pmemo').trim();

    // 5. Update purchase main row
    const { error: perr } = await sb.from('purchases').update({
      date: val('f_pdate') || oldP.date,
      memo_no: memoNo,
      brand_id: brandId,
      supplier_id: supplier.id,
      total,
      discount,
      paid,
      due,
      payment_method: paymentSel.payment_method,
      payment_account_id: paymentSel.payment_account_id
    }).eq('id', id);
    if (perr) { alert('ক্রয় আপডেট ব্যর্থ: ' + perr.message); return; }

    // 6. Replace purchase items
    await sb.from('purchase_items').delete().eq('purchase_id', id);
    const itemRows = resolvedItems.map(i => ({ purchase_id: id, product_id: i.product_id, name: i.name, qty: i.qty, cost: i.cost }));
    await sb.from('purchase_items').insert(itemRows);

    // 7. Apply new stock and new supplier due
    for (const it of resolvedItems) {
      const p = DB.products.find(x => x.id === it.product_id);
      const newQty = (p ? p.qty : 0) + it.qty;
      await sb.from('products').update({ qty: newQty, buy_price: it.cost }).eq('id', it.product_id);
    }
    const currentSup = DB.suppliers.find(x => x.id === supplier.id) || supplier;
    await sb.from('suppliers').update({ due: currentSup.due + due }).eq('id', supplier.id);

    closeModal(); await loadAll(); renderPurchases(); renderCatalog();
  } finally { setLoading(false); }
}
export async function deletePurchase(id) {
  if (!confirm('এই ক্রয়টি ডিলিট করবেন? স্টক ও সাপ্লায়ারের বকেয়া আগের অবস্থায় ফিরে যাবে।')) return;
  const p = DB.purchases.find(x => x.id === id);
  setLoading(true);
  try {
    for (const it of p.items) {
      const prod = DB.products.find(x => x.id === it.product_id);
      const newQty = Math.max(0, (prod ? prod.qty : 0) - it.qty);
      await sb.from('products').update({ qty: newQty }).eq('id', it.product_id);
    }
    const s = DB.suppliers.find(x => x.id === p.supplier_id);
    if (s) { await sb.from('suppliers').update({ due: Math.max(0, s.due - p.due) }).eq('id', s.id); }
    await sb.from('purchases').delete().eq('id', id);
    await loadAll(); renderPurchases(); renderCatalog();
  } finally { setLoading(false); }
}

window.openPurchaseModal = openPurchaseModal;
window.renderPurchaseRows = renderPurchaseRows;
window.onPurchaseProductChange = onPurchaseProductChange;
window.onPurchaseQtyChange = onPurchaseQtyChange;
window.onPurchaseCostChange = onPurchaseCostChange;
window.onPurchaseQtyInput = onPurchaseQtyInput;
window.onPurchaseCostInput = onPurchaseCostInput;
window.onPurchaseNewNameChange = onPurchaseNewNameChange;
window.onPurchaseNewMetaChange = onPurchaseNewMetaChange;
window.addPurchaseRow = addPurchaseRow;
window.removePurchaseRow = removePurchaseRow;
window.updatePurchaseTotals = updatePurchaseTotals;
window.savePurchase = savePurchase;
window.openEditPurchaseModal = openEditPurchaseModal;
window.updateEditPurchaseDue = updateEditPurchaseDue;
window.saveEditPurchase = saveEditPurchase;
window.deletePurchase = deletePurchase;

