import { sb } from './supabaseClient.js';
import { loadAll } from './state.js';
import { val } from './utils.js';
import { buildTabs, showTab } from './tabs.js';

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

window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleLogout = handleLogout;
