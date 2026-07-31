/* ============================================================ ছোট হেল্পার ফাংশন */
export function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
export function taka(n) {
  return "৳" + Number(n || 0).toLocaleString('en-US');
}
export function dateBn(iso) {
  return new Date(iso).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
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
