/**
 * Instaflow SEO Suite - Pure Scoring Engine & Scorecard Builder
 */

import { getGradeForScore } from './grades.js';

export const SCORECARD_GROUPS = [
  { id: 'onpage', name: 'On-Page SEO', color: '#ec4899', cssVar: '--seo-ring-onpage', defaultWeight: 35 },
  { id: 'geo', name: 'GEO', fullName: 'AI-Search Readiness', color: '#8b5cf6', cssVar: '--seo-ring-geo', defaultWeight: 20 },
  { id: 'links', name: 'Links', fullName: 'Link Architecture & Hygiene', color: '#10b981', cssVar: '--seo-ring-links', defaultWeight: 15 },
  { id: 'usability', name: 'Usability', fullName: 'Mobile & Accessibility', color: '#f59e0b', cssVar: '--seo-ring-usability', defaultWeight: 15 },
  { id: 'performance', name: 'Performance', fullName: 'Speed & Core Web Vitals', color: '#3b82f6', cssVar: '--seo-ring-perf', defaultWeight: 15 }
];

export const SEVERITY_WEIGHTS = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

export const EFFORT_SCORES = {
  low: 1,    // quick fix (e.g. meta tag)
  medium: 2, // moderate fix (e.g. schema or alt texts)
  high: 3    // engineering fix (e.g. server config, responsive rewrite)
};

/**
 * Pure function: Computes scorecard metrics from check results and custom weight settings.
 *
 * @param {Array} checkResults - Array of evaluated check objects { id, category, scorecardGroup, weight, severity, status, value, details, fixKey, explainKey, effort }
 * @param {Object} [config] - Optional configuration overrides (category weights, custom multipliers)
 * @returns {Object} Scorecard model
 */
export function buildScorecard(checkResults = [], config = {}) {
  const generatedAt = new Date().toISOString();
  const groupWeights = config.groupWeights || {
    onpage: 35,
    geo: 20,
    links: 15,
    usability: 15,
    performance: 15
  };

  const groupBuckets = {
    onpage: { passed: 0, warned: 0, failed: 0, na: 0, earnedPoints: 0, maxPoints: 0, totalChecks: 0, results: [] },
    geo: { passed: 0, warned: 0, failed: 0, na: 0, earnedPoints: 0, maxPoints: 0, totalChecks: 0, results: [] },
    links: { passed: 0, warned: 0, failed: 0, na: 0, earnedPoints: 0, maxPoints: 0, totalChecks: 0, results: [] },
    usability: { passed: 0, warned: 0, failed: 0, na: 0, earnedPoints: 0, maxPoints: 0, totalChecks: 0, results: [] },
    performance: { passed: 0, warned: 0, failed: 0, na: 0, earnedPoints: 0, maxPoints: 0, totalChecks: 0, results: [] }
  };

  // Assign each check to its scorecardGroup
  for (const check of checkResults) {
    const group = check.scorecardGroup || mapCategoryToGroup(check.category);
    if (!groupBuckets[group]) {
      groupBuckets[group] = { passed: 0, warned: 0, failed: 0, na: 0, earnedPoints: 0, maxPoints: 0, totalChecks: 0, results: [] };
    }
    const bucket = groupBuckets[group];
    bucket.totalChecks++;
    bucket.results.push(check);

    const checkWeight = typeof check.weight === 'number' ? check.weight : (SEVERITY_WEIGHTS[check.severity] || 2);

    if (check.status === 'pass') {
      bucket.passed++;
      bucket.earnedPoints += checkWeight * 1.0;
      bucket.maxPoints += checkWeight;
    } else if (check.status === 'warn') {
      bucket.warned++;
      bucket.earnedPoints += checkWeight * 0.5; // Partial credit
      bucket.maxPoints += checkWeight;
    } else if (check.status === 'fail') {
      bucket.failed++;
      bucket.earnedPoints += 0;
      bucket.maxPoints += checkWeight;
    } else {
      // 'na' - Excluded from both numerator and denominator
      bucket.na++;
    }
  }

  const categoryScores = [];
  const excludedCategories = [];
  let totalWeightedScore = 0;
  let totalApplicableWeight = 0;

  for (const groupDef of SCORECARD_GROUPS) {
    const bucket = groupBuckets[groupDef.id];
    const checksRun = bucket.passed + bucket.warned + bucket.failed;
    const checksTotal = bucket.totalChecks;

    let score = null;
    let grade = null;
    let status = 'evaluated';
    let note = '';

    if (checksRun === 0) {
      status = 'na';
      grade = 'N/A';
      note = groupDef.id === 'performance' ? 'Add PageSpeed data or URL for live metrics' :
             groupDef.id === 'links' ? 'Connect proxy to evaluate link status' : 'No applicable checks for this input';
      excludedCategories.push(groupDef.id);
    } else {
      score = bucket.maxPoints > 0 ? Math.round((bucket.earnedPoints / bucket.maxPoints) * 100) : 100;
      grade = getGradeForScore(score);
      if (bucket.na > 0) {
        status = 'partial';
        note = `Based on ${checksRun} of ${checksTotal} checks`;
      }

      const assignedWeight = groupWeights[groupDef.id] ?? groupDef.defaultWeight;
      totalWeightedScore += score * assignedWeight;
      totalApplicableWeight += assignedWeight;
    }

    categoryScores.push({
      id: groupDef.id,
      name: groupDef.name,
      fullName: groupDef.fullName || groupDef.name,
      color: groupDef.color,
      cssVar: groupDef.cssVar,
      score,
      grade,
      status,
      note,
      passed: bucket.passed,
      warned: bucket.warned,
      failed: bucket.failed,
      na: bucket.na,
      checksRun,
      checksTotal
    });
  }

  // Calculate overall score from only applicable categories
  let overallScore = null;
  let overallGrade = 'N/A';

  if (totalApplicableWeight > 0) {
    overallScore = Math.round(totalWeightedScore / totalApplicableWeight);
    overallGrade = getGradeForScore(overallScore);
  }

  // Prioritize Top Fixes
  const topFixes = rankTopFixes(checkResults);

  return {
    generatedAt,
    overallScore,
    overallGrade,
    categories: categoryScores,
    excludedCategories,
    topFixes,
    stats: {
      totalChecks: checkResults.length,
      passed: checkResults.filter(c => c.status === 'pass').length,
      warned: checkResults.filter(c => c.status === 'warn').length,
      failed: checkResults.filter(c => c.status === 'fail').length,
      na: checkResults.filter(c => c.status === 'na').length
    }
  };
}

/**
 * Fallback mapping if check doesn't define explicit scorecardGroup
 */
export function mapCategoryToGroup(category) {
  if (!category) return 'onpage';
  const cat = category.toLowerCase();
  if (['geo', 'aeo', 'ai'].includes(cat)) return 'geo';
  if (['links', 'backlinks', 'internal-links'].includes(cat)) return 'links';
  if (['usability', 'mobile', 'accessibility'].includes(cat)) return 'usability';
  if (['performance', 'speed', 'vitals'].includes(cat)) return 'performance';
  return 'onpage';
}

/**
 * Rank failed and warned checks by Impact vs Effort
 */
export function rankTopFixes(checkResults) {
  const issues = checkResults.filter(c => c.status === 'fail' || c.status === 'warn');

  return issues
    .map(c => {
      const impactScore = (c.status === 'fail' ? 2 : 1) * (SEVERITY_WEIGHTS[c.severity] || 2);
      const effortScore = EFFORT_SCORES[c.effort] || 2;
      // High impact + low effort = top priority (score formula: impact / effort)
      const priorityIndex = (impactScore * 2) - effortScore;
      return {
        ...c,
        priorityIndex,
        impactScore,
        effortScore
      };
    })
    .sort((a, b) => b.priorityIndex - a.priorityIndex)
    .slice(0, 10);
}
