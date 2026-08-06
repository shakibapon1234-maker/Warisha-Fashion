import { sb } from './supabaseClient.js';
import { loadAll } from './state.js';
import { val, pwField } from './utils.js';
import { buildTabs, showTab } from './tabs.js';
import { openModal, closeModal } from './modal.js';

/* ---------------- Auth ---------------- */
export async function handleLogin() {
  const email = val('authEmail'), password = val('authPassword');
  const errEl = document.getElementById('authError'); errEl.style.color = 'var(--danger)'; errEl.style.display = 'none';
  if (!email || !password) { errEl.textContent = 'ইমেইল ও পাসওয়ার্ড দিন'; errEl.style.display = 'block'; return; }
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; }
}
export async function handleSignup() {
  const email = val('authEmail'), password = val('authPassword');
  const errEl = document.getElementById('authError'); errEl.style.display = 'none';
  if (!email || !password) { errEl.style.color = 'var(--danger)'; errEl.textContent = 'ইমেইল ও পাসওয়ার্ড দিন'; errEl.style.display = 'block'; return; }
  const { error } = await sb.auth.signUp({ email, password });
  if (error) { errEl.style.color = 'var(--danger)'; errEl.textContent = error.message; errEl.style.display = 'block'; }
  else { errEl.style.color = 'var(--success)'; errEl.textContent = 'অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল কনফার্মেশন লাগলে ইনবক্স চেক করে তারপর লগইন করুন।'; errEl.style.display = 'block'; }
}
export async function handleLogout() { await sb.auth.signOut(); }
export async function showApp(user) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appRoot').style.display = 'block';
  document.getElementById('userEmailLabel').textContent = user.email || '';
  await loadAll();
  buildTabs();
  showTab('dashboard');
}
export function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appRoot').style.display = 'none';
}
export async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) { await showApp(session.user); } else { showLogin(); }
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) { showApp(session.user); }
    if (event === 'SIGNED_OUT') { showLogin(); }
  });
}

export function getSavedSecurityQuestions() {
  try {
    const raw = localStorage.getItem('warisha_sec_questions');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function openForgotPasswordModal() {
  const saved = getSavedSecurityQuestions();
  const loginEmail = val('authEmail') || '';

  if (saved && saved.q1 && saved.a1) {
    openModal(`
      <h3>🔑 পাসওয়ার্ড রিসেট</h3><div class="stitch"></div>
      <div class="helper" style="margin-bottom:12px;">আপনার সিকিউরিটি প্রশ্নের সঠিক উত্তর দিয়ে নতুন পাসওয়ার্ড সেট করুন।</div>
      <div class="field"><label>প্রশ্ন ১: ${saved.q1}</label><input id="secA1" placeholder="আপনার গোপন উত্তর লিখুন"></div>
      ${saved.q2 ? `<div class="field"><label>প্রশ্ন ২: ${saved.q2}</label><input id="secA2" placeholder="আপনার গোপন উত্তর লিখুন"></div>` : ''}
      <div class="field"><label>নতুন পাসওয়ার্ড</label>${pwField('newResetPw')}</div>
      <div class="field"><label>নতুন পাসওয়ার্ড নিশ্চিত করুন</label>${pwField('newResetPw2')}</div>
      <div id="resetMsg" class="helper" style="display:none;margin-bottom:10px;"></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModal()">বাতিল</button>
        <button class="btn btn-primary" onclick="handleResetWithSecurityQuestions()">পাসওয়ার্ড রিকভার করুন</button>
      </div>
      <div class="stitch" style="margin:16px 0;"></div>
      <div style="text-align:center;">
        <button class="btn btn-ghost btn-sm" onclick="handleSendEmailReset('${loginEmail}')">📧 ইমেইলে রিসেট লিংক পাঠান</button>
      </div>`);
  } else {
    openModal(`
      <h3>🔑 পাসওয়ার্ড রিসেট</h3><div class="stitch"></div>
      <div class="helper" style="margin-bottom:12px;">
        আপনি সিকিউরিটি প্রশ্ন সেট করে থাকলে সেটির উত্তর দিন, অথবা নিচে আপনার ইমেইল দিয়ে রিসেট লিংক পাঠান।
      </div>
      <div class="field"><label>আপনার অ্যাকাউন্ট ইমেইল</label><input id="resetEmail" type="email" value="${loginEmail}" placeholder="you@example.com"></div>
      <div id="resetMsg" class="helper" style="display:none;margin-bottom:10px;"></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModal()">বাতিল</button>
        <button class="btn btn-primary" onclick="handleSendEmailReset()">📧 ইমেইলে রিসেট লিংক পাঠান</button>
      </div>
    `);
  }
}

export async function handleSendEmailReset(presetEmail) {
  const email = presetEmail || val('resetEmail') || val('authEmail');
  const msg = document.getElementById('resetMsg');
  if (msg) msg.style.display = 'block';

  if (!email) {
    if (msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'আপনার ইমেইল ঠিকানা লিখুন'; }
    return;
  }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.href });
  if (error) {
    if (msg) { msg.style.color = 'var(--danger)'; msg.textContent = 'ব্যর্থ: ' + error.message; }
  } else {
    if (msg) {
      msg.style.color = 'var(--success)';
      msg.textContent = '✅ রিসেট লিংক আপনার ইমেইলে পাঠানো হয়েছে! ইনবক্স/স্প্যাম চেক করে লিংকে ক্লিক করুন।';
    }
  }
}

export async function handleResetWithSecurityQuestions() {
  const saved = getSavedSecurityQuestions();
  const msg = document.getElementById('resetMsg');
  if (msg) msg.style.display = 'block';

  const a1 = (val('secA1') || '').trim().toLowerCase();
  const a2 = saved && saved.q2 ? (val('secA2') || '').trim().toLowerCase() : '';
  const p1 = val('newResetPw'), p2 = val('newResetPw2');

  if (!a1 || (saved.q2 && !a2)) {
    msg.style.color = 'var(--danger)'; msg.textContent = 'সিকিউরিটি প্রশ্নের উত্তর দিন'; return;
  }
  if (a1 !== saved.a1 || (saved.q2 && a2 !== saved.a2)) {
    msg.style.color = 'var(--danger)'; msg.textContent = 'সিকিউরিটি প্রশ্নের উত্তর মিলছে না!'; return;
  }
  if (!p1 || p1.length < 6) {
    msg.style.color = 'var(--danger)'; msg.textContent = 'পাসওয়ার্ড অন্তত ৬ ক্যারেক্টার হতে হবে'; return;
  }
  if (p1 !== p2) {
    msg.style.color = 'var(--danger)'; msg.textContent = 'দুইটা পাসওয়ার্ড মিলছে না'; return;
  }

  const { error } = await sb.auth.updateUser({ password: p1 });
  if (error) {
    msg.style.color = 'var(--danger)';
    msg.textContent = 'পাসওয়ার্ড রিসেট করতে ইমেইল ভেরিফাইড লাগবে অথবা ইমেইলে পাঠানো লিংক ব্যবহার করুন। ভুল বিবরণ: ' + error.message;
  } else {
    msg.style.color = 'var(--success)';
    msg.textContent = '✅ পাসওয়ার্ড সফলভাবে রিসেট হয়েছে! এখন লগইন করুন।';
    setTimeout(() => { closeModal(); }, 2000);
  }
}

window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleLogout = handleLogout;
window.openForgotPasswordModal = openForgotPasswordModal;
window.handleSendEmailReset = handleSendEmailReset;
window.handleResetWithSecurityQuestions = handleResetWithSecurityQuestions;

