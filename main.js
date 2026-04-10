/* main.js — Bay Area BMR search, filter, and render logic
   Security: All user-facing strings are escaped via escHtml().
   URLs are validated against an allowlist of safe protocols.
*/

'use strict';

/* ── SECURITY UTILITIES ── */

/**
 * Escapes HTML special characters to prevent XSS when injecting into innerHTML.
 * Every dynamic string from data.js MUST pass through this before rendering.
 */
function escHtml(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/**
 * Returns a sanitized URL string safe for use in href attributes.
 * Only allows http: and https: protocols. Returns '#' for anything else
 * (blocks javascript:, data:, vbscript:, etc.).
 */
function safeUrl(url) {
  if (typeof url !== 'string') return '#';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return escHtml(url);
    }
  } catch (_) { /* invalid URL */ }
  return '#';
}

/* ── TRANSLATIONS ── */
const LABELS = Object.freeze({
  en: {
    heroTitle: 'Find below market rate housing in the Bay Area',
    heroSub: 'Free, comprehensive database of deed-restricted affordable rental units across 14 Bay Area cities. Updated every two months via public records requests.',
    searchPlaceholder: 'Search by city, address, or name...',
    allCities: 'All cities',
    anyBeds: 'Any bedrooms',
    studio: 'Studio',
    results: (n) => `${n} unit${n !== 1 ? 's' : ''} found`,
    noResults: 'No units match your filters. Try adjusting the search or filters.',
    mapsLink: 'Google Maps',
    officialSite: 'Official site',
    howToApply: 'How to apply',
    phone: 'Phone',
    units: 'units',
    perMonth: '/mo',
  },
  es: {
    heroTitle: 'Encuentra vivienda a precio reducido en el Área de la Bahía',
    heroSub: 'Base de datos gratuita de unidades de alquiler accesibles en 14 ciudades del Área de la Bahía. Actualizada cada dos meses.',
    searchPlaceholder: 'Buscar por ciudad, dirección o nombre...',
    allCities: 'Todas las ciudades',
    anyBeds: 'Cualquier número de habitaciones',
    studio: 'Estudio',
    results: (n) => `${n} unidad${n !== 1 ? 'es' : ''} encontrada${n !== 1 ? 's' : ''}`,
    noResults: 'Ninguna unidad coincide. Intenta ajustar los filtros.',
    mapsLink: 'Google Maps',
    officialSite: 'Sitio oficial',
    howToApply: 'Cómo aplicar',
    phone: 'Teléfono',
    units: 'unidades',
    perMonth: '/mes',
  },
  zh: {
    heroTitle: '在湾区寻找低于市场价格的住房',
    heroSub: '覆盖湾区14个城市的限价租赁公寓免费数据库，每两个月更新一次。',
    searchPlaceholder: '按城市、地址或名称搜索...',
    allCities: '所有城市',
    anyBeds: '任意房间数',
    studio: '单间',
    results: (n) => `找到 ${n} 个单元`,
    noResults: '没有匹配的结果，请调整筛选条件。',
    mapsLink: '谷歌地图',
    officialSite: '官方网站',
    howToApply: '如何申请',
    phone: '电话',
    units: '个单元',
    perMonth: '/月',
  },
  vi: {
    heroTitle: 'Tìm nhà ở giá thấp hơn thị trường tại Vùng Vịnh',
    heroSub: 'Cơ sở dữ liệu miễn phí về các căn hộ cho thuê giá rẻ tại 14 thành phố Vùng Vịnh. Cập nhật mỗi hai tháng.',
    searchPlaceholder: 'Tìm theo thành phố, địa chỉ hoặc tên...',
    allCities: 'Tất cả thành phố',
    anyBeds: 'Bất kỳ số phòng ngủ',
    studio: 'Studio',
    results: (n) => `Tìm thấy ${n} căn`,
    noResults: 'Không có kết quả phù hợp. Thử điều chỉnh bộ lọc.',
    mapsLink: 'Google Maps',
    officialSite: 'Trang chính thức',
    howToApply: 'Cách đăng ký',
    phone: 'Điện thoại',
    units: 'căn',
    perMonth: '/tháng',
  },
});

let currentLang = 'en';
let filtered = [];

/* ── LANGUAGE ── */
function setLang(lang) {
  if (!LABELS[lang]) return; // guard against invalid lang values
  currentLang = lang;
  const l = LABELS[lang];

  document.querySelectorAll('.lang-btn').forEach(btn => {
    const map = { EN: 'en', ES: 'es', '中文': 'zh', VI: 'vi' };
    const isActive = map[btn.textContent] === lang;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  const heroTitle = document.getElementById('hero-title');
  const heroSub = document.getElementById('hero-sub');
  const searchInput = document.getElementById('search-input');
  if (heroTitle) heroTitle.textContent = l.heroTitle;
  if (heroSub) heroSub.textContent = l.heroSub;
  if (searchInput) searchInput.placeholder = l.searchPlaceholder;

  if (typeof renderUnits === 'function') renderUnits();
}

/* ── MOBILE MENU ── */
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const btn = document.querySelector('.nav-menu-btn');
  if (!menu || !btn) return;
  const isOpen = menu.classList.toggle('open');
  menu.setAttribute('aria-hidden', String(!isOpen));
  btn.setAttribute('aria-expanded', String(isOpen));
}

/* ── HELPERS ── */
function formatRent(min, max) {
  const fmt = (n) => '$' + Number(n).toLocaleString();
  if (typeof min !== 'number' || typeof max !== 'number') return '$0';
  return min === max ? fmt(min) : `${fmt(min)}\u2013${fmt(max)}`;
}

function bedsLabel(b) {
  const l = LABELS[currentLang];
  if (b === 0) return l.studio;
  if (b === 1) return '1 bed';
  if (b === 2) return '2 bed';
  return `${b}+ bed`;
}

function incomeBadgeHtml(income) {
  if (!Array.isArray(income)) return '';
  const map = {
    vl: ['badge-vl', 'Very low AMI'],
    lo: ['badge-lo', 'Low AMI'],
    mo: ['badge-mo', 'Moderate AMI'],
  };
  return income.map(i => {
    const entry = map[i];
    if (!entry) return '';
    const [cls, label] = entry;
    return `<span class="badge ${escHtml(cls)}">${escHtml(label)}</span>`;
  }).join('');
}

function waitlistPillHtml(w) {
  if (w === 'open') return '<span class="waitlist-pill pill-open">Waitlist open</span>';
  if (w === 'closed') return '<span class="waitlist-pill pill-closed">Waitlist closed</span>';
  return '<span class="waitlist-pill pill-unknown">Status unknown</span>';
}

function mapsUrl(address) {
  return 'https://maps.google.com/?q=' + encodeURIComponent(address);
}

/* ── FILTER ── */
function filterUnits() {
  if (!Array.isArray(window.SAMPLE_UNITS)) return;

  const q = (document.getElementById('search-input') || {}).value || '';
  const city = (document.getElementById('city-filter') || {}).value || '';
  const bedsVal = (document.getElementById('beds-filter') || {}).value || '';

  const incomeChecked = [...document.querySelectorAll('input[value="vl"],input[value="lo"],input[value="mo"]')]
    .filter(c => c.checked).map(c => c.value);

  const waitChecked = [...document.querySelectorAll('input[value="open"],input[value="closed"],input[value="unknown"]')]
    .filter(c => c.checked).map(c => c.value);

  filtered = SAMPLE_UNITS.filter(u => {
    // Text search — sanitize query before comparison
    if (q) {
      const qLow = q.toLowerCase().trim();
      const match = u.name.toLowerCase().includes(qLow) ||
                    u.city.toLowerCase().includes(qLow) ||
                    u.address.toLowerCase().includes(qLow);
      if (!match) return false;
    }
    if (city && u.city !== city) return false;
    if (bedsVal !== '') {
      const b = parseInt(bedsVal, 10);
      if (isNaN(b)) return false;
      const has = b >= 3 ? u.beds.some(x => x >= 3) : u.beds.includes(b);
      if (!has) return false;
    }
    if (!Array.isArray(u.income) || !u.income.some(i => incomeChecked.includes(i))) return false;
    if (!waitChecked.includes(u.waitlist)) return false;
    return true;
  });

  renderUnits();
}

/* ── SORT ── */
function sortUnits(by) {
  const strategies = {
    city: (a, b) => a.city.localeCompare(b.city),
    income: (a, b) => {
      const order = { vl: 0, lo: 1, mo: 2 };
      return (order[a.income[0]] ?? 3) - (order[b.income[0]] ?? 3);
    },
    waitlist: (a, b) => {
      const order = { open: 0, unknown: 1, closed: 2 };
      return (order[a.waitlist] ?? 3) - (order[b.waitlist] ?? 3);
    },
    rent: (a, b) => a.rent_min - b.rent_min,
  };
  const fn = strategies[by];
  if (fn) filtered.sort(fn);
  renderUnits();
}

/* ── RENDER ── */
function renderUnits() {
  const list = document.getElementById('unit-list');
  const countEl = document.getElementById('results-count');
  if (!list) return;

  const l = LABELS[currentLang];

  if (countEl) {
    countEl.textContent = l.results(filtered.length) + ' (sample data \u2014 live data April 23+)';
  }

  if (!filtered.length) {
    list.innerHTML = `<div class="no-results"><p>${escHtml(l.noResults)}</p></div>`;
    return;
  }

  list.innerHTML = filtered.map(u => {
    const escapedName = escHtml(u.name);
    const escapedAddress = escHtml(u.address);
    const escapedPhone = escHtml(u.phone);
    const safeSiteUrl = safeUrl(u.website);
    const safeMapsUrl = mapsUrl(u.address); // encodeURIComponent already handles this

    return `
<article class="unit-card" aria-label="${escapedName}">
  <div class="card-photo">
    <div class="card-photo-placeholder">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <path d="M21 15l-5-5L5 21"></path>
      </svg>
      <span>Photo coming soon</span>
    </div>
    ${waitlistPillHtml(u.waitlist)}
  </div>
  <div class="card-body">
    <div class="card-top">
      <div>
        <div class="card-name">${escapedName}</div>
        <div class="card-address">${escapedAddress}</div>
      </div>
    </div>
    <div class="card-badges">
      ${incomeBadgeHtml(u.income)}
      ${Array.isArray(u.beds) ? u.beds.map(b => `<span class="badge badge-beds">${escHtml(bedsLabel(b))}</span>`).join('') : ''}
    </div>
    <div class="card-meta">
      <span>${Number(u.units) || 0} ${escHtml(l.units)}</span>
      <span>${formatRent(u.rent_min, u.rent_max)}${escHtml(l.perMonth)}</span>
      <span>${escHtml(u.city)}</span>
      ${escapedPhone ? `<span>${escHtml(l.phone)}: ${escapedPhone}</span>` : ''}
    </div>
    <div class="card-links">
      <a class="card-link" href="${safeMapsUrl}" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
        ${escHtml(l.mapsLink)}
      </a>
      ${safeSiteUrl !== '#' ? `<a class="card-link" href="${safeSiteUrl}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>${escHtml(l.officialSite)}</a>` : ''}
      <a class="card-link primary" href="tips.html">${escHtml(l.howToApply)}</a>
    </div>
  </div>
</article>`;
  }).join('');
}

/* ── EVENT BINDING ── */
document.addEventListener('DOMContentLoaded', function () {
  // Graceful handling if data.js failed to load
  if (!Array.isArray(window.SAMPLE_UNITS)) {
    const list = document.getElementById('unit-list');
    if (list) {
      list.innerHTML = '<div class="no-results"><p>Unable to load housing data. Please refresh the page or try again later.</p></div>';
    }
    console.error('Bay Area BMR: SAMPLE_UNITS not found. Ensure data.js loaded correctly.');
    return;
  }

  filtered = [...SAMPLE_UNITS];
  renderUnits();

  // Bind event listeners (replacing inline handlers for separation of concerns)
  const searchInput = document.getElementById('search-input');
  const cityFilter = document.getElementById('city-filter');
  const bedsFilter = document.getElementById('beds-filter');
  const sortSelect = document.getElementById('sort-select');

  if (searchInput) searchInput.addEventListener('input', filterUnits);
  if (cityFilter) cityFilter.addEventListener('change', filterUnits);
  if (bedsFilter) bedsFilter.addEventListener('change', filterUnits);
  if (sortSelect) sortSelect.addEventListener('change', function () { sortUnits(this.value); });

  // Income and waitlist checkboxes
  document.querySelectorAll('.sidebar input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', filterUnits);
  });

  // Language buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const map = { EN: 'en', ES: 'es', '中文': 'zh', VI: 'vi' };
      const lang = map[this.textContent];
      if (lang) setLang(lang);
    });
  });

  // Mobile menu button
  const menuBtn = document.querySelector('.nav-menu-btn');
  if (menuBtn) menuBtn.addEventListener('click', toggleMobileMenu);
});
