/**
 * Instaflow SEO Suite - Readability & Keyword Analytics Tests
 * Run via: node --test seo/tests/readability.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { analyzeText, countSyllables } from '../lib/seo/readability.js';
import { extractNGrams, classifyKeywordIntent, clusterKeywords } from '../lib/seo/keywords.js';

describe('Readability & Syllable Analysis', () => {
  it('counts syllables correctly', () => {
    assert.strictEqual(countSyllables('the'), 1);
    assert.strictEqual(countSyllables('software'), 2);
    assert.strictEqual(countSyllables('automation'), 4);
  });

  it('computes Flesch Reading Ease and text metrics', () => {
    const text = 'This is a simple sentence. Easy words make reading fast and enjoyable for everyone.';
    const stats = analyzeText(text);

    assert.ok(stats.wordCount > 10);
    assert.strictEqual(stats.sentenceCount, 2);
    assert.ok(stats.fleschReadingEase >= 60, `Expected ease >= 60, got ${stats.fleschReadingEase}`);
  });
});

describe('Keyword Clustering & Intent Classification', () => {
  it('classifies transactional, commercial, and informational intents', () => {
    assert.strictEqual(classifyKeywordIntent('buy crm subscription').intent, 'Transactional');
    assert.strictEqual(classifyKeywordIntent('best sales automation software').intent, 'Commercial');
    assert.strictEqual(classifyKeywordIntent('what is seo auditing').intent, 'Informational');
    assert.strictEqual(classifyKeywordIntent('instaflow login portal').intent, 'Navigational');
  });

  it('clusters related keywords into topic groups', () => {
    const keywords = [
      'best crm software',
      'crm software pricing',
      'cheap crm software',
      'email marketing tool',
      'email marketing templates'
    ];
    const clusters = clusterKeywords(keywords);
    assert.ok(clusters.length >= 2);
  });

  it('extracts n-gram phrases', () => {
    const text = 'high performance cloud crm with high performance sales intelligence and high performance auditing.';
    const bigrams = extractNGrams(text, 2, 2);
    assert.ok(bigrams.some(b => b.phrase === 'high performance'));
  });
});
