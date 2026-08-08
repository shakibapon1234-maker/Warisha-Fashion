/* ============================================================ থিম ম্যানেজার
   একাধিক প্রিমিয়াম থিমের মধ্যে সুইচ করা, localStorage-এ সেভ করা,
   এবং সেটিংস ট্যাবে থিম পিকার UI রেন্ডার করা।
   index.html-এর <head>-এ একটা ইনলাইন স্ক্রিপ্ট পেজ লোডের সময়ই
   সেভ করা থিম প্রয়োগ করে (ফ্ল্যাশ এড়াতে); এই ফাইলটা রানটাইমে
   সুইচ করা ও সেটিংস UI রেন্ডারের জন্য দায়ী।
   ========================================================== */

const STORAGE_KEY = 'warisha_theme';
export const DEFAULT_THEME = 'midnight-aurora';

export const THEMES = [
  {
    id: 'classic',
    name: 'ক্লাসিক হেরিটেজ',
    desc: 'উষ্ণ আইভরি ও গাঢ় টিল-গোল্ড — ওয়ারিশার অরিজিনাল লুক',
    css: null,
    swatches: ['#0F332C', '#C9973E', '#F3F0E6'],
  },
  {
    id: 'midnight-aurora',
    name: 'মিডনাইট অরোরা',
    desc: 'গভীর, প্রিমিয়াম ডার্ক থিম — সোনালি ও পান্না রঙের সংযত আভা',
    css: 'themes/midnight-aurora.css',
    swatches: ['#14151C', '#D4AF6A', '#1F7A5C'],
  },
  {
    id: 'emerald-gold',
    name: 'এমারেল্ড গোল্ড',
    desc: 'আইভরি ব্যাকগ্রাউন্ডে গাঢ় পান্না ও সোনালি — বুটিক শোরুম লুক',
    css: 'themes/emerald-gold.css',
    swatches: ['#F7F4EC', '#0B4F3C', '#C6A15B'],
  },
  {
    id: 'rose-gold-luxe',
    name: 'রোজ গোল্ড লাক্স',
    desc: 'ব্লাশ আইভরি ও রোজ-গোল্ড — এলিগেন্ট ফ্যাশন-হাউজ লুক',
    css: 'themes/rose-gold-luxe.css',
    swatches: ['#FBF3F0', '#7A2E4A', '#C68A6B'],
  },
];

export function getCurrentTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return THEMES.some(t => t.id === saved) ? saved : DEFAULT_THEME;
}

export function applyTheme(id) {
  const theme = THEMES.find(t => t.id === id) || THEMES.find(t => t.id === DEFAULT_THEME);
  const link = document.getElementById('themeStylesheet');
  if (link) link.setAttribute('href', theme.css || '');
  localStorage.setItem(STORAGE_KEY, theme.id);
  return theme;
}

export function initTheme() {
  applyTheme(getCurrentTheme());
}

export function renderThemeSettings() {
  const wrap = document.getElementById('themeSettings');
  if (!wrap) return;
  const current = getCurrentTheme();
  wrap.innerHTML = `
    <div class="panel settings-panel">
      <h3>🎨 থিম পছন্দ করুন</h3>
      <div class="helper" style="margin-bottom:14px;">আপনার দোকানের জন্য পছন্দের রং ও লুক বেছে নিন — ক্লিক করলেই সাথে সাথে পুরো অ্যাপে প্রয়োগ হবে।</div>
      <div class="theme-grid">
        ${THEMES.map(t => `
          <button type="button" class="theme-option ${t.id === current ? 'theme-active' : ''}" onclick="setWarishaTheme('${t.id}')">
            <span class="theme-swatches">
              ${t.swatches.map(c => `<span class="theme-dot" style="background:${c}"></span>`).join('')}
            </span>
            <span class="theme-name">${t.name}</span>
            <span class="theme-desc">${t.desc}</span>
            ${t.id === current ? '<span class="theme-check">✓ বর্তমানে ব্যবহৃত হচ্ছে</span>' : ''}
          </button>
        `).join('')}
      </div>
    </div>`;
}

window.setWarishaTheme = function (id) {
  applyTheme(id);
  renderThemeSettings();
};
