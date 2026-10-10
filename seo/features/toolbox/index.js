/**
 * Instaflow SEO Suite - Free SEO Toolbox Module (Tier 1 Offline Capable)
 */

import { estimatePixelWidth, slugify, buildUtmUrl, cleanUrlList } from '../../lib/seo/url.js';
import { analyzeText } from '../../lib/seo/readability.js';
import { extractNGrams } from '../../lib/seo/keywords.js';
import { parseRobotsTxt, isPathAllowed, generateRobotsTxt } from '../../lib/seo/robots.js';
import { parseSitemapXml, generateSitemapXml } from '../../lib/seo/sitemap.js';
import { validatePageHreflangs, validateHreflangCode } from '../../lib/seo/hreflang.js';
import { SUPPORTED_SCHEMAS, generateSchema, extractJsonLd, validateSchemaItems } from '../../lib/seo/schema.js';
import { generateRedirectRules } from '../../lib/seo/redirects.js';
import { showToast, escapeHtml } from '../../ui/components.js';

export const toolboxFeature = {
  id: 'toolbox',
  title: 'SEO Toolbox',
  tier: 1,

  render(container, ctx) {
    let activeTool = 'serp';

    container.innerHTML = `
      <div class="seo-toolbox-view">
        <div class="seo-card">
          <div class="seo-card-header">
            <div>
              <h2 class="seo-card-title">🧰 Free SEO Engineering Toolbox</h2>
              <p class="seo-card-subtitle">All 14 tools run 100% locally in your browser with zero paid API dependencies.</p>
            </div>
          </div>

          <!-- Tool Selector Tabs -->
          <div style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--seo-border);">
            <button type="button" class="seo-btn seo-btn-secondary tool-tab active" data-tool="serp">🖥️ SERP Preview</button>
            <button type="button" class="seo-btn seo-btn-secondary tool-tab" data-tool="schema">🏷️ Schema Builder</button>
            <button type="button" class="seo-btn seo-btn-secondary tool-tab" data-tool="robots">🤖 Robots.txt</button>
            <button type="button" class="seo-btn seo-btn-secondary tool-tab" data-tool="sitemap">🗺️ XML Sitemap</button>
            <button type="button" class="seo-btn seo-btn-secondary tool-tab" data-tool="llmstxt">📄 LLMs.txt</button>
            <button type="button" class="seo-btn seo-btn-secondary tool-tab" data-tool="hreflang">🌐 Hreflang</button>
            <button type="button" class="seo-btn seo-btn-secondary tool-tab" data-tool="redirects">🔀 Redirects</button>
            <button type="button" class="seo-btn seo-btn-secondary tool-tab" data-tool="readability">📖 Readability</button>
            <button type="button" class="seo-btn seo-btn-secondary tool-tab" data-tool="ngrams">📊 N-Grams</button>
            <button type="button" class="seo-btn seo-btn-secondary tool-tab" data-tool="urlcleaner">🧹 URL Cleaner</button>
          </div>

          <div id="seo-tool-body"></div>
        </div>
      </div>
    `;

    const toolBody = container.querySelector('#seo-tool-body');
    const toolTabs = container.querySelectorAll('.tool-tab');

    function renderActiveTool(toolId) {
      toolTabs.forEach(t => {
        if (t.getAttribute('data-tool') === toolId) t.classList.add('active');
        else t.classList.remove('active');
      });

      switch (toolId) {
        case 'serp': renderSerpTool(toolBody); break;
        case 'schema': renderSchemaTool(toolBody); break;
        case 'robots': renderRobotsTool(toolBody); break;
        case 'sitemap': renderSitemapTool(toolBody); break;
        case 'llmstxt': renderLlmsTxtTool(toolBody); break;
        case 'hreflang': renderHreflangTool(toolBody); break;
        case 'redirects': renderRedirectsTool(toolBody); break;
        case 'readability': renderReadabilityTool(toolBody); break;
        case 'ngrams': renderNGramsTool(toolBody); break;
        case 'urlcleaner': renderUrlCleanerTool(toolBody); break;
      }
    }

    toolTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        activeTool = tab.getAttribute('data-tool');
        renderActiveTool(activeTool);
      });
    });

    renderActiveTool(activeTool);
  }
};

/* 1. SERP Previewer */
function renderSerpTool(container) {
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
      <div>
        <div class="seo-form-group">
          <label class="seo-label">Page Title</label>
          <input type="text" id="serp-title" class="seo-input" value="Instaflow CRM - All-in-One Sales & SEO Automation" />
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--seo-muted); margin-top: 0.25rem;">
            <span id="serp-title-chars">53 chars</span>
            <span id="serp-title-px">545px / 600px max</span>
          </div>
        </div>

        <div class="seo-form-group">
          <label class="seo-label">Page URL / Breadcrumb</label>
          <input type="text" id="serp-url" class="seo-input" value="https://instaflow.io/seo-suite" />
        </div>

        <div class="seo-form-group">
          <label class="seo-label">Meta Description</label>
          <textarea id="serp-desc" class="seo-textarea" rows="3">Audit your website, check AI-search readiness (GEO), crawl broken links, and generate branded PDF reports directly in your browser.</textarea>
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--seo-muted); margin-top: 0.25rem;">
            <span id="serp-desc-chars">139 chars</span>
            <span id="serp-desc-px">920px / 960px max</span>
          </div>
        </div>
      </div>

      <div>
        <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.75rem;">Google Desktop SERP Preview</h4>
        <div style="background: #ffffff; border: 1px solid #dfe1e5; border-radius: 8px; padding: 1.25rem; font-family: Arial, sans-serif;">
          <div id="prev-cite" style="font-size: 12px; color: #202124; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 16px; height: 16px; background: #e8f0fe; border-radius: 50%; text-align: center; font-size: 10px;">🌐</span>
            <span id="prev-url-text">https://instaflow.io &rsaquo; seo-suite</span>
          </div>
          <h3 id="prev-title" style="font-size: 20px; font-weight: 400; color: #1a0dab; line-height: 1.3; margin-bottom: 4px; cursor: pointer; text-decoration: none;"></h3>
          <p id="prev-desc" style="font-size: 14px; color: #4d5156; line-height: 1.58;"></p>
        </div>
      </div>
    </div>
  `;

  const titleIn = container.querySelector('#serp-title');
  const urlIn = container.querySelector('#serp-url');
  const descIn = container.querySelector('#serp-desc');
  const prevTitle = container.querySelector('#prev-title');
  const prevDesc = container.querySelector('#prev-desc');
  const prevUrl = container.querySelector('#prev-url-text');
  const titleChars = container.querySelector('#serp-title-chars');
  const titlePx = container.querySelector('#serp-title-px');
  const descChars = container.querySelector('#serp-desc-chars');
  const descPx = container.querySelector('#serp-desc-px');

  function update() {
    const t = titleIn.value;
    const d = descIn.value;
    const u = urlIn.value;

    const tLen = t.length;
    const tWidth = estimatePixelWidth(t, true);
    titleChars.textContent = `${tLen} chars`;
    titlePx.textContent = `${tWidth}px / 600px max`;
    titlePx.style.color = tWidth > 600 ? 'var(--seo-fail)' : 'var(--seo-muted)';

    const dLen = d.length;
    const dWidth = estimatePixelWidth(d, false);
    descChars.textContent = `${dLen} chars`;
    descPx.textContent = `${dWidth}px / 960px max`;

    prevTitle.textContent = t;
    prevDesc.textContent = d;
    prevUrl.textContent = u;
  }

  titleIn.addEventListener('input', update);
  urlIn.addEventListener('input', update);
  descIn.addEventListener('input', update);
  update();
}

/* 2. Schema JSON-LD Builder & Validator */
function renderSchemaTool(container) {
  const types = Object.keys(SUPPORTED_SCHEMAS);
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
      <div>
        <div class="seo-form-group">
          <label class="seo-label">Select Schema Type</label>
          <select id="schema-type-select" class="seo-select">
            ${types.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="seo-form-group">
          <label class="seo-label">JSON-LD Code Editor</label>
          <textarea id="schema-json-code" class="seo-textarea" rows="12" style="font-family: monospace; font-size: 0.8rem;"></textarea>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button type="button" id="schema-btn-validate" class="seo-btn seo-btn-primary">Validate Schema</button>
          <button type="button" id="schema-btn-copy" class="seo-btn seo-btn-secondary">Copy JSON-LD</button>
        </div>
      </div>
      <div>
        <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.75rem;">Validation Report</h4>
        <div id="schema-val-output" style="background: var(--seo-bg); border: 1px solid var(--seo-border); border-radius: 8px; padding: 1rem; font-size: 0.85rem;">
          Select a schema type and click "Validate Schema".
        </div>
      </div>
    </div>
  `;

  const select = container.querySelector('#schema-type-select');
  const code = container.querySelector('#schema-json-code');
  const valBtn = container.querySelector('#schema-btn-validate');
  const copyBtn = container.querySelector('#schema-btn-copy');
  const output = container.querySelector('#schema-val-output');

  function loadTemplate(t) {
    code.value = generateSchema(t, { name: 'My ' + t, url: 'https://example.com' });
  }

  select.addEventListener('change', () => loadTemplate(select.value));
  loadTemplate(select.value);

  valBtn.addEventListener('click', () => {
    try {
      const parsed = JSON.parse(code.value);
      const res = validateSchemaItems([parsed]);
      if (res.valid) {
        output.innerHTML = `<div style="color: var(--seo-pass); font-weight: 700;">✅ Valid Schema.org JSON-LD!</div><p style="margin-top: 0.5rem; color: var(--seo-muted);">All required and core recommended rich snippet fields are satisfied.</p>`;
      } else {
        output.innerHTML = `
          <div style="color: var(--seo-fail); font-weight: 700;">❌ Validation Issues:</div>
          <ul style="margin-top: 0.5rem; padding-left: 1.25rem;">
            ${res.errors.map(e => `<li>${escapeHtml(e.message)}</li>`).join('')}
          </ul>
        `;
      }
    } catch (e) {
      output.innerHTML = `<div style="color: var(--seo-fail); font-weight: 700;">❌ JSON Syntax Error:</div><p style="color: var(--seo-muted); margin-top: 0.5rem;">${escapeHtml(e.message)}</p>`;
    }
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(`<script type="application/ld+json">\n${code.value}\n</script>`);
    showToast('Copied <script> block to clipboard!', 'success');
  });
}

/* 3. Robots.txt Generator & Linter */
function renderRobotsTool(container) {
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
      <div>
        <div class="seo-form-group">
          <label class="seo-label">Robots.txt Content</label>
          <textarea id="robots-editor" class="seo-textarea" rows="10" style="font-family: monospace; font-size: 0.85rem;"></textarea>
        </div>
        <div class="seo-form-group">
          <label class="seo-label">Test URL Path</label>
          <div style="display: flex; gap: 0.5rem;">
            <input type="text" id="robots-test-path" class="seo-input" value="/blog/my-post" />
            <select id="robots-test-agent" class="seo-select" style="max-width: 150px;">
              <option value="*">Googlebot (*)</option>
              <option value="GPTBot">GPTBot</option>
              <option value="ClaudeBot">ClaudeBot</option>
              <option value="PerplexityBot">PerplexityBot</option>
            </select>
            <button type="button" id="robots-btn-test" class="seo-btn seo-btn-primary">Test</button>
          </div>
        </div>
      </div>
      <div>
        <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.75rem;">Lint & Path Permission Result</h4>
        <div id="robots-output" style="background: var(--seo-bg); border: 1px solid var(--seo-border); border-radius: 8px; padding: 1rem; font-size: 0.85rem;">
          Click "Test" to evaluate crawl directives.
        </div>
      </div>
    </div>
  `;

  const editor = container.querySelector('#robots-editor');
  const pathIn = container.querySelector('#robots-test-path');
  const agentIn = container.querySelector('#robots-test-agent');
  const testBtn = container.querySelector('#robots-btn-test');
  const output = container.querySelector('#robots-output');

  editor.value = generateRobotsTxt({ allowAll: true, allowAI: true, sitemapUrl: 'https://example.com/sitemap.xml' });

  testBtn.addEventListener('click', () => {
    const parsed = parseRobotsTxt(editor.value);
    const path = pathIn.value.trim();
    const agent = agentIn.value;
    const allowed = isPathAllowed(parsed, agent, path);

    output.innerHTML = `
      <div style="font-size: 1rem; font-weight: 700; color: ${allowed ? 'var(--seo-pass)' : 'var(--seo-fail)'};">
        ${allowed ? '✅ ALLOWED' : '❌ BLOCKED (Disallowed)'}
      </div>
      <p style="margin-top: 0.5rem; color: var(--seo-muted);">
        User-Agent: <strong>${agent}</strong> | Path: <strong>${path}</strong>
      </p>
      ${parsed.errors.length > 0 ? `
        <div style="margin-top: 0.75rem; color: var(--seo-warn); font-weight: 600;">⚠️ Syntax Warnings:</div>
        <ul style="padding-left: 1.25rem;">
          ${parsed.errors.map(e => `<li>Line ${e.line}: ${escapeHtml(e.message)}</li>`).join('')}
        </ul>
      ` : ''}
    `;
  });
}

/* 4. XML Sitemap Validator */
function renderSitemapTool(container) {
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
      <div>
        <div class="seo-form-group">
          <label class="seo-label">XML Sitemap Code</label>
          <textarea id="sitemap-code" class="seo-textarea" rows="12" style="font-family: monospace; font-size: 0.85rem;"></textarea>
        </div>
        <button type="button" id="sitemap-btn-val" class="seo-btn seo-btn-primary">Validate Sitemap</button>
      </div>
      <div>
        <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 0.75rem;">Sitemap Analysis</h4>
        <div id="sitemap-output" style="background: var(--seo-bg); border: 1px solid var(--seo-border); border-radius: 8px; padding: 1rem; font-size: 0.85rem;">
          Click "Validate Sitemap" to check limits, duplicates, and URL health.
        </div>
      </div>
    </div>
  `;

  const code = container.querySelector('#sitemap-code');
  const btn = container.querySelector('#sitemap-btn-val');
  const output = container.querySelector('#sitemap-output');

  code.value = generateSitemapXml([
    { loc: 'https://example.com/', priority: 1.0 },
    { loc: 'https://example.com/about', priority: 0.8 },
    { loc: 'https://example.com/pricing', priority: 0.9 }
  ]);

  btn.addEventListener('click', () => {
    const res = parseSitemapXml(code.value);
    output.innerHTML = `
      <div style="font-weight: 700; font-size: 1rem;">Found ${res.totalEntries} URL(s) (${(res.byteSize / 1024).toFixed(1)} KB)</div>
      <div style="margin-top: 0.5rem; color: ${res.errors.length === 0 ? 'var(--seo-pass)' : 'var(--seo-fail)'};">
        ${res.errors.length === 0 ? '✅ Valid XML sitemap structure' : '❌ Issues: ' + res.errors.join('; ')}
      </div>
    `;
  });
}

/* 5. LLMs.txt Tool */
function renderLlmsTxtTool(container) {
  container.innerHTML = `
    <div>
      <p style="font-size: 0.85rem; color: var(--seo-muted); margin-bottom: 1rem;">LLMs.txt is the emerging standard for helping LLMs, AI agents, and search engines ingest core documentation in Markdown.</p>
      <div class="seo-form-group">
        <label class="seo-label">LLMs.txt Content (/llms.txt)</label>
        <textarea id="llms-editor" class="seo-textarea" rows="10" style="font-family: monospace; font-size: 0.85rem;"># Instaflow Documentation
> Instaflow is a high-performance CRM with autonomous SEO auditing.

## Core APIs
- [/api/leads]: Lead capture endpoint
- [/seo]: SEO Suite module
</textarea>
      </div>
      <button type="button" id="llms-btn-copy" class="seo-btn seo-btn-primary">Copy LLMs.txt</button>
    </div>
  `;
  container.querySelector('#llms-btn-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(container.querySelector('#llms-editor').value);
    showToast('Copied LLMs.txt!', 'success');
  });
}

/* 6. Hreflang Tool */
function renderHreflangTool(container) {
  container.innerHTML = `
    <div class="seo-form-group">
      <label class="seo-label">Test Hreflang Tag Code (e.g. en-US, es, fr-CA, x-default)</label>
      <div style="display: flex; gap: 0.5rem;">
        <input type="text" id="hreflang-input" class="seo-input" value="en-US" />
        <button type="button" id="hreflang-btn-val" class="seo-btn seo-btn-primary">Validate</button>
      </div>
      <div id="hreflang-output" style="margin-top: 1rem; font-size: 0.85rem;"></div>
    </div>
  `;
  const inp = container.querySelector('#hreflang-input');
  const btn = container.querySelector('#hreflang-btn-val');
  const out = container.querySelector('#hreflang-output');

  btn.addEventListener('click', () => {
    const res = validateHreflangCode(inp.value.trim());
    out.innerHTML = res.valid
      ? `<span style="color: var(--seo-pass); font-weight: 700;">✅ Valid ISO code:</span> Language "${res.lang}" ${res.region ? `| Region: "${res.region}"` : ''}`
      : `<span style="color: var(--seo-fail); font-weight: 700;">❌ Invalid:</span> ${res.reason}`;
  });
}

/* 7. Redirect Rules Tool */
function renderRedirectsTool(container) {
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
      <div>
        <div class="seo-form-group">
          <label class="seo-label">Format</label>
          <select id="redirect-format" class="seo-select">
            <option value="htaccess">Apache (.htaccess)</option>
            <option value="nginx">Nginx (nginx.conf)</option>
            <option value="netlify">Netlify (_redirects)</option>
            <option value="vercel">Vercel (vercel.json)</option>
          </select>
        </div>
        <div class="seo-form-group">
          <label class="seo-label">Old URL Path</label>
          <input type="text" id="redirect-from" class="seo-input" value="/old-blog-post" />
        </div>
        <div class="seo-form-group">
          <label class="seo-label">New Destination URL</label>
          <input type="text" id="redirect-to" class="seo-input" value="/new-article" />
        </div>
        <button type="button" id="redirect-btn-gen" class="seo-btn seo-btn-primary">Generate Config</button>
      </div>
      <div>
        <label class="seo-label">Generated Server Rules</label>
        <textarea id="redirect-output" class="seo-textarea" rows="10" readonly style="font-family: monospace; font-size: 0.85rem;"></textarea>
      </div>
    </div>
  `;
  const fmt = container.querySelector('#redirect-format');
  const from = container.querySelector('#redirect-from');
  const to = container.querySelector('#redirect-to');
  const btn = container.querySelector('#redirect-btn-gen');
  const out = container.querySelector('#redirect-output');

  function generate() {
    out.value = generateRedirectRules([{ from: from.value, to: to.value, status: 301 }], fmt.value);
  }

  btn.addEventListener('click', generate);
  fmt.addEventListener('change', generate);
  generate();
}

/* 8. Readability Tool */
function renderReadabilityTool(container) {
  container.innerHTML = `
    <div>
      <div class="seo-form-group">
        <label class="seo-label">Paste Content for Readability Scoring</label>
        <textarea id="readability-input" class="seo-textarea" rows="6" placeholder="Paste article or page copy here..."></textarea>
      </div>
      <button type="button" id="readability-btn" class="seo-btn seo-btn-primary">Compute Scores</button>
      <div id="readability-output" style="margin-top: 1.5rem;"></div>
    </div>
  `;
  const inp = container.querySelector('#readability-input');
  const btn = container.querySelector('#readability-btn');
  const out = container.querySelector('#readability-output');

  btn.addEventListener('click', () => {
    const res = analyzeText(inp.value);
    out.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
        <div style="background: var(--seo-bg); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--seo-primary);">${res.fleschReadingEase}</div>
          <div style="font-size: 0.75rem; color: var(--seo-muted);">Flesch Ease (${res.easeRating})</div>
        </div>
        <div style="background: var(--seo-bg); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--seo-text);">${res.fleschKincaidGrade}</div>
          <div style="font-size: 0.75rem; color: var(--seo-muted);">Grade Level</div>
        </div>
        <div style="background: var(--seo-bg); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--seo-text);">${res.wordCount}</div>
          <div style="font-size: 0.75rem; color: var(--seo-muted);">Word Count</div>
        </div>
        <div style="background: var(--seo-bg); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 800; color: var(--seo-text);">${res.readingTimeMinutes} min</div>
          <div style="font-size: 0.75rem; color: var(--seo-muted);">Est. Reading Time</div>
        </div>
      </div>
    `;
  });
}

/* 9. N-Grams & Keyword Density */
function renderNGramsTool(container) {
  container.innerHTML = `
    <div>
      <div class="seo-form-group">
        <label class="seo-label">Paste Content to Extract Frequent N-Gram Phrases</label>
        <textarea id="ngrams-input" class="seo-textarea" rows="5"></textarea>
      </div>
      <button type="button" id="ngrams-btn" class="seo-btn seo-btn-primary">Extract Phrases</button>
      <div id="ngrams-output" style="margin-top: 1.5rem;"></div>
    </div>
  `;
  const inp = container.querySelector('#ngrams-input');
  const btn = container.querySelector('#ngrams-btn');
  const out = container.querySelector('#ngrams-output');

  btn.addEventListener('click', () => {
    const bi = extractNGrams(inp.value, 2, 2);
    const tri = extractNGrams(inp.value, 3, 2);
    out.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        <div>
          <h4 style="font-weight: 700; margin-bottom: 0.5rem;">Top 2-Word Phrases</h4>
          <ul style="padding-left: 1.25rem; font-size: 0.85rem;">
            ${bi.length === 0 ? '<li>No repeated phrases found</li>' : bi.slice(0, 10).map(p => `<li><strong>${p.phrase}</strong>: ${p.count}x (${p.density}%)</li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="font-weight: 700; margin-bottom: 0.5rem;">Top 3-Word Phrases</h4>
          <ul style="padding-left: 1.25rem; font-size: 0.85rem;">
            ${tri.length === 0 ? '<li>No repeated phrases found</li>' : tri.slice(0, 10).map(p => `<li><strong>${p.phrase}</strong>: ${p.count}x (${p.density}%)</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  });
}

/* 10. URL Cleaner */
function renderUrlCleanerTool(container) {
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
      <div>
        <div class="seo-form-group">
          <label class="seo-label">Paste Raw URL List (One per line)</label>
          <textarea id="urlclean-input" class="seo-textarea" rows="8"></textarea>
        </div>
        <button type="button" id="urlclean-btn" class="seo-btn seo-btn-primary">Dedupe & Normalize</button>
      </div>
      <div>
        <label class="seo-label">Cleaned URL List</label>
        <textarea id="urlclean-output" class="seo-textarea" rows="8" readonly></textarea>
        <div id="urlclean-stats" style="font-size: 0.8rem; color: var(--seo-muted); margin-top: 0.5rem;"></div>
      </div>
    </div>
  `;
  const inp = container.querySelector('#urlclean-input');
  const btn = container.querySelector('#urlclean-btn');
  const out = container.querySelector('#urlclean-output');
  const stats = container.querySelector('#urlclean-stats');

  btn.addEventListener('click', () => {
    const res = cleanUrlList(inp.value);
    out.value = res.cleanedUrls.join('\n');
    stats.textContent = `Cleaned ${res.validCount} valid URLs (${res.duplicateCount} duplicates removed, ${res.invalidCount} invalid).`;
  });
}
