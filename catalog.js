import { sb } from './supabaseClient.js';
import { DB, loadAll } from './state.js';
import { taka, val, emptyState, escapeHTML } from './utils.js';
import { openModal, closeModal } from './modal.js';

/* ============================================================ CATALOG (Brand + Products) */
export function brandStats(brandId) {
  const items = DB.products.filter(p => p.brand_id === brandId);
  return { qty: items.reduce((s, p) => s + p.qty, 0), value: items.reduce((s, p) => s + p.qty * p.buy_price, 0) };
}
export function productSummary() {
  const map = new Map();
  DB.products.forEach(p => {
    const key = (p.name || '').trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, { name: p.name, qty: 0, value: 0, brands: new Set() });
    }
    const row = map.get(key);
    row.qty += p.qty;
    row.value += p.qty * p.buy_price;
    const brand = DB.brands.find(b => b.id === p.brand_id);
    if (brand) row.brands.add(brand.name);
  });
  return [...map.values()].sort((a, b) => b.qty - a.qty);
}
export function renderProductSummary() {
  const wrap = document.getElementById('productSummaryList');
  if (!wrap) return;
  const rows = productSummary();
  if (!rows.length) { wrap.innerHTML = emptyState('কোনো প্রোডাক্ট নেই', 'প্রথমে একটা প্রোডাক্ট যোগ করুন'); return; }
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  wrap.innerHTML = `
    <div class="table-wrap" style="margin-bottom:0;">
      <table>
        <thead><tr><th>প্রোডাক্টের নাম</th><th>ব্র্যান্ড</th><th>মোট Quantity</th><th>মোট স্টক ভ্যালু</th></tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${escapeHTML(r.name)}</td>
              <td>${[...r.brands].map(escapeHTML).join(', ')}</td>
              <td class="num">${r.qty} ${r.qty <= 3 ? '<span class="tag low">কম</span>' : ''}</td>
              <td class="num">${taka(r.value)}</td>
            </tr>`).join('')}
          <tr style="background:rgba(255,255,255,.06);">
            <td colspan="2"><b>সর্বমোট</b></td>
            <td class="num"><b>${totalQty}</b></td>
            <td class="num"><b>${taka(totalValue)}</b></td>
          </tr>
        </tbody>
      </table>
    </div>`;
}
export function renderCatalog() {
  renderProductSummary();
  const wrap = document.getElementById('catalogList');
  if (!DB.brands.length) { wrap.innerHTML = emptyState('কোনো ব্র্যান্ড নেই', 'প্রথমে একটা ব্র্যান্ড যোগ করুন'); return; }
  wrap.innerHTML = DB.brands.map(b => {
    const stats = brandStats(b.id);
    const products = DB.products.filter(p => p.brand_id === b.id);
    return `
    <div class="panel brand-panel">
      <div class="panel-flex">
        <div>
          <h3 style="margin-bottom:2px;">${escapeHTML(b.name)}</h3>
          <div class="helper">মোট ${stats.qty} পিস &nbsp;•&nbsp; স্টক ভ্যালু ${taka(stats.value)}</div>
        </div>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" onclick="openProductModal(null,'${b.id}')">+ প্রোডাক্ট</button>
          <button class="btn btn-ghost btn-sm" onclick="openBrandModal('${b.id}')">এডিট</button>
          <button class="btn btn-danger-ghost btn-sm" onclick="deleteBrand('${b.id}')">ডিলিট</button>
        </div>
      </div>
      ${products.length ? `
      <div class="table-wrap" style="margin-bottom:0;">
        <table>
          <thead><tr><th>নাম</th><th>ক্যাটাগরি</th><th>সাইজ/রং</th><th>ক্রয়মূল্য</th><th>Quantity</th><th>স্টক ভ্যালু</th><th></th></tr></thead>
          <tbody>
            ${products.map(p => `
              <tr>
                <td>${escapeHTML(p.name)}</td><td>${escapeHTML(p.category || '-')}</td><td>${escapeHTML(p.size || '-')} / ${escapeHTML(p.color || '-')}</td>
                <td class="num">${taka(p.buy_price)}</td>
                <td class="num">${p.qty} ${p.qty <= 3 ? '<span class="tag low">কম</span>' : ''}</td>
                <td class="num">${taka(p.qty * p.buy_price)}</td>
                <td><div class="row-actions">
                  <button class="btn btn-ghost btn-sm" onclick="openProductModal('${p.id}')">এডিট</button>
                  <button class="btn btn-danger-ghost btn-sm" onclick="deleteProduct('${p.id}')">ডিলিট</button>
                </div></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : `<div class="helper">এই ব্র্যান্ডে এখনো কোনো প্রোডাক্ট নেই।</div>`}
    </div>`;
  }).join('');
}
export function openBrandModal(id) {
  const b = id ? DB.brands.find(x => x.id === id) : null;
  openModal(`
    <h3>${b ? 'ব্র্যান্ড এডিট' : 'নতুন ব্র্যান্ড'}</h3><div class="stitch"></div>
    <div class="field"><label>ব্র্যান্ডের নাম</label><input id="f_bname" value="${b ? b.name : ''}" placeholder="যেমন: Aarong"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">বাতিল</button>
      <button class="btn btn-primary" onclick="saveBrand(${b ? `'${b.id}'` : 'null'})">সেভ করুন</button>
    </div>`);
}
export async function saveBrand(id) {
  const name = val('f_bname');
  if (!name) { alert('ব্র্যান্ডের নাম দিন'); return; }
  const { error } = id ? await sb.from('brands').update({ name }).eq('id', id) : await sb.from('brands').insert({ name });
  if (error) { alert('সেভ ব্যর্থ: ' + error.message); return; }
  closeModal(); await loadAll(); renderCatalog();
}
export async function deleteBrand(id) {
  if (DB.products.some(p => p.brand_id === id)) { alert('এই ব্র্যান্ডে প্রোডাক্ট আছে, আগে প্রোডাক্টগুলো সরান।'); return; }
  if (!confirm('ব্র্যান্ডটি ডিলিট করবেন?')) return;
  const { error } = await sb.from('brands').delete().eq('id', id);
  if (error) { alert('ডিলিট ব্যর্থ: ' + error.message); return; }
  await loadAll(); renderCatalog();
}
export function openProductModal(id, presetBrandId) {
  const p = id ? DB.products.find(x => x.id === id) : null;
  const brandOpts = DB.brands.map(b => `<option value="${b.id}" ${((p ? p.brand_id : presetBrandId) === b.id) ? 'selected' : ''}>${b.name}</option>`).join('');
  openModal(`
    <h3>${p ? 'প্রোডাক্ট এডিট' : 'নতুন প্রোডাক্ট'}</h3><div class="stitch"></div>
    <div class="field"><label>ব্র্যান্ড</label><select id="f_pbrand">${brandOpts}</select></div>
    <div class="field"><label>প্রোডাক্টের নাম</label><input id="f_name" value="${p ? p.name : ''}" placeholder="যেমন: জামদানি থ্রিপিস"></div>
    <div class="row2">
      <div class="field"><label>ক্যাটাগরি</label><input id="f_cat" value="${p ? p.category : ''}"></div>
      <div class="field"><label>সাইজ</label><input id="f_size" value="${p ? p.size : ''}"></div>
    </div>
    <div class="row2">
      <div class="field"><label>রং</label><input id="f_color" value="${p ? p.color : ''}"></div>
      <div class="field"><label>Quantity</label><input id="f_qty" type="number" value="${p ? p.qty : 0}"></div>
    </div>
    <div class="field"><label>ক্রয়মূল্য (প্রতি পিস)</label><input id="f_buy" type="number" value="${p ? p.buy_price : ''}"></div>
    <div class="helper">বিক্রয়মূল্য এখানে লাগবে না — সেটা বিক্রয়ের সময় বসবে।</div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">বাতিল</button>
      <button class="btn btn-primary" onclick="saveProduct(${p ? `'${p.id}'` : 'null'})">সেভ করুন</button>
    </div>`);
}
export async function saveProduct(id) {
  const data = {
    brand_id: val('f_pbrand'), name: val('f_name'), category: val('f_cat'), size: val('f_size'),
    color: val('f_color'), qty: Number(val('f_qty') || 0), buy_price: Number(val('f_buy') || 0)
  };
  if (!data.name) { alert('প্রোডাক্টের নাম দিন'); return; }
  if (!data.brand_id) { alert('একটা ব্র্যান্ড বাছাই করুন'); return; }
  const { error } = id ? await sb.from('products').update(data).eq('id', id) : await sb.from('products').insert(data);
  if (error) { alert('সেভ ব্যর্থ: ' + error.message); return; }
  closeModal(); await loadAll(); renderCatalog();
}
export async function deleteProduct(id) {
  // Check if this product is used in any purchase
  const { data: usedInPurchase, error: checkError } = await sb
    .from('purchase_items')
    .select('id')
    .eq('product_id', id)
    .limit(1);

  if (checkError) { alert('ত্রুটি: ' + checkError.message); return; }

  if (usedInPurchase && usedInPurchase.length > 0) {
    alert('এই প্রোডাক্টটি ডিলিট করা যাবে না।\n\nকারণ: এই প্রোডাক্টের ক্রয়ের ইতিহাস আছে। ক্রয়ের রেকর্ড মুছলে তারপর এটি ডিলিট করতে পারবেন।');
    return;
  }

  if (!confirm('এই প্রোডাক্টটি ডিলিট করবেন?')) return;
  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) { alert('ডিলিট ব্যর্থ: ' + error.message); return; }
  await loadAll(); renderCatalog();
}

window.openBrandModal = openBrandModal;
window.saveBrand = saveBrand;
window.deleteBrand = deleteBrand;
window.openProductModal = openProductModal;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
