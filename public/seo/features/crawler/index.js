/**
 * Instaflow SEO Suite - Site Crawler Module (Tier 2 Proxy Powered)
 */

import { showToast, escapeHtml } from '../../ui/components.js';
import { parseHTML, extractPageAnatomy } from '../../lib/parse/html.js';
import { getItem, setItem } from '../../lib/storage/storage.js';

export const crawlerFeature = {
  id: 'crawler',
  title: 'Site Crawler',
  tier: 2,

  render(container, ctx) {
    let crawlState = getItem('crawler:state', {
      status: 'idle', // 'idle' | 'running' | 'paused' | 'done'
      targetUrl: '',
      maxPages: 50,
      maxDepth: 3,
      delayMs: 300,
      crawled: [],
      queue: [],
      seen: {}
    });

    let isPaused = false;
    let isCancelled = false;

    container.innerHTML = `
      <div class="seo-crawler-view">
        <div class="seo-card">
          <div class="seo-card-header">
            <div>
              <h2 class="seo-card-title">🕷️ Autonomous Site Crawler</h2>
              <p class="seo-card-subtitle">Discover broken links, duplicate titles, redirect chains, and site architecture depth.</p>
            </div>
          </div>

          ${!ctx.proxyUrl ? `
            <div style="background: var(--seo-warn-bg); color: var(--seo-warn); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; font-size: 0.875rem;">
              ⚠️ <strong>Requires Tier 2 Proxy:</strong> Web browsers cannot crawl cross-origin websites directly. Please configure your free Cloudflare Worker or Vercel proxy in <strong>Settings</strong>.
            </div>
          ` : ''}

          <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 1rem; align-items: end; margin-bottom: 1.5rem;">
            <div class="seo-form-group" style="margin-bottom: 0;">
              <label class="seo-label">Root Website URL or Sitemap</label>
              <input type="url" id="crawl-target-url" class="seo-input" placeholder="https://example.com" value="${escapeHtml(crawlState.targetUrl || '')}" ${!ctx.proxyUrl ? 'disabled' : ''} />
            </div>

            <div class="seo-form-group" style="margin-bottom: 0;">
              <label class="seo-label">Max Pages</label>
              <input type="number" id="crawl-max-pages" class="seo-input" value="${crawlState.maxPages || 50}" min="5" max="250" />
            </div>

            <div class="seo-form-group" style="margin-bottom: 0;">
              <label class="seo-label">Max Depth</label>
              <input type="number" id="crawl-max-depth" class="seo-input" value="${crawlState.maxDepth || 3}" min="1" max="5" />
            </div>

            <div style="display: flex; gap: 0.5rem;">
              <button type="button" id="crawl-btn-start" class="seo-btn seo-btn-primary" style="width: 100%;" ${!ctx.proxyUrl ? 'disabled' : ''}>
                Start Crawl
              </button>
            </div>
          </div>

          <!-- Progress Bar & Controls -->
          <div id="crawl-progress-card" style="display: ${crawlState.crawled.length > 0 || crawlState.status === 'running' ? 'block' : 'none'}; background: var(--seo-bg); padding: 1.25rem; border-radius: 8px; margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.5rem;">
              <span id="crawl-status-text">Crawled ${crawlState.crawled.length} pages</span>
              <span id="crawl-queue-text">Queue: ${crawlState.queue.length} remaining</span>
            </div>
            <div style="height: 8px; background: var(--seo-border); border-radius: 4px; overflow: hidden; margin-bottom: 1rem;">
              <div id="crawl-progress-bar" style="height: 100%; background: var(--seo-primary); width: ${crawlState.crawled.length > 0 ? (crawlState.crawled.length / (crawlState.crawled.length + crawlState.queue.length || 1)) * 100 : 0}%;"></div>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button type="button" id="crawl-btn-pause" class="seo-btn seo-btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">Pause</button>
              <button type="button" id="crawl-btn-cancel" class="seo-btn seo-btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; color: var(--seo-fail);">Stop</button>
              <button type="button" id="crawl-btn-csv" class="seo-btn seo-btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; margin-left: auto;">Export Crawl CSV</button>
            </div>
          </div>

          <!-- Crawl Results Table -->
          <div id="crawl-results-slot"></div>
        </div>
      </div>
    `;

    const startBtn = container.querySelector('#crawl-btn-start');
    const pauseBtn = container.querySelector('#crawl-btn-pause');
    const cancelBtn = container.querySelector('#crawl-btn-cancel');
    const csvBtn = container.querySelector('#crawl-btn-csv');
    const targetUrlInput = container.querySelector('#crawl-target-url');
    const maxPagesInput = container.querySelector('#crawl-max-pages');
    const maxDepthInput = container.querySelector('#crawl-max-depth');
    const progressCard = container.querySelector('#crawl-progress-card');
    const progressBar = container.querySelector('#crawl-progress-bar');
    const statusText = container.querySelector('#crawl-status-text');
    const queueText = container.querySelector('#crawl-queue-text');
    const resultsSlot = container.querySelector('#crawl-results-slot');

    function renderResultsTable() {
      if (crawlState.crawled.length === 0) {
        resultsSlot.innerHTML = '';
        return;
      }

      const broken = crawlState.crawled.filter(p => p.status >= 400);
      const redirects = crawlState.crawled.filter(p => p.status >= 300 && p.status < 400);

      resultsSlot.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; text-align: center;">
          <div style="background: var(--seo-bg); padding: 0.75rem; border-radius: 6px;">
            <div style="font-size: 1.25rem; font-weight: 800;">${crawlState.crawled.length}</div>
            <div style="font-size: 0.7rem; color: var(--seo-muted); text-transform: uppercase;">Pages Crawled</div>
          </div>
          <div style="background: var(--seo-bg); padding: 0.75rem; border-radius: 6px;">
            <div style="font-size: 1.25rem; font-weight: 800; color: ${broken.length > 0 ? 'var(--seo-fail)' : 'var(--seo-pass)'};">${broken.length}</div>
            <div style="font-size: 0.7rem; color: var(--seo-muted); text-transform: uppercase;">Broken Links (4xx/5xx)</div>
          </div>
          <div style="background: var(--seo-bg); padding: 0.75rem; border-radius: 6px;">
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--seo-warn);">${redirects.length}</div>
            <div style="font-size: 0.7rem; color: var(--seo-muted); text-transform: uppercase;">Redirects</div>
          </div>
          <div style="background: var(--seo-bg); padding: 0.75rem; border-radius: 6px;">
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--seo-primary);">${crawlState.queue.length}</div>
            <div style="font-size: 0.7rem; color: var(--seo-muted); text-transform: uppercase;">In Queue</div>
          </div>
        </div>

        <div class="seo-table-container">
          <table class="seo-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>URL</th>
                <th>Title</th>
                <th>H1</th>
                <th>Depth</th>
                <th>Words</th>
                <th>Links (In / Out)</th>
              </tr>
            </thead>
            <tbody>
              ${crawlState.crawled.map(p => `
                <tr>
                  <td><span class="seo-status-tag ${p.status === 200 ? 'pass' : p.status >= 400 ? 'fail' : 'warn'}">${p.status}</span></td>
                  <td><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener" style="font-weight: 600; font-size: 0.8rem; word-break: break-all;">${escapeHtml(p.url)}</a></td>
                  <td style="font-size: 0.8rem;">${escapeHtml(p.title || 'Missing')}</td>
                  <td style="font-size: 0.8rem;">${escapeHtml(p.h1 || 'Missing')}</td>
                  <td>${p.depth}</td>
                  <td>${p.wordCount}</td>
                  <td>${p.internalLinks} / ${p.externalLinks}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    renderResultsTable();

    startBtn?.addEventListener('click', async () => {
      const rootUrl = targetUrlInput.value.trim();
      if (!rootUrl) {
        showToast('Please enter a root URL to start crawling.', 'warn');
        return;
      }
      if (!ctx.proxyUrl) {
        showToast('Tier 2 Proxy required for live crawling.', 'error');
        return;
      }

      crawlState = {
        status: 'running',
        targetUrl: rootUrl,
        maxPages: parseInt(maxPagesInput.value, 10) || 50,
        maxDepth: parseInt(maxDepthInput.value, 10) || 3,
        delayMs: 300,
        crawled: [],
        queue: [{ url: rootUrl, depth: 0 }],
        seen: { [rootUrl.replace(/\/$/, '').toLowerCase()]: true }
      };
      setItem('crawler:state', crawlState);
      progressCard.style.display = 'block';
      isPaused = false;
      isCancelled = false;

      runCrawlLoop();
    });

    pauseBtn?.addEventListener('click', () => {
      isPaused = !isPaused;
      pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
      if (!isPaused) runCrawlLoop();
    });

    cancelBtn?.addEventListener('click', () => {
      isCancelled = true;
      crawlState.status = 'done';
      setItem('crawler:state', crawlState);
      showToast('Crawler stopped.', 'info');
    });

    csvBtn?.addEventListener('click', () => {
      if (crawlState.crawled.length === 0) return;
      const csv = [
        ['Status', 'URL', 'Title', 'H1', 'Depth', 'Word Count', 'Internal Links', 'External Links'],
        ...crawlState.crawled.map(p => [p.status, p.url, p.title || '', p.h1 || '', p.depth, p.wordCount, p.internalLinks, p.externalLinks])
      ].map(r => r.map(c => `"${c}"`).join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `crawl-export-${Date.now()}.csv`;
      a.click();
      showToast('Crawl CSV downloaded!', 'success');
    });

    async function runCrawlLoop() {
      while (crawlState.queue.length > 0 && crawlState.crawled.length < crawlState.maxPages && !isPaused && !isCancelled) {
        const item = crawlState.queue.shift();
        statusText.textContent = `Crawling: ${item.url.slice(0, 50)}...`;
        queueText.textContent = `Queue: ${crawlState.queue.length} remaining`;
        const pct = Math.min(100, Math.round((crawlState.crawled.length / crawlState.maxPages) * 100));
        progressBar.style.width = `${pct}%`;

        try {
          const endpoint = `${ctx.proxyUrl.replace(/\/$/, '')}/fetch?url=${encodeURIComponent(item.url)}`;
          const res = await fetch(endpoint);
          const data = await res.json();

          const doc = parseHTML(data.html || '');
          const anatomy = extractPageAnatomy(doc, data.html || '');
          const h1 = doc.querySelector('h1')?.textContent?.trim() || '';

          const pageRecord = {
            url: data.finalUrl || item.url,
            status: data.status || res.status,
            depth: item.depth,
            title: doc.title || '',
            h1,
            wordCount: anatomy.wordCount,
            internalLinks: 0,
            externalLinks: 0
          };

          // Extract outbound links if within maxDepth
          if (item.depth < crawlState.maxDepth) {
            const host = new URL(item.url).hostname;
            const links = doc.querySelectorAll('a[href]');
            for (const a of links) {
              const href = a.getAttribute('href') || '';
              if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
              
              let resolved;
              try {
                resolved = new URL(href, item.url).toString().split('#')[0];
              } catch (e) {
                continue;
              }

              const isInternal = resolved.includes(host);
              if (isInternal) {
                pageRecord.internalLinks++;
                const key = resolved.replace(/\/$/, '').toLowerCase();
                if (!crawlState.seen[key] && crawlState.queue.length < 300) {
                  crawlState.seen[key] = true;
                  crawlState.queue.push({ url: resolved, depth: item.depth + 1 });
                }
              } else {
                pageRecord.externalLinks++;
              }
            }
          }

          crawlState.crawled.push(pageRecord);
          setItem('crawler:state', crawlState);
          renderResultsTable();

          // Polite crawl delay
          await new Promise(r => setTimeout(r, crawlState.delayMs || 300));
        } catch (err) {
          crawlState.crawled.push({
            url: item.url,
            status: 500,
            depth: item.depth,
            title: 'Fetch Error',
            h1: '',
            wordCount: 0,
            internalLinks: 0,
            externalLinks: 0
          });
        }
      }

      if (crawlState.queue.length === 0 || crawlState.crawled.length >= crawlState.maxPages) {
        crawlState.status = 'done';
        setItem('crawler:state', crawlState);
        statusText.textContent = `✅ Crawl completed: ${crawlState.crawled.length} pages indexed.`;
        showToast('Site crawl completed!', 'success');
      }
    }
  }
};
