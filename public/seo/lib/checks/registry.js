/**
 * Instaflow SEO Suite - Master Check Registry & Audit Runner
 */

import { parseHTML } from '../parse/html.js';
import { buildScorecard } from '../score/scorecard.js';
import { onpageChecks } from './onpage.js';
import { technicalChecks } from './technical.js';
import { performanceChecks } from './performance.js';
import { usabilityChecks } from './usability.js';
import { socialChecks } from './social.js';
import { localChecks } from './local.js';
import { eeatChecks } from './eeat.js';
import { geoChecks } from './geo.js';
import { internationalChecks } from './international.js';
import { ecommerceChecks } from './ecommerce.js';
import { linksChecks } from './links.js';

export class CheckRegistry {
  constructor() {
    this.checks = new Map();
    this.registerDefaults();
  }

  register(check) {
    if (!check || !check.id) {
      throw new Error('Check must have a unique "id"');
    }
    this.checks.set(check.id, check);
  }

  registerAll(checksArray) {
    for (const check of checksArray) {
      this.register(check);
    }
  }

  get(id) {
    return this.checks.get(id);
  }

  getAll() {
    return Array.from(this.checks.values());
  }

  getByCategory(category) {
    return this.getAll().filter(c => c.category === category);
  }

  getByGroup(scorecardGroup) {
    return this.getAll().filter(c => c.scorecardGroup === scorecardGroup);
  }

  registerDefaults() {
    this.registerAll(onpageChecks);
    this.registerAll(technicalChecks);
    this.registerAll(performanceChecks);
    this.registerAll(usabilityChecks);
    this.registerAll(socialChecks);
    this.registerAll(localChecks);
    this.registerAll(eeatChecks);
    this.registerAll(geoChecks);
    this.registerAll(internationalChecks);
    this.registerAll(ecommerceChecks);
    this.registerAll(linksChecks);
  }

  /**
   * Evaluates all registered checks against the parsed DOM document and context
   */
  evaluateAll(doc, context = {}) {
    const results = [];
    for (const check of this.getAll()) {
      try {
        const testRes = check.test(doc, context);
        results.push({
          id: check.id,
          category: check.category,
          scorecardGroup: check.scorecardGroup,
          title: check.title,
          weight: check.weight,
          severity: check.severity,
          effort: check.effort || 'medium',
          tier: check.tier || 1,
          status: testRes.status || 'na', // 'pass' | 'warn' | 'fail' | 'na'
          value: testRes.value !== undefined ? testRes.value : null,
          details: testRes.details || '',
          fixKey: check.fixKey || '',
          explainKey: check.explainKey || '',
          source: check.source || 'instaflow'
        });
      } catch (err) {
        console.warn(`Error evaluating check "${check.id}":`, err);
        results.push({
          id: check.id,
          category: check.category,
          scorecardGroup: check.scorecardGroup,
          title: check.title,
          weight: check.weight,
          severity: check.severity,
          effort: check.effort || 'medium',
          tier: check.tier || 1,
          status: 'na',
          value: 'Evaluation Error',
          details: err.message,
          fixKey: check.fixKey || '',
          explainKey: check.explainKey || ''
        });
      }
    }
    return results;
  }
}

// Global default singleton registry
export const defaultRegistry = new CheckRegistry();

/**
 * Pure function: Runs full audit on HTML string or document, builds scorecard & returns full report model
 */
export function runAudit(htmlOrDoc, context = {}, registry = defaultRegistry) {
  let doc = htmlOrDoc;
  let rawHtml = '';

  if (typeof htmlOrDoc === 'string') {
    rawHtml = htmlOrDoc;
    doc = parseHTML(htmlOrDoc, context.customDOMParser);
  } else if (doc && doc.body) {
    rawHtml = doc.body.innerHTML || '';
  }

  const auditContext = {
    ...context,
    rawHtml: rawHtml || context.rawHtml || ''
  };

  const checkResults = registry.evaluateAll(doc, auditContext);
  const scorecard = buildScorecard(checkResults, auditContext.config);

  return {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    url: context.url || '',
    targetKeyword: context.targetKeyword || '',
    competitorUrl: context.competitorUrl || '',
    auditedAt: new Date().toISOString(),
    scorecard,
    checkResults,
    pageAnatomy: {
      title: doc.title || '',
      headings: extractHeadingsOutline(doc)
    }
  };
}

function extractHeadingsOutline(doc) {
  const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
  return Array.from(headings).map(h => ({
    level: parseInt(h.tagName?.substring(1) || '1', 10),
    text: (h.textContent || '').trim()
  }));
}
