/**
 * Instaflow SEO Suite - Main Entrypoint & Mount Function
 *
 * Usage:
 * import { mountSeoSuite } from '/seo/index.js';
 * const suite = mountSeoSuite(document.getElementById('seo-root'), {
 *   proxyUrl: 'https://my-proxy.workers.dev',
 *   theme: 'light',
 *   locale: 'en'
 * });
 * // To unmount: suite.destroy();
 */

import { ALL_FEATURES } from './features/registry.js';
import { LocalStorageCrmAdapter } from './lib/crm/adapter.js';
import { t, setLocale, getLocale, getAvailableLocales } from './lib/i18n/loader.js';
import { getItem, setItem } from './lib/storage/storage.js';
import { escapeHtml, showToast } from './ui/components.js';

export function mountSeoSuite(containerEl, options = {}) {
  if (!containerEl) {
    throw new Error('mountSeoSuite requires a valid container DOM element.');
  }

  const crmAdapter = options.crmAdapter || new LocalStorageCrmAdapter();
  let proxyUrl = options.proxyUrl !== undefined ? options.proxyUrl : '/api/seo';
  let currentLocale = options.locale || 'en';
  let currentTheme = options.theme || 'light';
  let activeFeatureId = options.defaultFeature || 'dashboard';
  let activeTargetUrl = getItem('active_target_url', 'https://freepdfly.com/');

  setLocale(currentLocale);

  // Apply root CSS class and styles
  containerEl.classList.add('seo-suite');
  if (currentTheme === 'dark') {
    containerEl.classList.add('seo-dark');
  }

  // Load proxyUrl from stored settings if not passed explicitly in options
  crmAdapter.getSettings().then(settings => {
    if (!proxyUrl && settings.proxyUrl) {
      proxyUrl = settings.proxyUrl;
      updateHeaderBadge();
    }
  });

  function updateActiveUrlDisplay() {
    const displayEl = containerEl.querySelector('#seo-current-target-display');
    if (displayEl) {
      displayEl.textContent = activeTargetUrl;
    }
  }

  const ctx = {
    get proxyUrl() { return proxyUrl; },
    set proxyUrl(val) { proxyUrl = val; updateHeaderBadge(); },
    crmAdapter,
    get locale() { return currentLocale; },
    get theme() { return currentTheme; },
    getActiveUrl: () => activeTargetUrl || 'https://freepdfly.com/',
    setActiveUrl: (url) => {
      if (!url) return;
      let clean = url.trim();
      if (!/^https?:\/\//i.test(clean)) clean = 'https://' + clean;
      activeTargetUrl = clean;
      setItem('active_target_url', clean);
      updateActiveUrlDisplay();
    },
    navigate: (featureId) => switchFeature(featureId)
  };

  function renderShell() {
    containerEl.innerHTML = `
      <div class="seo-app-container">
        <!-- Top App Navbar -->
        <header class="seo-navbar" role="banner">
          <div class="seo-brand-box">
            <span class="seo-brand-logo">⚡</span>
            <div>
              <div class="seo-brand-name">Instaflow SEO Suite</div>
              <div style="font-size: 0.75rem; color: var(--seo-muted);">Professional SEO Audit, GEO & Lead Intelligence</div>
            </div>
            <span id="seo-tier-badge" class="seo-brand-badge ${proxyUrl ? '' : 'tier1'}">
              ${proxyUrl ? '⚡ Free Live Scanner Active' : 'Offline Mode'}
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <!-- Language Switcher -->
            <select id="seo-locale-select" class="seo-select" style="padding: 0.35rem 0.6rem; font-size: 0.8rem; width: auto;" aria-label="Select Language">
              ${getAvailableLocales().map(l => `
                <option value="${l.code}" ${l.code === currentLocale ? 'selected' : ''}>${l.flag} ${l.name}</option>
              `).join('')}
            </select>

            <!-- Theme Toggle -->
            <button type="button" id="seo-theme-toggle" class="seo-btn seo-btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 0.85rem;" title="Toggle Dark/Light Mode" aria-label="Toggle Theme">
              ${currentTheme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        <!-- Navigation Tabs Bar -->
        <nav class="seo-nav-tabs" role="tablist" aria-label="SEO Suite Navigation">
          ${ALL_FEATURES.map(f => `
            <button type="button" class="seo-tab-btn ${f.id === activeFeatureId ? 'active' : ''}" role="tab" aria-selected="${f.id === activeFeatureId}" data-feature="${f.id}">
              ${f.title}
            </button>
          `).join('')}
        </nav>

        <!-- Active Target Site Bar -->
        <div class="seo-target-bar">
          <div class="seo-target-info">
            <span class="seo-target-dot"></span>
            <span class="seo-target-label">Target Site:</span>
            <span class="seo-target-url" id="seo-current-target-display">${escapeHtml(activeTargetUrl)}</span>
          </div>
          <div class="seo-target-actions">
            <button type="button" id="seo-btn-change-target" class="seo-btn seo-btn-secondary" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;" title="Change default website">🌐 Switch Site</button>
            <button type="button" id="seo-btn-quick-audit" class="seo-btn seo-btn-primary" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">⚡ Run Audit</button>
            <button type="button" id="seo-btn-quick-crawl" class="seo-btn seo-btn-secondary" style="padding: 0.25rem 0.65rem; font-size: 0.75rem;">🕷️ Crawl Site</button>
          </div>
        </div>

        <!-- Main Body Area -->
        <main class="seo-main-body" id="seo-feature-container" role="tabpanel" tabindex="0">
        </main>
      </div>
    `;

    // Bind event listeners
    const navButtons = containerEl.querySelectorAll('.seo-tab-btn');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const featId = btn.getAttribute('data-feature');
        switchFeature(featId);
      });
    });

    // Target bar handlers
    const changeTargetBtn = containerEl.querySelector('#seo-btn-change-target');
    changeTargetBtn?.addEventListener('click', () => {
      const newUrl = prompt('Enter website URL to analyze across all SEO tools:', activeTargetUrl);
      if (newUrl && newUrl.trim()) {
        ctx.setActiveUrl(newUrl.trim());
        showToast(`Target site updated to ${activeTargetUrl}`, 'success');
        // Refresh current feature
        switchFeature(activeFeatureId);
      }
    });

    const quickAuditBtn = containerEl.querySelector('#seo-btn-quick-audit');
    quickAuditBtn?.addEventListener('click', () => {
      switchFeature('audit');
    });

    const quickCrawlBtn = containerEl.querySelector('#seo-btn-quick-crawl');
    quickCrawlBtn?.addEventListener('click', () => {
      switchFeature('crawler');
    });

    const localeSelect = containerEl.querySelector('#seo-locale-select');
    localeSelect?.addEventListener('change', (e) => {
      currentLocale = e.target.value;
      setLocale(currentLocale);
      switchFeature(activeFeatureId);
    });

    const themeToggle = containerEl.querySelector('#seo-theme-toggle');
    themeToggle?.addEventListener('click', () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      containerEl.classList.toggle('seo-dark', currentTheme === 'dark');
      themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    });
  }

  function updateHeaderBadge() {
    const badge = containerEl.querySelector('#seo-tier-badge');
    if (badge) {
      badge.className = `seo-brand-badge ${proxyUrl ? '' : 'tier1'}`;
      badge.textContent = proxyUrl ? 'Tier 2: Proxy Active' : 'Tier 1: Browser Offline';
    }
  }

  function switchFeature(featureId) {
    activeFeatureId = featureId;
    const navButtons = containerEl.querySelectorAll('.seo-tab-btn');
    navButtons.forEach(btn => {
      const match = btn.getAttribute('data-feature') === featureId;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-selected', match);
    });

    const featureContainer = containerEl.querySelector('#seo-feature-container');
    if (!featureContainer) return;

    const feature = ALL_FEATURES.find(f => f.id === featureId) || ALL_FEATURES[0];
    feature.render(featureContainer, ctx);
  }

  // Initial render
  renderShell();
  switchFeature(activeFeatureId);

  // Return destroy teardown function
  return {
    destroy: () => {
      containerEl.innerHTML = '';
      containerEl.classList.remove('seo-suite', 'seo-dark');
    },
    navigate: switchFeature,
    setProxyUrl: (url) => { ctx.proxyUrl = url; }
  };
}

// Global auto-mount fallback if requested via script tag
if (typeof window !== 'undefined') {
  window.mountSeoSuite = mountSeoSuite;
}
