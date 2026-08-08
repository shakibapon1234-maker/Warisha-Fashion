import { sb } from './supabaseClient.js';
import { val, pwField, setLoading } from './utils.js';
import { DB } from './state.js';
import { ACCOUNT_TYPE_LABEL, accountsByType } from './payment-accounts.js';
import { exportSystemBackupJSON, importSystemBackupJSON, runSyncGuardAudit, fixSyncGuardDiscrepancies } from './backup-sync.js';
import { renderThemeSettings } from './theme.js';

/* ============================================================ SETTINGS */
export function renderSettings() {
  document.getElementById('setNewPwWrap').innerHTML = pwField('setNewPw');
  document.getElementById('setNewPw2Wrap').innerHTML = pwField('setNewPw2');
  const emailMsg = document.getElementById('setEmailMsg'); if (emailMsg) emailMsg.style.display = 'none';
  const pwMsg = document.getElementById('setPwMsg'); if (pwMsg) pwMsg.style.display = 'none';
  const newEmailEl = document.getElementById('setNewEmail'); if (newEmailEl) newEmailEl.value = '';

  sb.auth.getUser().then(({ data }) => {
    const curEmail = document.getElementById('setCurrentEmail');
    if (curEmail) curEmail.value = data?.user?.email || '';
  });
  renderThemeSettings();
  renderPaymentAccountsSettings();
  renderSecurityQuestionsSettings();
  renderBackupAndSyncSettings();
  renderDangerZoneSettings();
}

export function renderBackupAndSyncSettings() {
  const wrap = document.getElementById('backupSyncSettings');
  if (!wrap) return;

  const audit = runSyncGuardAudit();

  wrap.innerHTML = `
    <div class="panel settings-panel" style="max-width:560px;">
      <h3>💾 ডেটা ব্যাকআপ ও রিস্টোর (Backup & Import)</h3>
      <div class="helper" style="margin-bottom:12px;">
        আপনার দোকানের সকল ডেটা (স্টক, ক্রয়, বিক্রয়, বকেয়া) ব্যাকআপ বা রিস্টোর করতে নিচের অপশন ব্যবহার করুন। প্রতিদিন প্রথমবার প্রবেশের সময় সিস্টেম অটোমেটিক ব্যাকআপ ডাউনলোড করে।
      </div>
      <div class="row-actions" style="gap:10px;margin-bottom:12px;">
        <button class="btn btn-primary" onclick="exportSystemBackupJSON(false)">💾 ব্যাকআপ ডাউনলোড করুন</button>
        <button class="btn btn-ghost" onclick="document.getElementById('importBackupFileInput').click()">📥 ব্যাকআপ রিস্টোর করুন</button>
        <input type="file" id="importBackupFileInput" accept=".json" style="display:none;" onchange="onBackupFileSelected(this)">
      </div>
    </div>

    <div class="panel settings-panel" style="max-width:560px;">
      <h3>🛡️ সিঙ্ক গার্ড (Sync Guard Audit & Fix)</h3>
      <div class="helper" style="margin-bottom:12px;">
        কাস্টমার পাওনা, সাপ্লায়ার দেনা ও মজুদ স্টকের হিসেব ক্রয়-বিক্রয়ের সূত্র ধরে সমীকরণ পরীক্ষা করা হয়।
      </div>
      ${audit.isHealthy ? `
        <div style="background:var(--success-bg);color:var(--success);padding:10px 14px;border-radius:8px;font-size:13.5px;font-weight:600;margin-bottom:12px;">
          ✅ সিঙ্ক গার্ড: আপনার সকল কাস্টমার বকেয়া, দেনা ও প্রোডাক্টের স্টক ১০০% সঠিক রয়েছে।
        </div>
      ` : `
        <div style="background:var(--danger-bg);color:var(--danger);padding:10px 14px;border-radius:8px;font-size:13.5px;margin-bottom:12px;">
          <b>⚠️ সিঙ্ক ওয়ার্নিং (${audit.issuesCount} টি অমিল পাওয়া গেছে):</b>
          <ul style="margin:6px 0 0 18px;padding:0;font-size:12.5px;">
            ${audit.issues.map(i => `<li>${i}</li>`).join('')}
          </ul>
        </div>
      `}
      <button class="btn btn-gold" onclick="fixSyncGuardDiscrepancies()">🔄 সিঙ্ক রিক্যালকুলেট ও ফিক্স করুন</button>
    </div>`;
}

/* ---------------------------------------------------------- ডেঞ্জার জোন — সব ডেটা মুছে ফেলুন */
const CLEAR_ALL_CONFIRM_PHRASE = 'মুছে ফেলুন';

export function renderDangerZoneSettings() {
  const wrap = document.getElementById('dangerZoneSettings');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="panel settings-panel" style="max-width:560px;border-left:4px solid var(--danger);">
      <h3 style="color:var(--danger);">⚠️ বিপজ্জনক এলাকা — সব ডেটা মুছে ফেলুন</h3>
      <div class="helper" style="margin-bottom:12px;">
        এই বাটনে চাপ দিলে ব্র্যান্ড, প্রোডাক্ট, ক্রয়, বিক্রয়, কাস্টমার, সাপ্লায়ার, পাওনা-দেনা, মূলধন, খরচ ও পেমেন্ট মাধ্যম — সব ডেটা <b>স্থায়ীভাবে</b> মুছে যাবে এবং অ্যাপ একদম ফ্রেশ অবস্থায় চলে যাবে (লগইন অ্যাকাউন্ট অক্ষত থাকবে)। প্র্যাকটিসের ডেটা পরিষ্কার করতে চাইলে এটা ব্যবহার করুন — কিন্তু আসল হিসাব থাকলে আগে অবশ্যই ব্যাকআপ ডাউনলোড করে নিন, কারণ এই কাজ ফিরিয়ে আনা যাবে না।
      </div>
      <button class="btn" style="background:var(--danger);color:#fff;" onclick="handleClearAllData()">🗑️ সব ডেটা মুছে ফ্রেশ স্টার্ট করুন</button>
    </div>`;
}

export async function handleClearAllData() {
  const warned = confirm(
    'সতর্কতা!\n\nএই কাজটি আপনার সব ব্র্যান্ড, প্রোডাক্ট, ক্রয়, বিক্রয়, কাস্টমার, সাপ্লায়ার, পাওনা-দেনা, মূলধন, খরচ ও পেমেন্ট মাধ্যম — সব ডেটা স্থায়ীভাবে মুছে ফেলবে। এটা আর ফিরিয়ে আনা যাবে না।\n\nচালিয়ে যেতে চাইলে "ঠিক আছে" চাপুন।'
  );
  if (!warned) return;

  const typed = prompt(`নিশ্চিত করতে নিচের বাক্সে হুবহু লিখুনঃ ${CLEAR_ALL_CONFIRM_PHRASE}`);
  if (typed === null) return;
  if (typed.trim() !== CLEAR_ALL_CONFIRM_PHRASE) {
    alert('লেখাটি মিলেনি, তাই কোনো ডেটা মুছা হয়নি।');
    return;
  }

  setLoading(true);
  try {
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';
    // নির্ভরতা (foreign key) অনুযায়ী সঠিক ক্রমে টেবিল খালি করা হচ্ছে
    const tablesInOrder = [
      'sales', 'purchases',
      'payments_customer', 'payments_supplier',
      'investments', 'advances_customer', 'advances_supplier',
      'expenses',
      'products', 'customers', 'suppliers', 'brands',
      'payment_accounts',
    ];
    for (const table of tablesInOrder) {
      const { error } = await sb.from(table).delete().neq('id', NIL_UUID);
      if (error) {
        alert(`"${table}" টেবিলের ডেটা মুছতে সমস্যা হয়েছে: ${error.message}\n\nবাকি ধাপ থেমে গেছে, আংশিক ডেটা মুছা হয়ে থাকতে পারে।`);
        return;
      }
    }
    alert('সব ডেটা সফলভাবে মুছে ফেলা হয়েছে। অ্যাপটি এখন রিফ্রেশ হবে।');
    location.reload();
  } finally {
    setLoading(false);
  }
}

export function onBackupFileSelected(input) {
  if (input.files && input.files[0]) {
    importSystemBackupJSON(input.files[0]);
    input.value = '';
  }
}

/* ---------------------------------------------------------- পেমেন্ট মাধ্যম সেটিংস */
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

export function renderSecurityQuestionsSettings() {
  const wrap = document.getElementById('securityQuestionsSettings');
  if (!wrap) return;

  let saved = null;
  try {
    const raw = localStorage.getItem('warisha_sec_questions');
    if (raw) saved = JSON.parse(raw);
  } catch (e) {}

  wrap.innerHTML = `
    <div class="panel settings-panel" style="max-width:560px;">
      <h3>🛡️ সিকিউরিটি কোশ্চেন সেটিংস (পাসওয়ার্ড রিকভারি)</h3>
      <div class="helper" style="margin-bottom:12px;">
        পাসওয়ার্ড ভুলে গেলে এই প্রশ্নগুলোর সঠিক উত্তর দিয়ে আপনি সহজেই পাসওয়ার্ড রিসেট করতে পারবেন।
      </div>
      <div class="field">
        <label>প্রশ্ন ১</label>
        <select id="secQ1">
          <option value="আপনার প্রিয় শহরের নাম কী?" ${saved?.q1 === 'আপনার প্রিয় শহরের নাম কী?' ? 'selected' : ''}>আপনার প্রিয় শহরের নাম কী?</option>
          <option value="আপনার প্রথম প্রাইমারি স্কুলের নাম কী?" ${saved?.q1 === 'আপনার প্রথম প্রাইমারি স্কুলের নাম কী?' ? 'selected' : ''}>আপনার প্রথম প্রাইমারি স্কুলের নাম কী?</option>
          <option value="আপনার প্রিয় খাবারের নাম কী?" ${saved?.q1 === 'আপনার প্রিয় খাবারের নাম কী?' ? 'selected' : ''}>আপনার প্রিয় খাবারের নাম কী?</option>
        </select>
      </div>
      <div class="field">
        <label>উত্তর ১</label>
        <input id="secAns1" value="${saved?.a1 || ''}" placeholder="গোপন উত্তর লিখুন">
      </div>
      <div class="field">
        <label>প্রশ্ন ২</label>
        <select id="secQ2">
          <option value="আপনার প্রিয় রঙের নাম কী?" ${saved?.q2 === 'আপনার প্রিয় রঙের নাম কী?' ? 'selected' : ''}>আপনার প্রিয় রঙের নাম কী?</option>
          <option value="আপনার প্রিয় খেলার নাম কী?" ${saved?.q2 === 'আপনার প্রিয় খেলার নাম কী?' ? 'selected' : ''}>আপনার প্রিয় খেলার নাম কী?</option>
          <option value="আপনার শৈশবের বন্ধুর নাম কী?" ${saved?.q2 === 'আপনার শৈশবের বন্ধুর নাম কী?' ? 'selected' : ''}>আপনার শৈশবের বন্ধুর নাম কী?</option>
        </select>
      </div>
      <div class="field">
        <label>উত্তর ২</label>
        <input id="secAns2" value="${saved?.a2 || ''}" placeholder="গোপন উত্তর লিখুন">
      </div>
      <div id="secQMsg" class="helper" style="display:none;margin-bottom:8px;"></div>
      <button class="btn btn-primary" onclick="saveSecurityQuestionsSettings()">💾 সিকিউরিটি প্রশ্ন সেভ করুন</button>
    </div>`;
}

async function hashAnswer(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode((str || '').trim().toLowerCase()));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function saveSecurityQuestionsSettings() {
  const q1 = val('secQ1'), a1Raw = val('secAns1').trim().toLowerCase();
  const q2 = val('secQ2'), a2Raw = val('secAns2').trim().toLowerCase();
  const msg = document.getElementById('secQMsg');
  if (msg) msg.style.display = 'block';

  if (!a1Raw || !a2Raw) {
    if (msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'দুইটি প্রশ্নেরই উত্তর দিন'; }
    return;
  }
  // Hash the answers before storing — plain text never persisted
  Promise.all([hashAnswer(a1Raw), hashAnswer(a2Raw)]).then(([a1, a2]) => {
    const data = { q1, a1, q2, a2, v: 2 }; // v:2 = hashed version
    localStorage.setItem('warisha_sec_questions', JSON.stringify(data));
    sb.auth.updateUser({ data: { sec_q: { q1, q2, v: 2 } } }).catch(() => {});
    if (msg) {
      msg.style.color = 'var(--success)';
      msg.textContent = '✅ সিকিউরিটি প্রশ্ন সফলভাবে সেভ করা হয়েছে!';
    }
  });
}

window.handleUpdateEmail = handleUpdateEmail;
window.handleUpdatePassword = handleUpdatePassword;
window.addPaymentAccount = addPaymentAccount;
window.deletePaymentAccount = deletePaymentAccount;
window.onBackupFileSelected = onBackupFileSelected;
window.handleClearAllData = handleClearAllData;
window.saveSecurityQuestionsSettings = saveSecurityQuestionsSettings;
