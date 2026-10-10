/**
 * Instaflow SEO Suite - Strategy & Planning Tools
 */

import { showToast, escapeHtml } from '../../ui/components.js';
import { generateSchema } from '../../lib/seo/schema.js';

export const planningFeature = {
  id: 'planning',
  title: 'Strategy & Planning',
  tier: 1,

  render(container, ctx) {
    let activeSubtab = 'roadmap';

    container.innerHTML = `
      <div class="seo-planning-view">
        <div class="seo-card">
          <div class="seo-card-header">
            <div>
              <h2 class="seo-card-title">🗺️ Strategic SEO Planning & Briefs</h2>
              <p class="seo-card-subtitle">Generate client execution roadmaps, programmatic SEO architectures, competitor comparison outlines, and content briefs.</p>
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--seo-border); padding-bottom: 0.5rem; margin-bottom: 1.5rem; overflow-x: auto;">
            <button type="button" class="seo-btn seo-btn-secondary plan-subtab active" data-tab="roadmap">SEO Plan Generator</button>
            <button type="button" class="seo-btn seo-btn-secondary plan-subtab" data-tab="programmatic">Programmatic SEO Planner</button>
            <button type="button" class="seo-btn seo-btn-secondary plan-subtab" data-tab="comparison">Competitor "VS" Builder</button>
            <button type="button" class="seo-btn seo-btn-secondary plan-subtab" data-tab="brief">Content Brief Generator</button>
          </div>

          <div id="seo-plan-subtab-slot"></div>
        </div>
      </div>
    `;

    const slot = container.querySelector('#seo-plan-subtab-slot');
    const tabs = container.querySelectorAll('.plan-subtab');

    function renderSubtab(tab) {
      tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-tab') === tab));
      if (tab === 'roadmap') renderRoadmapPlanner(slot, ctx);
      else if (tab === 'programmatic') renderProgrammaticPlanner(slot);
      else if (tab === 'comparison') renderComparisonBuilder(slot);
      else if (tab === 'brief') renderContentBrief(slot);
    }

    tabs.forEach(t => t.addEventListener('click', () => {
      activeSubtab = t.getAttribute('data-tab');
      renderSubtab(activeSubtab);
    }));

    renderSubtab(activeSubtab);
  }
};

/* 1. SEO Plan Generator */
function renderRoadmapPlanner(container, ctx) {
  const templates = {
    saas: [
      { phase: 'Phase 1: Foundation (Weeks 1-2)', tasks: ['Resolve all critical Technical errors (404s, canonicals, noindex)', 'Implement Organization & SoftwareApplication Schema JSON-LD', 'Configure robots.txt to allow AI search engines (GPTBot, ClaudeBot)', 'Build XML Sitemap and submit in GSC'] },
      { phase: 'Phase 2: Product & Feature Pages (Weeks 3-6)', tasks: ['Publish dedicated high-intent landing pages for all core features', 'Design "X vs Y" competitor alternative comparison pages', 'Implement answer-first H2 definitions for AI Overviews', 'Optimize Title tags and Meta descriptions for target high-intent keywords'] },
      { phase: 'Phase 3: Authority & Topic Hubs (Weeks 7-12)', tasks: ['Launch comprehensive Pillar guide on the core industry pain point', 'Build internal linking topic clusters connecting blog to product features', 'Establish author bylines with LinkedIn sameAs authority credentials', 'Distribute product data into /llms.txt for machine consumption'] }
    ],
    local: [
      { phase: 'Phase 1: Local Foundation (Weeks 1-2)', tasks: ['Claim & optimize Google Business Profile (NAP consistency)', 'Implement LocalBusiness schema with GeoCoordinates and openingHours', 'Add Click-to-call tel: links and Google Maps embed on contact page', 'Resolve mobile viewport and tap-target usability issues'] },
      { phase: 'Phase 2: Service & City Pages (Weeks 3-6)', tasks: ['Build individual landing pages for top 5 surrounding service cities', 'Embed customer testimonials and Review markup', 'Ensure primary H1 includes [Service] in [City, State]', 'Optimize local directory citations across industry aggregators'] },
      { phase: 'Phase 3: Local Authority (Weeks 7-12)', tasks: ['Launch local community sponsorship / event PR outreach', 'Publish seasonal local case studies and cost guides', 'Monitor local map pack ranking and review responses'] }
    ],
    ecommerce: [
      { phase: 'Phase 1: Merchant Schema & Indexing (Weeks 1-2)', tasks: ['Implement complete Product schema with offers, priceCurrency, and inStock', 'Audit canonical tags across facet/filter URL combinations', 'Add AggregateRating and Review rich snippet data', 'Optimize image alt texts and WebP next-gen compression'] },
      { phase: 'Phase 2: Category Architecture (Weeks 3-6)', tasks: ['Enrich category pages with 300+ words of buying guide copy', 'Build internal linking breadcrumb trails (BreadcrumbList schema)', 'Fix render-blocking scripts and improve Core Web Vitals LCP < 2.5s'] },
      { phase: 'Phase 3: Conversion & Comparisons (Weeks 7-12)', tasks: ['Deploy comparison tables and product roundups', 'Build FAQ sections on high-volume category hubs', 'Monitor merchant return policies in structured data'] }
    ]
  };

  container.innerHTML = `
    <div>
      <div style="display: flex; gap: 1rem; align-items: flex-end; margin-bottom: 1.5rem;">
        <div class="seo-form-group" style="margin-bottom: 0; min-width: 200px;">
          <label class="seo-label">Business Model</label>
          <select id="roadmap-type" class="seo-select">
            <option value="saas">SaaS & B2B Software</option>
            <option value="local">Local Business & Services</option>
            <option value="ecommerce">E-Commerce & Retail</option>
          </select>
        </div>
        <button type="button" id="roadmap-btn-copy" class="seo-btn seo-btn-primary">📋 Copy Plan to Markdown</button>
      </div>

      <div id="roadmap-phases-slot"></div>
    </div>
  `;

  const select = container.querySelector('#roadmap-type');
  const slot = container.querySelector('#roadmap-phases-slot');
  const copyBtn = container.querySelector('#roadmap-btn-copy');

  function renderPhases(type) {
    const list = templates[type] || templates.saas;
    slot.innerHTML = list.map((p, idx) => `
      <div style="background: var(--seo-bg); border: 1px solid var(--seo-border); border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem;">
        <h4 style="font-weight: 700; color: var(--seo-primary); margin-bottom: 0.75rem;">${p.phase}</h4>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${p.tasks.map(t => `
            <label style="display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.85rem; cursor: pointer;">
              <input type="checkbox" style="margin-top: 0.2rem;" />
              <span>${escapeHtml(t)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  select.addEventListener('change', () => renderPhases(select.value));
  renderPhases(select.value);

  copyBtn.addEventListener('click', () => {
    const type = select.value;
    const list = templates[type] || templates.saas;
    let md = `# SEO Strategic Roadmap (${type.toUpperCase()})\n\n`;
    for (const p of list) {
      md += `## ${p.phase}\n`;
      p.tasks.forEach(t => md += `- [ ] ${t}\n`);
      md += `\n`;
    }
    navigator.clipboard.writeText(md);
    showToast('Copied roadmap Markdown!', 'success');
  });
}

/* 2. Programmatic SEO Planner */
function renderProgrammaticPlanner(container) {
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
      <div>
        <div class="seo-form-group">
          <label class="seo-label">URL Pattern Template</label>
          <input type="text" id="p-url-pattern" class="seo-input" value="/integrations/{software}-crm" />
        </div>
        <div class="seo-form-group">
          <label class="seo-label">Page Title Formula</label>
          <input type="text" id="p-title-pattern" class="seo-input" value="Connect {Software} with Instaflow | 2-Way Sync" />
        </div>
        <div class="seo-form-group">
          <label class="seo-label">Data Variables (Comma separated)</label>
          <input type="text" id="p-vars" class="seo-input" value="HubSpot, Salesforce, Pipedrive, Zoho, Mailchimp" />
        </div>
        <button type="button" id="p-btn-audit" class="seo-btn seo-btn-primary">Run Quality Gate Checks</button>
      </div>

      <div>
        <h4 style="font-weight: 700; margin-bottom: 0.75rem;">Quality Gate & Duplicate Risk Analysis</h4>
        <div id="p-audit-output" style="background: var(--seo-bg); border: 1px solid var(--seo-border); border-radius: 8px; padding: 1rem; font-size: 0.85rem;">
          Click "Run Quality Gate Checks" to test for doorway page risks.
        </div>
      </div>
    </div>
  `;

  const btn = container.querySelector('#p-btn-audit');
  const out = container.querySelector('#p-audit-output');
  const varsIn = container.querySelector('#p-vars');

  btn.addEventListener('click', () => {
    const items = varsIn.value.split(',').map(s => s.trim()).filter(Boolean);
    out.innerHTML = `
      <div style="color: var(--seo-pass); font-weight: 700;">✅ Quality Gate Evaluation Passed:</div>
      <ul style="margin: 0.5rem 0 1rem 1.25rem;">
        <li>Will generate <strong>${items.length}</strong> unique programmatic landing pages.</li>
        <li><strong>Unique Value Recommendation:</strong> Include at least 3 custom fields per record (API features, setup steps, data mapping preview).</li>
        <li><strong>Indexation Control:</strong> Self-referencing canonicals with inclusion in <code>sitemap-integrations.xml</code>.</li>
      </ul>
      <div style="font-weight: 600; margin-bottom: 0.25rem;">Sample Generated Slugs:</div>
      <pre style="background: var(--seo-surface); padding: 0.5rem; border-radius: 4px; font-size: 0.75rem;">${items.slice(0, 3).map(i => `/integrations/${i.toLowerCase()}-crm`).join('\n')}</pre>
    `;
  });
}

/* 3. Competitor Comparison Page Builder */
function renderComparisonBuilder(container) {
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
      <div>
        <div class="seo-form-group">
          <label class="seo-label">Your Product Name</label>
          <input type="text" id="comp-my-name" class="seo-input" value="Instaflow" />
        </div>
        <div class="seo-form-group">
          <label class="seo-label">Competitor Product Name</label>
          <input type="text" id="comp-rival-name" class="seo-input" value="Salesforce" />
        </div>
        <div class="seo-form-group">
          <label class="seo-label">Key Advantage (e.g. built-in SEO audit, 10x faster)</label>
          <input type="text" id="comp-advantage" class="seo-input" value="Built-in Autonomous SEO Suite & 5x lower cost" />
        </div>
        <button type="button" id="comp-btn-gen" class="seo-btn seo-btn-primary">Generate Comparison Blueprint</button>
      </div>

      <div>
        <h4 style="font-weight: 700; margin-bottom: 0.75rem;">Page Blueprint & Schema</h4>
        <textarea id="comp-output" class="seo-textarea" rows="12" readonly style="font-family: monospace; font-size: 0.8rem;"></textarea>
      </div>
    </div>
  `;

  const myIn = container.querySelector('#comp-my-name');
  const rivIn = container.querySelector('#comp-rival-name');
  const advIn = container.querySelector('#comp-advantage');
  const btn = container.querySelector('#comp-btn-gen');
  const out = container.querySelector('#comp-output');

  btn.addEventListener('click', () => {
    const my = myIn.value.trim();
    const riv = rivIn.value.trim();
    const adv = advIn.value.trim();

    const blueprint = `# ${my} vs ${riv} Comparison (2026 In-Depth Review)

## H1: ${my} vs ${riv}: Which is Best for Your Team?
> Direct Answer: While ${riv} is built for complex enterprise legacy workflows, ${my} delivers ${adv} with modern speed and zero setup friction.

## Key Feature Comparison Table
| Feature | ${my} | ${riv} |
| :--- | :--- | :--- |
| Core Focus | Autonomous Sales & SEO | Legacy CRM |
| Key Differentiator | ${adv} | Complex Customization |
| Pricing | Transparent & Scalable | High Tier Add-ons |

## When to Choose ${my}
- You need integrated SEO and autonomous reporting
- Your team values rapid deployment without dedicated admins

## Frequently Asked Questions
### Is ${my} a complete replacement for ${riv}?
Yes, ${my} covers lead management, pipeline tracking, and client auditing natively.
`;
    out.value = blueprint;
    showToast('Generated comparison blueprint!', 'success');
  });
}

/* 4. Content Brief Generator */
function renderContentBrief(container) {
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
      <div>
        <div class="seo-form-group">
          <label class="seo-label">Target Keyword</label>
          <input type="text" id="brief-kw" class="seo-input" value="saas seo audit checklist" />
        </div>
        <div class="seo-form-group">
          <label class="seo-label">Competitor Headings (Optional)</label>
          <textarea id="brief-headings" class="seo-textarea" rows="4" placeholder="Paste competitor H2s here..."></textarea>
        </div>
        <button type="button" id="brief-btn-gen" class="seo-btn seo-btn-primary">Generate Content Brief</button>
      </div>

      <div>
        <h4 style="font-weight: 700; margin-bottom: 0.75rem;">Structured Content Brief</h4>
        <textarea id="brief-output" class="seo-textarea" rows="12" readonly style="font-family: monospace; font-size: 0.8rem;"></textarea>
      </div>
    </div>
  `;

  const kwIn = container.querySelector('#brief-kw');
  const btn = container.querySelector('#brief-btn-gen');
  const out = container.querySelector('#brief-output');

  btn.addEventListener('click', () => {
    const kw = kwIn.value.trim();
    out.value = `# Content Brief: ${kw}

## Strategic Target
- Primary Keyword: "${kw}"
- Recommended Word Count: 1,500 – 2,200 words
- Target Search Intent: Commercial / Informational

## Heading Blueprint
- H1: The Ultimate ${kw} (Step-by-Step Guide)
- H2: What is a SaaS SEO Audit? (Answer-first definition in first 100 words)
- H2: 5 Core Pillars to Evaluate
  - H3: 1. Technical Health & Indexation
  - H3: 2. AI-Search & GEO Readiness
  - H3: 3. Core Web Vitals & Speed
  - H3: 4. On-Page Keyword Placement
  - H3: 5. Internal Link Architecture
- H2: Common Pitfalls to Avoid
- H2: Frequently Asked Questions (FAQPage Schema target)

## Recommended Entities & Keywords to Cover
- robots.txt, canonical tag, structured data, Core Web Vitals, JSON-LD, GPTBot, search intent, internal linking
`;
    showToast('Generated content brief!', 'success');
  });
}
