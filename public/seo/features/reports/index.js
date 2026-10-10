/**
 * Instaflow SEO Suite - Reports & Template Management
 */

import { REPORT_TEMPLATES } from '../../lib/report/templates.js';
import { buildStandaloneHtmlReport, buildMarkdownReport } from '../../lib/report/builders.js';
import { showToast, escapeHtml } from '../../ui/components.js';

export const reportsFeature = {
  id: 'reports',
  title: 'Reports & Templates',
  tier: 1,

  async render(container, ctx) {
    const reports = await ctx.crmAdapter.listReports();
    const settings = await ctx.crmAdapter.getSettings();

    container.innerHTML = `
      <div class="seo-reports-view">
        <div class="seo-card">
          <div class="seo-card-header">
            <div>
              <h2 class="seo-card-title">📑 Report Templates & Historical Audits</h2>
              <p class="seo-card-subtitle">Manage white-label PDF/HTML reporting presets and audit history across clients.</p>
            </div>
          </div>

          <!-- Report Templates Preset Grid -->
          <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 1rem;">Saved Report Templates</h3>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem;">
            ${REPORT_TEMPLATES.map(tpl => `
              <div style="background: var(--seo-bg); border: 1px solid var(--seo-border); border-radius: 8px; padding: 1.25rem;">
                <div style="font-weight: 700; font-size: 1rem; color: var(--seo-text);">${escapeHtml(tpl.name)}</div>
                <p style="font-size: 0.8rem; color: var(--seo-muted); margin: 0.4rem 0 0.75rem 0;">${escapeHtml(tpl.description)}</p>
                <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                  ${tpl.groups.map(g => `<span class="seo-status-tag na" style="font-size: 0.65rem;">${g}</span>`).join('')}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Audit History List -->
          <h3 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 1rem;">Audit History & Reports Log</h3>
          ${reports.length === 0 ? `
            <p style="font-size: 0.85rem; color: var(--seo-muted); text-align: center; padding: 2rem 0;">No audit reports found in history yet.</p>
          ` : `
            <div class="seo-table-container">
              <table class="seo-table">
                <thead>
                  <tr>
                    <th>Date (UTC)</th>
                    <th>Target URL / Document</th>
                    <th>Health Score</th>
                    <th>Grade</th>
                    <th>Issues Found</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${reports.map(r => `
                    <tr>
                      <td>${new Date(r.auditedAt).toLocaleString()}</td>
                      <td><strong>${escapeHtml(r.url || 'Pasted Document')}</strong></td>
                      <td>${r.scorecard.overallScore !== null ? r.scorecard.overallScore + '/100' : 'N/A'}</td>
                      <td><span class="seo-status-tag ${r.scorecard.overallScore >= 80 ? 'pass' : r.scorecard.overallScore >= 60 ? 'warn' : 'fail'}">${r.scorecard.overallGrade}</span></td>
                      <td>${r.scorecard.stats.failed} fail, ${r.scorecard.stats.warned} warn</td>
                      <td>
                        <button type="button" class="seo-btn seo-btn-primary btn-open-report" data-id="${r.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">🖨️ View Report</button>
                        <button type="button" class="seo-btn seo-btn-secondary btn-delete-report" data-id="${r.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Delete</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;

    container.querySelectorAll('.btn-open-report').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const report = await ctx.crmAdapter.getReport(id);
        if (report) {
          const html = buildStandaloneHtmlReport(report, settings);
          const win = window.open('', '_blank');
          win.document.write(html);
          win.document.close();
        }
      });
    });

    container.querySelectorAll('.btn-delete-report').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Delete this report record?')) {
          await ctx.crmAdapter.deleteReport(id);
          showToast('Report deleted.', 'info');
          reportsFeature.render(container, ctx);
        }
      });
    });
  }
};
