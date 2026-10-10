/**
 * Instaflow SEO Suite - Scoring & Scorecard Unit Tests
 * Run via: node --test seo/tests/scoring.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getGradeForScore, GRADE_SCALE } from '../lib/score/grades.js';
import { buildScorecard, rankTopFixes } from '../lib/score/scorecard.js';

describe('Scoring & Grade Scale', () => {
  it('correctly maps scores to letter grades across all boundaries', () => {
    assert.strictEqual(getGradeForScore(100), 'A+');
    assert.strictEqual(getGradeForScore(97), 'A+');
    assert.strictEqual(getGradeForScore(96), 'A');
    assert.strictEqual(getGradeForScore(93), 'A');
    assert.strictEqual(getGradeForScore(92), 'A-');
    assert.strictEqual(getGradeForScore(90), 'A-');
    assert.strictEqual(getGradeForScore(88), 'B+');
    assert.strictEqual(getGradeForScore(84), 'B');
    assert.strictEqual(getGradeForScore(81), 'B-');
    assert.strictEqual(getGradeForScore(78), 'C+');
    assert.strictEqual(getGradeForScore(75), 'C');
    assert.strictEqual(getGradeForScore(71), 'C-');
    assert.strictEqual(getGradeForScore(68), 'D+');
    assert.strictEqual(getGradeForScore(64), 'D');
    assert.strictEqual(getGradeForScore(61), 'D-');
    assert.strictEqual(getGradeForScore(59), 'F');
    assert.strictEqual(getGradeForScore(0), 'F');
    assert.strictEqual(getGradeForScore(null), 'N/A');
  });

  it('builds a scorecard with all passing checks', () => {
    const checks = [
      { id: 'c1', category: 'onpage', scorecardGroup: 'onpage', severity: 'high', weight: 3, status: 'pass' },
      { id: 'c2', category: 'geo', scorecardGroup: 'geo', severity: 'critical', weight: 4, status: 'pass' },
      { id: 'c3', category: 'links', scorecardGroup: 'links', severity: 'medium', weight: 2, status: 'pass' },
      { id: 'c4', category: 'usability', scorecardGroup: 'usability', severity: 'high', weight: 3, status: 'pass' },
      { id: 'c5', category: 'performance', scorecardGroup: 'performance', severity: 'high', weight: 3, status: 'pass' }
    ];

    const scorecard = buildScorecard(checks);
    assert.strictEqual(scorecard.overallScore, 100);
    assert.strictEqual(scorecard.overallGrade, 'A+');
    assert.strictEqual(scorecard.excludedCategories.length, 0);
    assert.strictEqual(scorecard.stats.passed, 5);
  });

  it('honestly excludes categories with zero applicable checks', () => {
    // Only onpage checks provided, performance and links have 0 applicable checks
    const checks = [
      { id: 'c1', category: 'onpage', scorecardGroup: 'onpage', severity: 'high', weight: 3, status: 'pass' },
      { id: 'c2', category: 'onpage', scorecardGroup: 'onpage', severity: 'high', weight: 3, status: 'warn' },
      { id: 'c3', category: 'geo', scorecardGroup: 'geo', severity: 'high', weight: 3, status: 'pass' }
    ];

    const scorecard = buildScorecard(checks);
    assert.ok(scorecard.excludedCategories.includes('performance'));
    assert.ok(scorecard.excludedCategories.includes('links'));
    assert.ok(scorecard.excludedCategories.includes('usability'));

    const perfCat = scorecard.categories.find(c => c.id === 'performance');
    assert.strictEqual(perfCat.score, null);
    assert.strictEqual(perfCat.grade, 'N/A');
    assert.strictEqual(perfCat.status, 'na');
  });

  it('correctly ranks top fixes by impact vs effort', () => {
    const checks = [
      { id: 'c1', title: 'Low priority warning', severity: 'low', effort: 'high', status: 'warn' },
      { id: 'c2', title: 'Critical quick fix', severity: 'critical', effort: 'low', status: 'fail' },
      { id: 'c3', title: 'High impact medium effort', severity: 'high', effort: 'medium', status: 'fail' }
    ];

    const ranked = rankTopFixes(checks);
    assert.strictEqual(ranked[0].id, 'c2'); // Critical + low effort must be #1 priority
  });
});
