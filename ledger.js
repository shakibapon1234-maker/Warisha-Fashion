import { sb } from './supabaseClient.js';
import { DB, loadAll } from './state.js';
import { taka, val, todayISO, emptyState, paymentMethodOptions, setLoading } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { resolvePaymentSelection } from './payment-accounts.js';

/* ============================================================ LEDGER */
let ledgerTab = 'customers';
export function setLedgerTab(k) { ledgerTab = k; buildLedgerSeg(); renderLedger(); }
export function buildLedgerSeg() {
  document.getElementById('ledgerSeg').innerHTML = `
    <button class="${ledgerTab === 'customers' ? 'active' : ''}" onclick="setLedgerTab('customers')">কাস্টমার</button>
    <button class="${ledgerTab === 'suppliers' ? 'active' : ''}" onclick="setLedgerTab('suppliers')">সাপ্লায়ার</button>`;
}
export function renderLedger() {
  const wrap = document.getElementById('ledgerContent');
  if (ledgerTab === 'customers') {
    if (!DB.customers.length) { wrap.innerHTML = emptyState('কোনো কাস্টমার নেই', ''); return; }
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>নাম</th><th>ফোন</th><th>পাওনা</th><th>অগ্রিম জমা</th><th></th></tr></thead>
      <tbody>${DB.customers.map(c => `
        <tr>
          <td>${c.name}</td><td>${c.phone || '-'}</td>
          <td class="num">${c.due > 0 ? `<span class="tag due">${taka(c.due)}</span>` : `<span class="tag paid">নেই</span>`}</td>
          <td class="num">${c.advance > 0 ? taka(c.advance) : '-'}</td>
          <td><div class="row-actions">
            ${c.due > 0 ? `<button class="btn btn-gold btn-sm" onclick="openCustPaymentModal('${c.id}')">বকেয়া আদায়</button>` : ''}
            ${c.advance > 0 && c.due > 0 ? `<button class="btn btn-ghost btn-sm" onclick="applyCustomerAdvance('${c.id}')">অগ্রিম সমন্বয়</button>` : ''}
          </div></td>
        </tr>`).join('')}</tbody></table></div>`;
  } else {
    if (!DB.suppliers.length) { wrap.innerHTML = emptyState('কোনো সাপ্লায়ার নেই', ''); return; }
    wrap.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>নাম</th><th>দেনা</th><th>অগ্রিম দেওয়া</th><th></th></tr></thead>
      <tbody>${DB.suppliers.map(s => `
        <tr>
          <td>${s.name}</td>
          <td class="num">${s.due > 0 ? `<span class="tag due">${taka(s.due)}</span>` : `<span class="tag paid">নেই</span>`}</td>
          <td class="num">${s.advance > 0 ? taka(s.advance) : '-'}</td>
          <td><div class="row-actions">
            ${s.due > 0 ? `<button class="btn btn-gold btn-sm" onclick="openSupPaymentModal('${s.id}')">দেনা পরিশোধ</button>` : ''}
            ${s.advance > 0 && s.due > 0 ? `<button class="btn btn-ghost btn-sm" onclick="applySupplierAdvance('${s.id}')">অগ্রিম সমন্বয়</button>` : ''}
          </div></td>
        </tr>`).join('')}</tbody></table></div>`;
  }
}
export function openCustPaymentModal(customerId) {
  const c = DB.customers.find(x => x.id === customerId);
  openModal(`
    <h3>বকেয়া আদায় — ${c.name}</h3><div class="stitch"></div>
    <div class="helper" style="margin-bottom:10px;">বর্তমান পাওনা: <b>${taka(c.due)}</b></div>
    <div class="field"><label>কত টাকা জমা নিচ্ছেন</label><input id="f_cpamt" type="number"></div>
    <div class="field"><label>তারিখ</label><input id="f_cpdate" type="date" value="${todayISO()}"></div>
    <div class="field"><label>পেমেন্ট মাধ্যম <span style="color:var(--danger)">*</span></label><select id="f_cpmethod" onchange="onPaymentMethodChange('f_cp')">${paymentMethodOptions('cash')}</select></div>
    <div class="field" id="f_cpAccountWrap"></div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">বাতিল</button>
    <button class="btn btn-primary" onclick="saveCustPayment('${customerId}')">জমা নিন</button></div>`);
}
export async function saveCustPayment(customerId) {
  const amount = Number(val('f_cpamt') || 0); const c = DB.customers.find(x => x.id === customerId);
  if (amount <= 0) { alert('সঠিক পরিমাণ লিখুন'); return; }
  setLoading(true);
  try {
    const paymentSel = await resolvePaymentSelection('f_cp');
    if (!paymentSel) return;
    await sb.from('payments_customer').insert({
      customer_id: customerId, amount, date: val('f_cpdate') || todayISO(),
      payment_method: paymentSel.payment_method, payment_account_id: paymentSel.payment_account_id
    });
    await sb.from('customers').update({ due: Math.max(0, c.due - amount) }).eq('id', customerId);
    closeModal(); await loadAll(); renderLedger();
  } finally { setLoading(false); }
}
export function openSupPaymentModal(supplierId) {
  const s = DB.suppliers.find(x => x.id === supplierId);
  openModal(`
    <h3>দেনা পরিশোধ — ${s.name}</h3><div class="stitch"></div>
    <div class="helper" style="margin-bottom:10px;">বর্তমান দেনা: <b>${taka(s.due)}</b></div>
    <div class="field"><label>কত টাকা পরিশোধ করছেন</label><input id="f_spamt" type="number"></div>
    <div class="field"><label>তারিখ</label><input id="f_spdate" type="date" value="${todayISO()}"></div>
    <div class="field"><label>পেমেন্ট মাধ্যম <span style="color:var(--danger)">*</span></label><select id="f_spmethod" onchange="onPaymentMethodChange('f_sp')">${paymentMethodOptions('cash')}</select></div>
    <div class="field" id="f_spAccountWrap"></div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">বাতিল</button>
    <button class="btn btn-primary" onclick="saveSupPayment('${supplierId}')">পরিশোধ করুন</button></div>`);
}
export async function saveSupPayment(supplierId) {
  const amount = Number(val('f_spamt') || 0); const s = DB.suppliers.find(x => x.id === supplierId);
  if (amount <= 0) { alert('সঠিক পরিমাণ লিখুন'); return; }
  setLoading(true);
  try {
    const paymentSel = await resolvePaymentSelection('f_sp');
    if (!paymentSel) return;
    await sb.from('payments_supplier').insert({
      supplier_id: supplierId, amount, date: val('f_spdate') || todayISO(),
      payment_method: paymentSel.payment_method, payment_account_id: paymentSel.payment_account_id
    });
    await sb.from('suppliers').update({ due: Math.max(0, s.due - amount) }).eq('id', supplierId);
    closeModal(); await loadAll(); renderLedger();
  } finally { setLoading(false); }
}
export async function applyCustomerAdvance(customerId) {
  const c = DB.customers.find(x => x.id === customerId);
  const amt = Math.min(c.due, c.advance);
  if (!confirm(`${taka(amt)} অগ্রিম থেকে বকেয়ার সাথে সমন্বয় করবেন?`)) return;
  setLoading(true);
  try {
    await sb.from('customers').update({ due: c.due - amt, advance: c.advance - amt }).eq('id', customerId);
    await loadAll(); renderLedger();
  } finally { setLoading(false); }
}
export async function applySupplierAdvance(supplierId) {
  const s = DB.suppliers.find(x => x.id === supplierId);
  const amt = Math.min(s.due, s.advance);
  if (!confirm(`${taka(amt)} অগ্রিম থেকে দেনার সাথে সমন্বয় করবেন?`)) return;
  setLoading(true);
  try {
    await sb.from('suppliers').update({ due: s.due - amt, advance: s.advance - amt }).eq('id', supplierId);
    await loadAll(); renderLedger();
  } finally { setLoading(false); }
}

window.setLedgerTab = setLedgerTab;
window.openCustPaymentModal = openCustPaymentModal;
window.saveCustPayment = saveCustPayment;
window.openSupPaymentModal = openSupPaymentModal;
window.saveSupPayment = saveSupPayment;
window.applyCustomerAdvance = applyCustomerAdvance;
window.applySupplierAdvance = applySupplierAdvance;
