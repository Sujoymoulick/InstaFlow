/**
 * Instaflow SEO Suite - Check Family Unit Tests
 * Run via: node --test seo/tests/checks.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { runAudit, defaultRegistry } from '../lib/checks/registry.js';
import { parseHTML } from '../lib/parse/html.js';

describe('Audit Check Registry & Evaluation', () => {
  it('passes on-page and technical checks for a high-quality HTML document', () => {
    const goodHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Instaflow CRM - High Performance Sales Automation Software</title>
        <meta name="description" content="Discover Instaflow CRM for sales pipelines, client tracking, and autonomous SEO audits. Start streamlining your workflow today." />
        <link rel="canonical" href="https://example.com/crm" />
        <link rel="icon" href="/favicon.ico" />
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Instaflow",
            "offers": { "@type": "Offer", "price": "49", "priceCurrency": "USD" },
            "operatingSystem": "Web",
            "applicationCategory": "BusinessApplication"
          }
        </script>
      </head>
      <body>
        <h1>Instaflow CRM - Sales & SEO Intelligence</h1>
        <h2>Overview & Core Features</h2>
        <p>Instaflow CRM is designed to unify lead tracking and client SEO auditing in one interface. With over 600 words of substantive content depth, it empowers modern agencies.</p>
        <img src="/logo.webp" alt="Instaflow CRM Logo" width="200" height="50" />
        <a href="/pricing">View Pricing Plans</a>
        <a href="/about">About Us</a>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
      </body>
      </html>
    `;

    const result = runAudit(goodHtml, { url: 'https://example.com/crm', targetKeyword: 'Instaflow CRM' });

    assert.ok(result.scorecard.overallScore >= 80, `Expected score >= 80, got ${result.scorecard.overallScore}`);
    
    // Check specific critical evaluations
    const titleCheck = result.checkResults.find(c => c.id === 'onpage_title_present');
    assert.strictEqual(titleCheck.status, 'pass');

    const canonicalCheck = result.checkResults.find(c => c.id === 'tech_canonical_present');
    assert.strictEqual(canonicalCheck.status, 'pass');

    const h1Check = result.checkResults.find(c => c.id === 'onpage_h1_count');
    assert.strictEqual(h1Check.status, 'pass');

    const charsetCheck = result.checkResults.find(c => c.id === 'tech_charset_utf8');
    assert.strictEqual(charsetCheck.status, 'pass');
  });

  it('detects missing critical elements on poor HTML', () => {
    const poorHtml = `
      <html>
      <head></head>
      <body>
        <p>Short page without title, H1 or canonical.</p>
        <img src="/unnamed.jpg" />
        <a href="http://insecure.com" target="_blank">click here</a>
      </body>
      </html>
    `;

    const result = runAudit(poorHtml, { url: 'http://example.com' });

    const titleCheck = result.checkResults.find(c => c.id === 'onpage_title_present');
    assert.strictEqual(titleCheck.status, 'fail');

    const h1Check = result.checkResults.find(c => c.id === 'onpage_h1_count');
    assert.strictEqual(h1Check.status, 'fail');

    const canonicalCheck = result.checkResults.find(c => c.id === 'tech_canonical_present');
    assert.strictEqual(canonicalCheck.status, 'fail');

    const genericAnchor = result.checkResults.find(c => c.id === 'onpage_anchor_text_quality');
    assert.strictEqual(genericAnchor.status, 'warn');
  });

  it('evaluates GEO AI-search readiness checks', () => {
    const robotsContent = `
      User-agent: *
      Allow: /
      
      User-agent: GPTBot
      Allow: /
      
      User-agent: ClaudeBot
      Allow: /
      
      User-agent: PerplexityBot
      Allow: /
    `;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head><title>AI Optimized Topic Guide</title></head>
      <body>
        <h1>What is Autonomous SEO?</h1>
        <p>Autonomous SEO refers to the algorithmic auditing and optimization of web entities without human intervention.</p>
        <h2>Frequently Asked Questions</h2>
        <table><tr><td>Feature</td><td>Support</td></tr></table>
      </body>
      </html>
    `;

    const result = runAudit(html, { robotsTxt: robotsContent, url: 'https://example.com/guide' });
    const aiCrawlerCheck = result.checkResults.find(c => c.id === 'geo_ai_crawlers_allowed');
    assert.strictEqual(aiCrawlerCheck.status, 'pass');

    const answerFirstCheck = result.checkResults.find(c => c.id === 'geo_answer_first_format');
    assert.strictEqual(answerFirstCheck.status, 'pass');
  });
});
