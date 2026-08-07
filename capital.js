import { sb } from './supabaseClient.js';
import { DB, loadAll, ensureCustomer, ensureSupplier, customerName, supplierName } from './state.js';
import { taka, val, todayISO, dateBn, emptyState, escapeHTML, paymentMethodOptions, setLoading } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { resolvePaymentSelection, paymentMethodDisplay, renderPaymentAccountField } from './payment-accounts.js';

/* ============================================================ CAPITAL */
let capitalTab = 'investment';
export function setCapitalTab(k) { capitalTab = k; buildCapitalSeg(); renderCapital(); }
export function buildCapitalSeg() {
  document.getElementById('capitalSeg').innerHTML = `
    <button class="${capitalTab === 'investment' ? 'active' : ''}" onclick="setCapitalTab('investment')">ইনভেস্টমেন্ট</button>
    <button class="${capitalTab === 'advance' ? 'active' : ''}" onclick="setCapitalTab('advance')">অ্যাডভান্স</button>`;
}
export function renderCapital() {
  const wrap = document.getElementById('capitalContent');
  if (capitalTab === 'investment') {
    const total = DB.investments.reduce((s, x) => s + x.amount, 0);
    wrap.innerHTML = `
      <div class="panel-flex"><div class="helper">মোট ইনভেস্টমেন্ট: <b>${taka(total)}</b></div>
        <button class="btn btn-primary btn-sm" onclick="openInvestModal()">+ নতুন ইনভেস্টমেন্ট</button></div>
      <div class="table-wrap"><div id="investTable"></div></div>`;
    const rows = [...DB.investments].sort((a, b) => b.date.localeCompare(a.date));
    document.getElementById('investTable').innerHTML = rows.length ? `
      <table><thead><tr><th>তারিখ</th><th>কে দিলেন</th><th>নোট</th><th>টাকা</th><th>মাধ্যম</th><th></th></tr></thead>
      <tbody>${rows.map(x => `<tr><td>${dateBn(x.date)}</td><td>${escapeHTML(x.person)}</td><td>${escapeHTML(x.note || '-')}</td>
        <td class="num">${taka(x.amount)}</td>
        <td><span class="tag ${x.payment_method}">${escapeHTML(paymentMethodDisplay(x.payment_method, x.payment_account_id))}</span></td>
        <td><div class="row-actions">
          <button class="btn btn-ghost btn-sm" onclick="openEditInvestModal('${x.id}')">এডিট</button>
          <button class="btn btn-danger-ghost btn-sm" onclick="deleteInvest('${x.id}')">ডিলিট</button>
        </div></td></tr>`).join('')}</tbody></table>`
      : emptyState('কোনো ইনভেস্টমেন্ট নেই', '');
  } else {
    wrap.innerHTML = `
      <div class="panel-flex"><div></div>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" onclick="openAdvanceModal('customer')">+ কাস্টমার অগ্রিম</button>
          <button class="btn btn-ghost btn-sm" onclick="openAdvanceModal('supplier')">+ সাপ্লায়ার অগ্রিম</button>
        </div></div>
      <h3 style="font-size:14px;color:var(--teal-900);">কাস্টমার থেকে পাওয়া অগ্রিম</h3>
      <div class="table-wrap"><div id="custAdvTable"></div></div>
      <h3 style="font-size:14px;color:var(--teal-900);">সাপ্লায়ারকে দেওয়া অগ্রিম</h3>
      <div class="table-wrap"><div id="supAdvTable"></div></div>`;
    const cr = [...DB.advances_customer].sort((a, b) => b.date.localeCompare(a.date));
    document.getElementById('custAdvTable').innerHTML = cr.length ? `
      <table><thead><tr><th>তারিখ</th><th>কাস্টমার</th><th>নোট</th><th>টাকা</th><th>মাধ্যম</th><th></th></tr></thead>
      <tbody>${cr.map(x => `<tr><td>${dateBn(x.date)}</td><td>${escapeHTML(customerName(x.customer_id))}</td><td>${escapeHTML(x.note || '-')}</td><td class="num">${taka(x.amount)}</td>
        <td><span class="tag ${x.payment_method}">${escapeHTML(paymentMethodDisplay(x.payment_method, x.payment_account_id))}</span></td>
        <td><div class="row-actions">
          <button class="btn btn-ghost btn-sm" onclick="openEditAdvanceModal('customer','${x.id}')">এডিট</button>
          <button class="btn btn-danger-ghost btn-sm" onclick="deleteAdvance('customer','${x.id}','${x.customer_id}',${x.amount})">ডিলিট</button>
        </div></td></tr>`).join('')}</tbody></table>`
      : emptyState('কোনো তথ্য নেই', '');
    const sr = [...DB.advances_supplier].sort((a, b) => b.date.localeCompare(a.date));
    document.getElementById('supAdvTable').innerHTML = sr.length ? `
      <table><thead><tr><th>তারিখ</th><th>সাপ্লায়ার</th><th>নোট</th><th>টাকা</th><th>মাধ্যম</th><th></th></tr></thead>
      <tbody>${sr.map(x => `<tr><td>${dateBn(x.date)}</td><td>${escapeHTML(supplierName(x.supplier_id))}</td><td>${escapeHTML(x.note || '-')}</td><td class="num">${taka(x.amount)}</td>
        <td><span class="tag ${x.payment_method}">${escapeHTML(paymentMethodDisplay(x.payment_method, x.payment_account_id))}</span></td>
        <td><div class="row-actions">
          <button class="btn btn-ghost btn-sm" onclick="openEditAdvanceModal('supplier','${x.id}')">এডিট</button>
          <button class="btn btn-danger-ghost btn-sm" onclick="deleteAdvance('supplier','${x.id}','${x.supplier_id}',${x.amount})">ডিলিট</button>
        </div></td></tr>`).join('')}</tbody></table>`
      : emptyState('কোনো তথ্য নেই', '');
  }
}

/* ---- Investment Modal (New) ---- */
export function openInvestModal() {
  openModal(`
    <h3>নতুন ইনভেস্টমেন্ট</h3><div class="stitch"></div>
    <div class="field"><label>কে দিলেন (মালিক/পার্টনার)</label><input id="f_iperson" placeholder="যেমন: মালিক"></div>
    <div class="row2"><div class="field"><label>টাকা</label><input id="f_iamt" type="number"></div>
    <div class="field"><label>তারিখ</label><input id="f_idate" type="date" value="${todayISO()}"></div></div>
    <div class="field"><label>পেমেন্ট মাধ্যম <span style="color:var(--danger)">*</span></label><select id="f_imethod" onchange="onPaymentMethodChange('f_i')">${paymentMethodOptions('cash')}</select></div>
    <div class="field" id="f_iAccountWrap"></div>
    <div class="field"><label>নোট (ঐচ্ছিক)</label><textarea id="f_inote" rows="2"></textarea></div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">বাতিল</button>
    <button class="btn btn-primary" onclick="saveInvest()">সেভ করুন</button></div>`);
}

/* ---- Investment Modal (Edit) ---- */
export function openEditInvestModal(id) {
  const x = DB.investments.find(r => r.id === id);
  if (!x) return;
  openModal(`
    <h3>ইনভেস্টমেন্ট এডিট করুন</h3><div class="stitch"></div>
    <div class="field"><label>কে দিলেন (মালিক/পার্টনার)</label><input id="f_iperson" value="${x.person}" placeholder="যেমন: মালিক"></div>
    <div class="row2"><div class="field"><label>টাকা</label><input id="f_iamt" type="number" value="${x.amount}"></div>
    <div class="field"><label>তারিখ</label><input id="f_idate" type="date" value="${x.date}"></div></div>
    <div class="field"><label>পেমেন্ট মাধ্যম <span style="color:var(--danger)">*</span></label><select id="f_imethod" onchange="onPaymentMethodChange('f_i')">${paymentMethodOptions(x.payment_method)}</select></div>
    <div class="field" id="f_iAccountWrap"></div>
    <div class="field"><label>নোট (ঐচ্ছিক)</label><textarea id="f_inote" rows="2">${x.note || ''}</textarea></div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">বাতিল</button>
    <button class="btn btn-primary" onclick="saveEditInvest('${id}')">আপডেট করুন</button></div>`);
  if (x.payment_method !== 'cash') {
    renderPaymentAccountField('f_i', x.payment_method, x.payment_account_id);
  }
}

export async function saveInvest() {
  const person = val('f_iperson'), amount = Number(val('f_iamt') || 0);
  if (!person || amount <= 0) { alert('নাম ও সঠিক টাকা দিন'); return; }
  setLoading(true);
  try {
    const paymentSel = await resolvePaymentSelection('f_i');
    if (!paymentSel) return;
    const { error } = await sb.from('investments').insert({
      person, amount, note: val('f_inote'), date: val('f_idate') || todayISO(),
      payment_method: paymentSel.payment_method, payment_account_id: paymentSel.payment_account_id
    });
    if (error) { alert('সেভ ব্যর্থ: ' + error.message); return; }
    closeModal(); await loadAll(); renderCapital();
  } finally { setLoading(false); }
}

export async function saveEditInvest(id) {
  const person = val('f_iperson'), amount = Number(val('f_iamt') || 0);
  if (!person || amount <= 0) { alert('নাম ও সঠিক টাকা দিন'); return; }
  setLoading(true);
  try {
    const paymentSel = await resolvePaymentSelection('f_i');
    if (!paymentSel) return;
    const { error } = await sb.from('investments').update({
      person, amount, note: val('f_inote'), date: val('f_idate') || todayISO(),
      payment_method: paymentSel.payment_method, payment_account_id: paymentSel.payment_account_id
    }).eq('id', id);
    if (error) { alert('আপডেট ব্যর্থ: ' + error.message); return; }
    closeModal(); await loadAll(); renderCapital();
  } finally { setLoading(false); }
}

export async function deleteInvest(id) {
  if (!confirm('ডিলিট করবেন?')) return;
  setLoading(true);
  try {
    await sb.from('investments').delete().eq('id', id);
    await loadAll(); renderCapital();
  } finally { setLoading(false); }
}

/* ---- Advance Modal (New) ---- */
export function openAdvanceModal(kind) {
  const isCust = kind === 'customer';
  openModal(`
    <h3>${isCust ? 'কাস্টমার থেকে অগ্রিম' : 'সাপ্লায়ারকে অগ্রিম'}</h3><div class="stitch"></div>
    <div class="field"><label>${isCust ? 'কাস্টমারের নাম' : 'সাপ্লায়ারের নাম'}</label>
      <input id="f_aname" list="${isCust ? 'custList2' : 'supList2'}">
      <datalist id="${isCust ? 'custList2' : 'supList2'}">${(isCust ? DB.customers : DB.suppliers).map(x => `<option value="${x.name}">`).join('')}</datalist>
    </div>
    <div class="row2"><div class="field"><label>টাকা</label><input id="f_aamt" type="number"></div>
    <div class="field"><label>তারিখ</label><input id="f_adate" type="date" value="${todayISO()}"></div></div>
    <div class="field"><label>পেমেন্ট মাধ্যম <span style="color:var(--danger)">*</span></label><select id="f_amethod" onchange="onPaymentMethodChange('f_a')">${paymentMethodOptions('cash')}</select></div>
    <div class="field" id="f_aAccountWrap"></div>
    <div class="field"><label>নোট (ঐচ্ছিক)</label><textarea id="f_anote" rows="2"></textarea></div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">বাতিল</button>
    <button class="btn btn-primary" onclick="saveAdvance('${kind}')">সেভ করুন</button></div>`);
}

/* ---- Advance Modal (Edit) ---- */
export function openEditAdvanceModal(kind, id) {
  const isCust = kind === 'customer';
  const table = isCust ? 'advances_customer' : 'advances_supplier';
  const arr = isCust ? DB.advances_customer : DB.advances_supplier;
  const x = arr.find(r => r.id === id);
  if (!x) return;
  const personName = isCust ? customerName(x.customer_id) : supplierName(x.supplier_id);
  openModal(`
    <h3>${isCust ? 'কাস্টমার অগ্রিম এডিট' : 'সাপ্লায়ার অগ্রিম এডিট'}</h3><div class="stitch"></div>
    <div class="field"><label>${isCust ? 'কাস্টমারের নাম' : 'সাপ্লায়ারের নাম'}</label>
      <input id="f_aname" value="${personName}" list="${isCust ? 'custList2' : 'supList2'}" readonly style="background:var(--surface-2);color:var(--text-muted);">
      <datalist id="${isCust ? 'custList2' : 'supList2'}">${(isCust ? DB.customers : DB.suppliers).map(x => `<option value="${x.name}">`).join('')}</datalist>
    </div>
    <div class="row2"><div class="field"><label>টাকা</label><input id="f_aamt" type="number" value="${x.amount}"></div>
    <div class="field"><label>তারিখ</label><input id="f_adate" type="date" value="${x.date}"></div></div>
    <div class="field"><label>পেমেন্ট মাধ্যম <span style="color:var(--danger)">*</span></label><select id="f_amethod" onchange="onPaymentMethodChange('f_a')">${paymentMethodOptions(x.payment_method)}</select></div>
    <div class="field" id="f_aAccountWrap"></div>
    <div class="field"><label>নোট (ঐচ্ছিক)</label><textarea id="f_anote" rows="2">${x.note || ''}</textarea></div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">বাতিল</button>
    <button class="btn btn-primary" onclick="saveEditAdvance('${kind}','${id}',${x.amount})">আপডেট করুন</button></div>`);
  if (x.payment_method !== 'cash') {
    renderPaymentAccountField('f_a', x.payment_method, x.payment_account_id);
  }
}

export async function saveAdvance(kind) {
  const name = val('f_aname'); const amount = Number(val('f_aamt') || 0);
  if (!name || amount <= 0) { alert('নাম ও সঠিক টাকা দিন'); return; }
  const date = val('f_adate') || todayISO(); const note = val('f_anote');
  setLoading(true);
  try {
    const paymentSel = await resolvePaymentSelection('f_a');
    if (!paymentSel) return;
    if (kind === 'customer') {
      const c = await ensureCustomer(name);
      await sb.from('advances_customer').insert({
        customer_id: c.id, amount, note, date,
        payment_method: paymentSel.payment_method, payment_account_id: paymentSel.payment_account_id
      });
      await sb.from('customers').update({ advance: c.advance + amount }).eq('id', c.id);
    } else {
      const s = await ensureSupplier(name);
      await sb.from('advances_supplier').insert({
        supplier_id: s.id, amount, note, date,
        payment_method: paymentSel.payment_method, payment_account_id: paymentSel.payment_account_id
      });
      await sb.from('suppliers').update({ advance: s.advance + amount }).eq('id', s.id);
    }
    closeModal(); await loadAll(); renderCapital();
  } finally { setLoading(false); }
}

export async function saveEditAdvance(kind, id, oldAmount) {
  const newAmount = Number(val('f_aamt') || 0);
  if (newAmount <= 0) { alert('সঠিক টাকা দিন'); return; }
  const date = val('f_adate') || todayISO();
  const note = val('f_anote');
  setLoading(true);
  try {
    const paymentSel = await resolvePaymentSelection('f_a');
    if (!paymentSel) return;
    if (kind === 'customer') {
      const rec = DB.advances_customer.find(r => r.id === id);
      const cust = DB.customers.find(c => c.id === rec.customer_id);
      const { error } = await sb.from('advances_customer').update({
        amount: newAmount, note, date,
        payment_method: paymentSel.payment_method, payment_account_id: paymentSel.payment_account_id
      }).eq('id', id);
      if (error) { alert('আপডেট ব্যর্থ: ' + error.message); return; }
      if (cust) {
        const newAdv = Math.max(0, cust.advance - oldAmount + newAmount);
        await sb.from('customers').update({ advance: newAdv }).eq('id', cust.id);
      }
    } else {
      const rec = DB.advances_supplier.find(r => r.id === id);
      const sup = DB.suppliers.find(s => s.id === rec.supplier_id);
      const { error } = await sb.from('advances_supplier').update({
        amount: newAmount, note, date,
        payment_method: paymentSel.payment_method, payment_account_id: paymentSel.payment_account_id
      }).eq('id', id);
      if (error) { alert('আপডেট ব্যর্থ: ' + error.message); return; }
      if (sup) {
        const newAdv = Math.max(0, sup.advance - oldAmount + newAmount);
        await sb.from('suppliers').update({ advance: newAdv }).eq('id', sup.id);
      }
    }
    closeModal(); await loadAll(); renderCapital();
  } finally { setLoading(false); }
}

export async function deleteAdvance(kind, id, entityId, amount) {
  if (!confirm('এই অগ্রিম এন্ট্রি ডিলিট করবেন?')) return;
  setLoading(true);
  try {
    if (kind === 'customer') {
      const cust = DB.customers.find(c => c.id === entityId);
      await sb.from('advances_customer').delete().eq('id', id);
      if (cust) await sb.from('customers').update({ advance: Math.max(0, cust.advance - amount) }).eq('id', cust.id);
    } else {
      const sup = DB.suppliers.find(s => s.id === entityId);
      await sb.from('advances_supplier').delete().eq('id', id);
      if (sup) await sb.from('suppliers').update({ advance: Math.max(0, sup.advance - amount) }).eq('id', sup.id);
    }
    await loadAll(); renderCapital();
  } finally { setLoading(false); }
}

window.setCapitalTab = setCapitalTab;
window.openInvestModal = openInvestModal;
window.openEditInvestModal = openEditInvestModal;
window.saveInvest = saveInvest;
window.saveEditInvest = saveEditInvest;
window.deleteInvest = deleteInvest;
window.openAdvanceModal = openAdvanceModal;
window.openEditAdvanceModal = openEditAdvanceModal;
window.saveAdvance = saveAdvance;
window.saveEditAdvance = saveEditAdvance;
window.deleteAdvance = deleteAdvance;
