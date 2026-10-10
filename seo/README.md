# Instaflow SEO Suite

A zero-paid-API, enterprise-grade SEO audit, GEO (AI-search readiness), reporting, crawler, and lead-generation module designed to embed seamlessly into the **Instaflow** CRM at route `/seo`.

---

## 1. Quick Start & Embedding Guide

### Vanilla JavaScript / ES Modules
```javascript
import { mountSeoSuite } from '/seo/index.js';

const container = document.getElementById('seo-root');
const suite = mountSeoSuite(container, {
  proxyUrl: 'https://my-proxy.workers.dev', // Optional: Tier 2 Free Proxy
  theme: 'light',                           // 'light' | 'dark'
  locale: 'en',                            // 'en' | 'es' | 'fr' | 'de'
  defaultFeature: 'dashboard'
});

// To unmount:
// suite.destroy();
```

### React / Next.js Wrapper
```jsx
import React from 'react';
import { SeoSuiteComponent } from './seo/wrappers/react-wrapper.jsx';

export default function SeoModule() {
  return (
    <SeoSuiteComponent
      proxyUrl="https://my-proxy.workers.dev"
      theme="light"
      locale="en"
      defaultFeature="dashboard"
    />
  );
}
```

### Astro CRM Route (`src/pages/seo.astro`)
The suite is mounted at `/seo` inside Instaflow's `LayoutSidebar`.

---

## 2. Operating Tiers

| Tier | Capabilities | Dependencies |
| :--- | :--- | :--- |
| **Tier 1: Browser Offline (Default)** | Paste HTML, drag & drop `.html`, 100+ audit checks, Scorecard rings & radar, top fixes, full SEO toolbox, keyword clustering, backlink CSV importer, branded reports, planning roadmaps. | 100% Client-Side. No network calls. Zero secrets. |
| **Tier 2: Optional Free Proxy** | Live URL audit, robots.txt fetch, sitemap fetch, autonomous site crawler, live link HTTP status verification, PageSpeed Insights. | Free Cloudflare Worker or Vercel Serverless Function (`/seo/worker`). |
| **Tier 3: Honest Substitutes** | Search volume, live keyword rankings, massive web backlink indices. | **Intentionally not fabricated.** Replaced with Google Suggest autocomplete expansions, Search Console performance CSV importers, and manual rank loggers. |

---

## 3. Claude SEO Sub-Skills Mapping Table

| Claude SEO Sub-Skill | Action | Reason |
| :--- | :--- | :--- |
| `seo-audit` | **Ported** | Core 100+ deterministic checks ported to pure JS in `/seo/lib/checks/`. |
| `seo-technical` | **Ported** | Canonical, meta robots, charset, doctype, lang, URL hygiene ported. |
| `seo-geo` | **Ported** | AI crawler rules (GPTBot, ClaudeBot), answer-first formatting, and llms.txt ported. |
| `seo-schema` | **Ported** | JSON-LD extractor and validator for 14+ Schema.org types ported. |
| `seo-sitemap` | **Ported** | XML Sitemap parser, duplicate detection, and generator ported. |
| `seo-hreflang` | **Ported** | ISO-639-1 / ISO-3166-1 validator and x-default checks ported. |
| `seo-sxo` (UX & Usability) | **Ported** | Viewport, touch target hints, and intrusive interstitial signals ported. |
| `seo-performance` | **Partially Ported** | Offline payload and render-blocking checks ported; live CWV runs via PSI / Tier 2. |
| `seo-cluster` | **Ported** | Local n-gram token overlap clustering and rule-based search intent classification ported. |
| `seo-backlinks` | **Partially Ported** | Search Console / CSV backlink importer and domain grouping ported. Live paid index skipped. |
| `seo-plan` & `seo-programmatic` | **Ported** | Roadmap generator, programmatic blueprint designer, and brief generator ported. |
| `seo-dataforseo` | **Skipped** | Requires paid third-party API keys and recurring subscriptions. |
| `seo-flow` (Firecrawl / Puppeteer) | **Skipped** | Headless browser scraping services skipped in favor of lightweight Tier 2 proxy. |
| `seo-google` (GA4 / BigQuery) | **Skipped** | Complex cloud OAuth data warehousing skipped; replaced with direct GSC CSV imports. |

---

## 4. Scorecard: Grade Rings & 5-Axis Radar Pentagram Chart

The results view renders an inline SVG **Scorecard** computed strictly from real audit results:
1. **On-Page SEO** (pink/red)
2. **GEO (AI-Search Readiness)** (purple)
3. **Links Architecture & Hygiene** (green)
4. **Usability & Mobile** (amber)
5. **Performance & Core Web Vitals** (blue)

### Honest Data Handling
- If a category cannot be tested on the current input (e.g. Performance on pasted HTML without PageSpeed data, or live Links without a proxy), it renders as **N/A (gray ring)** and is **excluded** from the overall score calculation.

---

## 5. Deploying the Free Tier 2 Proxy Worker

### Deploying to Cloudflare Workers (Free)
1. Install Wrangler CLI: `npm install -g wrangler`
2. In `seo/worker`, create `wrangler.toml`:
   ```toml
   name = "instaflow-seo-proxy"
   main = "cloudflare-worker.js"
   compatibility_date = "2026-01-01"

   [vars]
   ALLOWED_ORIGIN = "https://your-instaflow-domain.com"
   ```
3. Run `wrangler deploy`.
4. Paste your worker URL (`https://instaflow-seo-proxy.workers.dev`) into **Settings** in the SEO Suite.

### Deploying to Vercel (Free)
1. Copy `seo/worker/vercel-function.js` to `api/seo/proxy.js`.
2. Set environment variable `ALLOWED_ORIGIN = https://your-instaflow-domain.com`.

---

## 6. How to Add a New Check or Language

### Adding a New Audit Check
Open any check file in `seo/lib/checks/` (or create a new one) and register:
```javascript
export const myCustomCheck = {
  id: 'my_custom_check',
  category: 'onpage',
  scorecardGroup: 'onpage',
  title: 'My Custom Rule',
  weight: 3,
  severity: 'high',
  effort: 'low',
  tier: 1,
  test: (doc, ctx) => {
    const hasElement = doc.querySelector('.my-element');
    if (!hasElement) {
      return { status: 'fail', value: 'Missing', details: 'Explanation of why it failed.' };
    }
    return { status: 'pass', value: 'Present', details: 'All good.' };
  },
  fixKey: 'checks.custom.fix',
  explainKey: 'checks.custom.explain'
};
```
No UI changes are required; the check will automatically appear in the audit runner, scorecard, and report builders.

### Adding a New Language
1. Create `seo/lib/i18n/{locale}.json`.
2. Run `node seo/lib/i18n/check-missing.js` to audit missing translation keys against `en.json`.
3. Register the locale in `seo/lib/i18n/loader.js`.

---

## 7. Security & SSRF Protection

- **DOMParser Isolation**: All user-pasted and fetched HTML is parsed as an inert document tree without executing scripts.
- **SSRF Blocklist**: The Tier 2 proxy strictly blocks loopback (`127.0.0.0/8`), private networks (`10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`), AWS/GCP cloud metadata endpoints (`169.254.169.254`), non-standard ports, and limits payload size to 3MB.

---

## 8. Intentionally Not Included

- Paid third-party rank tracking APIs (e.g. Ahrefs, Semrush, DataForSEO)
- Fabricated search volumes or keyword difficulty estimates
- Headless Chromium scrapers (Puppeteer / Playwright)
- Closed-source proprietary telemetry

---

## 9. Attribution & Licenses

- **Claude SEO Skill**: MIT License. Copyright (c) 2025-2026 Agrici Daniel.
- **Instaflow SEO Suite**: MIT License. Copyright (c) 2026 Instaflow Team.
