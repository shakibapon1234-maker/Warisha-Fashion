import { sb } from './supabaseClient.js';
import { DB, loadAll } from './state.js';
import { brandName, supplierName, ensureSupplier } from './state.js';
import { taka, val, todayISO, dateBn, emptyState, paymentMethodOptions, paymentMethodLabel, setLoading } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { renderCatalog } from './catalog.js';

/* ============================================================ PURCHASES */
export function renderPurchases() {
  const wrap = document.getElementById('purchasesTable');
  if (!DB.purchases.length) { wrap.innerHTML = emptyState('কোনো ক্রয় নেই', 'প্রথম ক্রয়টি যোগ করুন'); return; }
  const rows = [...DB.purchases].sort((a, b) => b.date.localeCompare(a.date));
  wrap.innerHTML = `
    <table>
      <thead><tr><th>তারিখ</th><th>ব্র্যান্ড</th><th>সোর্স</th><th>প্রোডাক্ট</th><th>মোট</th><th>পেইড</th><th>মাধ্যম</th><th>বাকি</th><th></th></tr></thead>
      <tbody>
        ${rows.map(p => `
          <tr>
            <td>${dateBn(p.date)}</td><td>${brandName(p.brand_id)}</td><td>${supplierName(p.supplier_id)}</td>
            <td>${p.items.map(i => `${i.name} × ${i.qty}`).join(', ')}</td>
            <td class="num">${taka(p.total)}</td><td class="num">${taka(p.paid)}</td>
            <td><span class="tag ${p.payment_method}">${paymentMethodLabel(p.payment_method)}</span></td>
            <td class="num">${p.due > 0 ? `<span class="tag due">${taka(p.due)}</span>` : `<span class="tag paid">নেই</span>`}</td>
            <td><button class="btn btn-danger-ghost btn-sm" onclick="deletePurchase('${p.id}')">ডিলিট</button></td>
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
      <div class="field"><label>পেইড হয়েছে</label><input id="f_ppaid" type="number" value="0" oninput="updatePurchaseTotals()"></div>
    </div>
    <div class="field"><label>পেমেন্ট মাধ্যম</label><select id="f_pmethod">${paymentMethodOptions('cash')}</select></div>
    <div class="totals-box">
      <div class="r"><span>সর্বমোট</span><b id="pTotal" class="num">৳০</b></div>
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
  if (!bid || bid === '__newbrand__') return [];
  return DB.products.filter(p => p.brand_id === bid);
}
export function renderPurchaseRows() {
  const prods = currentPurchaseBrandProducts();
  document.getElementById('pItemRows').innerHTML = purchaseItems.map((it, idx) => `
    <div class="item-row">
      <div class="row3">
        <div class="field" style="margin:0;"><label>প্রোডাক্ট</label>
          <select onchange="onPurchaseProductChange(${idx}, this.value)">
            <option value="">-- বাছাই বা নতুন --</option>
            ${prods.map(p => `<option value="${p.id}" ${p.id === it.product_id ? 'selected' : ''}>${p.name} (স্টক ${p.qty})</option>`).join('')}
            <option value="__new__" ${it.product_id === '__new__' ? 'selected' : ''}>➕ নতুন প্রোডাক্ট</option>
          </select>
        </div>
        <div class="field" style="margin:0;"><label>Quantity</label><input type="number" min="1" value="${it.qty}" oninput="onPurchaseQtyChange(${idx}, this.value)"></div>
        <div class="field" style="margin:0;"><label>ক্রয়মূল্য/পিস</label><input type="number" value="${it.cost}" oninput="onPurchaseCostChange(${idx}, this.value)"></div>
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
  if (pid && pid !== '__new__') { const p = DB.products.find(x => x.id === pid); purchaseItems[idx].name = p.name; purchaseItems[idx].cost = p.buy_price; }
  renderPurchaseRows();
}
export function onPurchaseQtyChange(idx, v) { purchaseItems[idx].qty = Number(v || 1); renderPurchaseRows(); }
export function onPurchaseCostChange(idx, v) { purchaseItems[idx].cost = Number(v || 0); renderPurchaseRows(); }
export function onPurchaseNewNameChange(idx, v) { purchaseItems[idx].new_name = v; }
export function onPurchaseNewMetaChange(idx, v) { purchaseItems[idx].new_meta = v; }
export function addPurchaseRow() { purchaseItems.push({ product_id: '', qty: 1, cost: 0 }); renderPurchaseRows(); }
export function removePurchaseRow(idx) { purchaseItems.splice(idx, 1); renderPurchaseRows(); }
export function updatePurchaseTotals() {
  const total = purchaseItems.reduce((s, i) => s + i.qty * i.cost, 0);
  const paid = Number(val('f_ppaid') || 0);
  document.getElementById('pTotal').textContent = taka(total);
  document.getElementById('pDue').textContent = taka(Math.max(0, total - paid));
}
export async function savePurchase() {
  let brandId = val('f_pubrand');
  if (!brandId) { alert('ব্র্যান্ড বাছাই করুন'); return; }
  const sourceName = val('f_source');
  if (!sourceName) { alert('সোর্স/সাপ্লায়ারের নাম দিন'); return; }
  const validItems = purchaseItems.filter(i => i.product_id && i.qty > 0);
  if (!validItems.length) { alert('অন্তত একটা প্রোডাক্ট বাছাই করুন'); return; }
  const paymentMethod = val('f_pmethod') || 'cash';

  setLoading(true);
  try {
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
    const paid = Number(val('f_ppaid') || 0);
    const due = Math.max(0, total - paid);
    const supplier = await ensureSupplier(sourceName);

    const { data: purchaseRow, error: perr } = await sb.from('purchases').insert({
      date: val('f_pdate') || todayISO(), brand_id: brandId, supplier_id: supplier.id, total, paid, due, payment_method: paymentMethod
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
window.onPurchaseNewNameChange = onPurchaseNewNameChange;
window.onPurchaseNewMetaChange = onPurchaseNewMetaChange;
window.addPurchaseRow = addPurchaseRow;
window.removePurchaseRow = removePurchaseRow;
window.updatePurchaseTotals = updatePurchaseTotals;
window.savePurchase = savePurchase;
window.deletePurchase = deletePurchase;
