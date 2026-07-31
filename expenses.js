import { sb } from './supabaseClient.js';
import { DB, loadAll } from './state.js';
import { taka, val, todayISO, dateBn, emptyState } from './utils.js';
import { openModal, closeModal } from './modal.js';

/* ============================================================ EXPENSES */
export function renderExpenses() {
  const wrap = document.getElementById('expensesTable');
  if (!DB.expenses.length) { wrap.innerHTML = emptyState('কোনো খরচ নেই', 'প্রথম খরচ যোগ করুন'); return; }
  const rows = [...DB.expenses].sort((a, b) => b.date.localeCompare(a.date));
  wrap.innerHTML = `<table><thead><tr><th>তারিখ</th><th>খাত</th><th>নোট</th><th>টাকা</th><th></th></tr></thead>
    <tbody>${rows.map(e => `<tr><td>${dateBn(e.date)}</td><td>${e.category}</td><td>${e.note || '-'}</td>
      <td class="num">${taka(e.amount)}</td><td><button class="btn btn-danger-ghost btn-sm" onclick="deleteExpense('${e.id}')">ডিলিট</button></td></tr>`).join('')}</tbody></table>`;
}
export function openExpenseModal() {
  openModal(`
    <h3>নতুন খরচ</h3><div class="stitch"></div>
    <div class="field"><label>খাত</label><input id="f_ecat" placeholder="দোকান ভাড়া / বিদ্যুৎ / পরিবহন..."></div>
    <div class="row2"><div class="field"><label>টাকা</label><input id="f_eamt" type="number"></div>
    <div class="field"><label>তারিখ</label><input id="f_edate" type="date" value="${todayISO()}"></div></div>
    <div class="field"><label>নোট (ঐচ্ছিক)</label><textarea id="f_enote" rows="2"></textarea></div>
    <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">বাতিল</button>
    <button class="btn btn-primary" onclick="saveExpense()">সেভ করুন</button></div>`);
}
export async function saveExpense() {
  const category = val('f_ecat'), amount = Number(val('f_eamt') || 0);
  if (!category || amount <= 0) { alert('খাত ও সঠিক টাকার পরিমাণ দিন'); return; }
  const { error } = await sb.from('expenses').insert({ category, amount, note: val('f_enote'), date: val('f_edate') || todayISO() });
  if (error) { alert('সেভ ব্যর্থ: ' + error.message); return; }
  closeModal(); await loadAll(); renderExpenses();
}
export async function deleteExpense(id) {
  if (!confirm('ডিলিট করবেন?')) return;
  await sb.from('expenses').delete().eq('id', id);
  await loadAll(); renderExpenses();
}

window.openExpenseModal = openExpenseModal;
window.saveExpense = saveExpense;
window.deleteExpense = deleteExpense;
