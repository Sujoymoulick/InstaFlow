/**
 * Instaflow SEO Suite - SEO Validators (Robots, Sitemap, Hreflang, Schema) Tests
 * Run via: node --test seo/tests/validators.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseRobotsTxt, isPathAllowed, analyzeAICrawlers, generateRobotsTxt } from '../lib/seo/robots.js';
import { parseSitemapXml, generateSitemapXml } from '../lib/seo/sitemap.js';
import { validateHreflangCode, validatePageHreflangs } from '../lib/seo/hreflang.js';
import { validateSchemaItems, generateSchema } from '../lib/seo/schema.js';

describe('Robots.txt Engine', () => {
  it('correctly parses user-agents and respects longest match allow/disallow rules', () => {
    const robots = `
      User-agent: Googlebot
      Disallow: /admin/
      Allow: /admin/public/

      User-agent: GPTBot
      Disallow: /
    `;

    const parsed = parseRobotsTxt(robots);
    assert.strictEqual(isPathAllowed(parsed, 'Googlebot', '/admin/public/page'), true);
    assert.strictEqual(isPathAllowed(parsed, 'Googlebot', '/admin/secret'), false);
    assert.strictEqual(isPathAllowed(parsed, 'GPTBot', '/blog'), false);
  });

  it('analyzes AI crawlers status', () => {
    const robots = generateRobotsTxt({ allowAll: true, allowAI: true });
    const aiAnalysis = analyzeAICrawlers(robots);
    const gptBot = aiAnalysis.find(b => b.name === 'GPTBot');
    assert.strictEqual(gptBot.status, 'allowed');
  });
});

describe('XML Sitemap Parser & Generator', () => {
  it('parses valid urlset XML and detects duplicates', () => {
    const xml = generateSitemapXml([
      { loc: 'https://example.com/', priority: 1.0 },
      { loc: 'https://example.com/about', priority: 0.8 },
      { loc: 'https://example.com/', priority: 0.5 } // Duplicate
    ]);

    const result = parseSitemapXml(xml);
    assert.strictEqual(result.totalEntries, 3);
    assert.strictEqual(result.duplicates.length, 1);
    assert.strictEqual(result.duplicates[0], 'https://example.com/');
  });
});

describe('Hreflang Validator', () => {
  it('validates ISO 639-1 language and ISO 3166-1 country codes', () => {
    assert.strictEqual(validateHreflangCode('en-US').valid, true);
    assert.strictEqual(validateHreflangCode('es-ES').valid, true);
    assert.strictEqual(validateHreflangCode('x-default').valid, true);
    assert.strictEqual(validateHreflangCode('invalid-XX').valid, false);
  });

  it('validates page-level hreflang reciprocal and x-default requirements', () => {
    const tags = [
      { hreflang: 'en', href: 'https://example.com/en' },
      { hreflang: 'es', href: 'https://example.com/es' },
      { hreflang: 'x-default', href: 'https://example.com/' }
    ];
    const res = validatePageHreflangs(tags, 'https://example.com/en');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.hasSelfReference, true);
    assert.strictEqual(res.hasXDefault, true);
  });
});

describe('Schema JSON-LD Validator', () => {
  it('validates rich snippet schema structures', () => {
    const validProduct = {
      '@type': 'Product',
      name: 'Wireless Keyboard',
      offers: { '@type': 'Offer', price: '29.99', priceCurrency: 'USD' }
    };

    const res = validateSchemaItems([validProduct]);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.errors.length, 0);

    const invalidProduct = {
      '@type': 'Product'
      // missing name and offers
    };
    const badRes = validateSchemaItems([invalidProduct]);
    assert.strictEqual(badRes.valid, false);
    assert.ok(badRes.errors.length > 0);
  });
});
