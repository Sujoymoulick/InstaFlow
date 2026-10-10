/**
 * Instaflow SEO Suite - Keyword Rank Intelligence & URL Normalization Tests
 * Run via: node --test seo/tests/ranks-and-urls.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateKeywordDifficulty,
  estimateCtrForPosition,
  extractTopSiteKeywords,
  evaluateKeywordRankLocally,
  classifyKeywordIntent
} from '../lib/seo/keywords.js';
import { normalizeUrl, extractDomain, cleanUrlList } from '../lib/seo/url.js';

describe('URL Normalization & Multi-Site Handling', () => {
  it('normalizes URLs missing protocols and trailing slashes', () => {
    assert.strictEqual(normalizeUrl('freepdfly.com'), 'https://freepdfly.com/');
    assert.strictEqual(normalizeUrl('http://example.com/tools/'), 'http://example.com/tools/');
    assert.strictEqual(normalizeUrl('  https://instaflow.io/blog  '), 'https://instaflow.io/blog');
  });

  it('extracts clean domain hostnames from various URL shapes', () => {
    assert.strictEqual(extractDomain('https://www.freepdfly.com/merge-pdf'), 'freepdfly.com');
    assert.strictEqual(extractDomain('http://instaflow.sendvirtualgift.com'), 'instaflow.sendvirtualgift.com');
    assert.strictEqual(extractDomain('example.com/path?q=1'), 'example.com');
  });

  it('cleans, dedupes, and normalizes batch lists of submitted URLs', () => {
    const rawInput = `
      freepdfly.com
      https://freepdfly.com/
      http://example.com/
      instaflow.sendvirtualgift.com
    `;
    const result = cleanUrlList(rawInput);
    assert.strictEqual(result.duplicateCount, 1);
    assert.strictEqual(result.validCount, 3);
    assert.ok(result.cleanedUrls.includes('https://freepdfly.com/'));
    assert.ok(result.cleanedUrls.includes('http://example.com/'));
  });
});

describe('Keyword Rank Intelligence & Difficulty Scoring', () => {
  it('computes keyword difficulty KD% accurately', () => {
    const shortCompetitive = calculateKeywordDifficulty('best crm software');
    assert.ok(shortCompetitive.score > 60);

    const longTail = calculateKeywordDifficulty('how to convert pdf to docx on mac free');
    assert.ok(longTail.score <= 40);
  });

  it('estimates search CTR based on SERP position', () => {
    assert.strictEqual(estimateCtrForPosition(1), '31.7%');
    assert.strictEqual(estimateCtrForPosition(2), '15.6%');
    assert.strictEqual(estimateCtrForPosition(3), '9.8%');
    assert.strictEqual(estimateCtrForPosition(10), '2.1%');
  });

  it('automatically extracts top ranking keywords from webpage HTML', () => {
    const text = 'Free PDF converter tool to merge, split, and edit PDF documents online with high security.';
    const keywords = extractTopSiteKeywords(text, {
      title: 'Free PDF Converter & Tools Online',
      h1: 'Best Free PDF Converter',
      url: 'https://freepdfly.com'
    });

    assert.ok(keywords.length > 0);
    assert.ok(keywords.some(k => k.includes('pdf')));
  });

  it('evaluates keyword search rank and on-page alignment score', () => {
    const rankResult = evaluateKeywordRankLocally('free pdf tools', {
      domain: 'freepdfly.com',
      targetUrl: 'https://freepdfly.com',
      title: 'Free PDF Tools Online - Convert & Merge',
      description: 'The best free pdf tools online for everyone',
      h1: 'Free PDF Tools',
      bodyText: 'We provide free pdf tools to convert and merge documents.'
    });

    assert.ok(rankResult.rank !== null);
    assert.ok(rankResult.rank <= 10);
    assert.ok(rankResult.onPageScore >= 70);
    assert.strictEqual(rankResult.intent, 'Commercial');
  });
});
