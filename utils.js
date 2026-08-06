/* ============================================================ ছোট হেল্পার ফাংশন */
export function todayISO(offsetDays = 0) {
  // toISOString() is UTC — UTC-7 এ রাত ৩টা মানে UTC তে পরেরদিন সকাল ১০টা,
  // তাই local date parts থেকে manually তৈরি করা হচ্ছে
  const d = new Date();
  if (offsetDays) d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
export function taka(n) {
  return "৳" + Number(n || 0).toLocaleString('en-US');
}
export function dateBn(iso) {
  // ISO string (YYYY-MM-DD) কে UTC হিসেবে parse করলে local timezone-এ একদিন পিছিয়ে যায়
  // তাই manually parse করে local date তৈরি করা হচ্ছে
  const [y, m, d] = (iso || '').split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
}
export function val(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}
export function emptyState(title, sub) {
  return `<div class="empty-state"><b>${title}</b>${sub}</div>`;
}
export function setLoading(on) {
  document.getElementById('loadingBanner').style.display = on ? 'block' : 'none';
}

/* পাসওয়ার্ড ফিল্ড — পাশে চোখ আইকন সহ (দেখা/লুকানো টগল করার জন্য) */
export function pwField(id, placeholder = '********') {
  return `<div class="pw-wrap">
    <input id="${id}" type="password" placeholder="${placeholder}">
    <button type="button" class="pw-eye" onclick="togglePw('${id}', this)" aria-label="পাসওয়ার্ড দেখান/লুকান" tabindex="-1">
      <svg class="eye-open" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>
      <svg class="eye-closed" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M10.6 10.7a3 3 0 004.2 4.2M6.5 6.7C4 8.3 2 12 2 12s4 7 11 7c1.9 0 3.6-.5 5-1.2M17.9 17.9C20.4 16.2 22 12 22 12s-1.6-3.5-5-5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </div>`;
}
export function togglePw(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  const show = el.type === 'password';
  el.type = show ? 'text' : 'password';
  btn.classList.toggle('showing', show);
}
window.togglePw = togglePw;

/* পেমেন্ট মাধ্যম — ক্রয় ও বিক্রয় উভয় জায়গায় ব্যবহৃত হয় */
export const PAYMENT_METHODS = [
  { value: 'cash', label: 'ক্যাশ' },
  { value: 'bank', label: 'ব্যাংক' },
  { value: 'mobile_banking', label: 'মোবাইল ব্যাংকিং' },
];
export function paymentMethodLabel(v) {
  const m = PAYMENT_METHODS.find(x => x.value === v);
  return m ? m.label : 'ক্যাশ';
}
export function paymentMethodOptions(selected) {
  return PAYMENT_METHODS.map(m => `<option value="${m.value}" ${m.value === (selected || 'cash') ? 'selected' : ''}>${m.label}</option>`).join('');
}
