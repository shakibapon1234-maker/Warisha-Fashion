import { sb } from './supabaseClient.js';
import { DB, loadAll } from './state.js';
import { taka, val, todayISO, dateBn, emptyState, escapeHTML, paymentMethodOptions, setLoading } from './utils.js';
import { openModal, closeModal } from './modal.js';
import { resolvePaymentSelection, paymentMethodDisplay } from './payment-accounts.js';

/* ============================================================ EXPENSES */
export function renderExpenses() {
  const wrap = document.getElementById('expensesTable');
  if (!DB.expenses.length) { wrap.innerHTML = emptyState('কোনো খরচ নেই', 'প্রথম খরচ যোগ করুন'); return; }
  const rows = [...DB.expenses].sort((a, b) => b.date.localeCompare(a.date));
  wrap.innerHTML = `<table><thead><tr><th>তারিখ</th><th>খাত</th><th>নোট</th><th>টাকা</th><th>মাধ্যম</th><th></th></tr></thead>
    <tbody>${rows.map(e => `<tr><td>${dateBn(e.date)}</td><td>${escapeHTML(e.category)}</td><td>${escapeHTML(e.note || '-')}</td>
      <td class="num">${taka(e.amount)}</td>
      <td><span class="tag ${e.payment_method}">${escapeHTML(paymentMethodDisplay(e.payment_method, e.payment_account_id))}</span></td>
      <td><div class="row-actions">
        <button class="btn btn-ghost btn-sm" onclick="openEditExpenseModal('${e.id}')">এডিট</button>
        <button class="btn btn-danger-ghost btn-sm" onclick="deleteExpense('${e.id}')">ডিলিট</button>
      </div></td></tr>`).join('')}</tbody></table>`;
}
export function openExpenseModal() {
  openModal(`
    <h3>নতুন খরচ</h3><div class="stitch"></div>
    <div class="field"><label>খাত</label><input id="f_ecat" placeholder="দোকান ভাড়া / বিদ্যুৎ / পরিবহন..."></div>
    <div class="row2"><div class="field"><label>টাকা</label><input id="f_eamt" type="number"></div>
    <div class="field"><label>তারিখ</label><input id="f_edate" type="date" value="${todayISO()}"></div></div>
    <div class="field"><label>পেমেন্ট মাধ্যম <span style="color:var(--danger)">*</span></label><select id="f_emethod" onchange="onPaymentMethodChange('f_e')">${paymentMethodOptions('cash')}</select></div>
    <div class="field" id="f_eAccountWrap"></div>
    <div class="field"><label>নোট (ঐচ্ছিক)</label><textarea id="f_enote" rows="2"></textarea></div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">বাতিল</button>
    <button class="btn btn-primary" onclick="saveExpense()">সেভ করুন</button></div>`);
}
export function openEditExpenseModal(id) {
  const e = DB.expenses.find(x => x.id === id);
  if (!e) return;
  openModal(`
    <h3>খরচ এডিট করুন</h3><div class="stitch"></div>
    <div class="field"><label>খাত</label><input id="ee_cat" value="${escapeHTML(e.category)}"></div>
    <div class="row2">
      <div class="field"><label>টাকা</label><input id="ee_amt" type="number" value="${e.amount}"></div>
      <div class="field"><label>তারিখ</label><input id="ee_date" type="date" value="${e.date}"></div>
    </div>
    <div class="field"><label>পেমেন্ট মাধ্যম <span style="color:var(--danger)">*</span></label><select id="ee_method" onchange="onPaymentMethodChange('ee_')">${paymentMethodOptions(e.payment_method)}</select></div>
    <div class="field" id="ee_AccountWrap"></div>
    <div class="field"><label>নোট (এচ্ছিক)</label><textarea id="ee_note" rows="2">${e.note || ''}</textarea></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">বাতিল</button>
      <button class="btn btn-primary" onclick="saveEditExpense('${id}')">আপডেট করুন</button>
    </div>`);
  if (e.payment_method !== 'cash') {
    import('./payment-accounts.js').then(m => m.renderPaymentAccountField('ee_', e.payment_method, e.payment_account_id));
  }
}
export async function saveEditExpense(id) {
  const category = val('ee_cat'), amount = Number(val('ee_amt') || 0);
  if (!category || amount <= 0) { alert('খাত ও সঠিক টাকার পরিমাণ দিন'); return; }
  setLoading(true);
  try {
    const paymentSel = await resolvePaymentSelection('ee_');
    if (!paymentSel) return;
    const { error } = await sb.from('expenses').update({
      category, amount,
      note: val('ee_note'),
      date: val('ee_date') || todayISO(),
      payment_method: paymentSel.payment_method,
      payment_account_id: paymentSel.payment_account_id
    }).eq('id', id);
    if (error) { alert('আপডেট ব্যর্থ: ' + error.message); return; }
    closeModal(); await loadAll(); renderExpenses();
  } finally { setLoading(false); }
}
export async function saveExpense() {
  const category = val('f_ecat'), amount = Number(val('f_eamt') || 0);
  if (!category || amount <= 0) { alert('খাত ও সঠিক টাকার পরিমাণ দিন'); return; }
  setLoading(true);
  try {
    const paymentSel = await resolvePaymentSelection('f_e');
    if (!paymentSel) return;
    const { error } = await sb.from('expenses').insert({
      category, amount, note: val('f_enote'), date: val('f_edate') || todayISO(),
      payment_method: paymentSel.payment_method, payment_account_id: paymentSel.payment_account_id
    });
    if (error) { alert('সেভ ব্যর্থ: ' + error.message); return; }
    closeModal(); await loadAll(); renderExpenses();
  } finally { setLoading(false); }
}
export async function deleteExpense(id) {
  if (!confirm('ডিলিট করবেন?')) return;
  setLoading(true);
  try {
    await sb.from('expenses').delete().eq('id', id);
    await loadAll(); renderExpenses();
  } finally { setLoading(false); }
}

window.openExpenseModal = openExpenseModal;
window.saveExpense = saveExpense;
window.openEditExpenseModal = openEditExpenseModal;
window.saveEditExpense = saveEditExpense;
window.deleteExpense = deleteExpense;
