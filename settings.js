import { sb } from './supabaseClient.js';
import { val, pwField } from './utils.js';

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
