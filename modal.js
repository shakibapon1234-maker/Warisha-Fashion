/* ============================================================ MODAL */
export function openModal(html) {
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('overlay').classList.add('open');
}
export function closeModal() {
  document.getElementById('overlay').classList.remove('open');
}
export function initModal() {
  document.getElementById('overlay').addEventListener('click', e => { if (e.target.id === 'overlay') closeModal(); });
}

window.closeModal = closeModal;
