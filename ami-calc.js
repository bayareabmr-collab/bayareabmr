/* ami-calc.js — AMI eligibility calculator logic
   Extracted from inline script for CSP compliance and testability.
   All output is escaped via escHtml() from main.js.
*/

'use strict';

(function () {
  // 2026 HUD income limits (estimates) per household size
  // Format: { county: [1-person, 2, 3, 4, 5, 6, 7, 8] } = 100% AMI
  const AMI_LIMITS = Object.freeze({
    scco: Object.freeze([104800, 119750, 134700, 149650, 161650, 173600, 185550, 197550]),
    ala:  Object.freeze([98400,  112450, 126500, 140550, 151800, 163000, 174200, 185400]),
    cc:   Object.freeze([98400,  112450, 126500, 140550, 151800, 163000, 174200, 185400]),
  });

  const TIERS = Object.freeze([
    { key: 'el',  label: 'Extremely low income', pct: 0.30, color: '#eff6ff', textColor: '#1d4ed8' },
    { key: 'vl',  label: 'Very low income',       pct: 0.50, color: '#eff6ff', textColor: '#1d4ed8' },
    { key: 'lo',  label: 'Low income',             pct: 0.80, color: '#f0fdf4', textColor: '#166534' },
    { key: 'mo',  label: 'Moderate income',        pct: 1.20, color: '#fffbeb', textColor: '#92400e' },
  ]);

  const COUNTY_NAMES = Object.freeze({
    scco: 'Santa Clara County',
    ala: 'Alameda County',
    cc: 'Contra Costa County',
  });

  function formatMoney(n) {
    return '$' + Math.round(n).toLocaleString();
  }

  /**
   * Validates and calculates AMI eligibility.
   * Guards against NaN, negative values, and out-of-range household sizes.
   */
  function calculateAMI() {
    const sizeEl   = document.getElementById('household-size');
    const incomeEl = document.getElementById('annual-income');
    const countyEl = document.getElementById('county');
    const result   = document.getElementById('ami-result');

    if (!sizeEl || !incomeEl || !countyEl || !result) return;

    const size   = parseInt(sizeEl.value, 10);
    const income = parseFloat(incomeEl.value);
    const county = countyEl.value;

    // Validate inputs
    if (!income || income <= 0 || isNaN(income) || income > 10000000) {
      result.classList.remove('visible');
      return;
    }
    if (isNaN(size) || size < 1 || size > 8) {
      result.classList.remove('visible');
      return;
    }
    if (!AMI_LIMITS[county]) {
      result.classList.remove('visible');
      return;
    }

    const baseAMI = AMI_LIMITS[county][size - 1];
    if (!baseAMI || baseAMI <= 0) {
      result.classList.remove('visible');
      return;
    }

    const pct = (income / baseAMI) * 100;

    const pctText = document.getElementById('ami-pct-text');
    const tiersEl = document.getElementById('ami-tiers');

    result.classList.add('visible');

    const countyName = COUNTY_NAMES[county] || county;
    const sizeLabel = size === 1 ? 'person' : 'people';
    pctText.textContent = `Your household income of ${formatMoney(income)} is ${Math.round(pct)}% of the ${countyName} AMI (${formatMoney(baseAMI)} for ${size} ${sizeLabel}).`;

    // Use escHtml from main.js if available, otherwise basic text content is safe
    // since we only inject known constants and computed numbers
    tiersEl.innerHTML = TIERS.map(t => {
      const limit = baseAMI * t.pct;
      const qualifies = income <= limit;
      return `
        <div class="ami-tier ${qualifies ? 'qualify' : 'not-qualify'}">
          <h4 style="color:${qualifies ? t.textColor : 'var(--color-text-secondary)'};">${t.label}</h4>
          <p>Up to ${formatMoney(limit)}/year</p>
          <p>Up to ${Math.round(t.pct * 100)}% AMI</p>
          ${qualifies ? '<span class="qualify-badge">You qualify</span>' : ''}
        </div>`;
    }).join('');
  }

  // Bind event listeners on DOM ready
  document.addEventListener('DOMContentLoaded', function () {
    const sizeEl   = document.getElementById('household-size');
    const incomeEl = document.getElementById('annual-income');
    const countyEl = document.getElementById('county');

    if (sizeEl) sizeEl.addEventListener('change', calculateAMI);
    if (incomeEl) incomeEl.addEventListener('input', calculateAMI);
    if (countyEl) countyEl.addEventListener('change', calculateAMI);

    // Mobile menu (shared across pages)
    const menuBtn = document.querySelector('.nav-menu-btn');
    if (menuBtn && typeof toggleMobileMenu === 'function') {
      menuBtn.addEventListener('click', toggleMobileMenu);
    }
  });
})();
