/**
 * Instaflow SEO Suite - Audit Feature Module
 * Primary Free Live URL Scanner with instant 360° SEO & GEO analysis,
 * plus Multi-Site & All Submitted Sites Batch Scanner.
 */

import { runAudit } from '../../lib/checks/registry.js';
import { renderScorecard } from '../../ui/charts.js';
import { showToast, escapeHtml } from '../../ui/components.js';
import { buildMarkdownReport, buildCsvReport, buildJsonReport, buildStandaloneHtmlReport } from '../../lib/report/builders.js';
import { fetchWebsiteResilient, fetchRobotsResilient, fetchAllSubmittedSites } from '../../lib/seo/fetcher.js';
import { cleanUrlList, normalizeUrl } from '../../lib/seo/url.js';
import { getItem, setItem } from '../../lib/storage/storage.js';

export const auditFeature = {
  id: 'audit',
  title: 'Site Audit',
  tier: 1,

  render(container, ctx) {
    let currentAuditResult = null;
    let activeAuditMode = 'single'; // 'single' | 'batch'
    let batchScannedResults = getItem('audit:batch_results', []);
    let isBatchRunning = false;
    let isBatchCancelled = false;

    container.innerHTML = `
      <div class="seo-audit-view">
        <!-- Top Mode Switcher -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
          <button type="button" id="audit-mode-single-btn" class="seo-btn ${activeAuditMode === 'single' ? 'seo-btn-primary' : 'seo-btn-secondary'}" style="font-weight: 700; border-radius: 8px;">
            ⚡ Single Site Audit
          </button>
          <button type="button" id="audit-mode-batch-btn" class="seo-btn ${activeAuditMode === 'batch' ? 'seo-btn-primary' : 'seo-btn-secondary'}" style="font-weight: 700; border-radius: 8px;">
            🌐 Scan All Submitted Sites (Multi-Site Batch)
          </button>
        </div>

        <!-- Mode 1: Single URL Scanner -->
        <div id="audit-single-panel" style="display: ${activeAuditMode === 'single' ? 'block' : 'none'};">
          <div class="seo-card" style="background: linear-gradient(to bottom right, var(--seo-surface), var(--seo-bg)); border: 1px solid var(--seo-border); padding: 2rem;">
            <div style="text-align: center; max-width: 650px; margin: 0 auto 1.75rem auto;">
              <div style="display: inline-flex; align-items: center; gap: 0.4rem; background: var(--seo-pass-bg); color: var(--seo-pass); padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.75rem;">
                <span>⚡</span> Free Live URL Scanner
              </div>
              <h2 style="font-size: 1.6rem; font-weight: 800; color: var(--seo-text); letter-spacing: -0.02em;">Instant 360° SEO & AI-Search Audit</h2>
              <p style="font-size: 0.9rem; color: var(--seo-muted); margin-top: 0.25rem;">Enter any live website address to inspect on-page signals, technical tags, AI search readiness (GEO), and structured data.</p>
            </div>

            <div style="max-width: 780px; margin: 0 auto;">
              <!-- Main URL Search Input Group -->
              <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                <div style="position: relative; flex: 1;">
                  <span style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); font-size: 1.1rem; color: var(--seo-muted);">🌐</span>
                  <input type="text" id="seo-audit-url" class="seo-input" placeholder="Enter website URL (e.g. https://example.com or stripe.com)" style="padding-left: 2.75rem; height: 50px; font-size: 1rem; font-weight: 500; border-radius: 8px; border: 2px solid var(--seo-border);" />
                </div>
                <button type="button" id="seo-btn-fetch-url" class="seo-btn seo-btn-primary" style="height: 50px; padding: 0 1.75rem; font-size: 1rem; font-weight: 700; border-radius: 8px; white-space: nowrap; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.25);">
                  🔍 Scan Website
                </button>
              </div>

              <!-- Optional Parameters Row -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
                <div>
                  <label class="seo-label" style="font-size: 0.8rem; margin-bottom: 0.25rem;">Target Keyword (Optional)</label>
                  <input type="text" id="seo-audit-keyword" class="seo-input" placeholder="e.g. pdf converter" style="font-size: 0.85rem;" />
                </div>
                <div>
                  <label class="seo-label" style="font-size: 0.8rem; margin-bottom: 0.25rem;">Assign to Client (Optional)</label>
                  <select id="seo-audit-client-select" class="seo-select" style="font-size: 0.85rem;">
                    <option value="">-- Standalone Audit --</option>
                  </select>
                </div>
              </div>

              <!-- Quick One-Click Test Chips -->
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--seo-muted); flex-wrap: wrap;">
                <span>Try quick demo:</span>
                <button type="button" class="seo-chip-btn" data-url="https://freepdfly.com/" style="background: var(--seo-surface); border: 1px solid var(--seo-primary); color: var(--seo-primary); padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer;">⭐ freepdfly.com</button>
                <button type="button" class="seo-chip-btn" data-url="https://instaflow.sendvirtualgift.com" style="background: var(--seo-surface); border: 1px solid var(--seo-border); padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; cursor: pointer; color: var(--seo-text);">instaflow.sendvirtualgift.com</button>
                <button type="button" class="seo-chip-btn" data-url="https://example.com" style="background: var(--seo-surface); border: 1px solid var(--seo-border); padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; cursor: pointer; color: var(--seo-text);">example.com</button>
              </div>
            </div>

            <!-- Collapsible Manual Paste / Upload Accordion -->
            <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--seo-border); text-align: center;">
              <button type="button" id="seo-toggle-manual-input" style="background: none; border: none; font-size: 0.8rem; font-weight: 600; color: var(--seo-muted); cursor: pointer;">
                ⚙️ Need to paste raw HTML or upload .html file instead? (Click to expand)
              </button>
            </div>

            <div id="seo-manual-input-box" style="display: none; margin-top: 1.25rem; background: var(--seo-surface); border: 1px solid var(--seo-border); border-radius: 8px; padding: 1.25rem;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                  <label class="seo-label">Paste HTML Source Code</label>
                  <textarea id="seo-audit-html" class="seo-textarea" rows="4" placeholder="<!DOCTYPE html><html>..."></textarea>
                </div>
                <div>
                  <label class="seo-label">Or Upload .html File</label>
                  <div class="seo-dropzone" id="seo-dropzone" style="border: 2px dashed var(--seo-border); border-radius: 8px; padding: 1.25rem; text-align: center; cursor: pointer; background: var(--seo-bg);">
                    <span style="font-size: 1.5rem;">📄</span>
                    <div style="font-size: 0.8rem; font-weight: 600; margin-top: 0.25rem;">Drop .html file here or click to browse</div>
                    <input type="file" id="seo-file-input" accept=".html,.htm" style="display: none;" />
                  </div>
                </div>
              </div>
              <div style="display: flex; justify-content: flex-end;">
                <button type="button" id="seo-btn-run-pasted" class="seo-btn seo-btn-secondary">Run Audit from Pasted Content</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Mode 2: Multi-Site & All Submitted Sites Scanner -->
        <div id="audit-batch-panel" style="display: ${activeAuditMode === 'batch' ? 'block' : 'none'};">
          <div class="seo-card">
            <div class="seo-card-header">
              <div>
                <h2 class="seo-card-title">🌐 All Submitted Sites & Multi-URL Scanner</h2>
                <p class="seo-card-subtitle">Batch audit all submitted directory sites, client websites, or a custom list of URLs simultaneously.</p>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button type="button" id="batch-btn-load-subs" class="seo-btn seo-btn-secondary" style="font-size: 0.85rem;">
                  📥 Load Submitted Directory Sites
                </button>
                <button type="button" id="batch-btn-load-clients" class="seo-btn seo-btn-secondary" style="font-size: 0.85rem;">
                  👥 Load Client Sites
                </button>
              </div>
            </div>

            <div class="seo-form-group">
              <label class="seo-label">Target Website URLs to Audit (One URL per line)</label>
              <textarea id="batch-urls-input" class="seo-textarea" rows="4" placeholder="https://freepdfly.com/&#10;https://instaflow.sendvirtualgift.com&#10;https://example.com"></textarea>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
              <div style="font-size: 0.85rem; color: var(--seo-muted);" id="batch-url-count-label">
                Enter URLs above or click "Load Submitted Directory Sites"
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button type="button" id="batch-btn-stop" class="seo-btn seo-btn-secondary" style="display: none; color: var(--seo-fail);">
                  🛑 Stop Batch
                </button>
                <button type="button" id="batch-btn-start" class="seo-btn seo-btn-primary" style="font-weight: 700; padding: 0.6rem 1.5rem;">
                  🚀 Start Batch Audit of All Sites
                </button>
              </div>
            </div>

            <!-- Batch Progress Card -->
            <div id="batch-progress-card" style="display: none; background: var(--seo-bg); padding: 1.25rem; border-radius: 8px; margin-bottom: 1.5rem;">
              <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.5rem;">
                <span id="batch-progress-status">Auditing sites...</span>
                <span id="batch-progress-count">0 / 0 Completed</span>
              </div>
              <div style="height: 8px; background: var(--seo-border); border-radius: 4px; overflow: hidden;">
                <div id="batch-progress-bar" style="height: 100%; background: var(--seo-primary); width: 0%; transition: width 0.3s ease;"></div>
              </div>
            </div>

            <!-- Batch Results Slot -->
            <div id="batch-results-slot"></div>
          </div>
        </div>

        <!-- Audit Results Container (Single Audit View) -->
        <div id="seo-audit-results-container"></div>
      </div>
    `;

    // Mode buttons
    const singleBtn = container.querySelector('#audit-mode-single-btn');
    const batchBtn = container.querySelector('#audit-mode-batch-btn');
    const singlePanel = container.querySelector('#audit-single-panel');
    const batchPanel = container.querySelector('#audit-batch-panel');

    singleBtn.addEventListener('click', () => {
      activeAuditMode = 'single';
      singleBtn.className = 'seo-btn seo-btn-primary';
      batchBtn.className = 'seo-btn seo-btn-secondary';
      singlePanel.style.display = 'block';
      batchPanel.style.display = 'none';
    });

    batchBtn.addEventListener('click', () => {
      activeAuditMode = 'batch';
      batchBtn.className = 'seo-btn seo-btn-primary';
      singleBtn.className = 'seo-btn seo-btn-secondary';
      batchPanel.style.display = 'block';
      singlePanel.style.display = 'none';
      renderBatchResultsTable();
    });

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

    const urlInput = container.querySelector('#seo-audit-url');
    if (urlInput && ctx.getActiveUrl) {
      urlInput.value = ctx.getActiveUrl();
    }
    const fetchUrlBtn = container.querySelector('#seo-btn-fetch-url');
    const keywordInput = container.querySelector('#seo-audit-keyword');
    const resultsContainer = container.querySelector('#seo-audit-results-container');
    const chipBtns = container.querySelectorAll('.seo-chip-btn');

    // Manual input toggle
    const toggleManualBtn = container.querySelector('#seo-toggle-manual-input');
    const manualBox = container.querySelector('#seo-manual-input-box');
    const dropzone = container.querySelector('#seo-dropzone');
    const fileInput = container.querySelector('#seo-file-input');
    const htmlTextarea = container.querySelector('#seo-audit-html');
    const runPastedBtn = container.querySelector('#seo-btn-run-pasted');

    toggleManualBtn?.addEventListener('click', () => {
      manualBox.style.display = manualBox.style.display === 'none' ? 'block' : 'none';
    });

    chipBtns.forEach(chip => {
      chip.addEventListener('click', () => {
        const chipUrl = chip.getAttribute('data-url');
        urlInput.value = chipUrl;
        if (ctx.setActiveUrl) ctx.setActiveUrl(chipUrl);
        executeLiveScan(urlInput.value);
      });
    });

    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        executeLiveScan(urlInput.value);
      }
    });

    urlInput.addEventListener('change', () => {
      if (ctx.setActiveUrl && urlInput.value.trim()) {
        ctx.setActiveUrl(urlInput.value.trim());
      }
    });

    fetchUrlBtn.addEventListener('click', () => {
      executeLiveScan(urlInput.value);
    });

    async function executeLiveScan(rawUrl) {
      const cleanUrl = normalizeUrl(rawUrl);
      if (!cleanUrl) {
        showToast('Please enter a valid website URL to scan.', 'warn');
        urlInput.focus();
        return;
      }
      urlInput.value = cleanUrl;
      if (ctx.setActiveUrl) {
        ctx.setActiveUrl(cleanUrl);
      }

      fetchUrlBtn.disabled = true;
      fetchUrlBtn.innerHTML = '⏳ Scanning...';
      resultsContainer.innerHTML = `
        <div class="seo-card" style="text-align: center; padding: 3rem;">
          <div style="font-size: 2.5rem; margin-bottom: 1rem; animation: spin 2s infinite linear;">⚡</div>
          <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--seo-text);">Analyzing ${escapeHtml(cleanUrl)}</h3>
          <p style="font-size: 0.875rem; color: var(--seo-muted); margin-top: 0.5rem;">Evaluating 100+ on-page, technical, AI-search (GEO), and structured data checks...</p>
        </div>
        <style>@keyframes spin { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }</style>
      `;

      try {
        const fetchResult = await fetchWebsiteResilient(cleanUrl, ctx);
        const robotsTxt = await fetchRobotsResilient(cleanUrl, ctx);

        const auditResult = runAudit(fetchResult.html || '', {
          url: fetchResult.finalUrl || cleanUrl,
          targetKeyword: keywordInput.value.trim(),
          headers: fetchResult.headers || {},
          robotsTxt,
          byteSize: fetchResult.byteSize || 0
        });

        currentAuditResult = { ...auditResult, clientId: clientSelect.value || null };

        // Save report to CRM history
        await ctx.crmAdapter.saveReport(currentAuditResult);
        showToast('Audit complete and saved to history!', 'success');

        renderAuditResults(resultsContainer, currentAuditResult, ctx);
      } catch (err) {
        resultsContainer.innerHTML = `
          <div class="seo-card" style="border-left: 4px solid var(--seo-fail); padding: 1.5rem;">
            <h3 style="font-weight: 700; color: var(--seo-fail);">❌ Scan Failed</h3>
            <p style="font-size: 0.875rem; color: var(--seo-muted); margin-top: 0.4rem;">${escapeHtml(err.message)}</p>
            <p style="font-size: 0.8rem; color: var(--seo-muted); margin-top: 0.5rem;">Please make sure the URL is public and reachable, or use the manual HTML paste option below.</p>
          </div>
        `;
        showToast(`Scan error: ${err.message}`, 'error');
      } finally {
        fetchUrlBtn.disabled = false;
        fetchUrlBtn.innerHTML = '🔍 Scan Website';
      }
    }

    // Manual upload handlers
    dropzone?.addEventListener('click', () => fileInput.click());
    dropzone?.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--seo-primary)'; });
    dropzone?.addEventListener('dragleave', () => { dropzone.style.borderColor = 'var(--seo-border)'; });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--seo-border)';
      if (e.dataTransfer.files.length > 0) {
        readFile(e.dataTransfer.files[0]);
      }
    });

    fileInput?.addEventListener('change', () => {
      if (fileInput.files.length > 0) readFile(fileInput.files[0]);
    });

    function readFile(file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        htmlTextarea.value = ev.target.result;
        showToast(`Loaded ${file.name}`, 'success');
      };
      reader.readAsText(file);
    }

    runPastedBtn?.addEventListener('click', () => {
      const rawHtml = htmlTextarea.value.trim();
      if (!rawHtml) {
        showToast('Please paste HTML or upload a file first.', 'warn');
        return;
      }
      const auditResult = runAudit(rawHtml, {
        url: urlInput.value.trim() || 'Pasted Document',
        targetKeyword: keywordInput.value.trim()
      });
      currentAuditResult = { ...auditResult, clientId: clientSelect.value || null };
      ctx.crmAdapter.saveReport(currentAuditResult).then(() => {
        showToast('Audit complete!', 'success');
      });
      renderAuditResults(resultsContainer, currentAuditResult, ctx);
    });

    /* --- Multi-Site Batch Audit Logic --- */
    const batchUrlsInput = container.querySelector('#batch-urls-input');
    const loadSubsBtn = container.querySelector('#batch-btn-load-subs');
    const loadClientsBtn = container.querySelector('#batch-btn-load-clients');
    const startBatchBtn = container.querySelector('#batch-btn-start');
    const stopBatchBtn = container.querySelector('#batch-btn-stop');
    const batchProgressCard = container.querySelector('#batch-progress-card');
    const batchProgressBar = container.querySelector('#batch-progress-bar');
    const batchStatusText = container.querySelector('#batch-progress-status');
    const batchCountText = container.querySelector('#batch-progress-count');
    const batchResultsSlot = container.querySelector('#batch-results-slot');
    const batchCountLabel = container.querySelector('#batch-url-count-label');

    // Populate initial batch URL list from active site
    if (batchUrlsInput && !batchUrlsInput.value.trim()) {
      batchUrlsInput.value = 'https://freepdfly.com/\nhttps://instaflow.sendvirtualgift.com';
    }

    loadSubsBtn?.addEventListener('click', async () => {
      loadSubsBtn.disabled = true;
      loadSubsBtn.textContent = '⏳ Loading...';
      try {
        const sites = await fetchAllSubmittedSites();
        const urls = sites.map(s => s.url).filter(Boolean);
        if (urls.length > 0) {
          batchUrlsInput.value = urls.join('\n');
          batchCountLabel.textContent = `Loaded ${urls.length} submitted site URL(s).`;
          showToast(`Loaded ${urls.length} submitted site URLs!`, 'success');
        } else {
          showToast('No submitted sites found in database.', 'info');
        }
      } catch (e) {
        showToast(`Error loading sites: ${e.message}`, 'error');
      } finally {
        loadSubsBtn.disabled = false;
        loadSubsBtn.textContent = '📥 Load Submitted Directory Sites';
      }
    });

    loadClientsBtn?.addEventListener('click', async () => {
      const clients = await ctx.crmAdapter.listClients();
      const urls = clients.map(c => c.website).filter(Boolean);
      if (urls.length > 0) {
        batchUrlsInput.value = urls.join('\n');
        batchCountLabel.textContent = `Loaded ${urls.length} client website(s).`;
        showToast(`Loaded ${urls.length} client URLs!`, 'success');
      } else {
        showToast('No client websites found.', 'info');
      }
    });

    startBatchBtn?.addEventListener('click', async () => {
      const rawText = batchUrlsInput.value.trim();
      if (!rawText) {
        showToast('Please enter at least one URL to scan.', 'warn');
        return;
      }

      const cleaned = cleanUrlList(rawText);
      const targetUrls = cleaned.cleanedUrls;

      if (targetUrls.length === 0) {
        showToast('No valid URLs found in input.', 'warn');
        return;
      }

      isBatchRunning = true;
      isBatchCancelled = false;
      startBatchBtn.disabled = true;
      stopBatchBtn.style.display = 'inline-block';
      batchProgressCard.style.display = 'block';
      batchScannedResults = [];
      setItem('audit:batch_results', batchScannedResults);

      let completedCount = 0;
      const total = targetUrls.length;

      for (let i = 0; i < total; i++) {
        if (isBatchCancelled) break;

        const targetUrl = targetUrls[i];
        batchStatusText.textContent = `Auditing site (${i + 1}/${total}): ${targetUrl.slice(0, 45)}...`;
        batchProgressBar.style.width = `${Math.round((i / total) * 100)}%`;
        batchCountText.textContent = `${completedCount} / ${total} Completed`;

        try {
          const fetchResult = await fetchWebsiteResilient(targetUrl, ctx);
          const robotsTxt = await fetchRobotsResilient(targetUrl, ctx);

          const audit = runAudit(fetchResult.html || '', {
            url: fetchResult.finalUrl || targetUrl,
            headers: fetchResult.headers || {},
            robotsTxt,
            byteSize: fetchResult.byteSize || 0
          });

          const record = {
            url: fetchResult.finalUrl || targetUrl,
            title: audit.anatomy.title || 'Untitled',
            h1: audit.anatomy.h1 || '',
            score: audit.scorecard.overallScore,
            grade: audit.scorecard.overallGrade,
            passed: audit.scorecard.stats.passed,
            warned: audit.scorecard.stats.warned,
            failed: audit.scorecard.stats.failed,
            totalChecks: audit.scorecard.stats.totalChecks,
            status: audit.scorecard.overallScore >= 80 ? 'pass' : audit.scorecard.overallScore >= 60 ? 'warn' : 'fail',
            rawAudit: audit,
            scannedAt: new Date().toISOString()
          };

          batchScannedResults.push(record);
          await ctx.crmAdapter.saveReport(audit);
        } catch (err) {
          batchScannedResults.push({
            url: targetUrl,
            title: 'Fetch Error',
            h1: '',
            score: 0,
            grade: 'F',
            passed: 0,
            warned: 0,
            failed: 1,
            totalChecks: 1,
            status: 'fail',
            error: err.message,
            scannedAt: new Date().toISOString()
          });
        }

        completedCount++;
        setItem('audit:batch_results', batchScannedResults);
        renderBatchResultsTable();
      }

      batchProgressBar.style.width = '100%';
      batchStatusText.textContent = isBatchCancelled ? '🛑 Batch scan stopped.' : `✅ Completed audit of ${completedCount} websites!`;
      batchCountText.textContent = `${completedCount} / ${total} Completed`;
      startBatchBtn.disabled = false;
      stopBatchBtn.style.display = 'none';
      isBatchRunning = false;
      showToast(`Batch scan finished! Audited ${completedCount} sites.`, 'success');
    });

    stopBatchBtn?.addEventListener('click', () => {
      isBatchCancelled = true;
      showToast('Stopping batch scan...', 'info');
    });

    function renderBatchResultsTable() {
      if (!batchResultsSlot) return;
      if (batchScannedResults.length === 0) {
        batchResultsSlot.innerHTML = '';
        return;
      }

      const total = batchScannedResults.length;
      const avgScore = Math.round(batchScannedResults.reduce((acc, r) => acc + (r.score || 0), 0) / total);
      const passedCount = batchScannedResults.filter(r => r.status === 'pass').length;
      const failedCount = batchScannedResults.filter(r => r.status === 'fail').length;

      batchResultsSlot.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-top: 1.5rem; margin-bottom: 1.5rem; text-align: center;">
          <div style="background: var(--seo-bg); padding: 0.75rem; border-radius: 6px;">
            <div style="font-size: 1.4rem; font-weight: 800;">${total}</div>
            <div style="font-size: 0.7rem; color: var(--seo-muted); text-transform: uppercase;">Sites Audited</div>
          </div>
          <div style="background: var(--seo-bg); padding: 0.75rem; border-radius: 6px;">
            <div style="font-size: 1.4rem; font-weight: 800; color: ${avgScore >= 80 ? 'var(--seo-pass)' : avgScore >= 60 ? 'var(--seo-warn)' : 'var(--seo-fail)'};">${avgScore}/100</div>
            <div style="font-size: 0.7rem; color: var(--seo-muted); text-transform: uppercase;">Average SEO Score</div>
          </div>
          <div style="background: var(--seo-bg); padding: 0.75rem; border-radius: 6px;">
            <div style="font-size: 1.4rem; font-weight: 800; color: var(--seo-pass);">${passedCount}</div>
            <div style="font-size: 0.7rem; color: var(--seo-muted); text-transform: uppercase;">High Performing (80+)</div>
          </div>
          <div style="background: var(--seo-bg); padding: 0.75rem; border-radius: 6px;">
            <div style="font-size: 1.4rem; font-weight: 800; color: var(--seo-fail);">${failedCount}</div>
            <div style="font-size: 0.7rem; color: var(--seo-muted); text-transform: uppercase;">Needs Optimization</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h4 style="font-size: 0.95rem; font-weight: 700;">Audited Submitted Websites</h4>
          <button type="button" id="batch-btn-export-csv" class="seo-btn seo-btn-secondary" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">
            📊 Export All Sites CSV
          </button>
        </div>

        <div class="seo-table-container">
          <table class="seo-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Website URL</th>
                <th>SEO Health Score</th>
                <th>Page Title</th>
                <th>Checks (Pass / Warn / Fail)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${batchScannedResults.map((r, idx) => `
                <tr>
                  <td><span class="seo-status-tag ${r.status}">${r.grade}</span></td>
                  <td><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener" style="font-weight: 600; font-size: 0.85rem;">${escapeHtml(r.url)}</a></td>
                  <td>
                    <span style="font-weight: 800; color: ${r.score >= 80 ? 'var(--seo-pass)' : r.score >= 60 ? 'var(--seo-warn)' : 'var(--seo-fail)'};">
                      ${r.score}/100
                    </span>
                  </td>
                  <td style="font-size: 0.8rem; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(r.title || '')}">${escapeHtml(r.title || 'N/A')}</td>
                  <td style="font-size: 0.8rem;">
                    <span style="color: var(--seo-pass); font-weight: 700;">${r.passed}</span> /
                    <span style="color: var(--seo-warn); font-weight: 700;">${r.warned}</span> /
                    <span style="color: var(--seo-fail); font-weight: 700;">${r.failed}</span>
                  </td>
                  <td>
                    <div style="display: flex; gap: 0.35rem;">
                      ${r.rawAudit ? `
                        <button type="button" class="seo-btn seo-btn-secondary btn-view-single-audit" data-idx="${idx}" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">🔍 View Audit</button>
                      ` : ''}
                      <button type="button" class="seo-btn seo-btn-primary btn-check-site-ranks" data-url="${escapeHtml(r.url)}" style="font-size: 0.75rem; padding: 0.25rem 0.5rem;">🔑 Check Ranks</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Export CSV handler
      batchResultsSlot.querySelector('#batch-btn-export-csv')?.addEventListener('click', () => {
        const headers = ['URL', 'Score', 'Grade', 'Title', 'Passed Checks', 'Warning Checks', 'Failed Checks', 'Scanned At'];
        const rows = batchScannedResults.map(r => [
          r.url,
          r.score,
          r.grade,
          r.title,
          r.passed,
          r.warned,
          r.failed,
          r.scannedAt
        ]);
        const csv = [headers, ...rows].map(row => row.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
        downloadFile(csv, `all-sites-seo-audit-${Date.now()}.csv`, 'text/csv');
        showToast('All sites CSV exported!', 'success');
      });

      // View single audit handler
      batchResultsSlot.querySelectorAll('.btn-view-single-audit').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-idx'), 10);
          const rec = batchScannedResults[idx];
          if (rec && rec.rawAudit) {
            currentAuditResult = rec.rawAudit;
            renderAuditResults(resultsContainer, currentAuditResult, ctx);
            resultsContainer.scrollIntoView({ behavior: 'smooth' });
          }
        });
      });

      // Check site ranks handler
      batchResultsSlot.querySelectorAll('.btn-check-site-ranks').forEach(btn => {
        btn.addEventListener('click', () => {
          const u = btn.getAttribute('data-url');
          if (ctx.setActiveUrl) ctx.setActiveUrl(u);
          if (ctx.navigate) ctx.navigate('keywords');
        });
      });
    }
  }
};

function renderAuditResults(container, report, ctx) {
  const sc = report.scorecard;

  container.innerHTML = `
    <!-- Top Scorecard Section -->
    <div id="seo-scorecard-slot"></div>

    <!-- Page Anatomy & Summary -->
    <div class="seo-card">
      <div class="seo-card-header">
        <div>
          <h3 class="seo-card-title">📄 Audit Overview: ${escapeHtml(report.url || 'Live Site')}</h3>
          <p class="seo-card-subtitle">Audited at ${new Date(report.auditedAt).toUTCString()}</p>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button type="button" id="seo-btn-export-md" class="seo-btn seo-btn-secondary">📋 Markdown</button>
          <button type="button" id="seo-btn-export-csv" class="seo-btn seo-btn-secondary">📊 CSV</button>
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

  // Render Scorecard
  const scorecardSlot = container.querySelector('#seo-scorecard-slot');
  renderScorecard(scorecardSlot, sc, {
    locale: ctx.locale || 'en',
    onCategoryClick: (groupId) => {
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

  const filterBtns = container.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderFilteredTable(btn.getAttribute('data-filter'));
    });
  });

  // Export handlers
  container.querySelector('#seo-btn-export-md')?.addEventListener('click', () => {
    ctx.crmAdapter.getSettings().then(settings => {
      const md = buildMarkdownReport(report, settings);
      navigator.clipboard.writeText(md);
      showToast('Markdown report copied to clipboard!', 'success');
    });
  });

  container.querySelector('#seo-btn-export-csv')?.addEventListener('click', () => {
    const csv = buildCsvReport(report);
    downloadFile(csv, `seo-audit-${Date.now()}.csv`, 'text/csv');
    showToast('CSV export downloaded!', 'success');
  });

  container.querySelector('#seo-btn-export-json')?.addEventListener('click', () => {
    const json = buildJsonReport(report);
    downloadFile(json, `seo-audit-${Date.now()}.json`, 'application/json');
    showToast('JSON report downloaded!', 'success');
  });

  container.querySelector('#seo-btn-export-html')?.addEventListener('click', () => {
    ctx.crmAdapter.getSettings().then(settings => {
      const standalone = buildStandaloneHtmlReport(report, settings);
      const win = window.open('', '_blank');
      win.document.write(standalone);
      win.document.close();
      showToast('Opened branded report in new tab!', 'success');
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
