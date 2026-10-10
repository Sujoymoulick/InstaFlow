/**
 * Instaflow SEO Suite - Backlink Intelligence & Audit Importer
 */

import { showToast, escapeHtml } from '../../ui/components.js';
import { getItem, setItem } from '../../lib/storage/storage.js';

export const backlinksFeature = {
  id: 'backlinks',
  title: 'Backlinks',
  tier: 1,

  render(container, ctx) {
    let backlinkData = getItem('backlinks:data', []);

    container.innerHTML = `
      <div class="seo-backlinks-view">
        <div class="seo-card">
          <div class="seo-card-header">
            <div>
              <h2 class="seo-card-title">🔗 Backlink Portfolio & Link Profile</h2>
              <p class="seo-card-subtitle">Import Google Search Console or third-party backlink exports to inspect referring domains and anchor distributions.</p>
            </div>
          </div>

          <div class="seo-form-group">
            <label class="seo-label">Import Backlink CSV (GSC Links Export or Spreadsheet)</label>
            <input type="file" id="backlink-file-input" accept=".csv" class="seo-input" style="max-width: 400px;" />
          </div>

          <div id="backlink-results-slot"></div>
        </div>
      </div>
    `;

    const fileInput = container.querySelector('#backlink-file-input');
    const slot = container.querySelector('#backlink-results-slot');

    function renderView() {
      if (backlinkData.length === 0) {
        slot.innerHTML = `
          <div style="text-align: center; padding: 2rem 0; color: var(--seo-muted); font-size: 0.875rem;">
            No backlink records imported yet. Upload a CSV file exported from Google Search Console (Links &rsaquo; Top linking sites) to inspect referring domains.
          </div>
        `;
        return;
      }

      // Group by referring domain
      const domains = {};
      const anchorCounts = {};

      for (const item of backlinkData) {
        const domain = item.domain || (item.url ? extractDomain(item.url) : 'unknown');
        domains[domain] = (domains[domain] || 0) + 1;

        const anchor = item.anchor || 'Generic / Brand';
        anchorCounts[anchor] = (anchorCounts[anchor] || 0) + 1;
      }

      const domainList = Object.entries(domains).sort((a, b) => b[1] - a[1]);
      const anchorList = Object.entries(anchorCounts).sort((a, b) => b[1] - a[1]);

      slot.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 1.5rem 0; text-align: center;">
          <div style="background: var(--seo-bg); padding: 1rem; border-radius: 8px;">
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--seo-primary);">${backlinkData.length}</div>
            <div style="font-size: 0.75rem; color: var(--seo-muted); text-transform: uppercase;">Total Backlinks</div>
          </div>
          <div style="background: var(--seo-bg); padding: 1rem; border-radius: 8px;">
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--seo-pass);">${domainList.length}</div>
            <div style="font-size: 0.75rem; color: var(--seo-muted); text-transform: uppercase;">Unique Referring Domains</div>
          </div>
          <div style="background: var(--seo-bg); padding: 1rem; border-radius: 8px;">
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--seo-text);">${anchorList.length}</div>
            <div style="font-size: 0.75rem; color: var(--seo-muted); text-transform: uppercase;">Distinct Anchor Texts</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <div>
            <h4 style="font-weight: 700; margin-bottom: 0.75rem;">Top Referring Domains</h4>
            <div class="seo-table-container">
              <table class="seo-table">
                <thead><tr><th>Domain</th><th>Links</th></tr></thead>
                <tbody>
                  ${domainList.slice(0, 10).map(([dom, cnt]) => `
                    <tr><td><strong>${escapeHtml(dom)}</strong></td><td>${cnt}</td></tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 style="font-weight: 700; margin-bottom: 0.75rem;">Anchor Text Distribution</h4>
            <div class="seo-table-container">
              <table class="seo-table">
                <thead><tr><th>Anchor Text</th><th>Count</th></tr></thead>
                <tbody>
                  ${anchorList.slice(0, 10).map(([anc, cnt]) => `
                    <tr><td>${escapeHtml(anc)}</td><td>${cnt}</td></tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }

    renderView();

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target.result;
          const lines = text.split(/\r?\n/).filter(Boolean);
          if (lines.length > 1) {
            backlinkData = lines.slice(1).map(l => {
              const cols = l.split(',').map(c => c.replace(/^"|"$/g, '').trim());
              return { url: cols[0], target: cols[1] || '', anchor: cols[2] || '', domain: extractDomain(cols[0]) };
            });
            setItem('backlinks:data', backlinkData);
            showToast(`Imported ${backlinkData.length} backlink rows!`, 'success');
            renderView();
          }
        };
        reader.readAsText(fileInput.files[0]);
      }
    });

    function extractDomain(urlStr) {
      try {
        return new URL(urlStr.startsWith('http') ? urlStr : 'https://' + urlStr).hostname.replace(/^www\./, '');
      } catch (e) {
        return urlStr;
      }
    }
  }
};
