import { renderDashboard } from './dashboard.js';
import { renderCatalog } from './catalog.js';
import { renderPurchases } from './purchases.js';
import { buildSalesFilterSeg, renderSales } from './sales.js';
import { buildLedgerSeg, renderLedger } from './ledger.js';
import { buildCapitalSeg, renderCapital } from './capital.js';
import { renderExpenses } from './expenses.js';
import { renderReport } from './reports.js';
import { renderSettings } from './settings.js';

/* ---------------- tabs ---------------- */
export const TABS = [
  { id: 'dashboard', label: 'ড্যাশবোর্ড' },
  { id: 'catalog', label: 'ব্র্যান্ড ও প্রোডাক্ট' },
  { id: 'purchases', label: 'ক্রয়' },
  { id: 'sales', label: 'বিক্রয়' },
  { id: 'ledger', label: 'পাওনা-বকেয়া' },
  { id: 'capital', label: 'মূলধন ও অ্যাডভান্স' },
  { id: 'expenses', label: 'খরচ' },
  { id: 'reports', label: 'রিপোর্ট' },
  { id: 'settings', label: 'সেটিংস' },
];
export function buildTabs() {
  document.getElementById('tabs').innerHTML = TABS.map(t => `<button class="tab-btn" data-tab="${t.id}" onclick="showTab('${t.id}')">${t.label}</button>`).join('');
}
export function showTab(id) {
  TABS.forEach(t => {
    document.getElementById('tab-' + t.id).classList.toggle('active', t.id === id);
    document.querySelector(`.tab-btn[data-tab="${t.id}"]`).classList.toggle('active', t.id === id);
  });
  if (id === 'dashboard') renderDashboard();
  if (id === 'catalog') renderCatalog();
  if (id === 'purchases') renderPurchases();
  if (id === 'sales') { buildSalesFilterSeg(); renderSales(); }
  if (id === 'ledger') { buildLedgerSeg(); renderLedger(); }
  if (id === 'capital') { buildCapitalSeg(); renderCapital(); }
  if (id === 'expenses') renderExpenses();
  if (id === 'reports') renderReport();
  if (id === 'settings') renderSettings();
}

window.showTab = showTab;
