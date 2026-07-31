import { sb } from './supabaseClient.js';
import { DB, paymentAccountName } from './state.js';
import { val } from './utils.js';

/* ============================================================
   পেমেন্ট মাধ্যম = টাইপ (ক্যাশ/ব্যাংক/মোবাইল ব্যাংকিং) + নির্দিষ্ট একাউন্ট
   (যেমন বিকাশ/নগদ বা ডাচ ব্যাংক) — এই ফাইলে দুটোই হ্যান্ডেল হয়:
   ১) সেটিংসে একাউন্ট তৈরি/ডিলিট করা
   ২) ক্রয়/বিক্রয় ফর্মে টাইপ বাছাইয়ের পর একাউন্ট ড্রপডাউন দেখানো
   ============================================================ */

export const ACCOUNT_TYPE_LABEL = { bank: 'ব্যাংক', mobile_banking: 'মোবাইল ব্যাংকিং' };

export function accountsByType(type) {
  return DB.payment_accounts.filter(a => a.type === type);
}

/* টেবিলে দেখানোর জন্য — "মোবাইল ব্যাংকিং · বিকাশ" এভাবে */
export function paymentMethodDisplay(method, accountId) {
  if (method === 'bank' || method === 'mobile_banking') {
    const name = paymentAccountName(accountId);
    return name ? `${ACCOUNT_TYPE_LABEL[method]} · ${name}` : ACCOUNT_TYPE_LABEL[method];
  }
  return 'ক্যাশ';
}

/* ------------------------------------------------------------
   ক্রয়/বিক্রয় ফর্মের ভেতরের একাউন্ট সাব-ফিল্ড
   prefix উদাহরণ: 'f_p' (ক্রয়) বা 'f_s' (বিক্রয়)
   ------------------------------------------------------------ */
export function renderPaymentAccountField(prefix, type, selectedAccountId) {
  const wrap = document.getElementById(prefix + 'AccountWrap');
  if (!wrap) return;
  if (type !== 'bank' && type !== 'mobile_banking') { wrap.innerHTML = ''; return; }
  const label = ACCOUNT_TYPE_LABEL[type];
  const accounts = accountsByType(type);
  wrap.innerHTML = `
    <label>${label} একাউন্ট</label>
    <select id="${prefix}account" onchange="onPaymentAccountChange('${prefix}')">
      <option value="">-- বাছাই করুন --</option>
      ${accounts.map(a => `<option value="${a.id}" ${a.id === selectedAccountId ? 'selected' : ''}>${a.name}</option>`).join('')}
      <option value="__new__">➕ নতুন ${label} একাউন্ট</option>
    </select>
    <div id="${prefix}newAccountWrap" style="display:none;margin-top:8px;">
      <input id="${prefix}newaccount" placeholder="${type === 'mobile_banking' ? 'যেমনঃ বিকাশ / নগদ' : 'যেমনঃ ডাচ বাংলা ব্যাংক'}">
    </div>`;
}
export function onPaymentMethodChange(prefix) {
  const type = val(prefix + 'method');
  renderPaymentAccountField(prefix, type, '');
}
export function onPaymentAccountChange(prefix) {
  const v = val(prefix + 'account');
  const nw = document.getElementById(prefix + 'newAccountWrap');
  if (nw) nw.style.display = v === '__new__' ? 'block' : 'none';
}

/* ফর্ম সেভ করার সময় কল হবে — cash হলে সরাসরি রিটার্ন, নাহলে একাউন্ট
   বাছাই/নতুন একাউন্ট তৈরি করে { payment_method, payment_account_id } রিটার্ন করে।
   কোনো সমস্যা হলে alert দেখিয়ে null রিটার্ন করে (ফর্ম সেভ বন্ধ করার সিগন্যাল)। */
export async function resolvePaymentSelection(prefix) {
  const type = val(prefix + 'method') || 'cash';
  if (type !== 'bank' && type !== 'mobile_banking') return { payment_method: 'cash', payment_account_id: null };

  let accId = val(prefix + 'account');
  if (!accId) { alert(`${ACCOUNT_TYPE_LABEL[type]} একাউন্ট বাছাই করুন`); return null; }

  if (accId === '__new__') {
    const name = val(prefix + 'newaccount').trim();
    if (!name) { alert('একাউন্টের নাম দিন'); return null; }
    const { data, error } = await sb.from('payment_accounts').insert({ type, name }).select().single();
    if (error) { alert('একাউন্ট তৈরি ব্যর্থ: ' + error.message); return null; }
    DB.payment_accounts.push(data);
    accId = data.id;
  }
  return { payment_method: type, payment_account_id: accId };
}

window.onPaymentMethodChange = onPaymentMethodChange;
window.onPaymentAccountChange = onPaymentAccountChange;
