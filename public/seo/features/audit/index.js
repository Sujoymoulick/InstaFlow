/**
 * Instaflow SEO Suite - Audit Feature Module
 */

import { runAudit } from '../../lib/checks/registry.js';
import { renderScorecard } from '../../ui/charts.js';
import { showToast, escapeHtml } from '../../ui/components.js';
import { buildMarkdownReport, buildCsvReport, buildJsonReport, buildStandaloneHtmlReport } from '../../lib/report/builders.js';

export const auditFeature = {
  id: 'audit',
  title: 'Site Audit',
  tier: 1,

  render(container, ctx) {
    let currentAuditResult = null;

    container.innerHTML = `
      <div class="seo-audit-view">
        <div class="seo-card">
          <div class="seo-card-header">
            <div>
              <h2 class="seo-card-title">Run Comprehensive SEO & GEO Audit</h2>
              <p class="seo-card-subtitle">Analyze on-page factors, technical tags, AI-search readiness, and structured data.</p>
            </div>
          </div>

          <div class="seo-audit-inputs-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
            <div>
              <div class="seo-form-group">
                <label class="seo-label">Live URL ${ctx.proxyUrl ? '<span style="color: var(--seo-pass);">(Tier 2 Active)</span>' : '<span style="color: var(--seo-muted);">(Tier 2 Proxy Required)</span>'}</label>
                <div style="display: flex; gap: 0.5rem;">
                  <input type="url" id="seo-audit-url" class="seo-input" placeholder="https://example.com" />
                  <button type="button" id="seo-btn-fetch-url" class="seo-btn seo-btn-primary" style="white-space: nowrap;">Fetch & Audit</button>
                </div>
                ${!ctx.proxyUrl ? '<small style="color: var(--seo-muted);">No proxy configured. Switch to paste/upload below or configure proxy in Settings.</small>' : ''}
              </div>

              <div class="seo-form-group">
                <label class="seo-label">Target Keyword (Optional)</label>
                <input type="text" id="seo-audit-keyword" class="seo-input" placeholder="e.g. cloud crm software" />
              </div>

              <div class="seo-form-group">
                <label class="seo-label">Assign to Client (Optional)</label>
                <select id="seo-audit-client-select" class="seo-select">
                  <option value="">-- Standalone Audit --</option>
                </select>
              </div>
            </div>

            <div>
              <div class="seo-form-group">
                <label class="seo-label">Paste HTML Source or Drag & Drop File</label>
                <textarea id="seo-audit-html" class="seo-textarea" rows="4" placeholder="<!DOCTYPE html><html>..."></textarea>
              </div>

              <div class="seo-dropzone" id="seo-dropzone" style="border: 2px dashed var(--seo-border); border-radius: 8px; padding: 1rem; text-align: center; cursor: pointer; background: var(--seo-bg);">
                <span style="font-size: 1.25rem;">📄</span>
                <div style="font-size: 0.85rem; font-weight: 600; margin-top: 0.25rem;">Drag & drop .html file here, or click to browse</div>
                <input type="file" id="seo-file-input" accept=".html,.htm" style="display: none;" />
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
            <button type="button" id="seo-btn-run-pasted" class="seo-btn seo-btn-primary" style="padding: 0.75rem 2rem; font-size: 1rem;">🚀 Run Offline Audit</button>
          </div>
        </div>

        <div id="seo-audit-results-container"></div>
      </div>
    `;

    // Populate clients dropdown
    const clientSelect = container.querySelector('#seo-audit-client-select');
    ctx.crmAdapter.listClients().then(clients => {
      for (const cl of clients) {
        const opt = document.createElement('option');
        opt.value = cl.id;
        opt.textContent = `${cl.name} (${cl.website || 'No URL'})`;
        clientSelect.appendChild(opt);
      }
    });

    // Event listeners
    const dropzone = container.querySelector('#seo-dropzone');
    const fileInput = container.querySelector('#seo-file-input');
    const htmlTextarea = container.querySelector('#seo-audit-html');
    const urlInput = container.querySelector('#seo-audit-url');
    const keywordInput = container.querySelector('#seo-audit-keyword');
    const runPastedBtn = container.querySelector('#seo-btn-run-pasted');
    const fetchUrlBtn = container.querySelector('#seo-btn-fetch-url');
    const resultsContainer = container.querySelector('#seo-audit-results-container');

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--seo-primary)'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = 'var(--seo-border)'; });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--seo-border)';
      if (e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        readFile(file);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        readFile(fileInput.files[0]);
      }
    });

    function readFile(file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        htmlTextarea.value = ev.target.result;
        showToast(`Loaded ${file.name} (${Math.round(file.size / 1024)} KB)`, 'success');
      };
      reader.readAsText(file);
    }

    runPastedBtn.addEventListener('click', () => {
      const rawHtml = htmlTextarea.value.trim();
      if (!rawHtml) {
        showToast('Please paste HTML or upload a file first.', 'warn');
        return;
      }
      executeAudit(rawHtml, {
        url: urlInput.value.trim() || 'Pasted Document',
        targetKeyword: keywordInput.value.trim(),
        clientId: clientSelect.value || null
      });
    });

    fetchUrlBtn.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      if (!url) {
        showToast('Please enter a valid website URL.', 'warn');
        return;
      }
      if (!ctx.proxyUrl) {
        showToast('Live URL audit requires a configured Tier 2 proxy. Configure in Settings.', 'error');
        return;
      }

      fetchUrlBtn.disabled = true;
      fetchUrlBtn.textContent = 'Fetching...';
      try {
        const endpoint = `${ctx.proxyUrl.replace(/\/$/, '')}/fetch?url=${encodeURIComponent(url)}`;
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`Proxy responded with status ${res.status}`);
        const data = await res.json();
        
        // Also fetch robots.txt if available
        let robotsTxt = '';
        try {
          const robRes = await fetch(`${ctx.proxyUrl.replace(/\/$/, '')}/robots?url=${encodeURIComponent(url)}`);
          if (robRes.ok) {
            const robData = await robRes.json();
            robotsTxt = robData.content || '';
          }
        } catch (e) {}

        htmlTextarea.value = data.html || '';
        executeAudit(data.html, {
          url: data.finalUrl || url,
          targetKeyword: keywordInput.value.trim(),
          clientId: clientSelect.value || null,
          headers: data.headers || {},
          robotsTxt,
          byteSize: data.byteSize
        });
        showToast('Successfully fetched live site!', 'success');
      } catch (err) {
        showToast(`Fetch failed: ${err.message}`, 'error');
      } finally {
        fetchUrlBtn.disabled = false;
        fetchUrlBtn.textContent = 'Fetch & Audit';
      }
    });

    function executeAudit(html, meta) {
      const auditResult = runAudit(html, {
        url: meta.url,
        targetKeyword: meta.targetKeyword,
        headers: meta.headers,
        robotsTxt: meta.robotsTxt,
        byteSize: meta.byteSize
      });

      currentAuditResult = { ...auditResult, clientId: meta.clientId };
      
      // Persist report in CRM
      ctx.crmAdapter.saveReport(currentAuditResult).then(() => {
        showToast('Audit completed and saved to history!', 'success');
      });

      renderAuditResults(resultsContainer, currentAuditResult, ctx);
    }
  }
};

function renderAuditResults(container, report, ctx) {
  const sc = report.scorecard;
  let activeFilter = 'all';

  container.innerHTML = `
    <!-- Top Scorecard Section -->
    <div id="seo-scorecard-slot"></div>

    <!-- Page Anatomy & Summary -->
    <div class="seo-card">
      <div class="seo-card-header">
        <h3 class="seo-card-title">📄 Page Anatomy</h3>
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" id="seo-btn-export-md" class="seo-btn seo-btn-secondary">📋 Copy Markdown</button>
          <button type="button" id="seo-btn-export-csv" class="seo-btn seo-btn-secondary">📊 Export CSV</button>
          <button type="button" id="seo-btn-export-json" class="seo-btn seo-btn-secondary">{ } JSON</button>
          <button type="button" id="seo-btn-export-html" class="seo-btn seo-btn-primary">🖨️ Branded Report</button>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; text-align: center;">
        <div style="background: var(--seo-bg); padding: 1rem; border-radius: 8px;">
          <div style="font-size: 1.25rem; font-weight: 800; color: var(--seo-primary);">${report.scorecard.stats.totalChecks}</div>
          <div style="font-size: 0.75rem; color: var(--seo-muted); text-transform: uppercase;">Checks Evaluated</div>
        </div>
        <div style="background: var(--seo-bg); padding: 1rem; border-radius: 8px;">
          <div style="font-size: 1.25rem; font-weight: 800; color: var(--seo-pass);">${report.scorecard.stats.passed}</div>
          <div style="font-size: 0.75rem; color: var(--seo-muted); text-transform: uppercase;">Passed</div>
        </div>
        <div style="background: var(--seo-bg); padding: 1rem; border-radius: 8px;">
          <div style="font-size: 1.25rem; font-weight: 800; color: var(--seo-warn);">${report.scorecard.stats.warned}</div>
          <div style="font-size: 0.75rem; color: var(--seo-muted); text-transform: uppercase;">Warnings</div>
        </div>
        <div style="background: var(--seo-bg); padding: 1rem; border-radius: 8px;">
          <div style="font-size: 1.25rem; font-weight: 800; color: var(--seo-fail);">${report.scorecard.stats.failed}</div>
          <div style="font-size: 0.75rem; color: var(--seo-muted); text-transform: uppercase;">Failed</div>
        </div>
      </div>
    </div>

    <!-- Top Priority Action Plan -->
    ${sc.topFixes && sc.topFixes.length > 0 ? `
      <div class="seo-card">
        <div class="seo-card-header">
          <div>
            <h3 class="seo-card-title">🎯 Priority Action Plan (Top Fixes)</h3>
            <p class="seo-card-subtitle">Ranked by maximum SEO impact vs lowest implementation effort.</p>
          </div>
        </div>
        <div class="seo-top-fixes-list">
          ${sc.topFixes.map(fix => `
            <div class="seo-fix-item ${fix.status === 'warn' ? 'warn' : ''}">
              <div class="seo-fix-header">
                <div class="seo-fix-title">${fix.status === 'fail' ? '❌' : '⚠️'} ${escapeHtml(fix.title)}</div>
                <div class="seo-fix-badges">
                  <span class="seo-badge-severity ${fix.severity}">${fix.severity}</span>
                  <span style="font-size: 0.75rem; color: var(--seo-muted);">${fix.effort || 'medium'} effort</span>
                </div>
              </div>
              <div class="seo-fix-desc"><strong>Detected:</strong> ${escapeHtml(fix.value || 'Issue')} - ${escapeHtml(fix.details)}</div>
              <div class="seo-fix-action">💡 ${escapeHtml(fix.details)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- All Detailed Checks Filter Table -->
    <div class="seo-card" id="seo-detailed-checks-card">
      <div class="seo-card-header">
        <h3 class="seo-card-title">📋 Detailed Check Results</h3>
        <div class="seo-filter-btn-group" style="display: flex; gap: 0.25rem;">
          <button type="button" class="seo-btn seo-btn-secondary filter-btn active" data-filter="all">All (${report.checkResults.length})</button>
          <button type="button" class="seo-btn seo-btn-secondary filter-btn" data-filter="failed">Failed (${report.scorecard.stats.failed})</button>
          <button type="button" class="seo-btn seo-btn-secondary filter-btn" data-filter="warned">Warnings (${report.scorecard.stats.warned})</button>
          <button type="button" class="seo-btn seo-btn-secondary filter-btn" data-filter="passed">Passed (${report.scorecard.stats.passed})</button>
        </div>
      </div>

      <div class="seo-table-container">
        <table class="seo-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Group</th>
              <th>Check Title</th>
              <th>Severity</th>
              <th>Detected Value & Recommendations</th>
            </tr>
          </thead>
          <tbody id="seo-checks-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  // Render the Scorecard SVG component into slot
  const scorecardSlot = container.querySelector('#seo-scorecard-slot');
  renderScorecard(scorecardSlot, sc, {
    locale: ctx.locale || 'en',
    onCategoryClick: (groupId) => {
      // Scroll to table and filter by group
      const checksCard = container.querySelector('#seo-detailed-checks-card');
      checksCard?.scrollIntoView({ behavior: 'smooth' });
      renderFilteredTable(groupId);
    }
  });

  const tbody = container.querySelector('#seo-checks-tbody');

  function renderFilteredTable(filter) {
    let list = report.checkResults;
    if (filter === 'failed') list = list.filter(c => c.status === 'fail');
    else if (filter === 'warned') list = list.filter(c => c.status === 'warn');
    else if (filter === 'passed') list = list.filter(c => c.status === 'pass');
    else if (['onpage', 'geo', 'links', 'usability', 'performance'].includes(filter)) {
      list = list.filter(c => c.scorecardGroup === filter);
    }

    tbody.innerHTML = list.map(c => `
      <tr>
        <td><span class="seo-status-tag ${c.status}">${c.status}</span></td>
        <td style="font-weight: 600; text-transform: capitalize;">${c.scorecardGroup || c.category}</td>
        <td><strong>${escapeHtml(c.title)}</strong></td>
        <td><span class="seo-badge-severity ${c.severity}">${c.severity}</span></td>
        <td>
          <div>${escapeHtml(c.value || '')}</div>
          <div style="font-size: 0.75rem; color: var(--seo-muted); margin-top: 0.2rem;">${escapeHtml(c.details)}</div>
        </td>
      </tr>
    `).join('');
  }

  renderFilteredTable('all');

  // Filter button handlers
  const filterBtns = container.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderFilteredTable(btn.getAttribute('data-filter'));
    });
  });

  // Export handlers
  container.querySelector('#seo-btn-export-md').addEventListener('click', () => {
    ctx.crmAdapter.getSettings().then(settings => {
      const md = buildMarkdownReport(report, settings);
      navigator.clipboard.writeText(md);
      showToast('Markdown report copied to clipboard!', 'success');
    });
  });

  container.querySelector('#seo-btn-export-csv').addEventListener('click', () => {
    const csv = buildCsvReport(report);
    downloadFile(csv, `seo-audit-${Date.now()}.csv`, 'text/csv');
    showToast('CSV export downloaded!', 'success');
  });

  container.querySelector('#seo-btn-export-json').addEventListener('click', () => {
    const json = buildJsonReport(report);
    downloadFile(json, `seo-audit-${Date.now()}.json`, 'application/json');
    showToast('JSON report downloaded!', 'success');
  });

  container.querySelector('#seo-btn-export-html').addEventListener('click', () => {
    ctx.crmAdapter.getSettings().then(settings => {
      const standalone = buildStandaloneHtmlReport(report, settings);
      const win = window.open('', '_blank');
      win.document.write(standalone);
      win.document.close();
      showToast('Opened print-ready branded report in new tab!', 'success');
    });
  });
}

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
