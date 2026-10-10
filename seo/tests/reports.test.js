/**
 * Instaflow SEO Suite - Report Builder Unit Tests
 * Run via: node --test seo/tests/reports.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { runAudit } from '../lib/checks/registry.js';
import { buildMarkdownReport, buildCsvReport, buildJsonReport, buildStandaloneHtmlReport } from '../lib/report/builders.js';

describe('Report Builders', () => {
  const fixtureHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Test Report Page</title>
      <meta name="description" content="This is a test description for auditing." />
    </head>
    <body>
      <h1>Main Headline</h1>
      <p>Body content for testing report exports.</p>
    </body>
    </html>
  `;

  const auditReport = runAudit(fixtureHtml, { url: 'https://test.com' });

  it('generates valid Markdown report', () => {
    const md = buildMarkdownReport(auditReport, { brandName: 'Test Agency' });
    assert.ok(md.includes('# SEO & AI-Search Readiness Audit Report'));
    assert.ok(md.includes('Overall Health Score'));
    assert.ok(md.includes('Test Agency'));
  });

  it('generates valid CSV report with header row', () => {
    const csv = buildCsvReport(auditReport);
    assert.ok(csv.startsWith('"Check ID","Category"'));
    assert.ok(csv.includes('"onpage_title_present"'));
  });

  it('generates valid JSON export', () => {
    const json = buildJsonReport(auditReport);
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.url, 'https://test.com');
    assert.ok(parsed.scorecard);
  });

  it('generates standalone branded HTML report with inline SVG scorecard', () => {
    const html = buildStandaloneHtmlReport(auditReport, { brandName: 'Instaflow White-Label' });
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('Instaflow White-Label'));
    assert.ok(html.includes('svg'));
    assert.ok(html.includes('window.print()'));
  });
});
