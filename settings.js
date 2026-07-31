import { sb } from './supabaseClient.js';
import { val, pwField, setLoading } from './utils.js';
import { DB } from './state.js';
import { ACCOUNT_TYPE_LABEL, accountsByType } from './payment-accounts.js';

/* ============================================================ SETTINGS */
export function renderSettings() {
  document.getElementById('setNewPwWrap').innerHTML = pwField('setNewPw');
  document.getElementById('setNewPw2Wrap').innerHTML = pwField('setNewPw2');
  const emailMsg = document.getElementById('setEmailMsg'); emailMsg.style.display = 'none';
  const pwMsg = document.getElementById('setPwMsg'); pwMsg.style.display = 'none';
  document.getElementById('setNewEmail').value = '';
  sb.auth.getUser().then(({ data }) => {
    document.getElementById('setCurrentEmail').value = data?.user?.email || '';
  });
  renderPaymentAccountsSettings();
}

/* ---------------------------------------------------------- পেমেন্ট মাধ্যম সেটিংস
   মোবাইল ব্যাংকিং (বিকাশ/নগদ) ও ব্যাংক একাউন্টের তালিকা — এখানে যোগ/ডিলিট
   করলে সাথে সাথে ক্রয়/বিক্রয় ফর্মের পেমেন্ট মাধ্যম ড্রপডাউনে দেখাবে। */
function accountsGroupHtml(type) {
  const label = ACCOUNT_TYPE_LABEL[type];
  const accounts = accountsByType(type);
  return `
    <div style="margin-bottom:16px;">
      <label style="display:block;font-size:12.5px;font-weight:600;color:var(--muted);margin-bottom:6px;">${label}</label>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
        ${accounts.length ? accounts.map(a => `
          <span class="tag ${type}" style="display:inline-flex;align-items:center;gap:6px;">
            ${a.name}
            <button onclick="deletePaymentAccount('${a.id}')" aria-label="ডিলিট" style="background:none;border:none;cursor:pointer;color:inherit;font-weight:800;padding:0;line-height:1;">✕</button>
          </span>`).join('') : `<span class="helper">এখনো কিছু যোগ করা হয়নি</span>`}
      </div>
      <div style="display:flex;gap:8px;">
        <input id="newAcc_${type}" placeholder="${type === 'mobile_banking' ? 'যেমনঃ বিকাশ / নগদ' : 'যেমনঃ ডাচ বাংলা ব্যাংক'}" style="flex:1;">
        <button class="btn btn-ghost btn-sm" onclick="addPaymentAccount('${type}')">+ যোগ করুন</button>
      </div>
    </div>`;
}
export function renderPaymentAccountsSettings() {
  const wrap = document.getElementById('paymentAccountsSettings');
  if (!wrap) return;
  wrap.innerHTML = accountsGroupHtml('mobile_banking') + accountsGroupHtml('bank');
}
export async function addPaymentAccount(type) {
  const input = document.getElementById(`newAcc_${type}`);
  const name = input ? input.value.trim() : '';
  if (!name) return;
  setLoading(true);
  try {
    const { data, error } = await sb.from('payment_accounts').insert({ type, name }).select().single();
    if (error) { alert('যোগ করা ব্যর্থ: ' + error.message); return; }
    DB.payment_accounts.push(data);
    renderPaymentAccountsSettings();
  } finally { setLoading(false); }
}
export async function deletePaymentAccount(id) {
  if (!confirm('এই পেমেন্ট একাউন্টটি ডিলিট করবেন? আগের ক্রয়/বিক্রয় রেকর্ড থাকবে, শুধু একাউন্টের নামটা আর দেখাবে না।')) return;
  setLoading(true);
  try {
    const { error } = await sb.from('payment_accounts').delete().eq('id', id);
    if (error) { alert('ডিলিট ব্যর্থ: ' + error.message); return; }
    DB.payment_accounts = DB.payment_accounts.filter(a => a.id !== id);
    renderPaymentAccountsSettings();
  } finally { setLoading(false); }
}

export async function handleUpdateEmail() {
  const msg = document.getElementById('setEmailMsg');
  const newEmail = val('setNewEmail').trim();
  msg.style.display = 'block'; msg.style.color = 'var(--danger)';
  if (!newEmail) { msg.textContent = 'নতুন ইমেইল লিখুন'; return; }
  const { error } = await sb.auth.updateUser({ email: newEmail });
  if (error) { msg.textContent = error.message; return; }
  msg.style.color = 'var(--success)';
  msg.textContent = 'অনুরোধ পাঠানো হয়েছে। কনফার্মেশন লিংক থাকলে ইনবক্স চেক করে ক্লিক করুন, তারপর পরিবর্তন কার্যকর হবে।';
  document.getElementById('setNewEmail').value = '';
}

export async function handleUpdatePassword() {
  const msg = document.getElementById('setPwMsg');
  const p1 = val('setNewPw'), p2 = val('setNewPw2');
  msg.style.display = 'block'; msg.style.color = 'var(--danger)';
  if (!p1 || !p2) { msg.textContent = 'দুইটা ফিল্ডেই নতুন পাসওয়ার্ড দিন'; return; }
  if (p1.length < 6) { msg.textContent = 'পাসওয়ার্ড অন্তত ৬ ক্যারেক্টার হতে হবে'; return; }
  if (p1 !== p2) { msg.textContent = 'দুইটা পাসওয়ার্ড মিলছে না'; return; }
  const { error } = await sb.auth.updateUser({ password: p1 });
  if (error) { msg.textContent = error.message; return; }
  msg.style.color = 'var(--success)';
  msg.textContent = 'পাসওয়ার্ড পরিবর্তন হয়েছে।';
  document.getElementById('setNewPw').value = '';
  document.getElementById('setNewPw2').value = '';
}

window.handleUpdateEmail = handleUpdateEmail;
window.handleUpdatePassword = handleUpdatePassword;
window.addPaymentAccount = addPaymentAccount;
window.deletePaymentAccount = deletePaymentAccount;
