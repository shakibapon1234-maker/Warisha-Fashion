/* ============================================================
   থিম সুইচার — লোকালস্টোরেজে থিম সংরক্ষণ করে ও body তে
   data-theme অ্যাট্রিবিউট বসায়। themes.css এই অ্যাট্রিবিউট
   অনুযায়ী পুরো অ্যাপের কালার প্যালেট পাল্টে দেয়।
   ============================================================ */

export const THEME_STORAGE_KEY = 'warisha_theme';
export const DEFAULT_THEME = 'nebula-night';

export const THEMES = [
  {
    id: 'nebula-night',
    name: 'নেবুলা নাইট',
    tag: 'ডিফল্ট · ডার্ক অ্যানিমেটেড',
    header: 'linear-gradient(120deg,#080B1A 0%,#1A1140 55%,#2D0F5C 100%)',
    bg: '#060914',
    dot1: '#22D3EE', dot2: '#EC4899', dot3: '#F59E0B'
  },
  {
    id: 'maroon-gold',
    name: 'মেরুন গোল্ড',
    tag: 'প্রিমিয়াম বুটিক · হালকা',
    header: 'linear-gradient(135deg,#3D0B1C 0%,#6E1530 55%,#8A1D3D 100%)',
    bg: '#FBF3EC',
    dot1: '#C9973E', dot2: '#0F6B5C', dot3: '#B23F63'
  },
  {
    id: 'royal-emerald',
    name: 'রয়্যাল এমেরাল্ড',
    tag: 'প্রিমিয়াম · হালকা',
    header: 'linear-gradient(135deg,#043D30 0%,#0B6B54 55%,#0F8A6C 100%)',
    bg: '#F1F7F3',
    dot1: '#D4A94A', dot2: '#14A085', dot3: '#2D5F82'
  },
  {
    id: 'classic-teal',
    name: 'ক্লাসিক টিল',
    tag: 'আদি লুক',
    header: 'linear-gradient(135deg,#0F332C,#1D5F53)',
    bg: '#F3F0E6',
    dot1: '#C9973E', dot2: '#2E8874', dot3: '#B23F63'
  }
];

export function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(themeId) {
  const id = THEMES.some(t => t.id === themeId) ? themeId : DEFAULT_THEME;
  document.body.setAttribute('data-theme', id);
  try { localStorage.setItem(THEME_STORAGE_KEY, id); } catch {}
}

// পেজ লোডের শুরুতেই থিম বসিয়ে দাও (FOUC এড়াতে main.js এর সবার আগে ইম্পোর্ট করা উচিত)
applyTheme(getSavedTheme());

window.setWarishaTheme = function (themeId) {
  applyTheme(themeId);
  renderThemeSettings();
};

export function renderThemeSettings() {
  const wrap = document.getElementById('themeSettings');
  if (!wrap) return;
  const current = getSavedTheme();
  wrap.innerHTML = `
    <div class="panel settings-panel" style="max-width:640px;">
      <h3>🎨 অ্যাপের থিম</h3>
      <div class="helper" style="margin-bottom:12px;">আপনার পছন্দমতো একটি থিম বেছে নিন — সাথে সাথে পুরো অ্যাপে প্রয়োগ হবে।</div>
      <div class="theme-grid">
        ${THEMES.map(t => `
          <div class="theme-option ${t.id === current ? 'selected' : ''}" onclick="setWarishaTheme('${t.id}')">
            <div class="theme-check">✓</div>
            <div class="theme-preview" style="background:${t.bg};">
              <div class="tp-header" style="background:${t.header};"></div>
              <div class="tp-dot" style="left:8px; background:${t.dot1};"></div>
              <div class="tp-dot" style="left:22px; background:${t.dot2};"></div>
              <div class="tp-dot" style="left:36px; background:${t.dot3};"></div>
            </div>
            <div class="theme-name">${t.name}</div>
            <div class="helper" style="margin-top:2px;">${t.tag}</div>
          </div>
        `).join('')}
      </div>
    </div>`;
}
