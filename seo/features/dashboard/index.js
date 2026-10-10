/**
 * Instaflow SEO Suite - Dashboard Feature Module
 */

import { showToast, escapeHtml } from '../../ui/components.js';

export const dashboardFeature = {
  id: 'dashboard',
  title: 'Dashboard',
  tier: 1,

  async render(container, ctx) {
    const clients = await ctx.crmAdapter.listClients();
    const reports = await ctx.crmAdapter.listReports();
    const leads = await ctx.crmAdapter.listLeads();
    const settings = await ctx.crmAdapter.getSettings();

    const reAuditDays = settings.reAuditIntervalDays || 30;
    const now = Date.now();
    const needsReAudit = [];

    for (const cl of clients) {
      const clientReports = reports.filter(r => r.clientId === cl.id);
      const latest = clientReports[0];
      if (latest) {
        const ageDays = (now - new Date(latest.auditedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays >= reAuditDays) {
          needsReAudit.push({ client: cl, latestReport: latest, ageDays: Math.round(ageDays) });
        }
      }
    }

    container.innerHTML = `
      <div class="seo-dashboard-view">
        <!-- Hero Instant URL Quick Scan Bar -->
        <div class="seo-card" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; padding: 1.75rem 2rem; border: none; margin-bottom: 1.5rem; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.25);">
          <div style="max-width: 800px;">
            <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.9; margin-bottom: 0.25rem;">⚡ Instant Free SEO & GEO Scanner</div>
            <h2 style="font-size: 1.5rem; font-weight: 800; color: #ffffff; margin-bottom: 0.5rem; line-height: 1.2;">Scan & Audit Any Website</h2>
            <p style="font-size: 0.875rem; opacity: 0.85; margin-bottom: 1.25rem;">Enter any URL below for an immediate 100+ point audit across On-Page SEO, AI-search (GEO), Schema, and Core Web Vitals.</p>
            
            <div style="display: flex; gap: 0.5rem;">
              <input type="text" id="dash-quick-url" placeholder="https://freepdfly.com" value="${escapeHtml(ctx.getActiveUrl ? ctx.getActiveUrl() : 'https://freepdfly.com/')}" style="flex: 1; height: 48px; padding: 0 1.25rem; font-size: 0.95rem; border: none; border-radius: 8px; background: #ffffff; color: #0f172a;" />
              <button type="button" id="dash-btn-quick-scan" style="height: 48px; padding: 0 1.75rem; font-size: 0.95rem; font-weight: 700; border: none; border-radius: 8px; background: #10b981; color: #ffffff; cursor: pointer; white-space: nowrap; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.15);">
                🔍 Start Scan
              </button>
            </div>
          </div>
        </div>

        <!-- Top Metric Counters -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="seo-card" style="margin-bottom: 0;">
            <div style="font-size: 0.8rem; font-weight: 700; color: var(--seo-muted); text-transform: uppercase;">Active Clients</div>
            <div style="font-size: 1.8rem; font-weight: 800; color: var(--seo-text); margin-top: 0.25rem;">${clients.length}</div>
          </div>
          <div class="seo-card" style="margin-bottom: 0;">
            <div style="font-size: 0.8rem; font-weight: 700; color: var(--seo-muted); text-transform: uppercase;">Audits Run</div>
            <div style="font-size: 1.8rem; font-weight: 800; color: var(--seo-primary); margin-top: 0.25rem;">${reports.length}</div>
          </div>
          <div class="seo-card" style="margin-bottom: 0;">
            <div style="font-size: 0.8rem; font-weight: 700; color: var(--seo-muted); text-transform: uppercase;">Widget Leads</div>
            <div style="font-size: 1.8rem; font-weight: 800; color: var(--seo-pass); margin-top: 0.25rem;">${leads.length}</div>
          </div>
          <div class="seo-card" style="margin-bottom: 0;">
            <div style="font-size: 0.8rem; font-weight: 700; color: var(--seo-muted); text-transform: uppercase;">Re-Audits Due</div>
            <div style="font-size: 1.8rem; font-weight: 800; color: ${needsReAudit.length > 0 ? 'var(--seo-warn)' : 'var(--seo-text)'}; margin-top: 0.25rem;">${needsReAudit.length}</div>
          </div>
        </div>

        ${needsReAudit.length > 0 ? `
          <div class="seo-card" style="border-left: 4px solid var(--seo-warn);">
            <h4 style="font-weight: 700; color: var(--seo-warn); display: flex; align-items: center; gap: 0.5rem;">
              ⏰ Scheduled Re-Audit Reminders
            </h4>
            <p style="font-size: 0.85rem; color: var(--seo-muted); margin: 0.25rem 0 0.75rem 0;">The following client sites have not been audited in over ${reAuditDays} days:</p>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
              ${needsReAudit.map(item => `
                <span style="background: var(--seo-warn-bg); color: var(--seo-warn); padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
                  ${escapeHtml(item.client.name)} (${item.ageDays}d ago)
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
          <!-- Clients & Project Management -->
          <div class="seo-card">
            <div class="seo-card-header">
              <h3 class="seo-card-title">👥 Client Project Accounts</h3>
              <button type="button" id="seo-btn-add-client" class="seo-btn seo-btn-primary">+ New Client</button>
            </div>

            <div id="seo-client-form-slot" style="display: none; background: var(--seo-bg); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
              <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.75rem;">Add Client Record</h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
                <input type="text" id="seo-new-client-name" class="seo-input" placeholder="Client Name (e.g. Acme Corp)" />
                <input type="url" id="seo-new-client-url" class="seo-input" placeholder="Primary Website URL" />
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
                <button type="button" id="seo-btn-cancel-client" class="seo-btn seo-btn-secondary">Cancel</button>
                <button type="button" id="seo-btn-save-client" class="seo-btn seo-btn-primary">Save Client</button>
              </div>
            </div>

            ${clients.length === 0 ? `
              <p style="font-size: 0.875rem; color: var(--seo-muted); text-align: center; padding: 2rem 0;">No client accounts created yet. Click "+ New Client" to start managing client SEO projects.</p>
            ` : `
              <div class="seo-table-container">
                <table class="seo-table">
                  <thead>
                    <tr>
                      <th>Client Name</th>
                      <th>Website</th>
                      <th>Latest Health Score</th>
                      <th>Audits</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${clients.map(cl => {
                      const clReports = reports.filter(r => r.clientId === cl.id);
                      const latest = clReports[0];
                      const score = latest ? latest.scorecard.overallScore : null;
                      const grade = latest ? latest.scorecard.overallGrade : 'N/A';

                      return `
                        <tr>
                          <td><strong>${escapeHtml(cl.name)}</strong></td>
                          <td><a href="${escapeHtml(cl.website)}" target="_blank" rel="noopener">${escapeHtml(cl.website || 'No URL')}</a></td>
                          <td>
                            ${score !== null ? `
                              <span class="seo-status-tag ${score >= 80 ? 'pass' : score >= 60 ? 'warn' : 'fail'}">
                                ${score}/100 (${grade})
                              </span>
                            ` : '<span style="color: var(--seo-muted);">Not audited</span>'}
                          </td>
                          <td>${clReports.length}</td>
                          <td>
                            <button type="button" class="seo-btn seo-btn-secondary btn-delete-client" data-id="${cl.id}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Delete</button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>

          <!-- Recent Audit Feed -->
          <div class="seo-card">
            <div class="seo-card-header">
              <h3 class="seo-card-title">🕒 Recent Audits</h3>
            </div>
            ${reports.length === 0 ? `
              <p style="font-size: 0.85rem; color: var(--seo-muted); text-align: center; padding: 1.5rem 0;">No audit history found. Run your first audit using the quick scan bar above.</p>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${reports.slice(0, 6).map(r => `
                  <div style="background: var(--seo-bg); border: 1px solid var(--seo-border); border-radius: 6px; padding: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-weight: 700; font-size: 0.85rem; word-break: break-all;">${escapeHtml(r.url || 'Pasted HTML')}</span>
                      <span class="seo-status-tag ${r.scorecard.overallScore >= 80 ? 'pass' : r.scorecard.overallScore >= 60 ? 'warn' : 'fail'}">
                        ${r.scorecard.overallGrade} (${r.scorecard.overallScore || 'N/A'})
                      </span>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--seo-muted); margin-top: 0.25rem;">
                      ${new Date(r.auditedAt).toLocaleDateString()} • ${r.scorecard.stats.failed} failed checks
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    // Quick scan handler from dashboard
    const quickUrlIn = container.querySelector('#dash-quick-url');
    const quickScanBtn = container.querySelector('#dash-btn-quick-scan');

    function triggerScan() {
      const u = quickUrlIn.value.trim();
      if (!u) {
        showToast('Please enter a website URL.', 'warn');
        quickUrlIn.focus();
        return;
      }
      if (ctx.setActiveUrl) {
        ctx.setActiveUrl(u);
      }
      ctx.navigate('audit');
      setTimeout(() => {
        const auditUrlIn = document.querySelector('#seo-audit-url');
        const auditBtn = document.querySelector('#seo-btn-fetch-url');
        if (auditUrlIn && auditBtn) {
          auditUrlIn.value = u;
          auditBtn.click();
        }
      }, 100);
    }

    quickScanBtn?.addEventListener('click', triggerScan);
    quickUrlIn?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') triggerScan();
    });

    // Client form handlers
    const addClientBtn = container.querySelector('#seo-btn-add-client');
    const formSlot = container.querySelector('#seo-client-form-slot');
    const cancelClientBtn = container.querySelector('#seo-btn-cancel-client');
    const saveClientBtn = container.querySelector('#seo-btn-save-client');
    const nameInput = container.querySelector('#seo-new-client-name');
    const urlInput = container.querySelector('#seo-new-client-url');

    addClientBtn?.addEventListener('click', () => {
      formSlot.style.display = 'block';
    });

    cancelClientBtn?.addEventListener('click', () => {
      formSlot.style.display = 'none';
    });

    saveClientBtn?.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      const website = urlInput.value.trim();
      if (!name) {
        showToast('Please enter a client name.', 'warn');
        return;
      }
      await ctx.crmAdapter.saveClient({ name, website });
      showToast(`Saved client "${name}"!`, 'success');
      dashboardFeature.render(container, ctx);
    });

    container.querySelectorAll('.btn-delete-client').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this client record?')) {
          await ctx.crmAdapter.deleteClient(id);
          showToast('Client deleted.', 'info');
          dashboardFeature.render(container, ctx);
        }
      });
    });
  }
};
