/**
 * Instaflow SEO Suite - International SEO & Hreflang Checks
 */

import { validatePageHreflangs } from '../seo/hreflang.js';

export const internationalChecks = [
  {
    id: 'intl_hreflang_validity',
    category: 'international',
    scorecardGroup: 'onpage',
    title: 'Hreflang Tags & Regional Code Correctness',
    weight: 3,
    severity: 'high',
    effort: 'medium',
    tier: 1,
    test: (doc, ctx) => {
      const links = doc.querySelectorAll('link[rel="alternate"][hreflang]');
      if (links.length === 0) {
        return { status: 'pass', value: 'None (Single-language page)', details: 'No hreflang tags found (applicable only for multilingual websites).' };
      }
      const rawTags = [];
      for (const l of links) {
        rawTags.push({
          hreflang: l.getAttribute('hreflang') || '',
          href: l.getAttribute('href') || ''
        });
      }
      const val = validatePageHreflangs(rawTags, ctx.url || '');
      if (!val.valid) {
        return { status: 'fail', value: `${val.issues.length} issue(s)`, details: val.issues.join('; ') };
      }
      return { status: 'pass', value: `${val.tagsCount} valid tag(s)`, details: `Hreflang codes and self-references are valid (${val.validCodes.map(c => c.code).join(', ')}).` };
    },
    fixKey: 'checks.intl.hreflang.fix',
    explainKey: 'checks.intl.hreflang.explain'
  },
  {
    id: 'intl_x_default_fallback',
    category: 'international',
    scorecardGroup: 'onpage',
    title: 'Hreflang x-default Fallback Tag',
    weight: 2,
    severity: 'medium',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const links = doc.querySelectorAll('link[rel="alternate"][hreflang]');
      if (links.length === 0) return { status: 'na', value: 'N/A', details: 'No hreflang tags present.' };
      const hasXDefault = [...links].some(l => (l.getAttribute('hreflang') || '').toLowerCase() === 'x-default');
      if (!hasXDefault) {
        return { status: 'warn', value: 'Missing x-default', details: 'Multilingual configuration lacks a fallback <link rel="alternate" hreflang="x-default"> tag.' };
      }
      return { status: 'pass', value: 'x-default present', details: 'Hreflang x-default fallback is configured.' };
    },
    fixKey: 'checks.intl.x_default.fix',
    explainKey: 'checks.intl.x_default.explain'
  }
];
