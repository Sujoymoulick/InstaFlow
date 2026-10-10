/**
 * Instaflow SEO Suite - Settings, White-Label Branding & Backup
 */

import { showToast, escapeHtml } from '../../ui/components.js';
import { exportAllData, importBackupData } from '../../lib/storage/storage.js';

export const settingsFeature = {
  id: 'settings',
  title: 'Settings',
  tier: 1,

  async render(container, ctx) {
    const settings = await ctx.crmAdapter.getSettings();

    container.innerHTML = `
      <div class="seo-settings-view">
        <div class="seo-card">
          <div class="seo-card-header">
            <div>
              <h2 class="seo-card-title">⚙️ Suite Configuration & White-Label Branding</h2>
              <p class="seo-card-subtitle">Manage your free Tier 2 proxy connection, custom scoring weights, branding, and full JSON data backup.</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
            <!-- Left Column: Proxy & Scoring Weights -->
            <div>
              <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem;">🌐 Tier 2 Proxy Worker Connection</h3>
              <p style="font-size: 0.8rem; color: var(--seo-muted); margin-bottom: 0.75rem;">Deploy our provided Cloudflare Worker or Vercel function to enable live URL audits, crawler, and status checks.</p>
              
              <div class="seo-form-group">
                <label class="seo-label">Worker / Proxy Base URL</label>
                <div style="display: flex; gap: 0.5rem;">
                  <input type="url" id="set-proxy-url" class="seo-input" placeholder="https://my-seo-proxy.workers.dev" value="${escapeHtml(settings.proxyUrl || '')}" />
                  <button type="button" id="set-btn-test-proxy" class="seo-btn seo-btn-secondary" style="white-space: nowrap;">Test Connection</button>
                </div>
                <div id="proxy-test-result" style="font-size: 0.8rem; margin-top: 0.4rem;"></div>
              </div>

              <hr style="border: 0; border-top: 1px solid var(--seo-border); margin: 1.5rem 0;" />

              <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem;">⚖️ Custom Scorecard Category Weights</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <div class="seo-form-group">
                  <label class="seo-label">On-Page SEO (%)</label>
                  <input type="number" id="w-onpage" class="seo-input" value="${settings.customWeights?.onpage || 35}" min="0" max="100" />
                </div>
                <div class="seo-form-group">
                  <label class="seo-label">GEO / AI-Search (%)</label>
                  <input type="number" id="w-geo" class="seo-input" value="${settings.customWeights?.geo || 20}" min="0" max="100" />
                </div>
                <div class="seo-form-group">
                  <label class="seo-label">Links Architecture (%)</label>
                  <input type="number" id="w-links" class="seo-input" value="${settings.customWeights?.links || 15}" min="0" max="100" />
                </div>
                <div class="seo-form-group">
                  <label class="seo-label">Usability & Mobile (%)</label>
                  <input type="number" id="w-usability" class="seo-input" value="${settings.customWeights?.usability || 15}" min="0" max="100" />
                </div>
                <div class="seo-form-group">
                  <label class="seo-label">Performance Speed (%)</label>
                  <input type="number" id="w-perf" class="seo-input" value="${settings.customWeights?.performance || 15}" min="0" max="100" />
                </div>
                <div class="seo-form-group">
                  <label class="seo-label">Re-Audit Interval (Days)</label>
                  <input type="number" id="set-reaudit-days" class="seo-input" value="${settings.reAuditIntervalDays || 30}" min="7" max="180" />
                </div>
              </div>
            </div>

            <!-- Right Column: White-Label Branding & Backup -->
            <div>
              <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem;">🎨 White-Label Agency Branding</h3>
              
              <div class="seo-form-group">
                <label class="seo-label">Agency / Brand Name</label>
                <input type="text" id="set-brand-name" class="seo-input" value="${escapeHtml(settings.brandName || '')}" />
              </div>

              <div class="seo-form-group">
                <label class="seo-label">Primary Brand Color</label>
                <input type="color" id="set-primary-color" class="seo-input" value="${settings.primaryColor || '#4f46e5'}" style="height: 40px; padding: 2px;" />
              </div>

              <div class="seo-form-group">
                <label class="seo-label">Report Footer Text</label>
                <input type="text" id="set-footer-text" class="seo-input" value="${escapeHtml(settings.reportFooter || '')}" />
              </div>

              <div class="seo-form-group">
                <label class="seo-label">Logo Upload (Stored Locally as Data URL)</label>
                <input type="file" id="set-logo-input" accept="image/*" class="seo-input" />
                ${settings.brandLogo ? `<img src="${settings.brandLogo}" style="max-height: 40px; margin-top: 0.5rem; display: block;" />` : ''}
              </div>

              <hr style="border: 0; border-top: 1px solid var(--seo-border); margin: 1.5rem 0;" />

              <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem;">💾 Full Data Backup & Restore</h3>
              <div style="display: flex; gap: 0.5rem;">
                <button type="button" id="set-btn-export-backup" class="seo-btn seo-btn-secondary">Export JSON Backup</button>
                <button type="button" id="set-btn-import-trigger" class="seo-btn seo-btn-secondary">Restore from Backup</button>
                <input type="file" id="set-backup-file-input" accept=".json" style="display: none;" />
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 2rem;">
            <button type="button" id="set-btn-save" class="seo-btn seo-btn-primary" style="padding: 0.75rem 2.5rem;">💾 Save Settings</button>
          </div>
        </div>
      </div>
    `;

    const saveBtn = container.querySelector('#set-btn-save');
    const proxyIn = container.querySelector('#set-proxy-url');
    const testProxyBtn = container.querySelector('#set-btn-test-proxy');
    const testResult = container.querySelector('#proxy-test-result');
    const brandNameIn = container.querySelector('#set-brand-name');
    const primaryColorIn = container.querySelector('#set-primary-color');
    const footerTextIn = container.querySelector('#set-footer-text');
    const logoInput = container.querySelector('#set-logo-input');
    const reAuditDaysIn = container.querySelector('#set-reaudit-days');

    const wOnpage = container.querySelector('#w-onpage');
    const wGeo = container.querySelector('#w-geo');
    const wLinks = container.querySelector('#w-links');
    const wUsability = container.querySelector('#w-usability');
    const wPerf = container.querySelector('#w-perf');

    const exportBackupBtn = container.querySelector('#set-btn-export-backup');
    const importTriggerBtn = container.querySelector('#set-btn-import-trigger');
    const backupFileInput = container.querySelector('#set-backup-file-input');

    let currentLogoDataUrl = settings.brandLogo || '';

    logoInput.addEventListener('change', () => {
      if (logoInput.files.length > 0) {
        const r = new FileReader();
        r.onload = (e) => {
          currentLogoDataUrl = e.target.result;
          showToast('Logo image loaded!', 'success');
        };
        r.readAsDataURL(logoInput.files[0]);
      }
    });

    testProxyBtn.addEventListener('click', async () => {
      const url = proxyIn.value.trim();
      if (!url) {
        showToast('Please enter a proxy URL first.', 'warn');
        return;
      }
      testResult.textContent = 'Testing connection...';
      try {
        const res = await fetch(`${url.replace(/\/$/, '')}/health`);
        if (res.ok) {
          testResult.innerHTML = '<span style="color: var(--seo-pass); font-weight: 700;">✅ Connected successfully to Tier 2 Proxy!</span>';
        } else {
          testResult.innerHTML = `<span style="color: var(--seo-fail);">❌ Connection error (HTTP ${res.status})</span>`;
        }
      } catch (e) {
        testResult.innerHTML = `<span style="color: var(--seo-fail);">❌ Failed to reach proxy: ${escapeHtml(e.message)}</span>`;
      }
    });

    saveBtn.addEventListener('click', async () => {
      const updated = {
        proxyUrl: proxyIn.value.trim(),
        brandName: brandNameIn.value.trim(),
        primaryColor: primaryColorIn.value,
        reportFooter: footerTextIn.value.trim(),
        brandLogo: currentLogoDataUrl,
        reAuditIntervalDays: parseInt(reAuditDaysIn.value, 10) || 30,
        customWeights: {
          onpage: parseInt(wOnpage.value, 10) || 35,
          geo: parseInt(wGeo.value, 10) || 20,
          links: parseInt(wLinks.value, 10) || 15,
          usability: parseInt(wUsability.value, 10) || 15,
          performance: parseInt(wPerf.value, 10) || 15
        }
      };

      await ctx.crmAdapter.saveSettings(updated);
      showToast('Settings successfully saved!', 'success');
    });

    exportBackupBtn.addEventListener('click', () => {
      const backup = exportAllData();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `instaflow-seo-backup-${Date.now()}.json`;
      a.click();
      showToast('Full backup exported!', 'success');
    });

    importTriggerBtn.addEventListener('click', () => backupFileInput.click());
    backupFileInput.addEventListener('change', () => {
      if (backupFileInput.files.length > 0) {
        const r = new FileReader();
        r.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            const res = importBackupData(data);
            showToast(`Restored ${res.importedKeysCount} records from backup!`, 'success');
            setTimeout(() => window.location.reload(), 800);
          } catch (err) {
            showToast(`Backup restore failed: ${err.message}`, 'error');
          }
        };
        r.readAsText(backupFileInput.files[0]);
      }
    });
  }
};
