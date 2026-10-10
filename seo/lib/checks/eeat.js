/**
 * Instaflow SEO Suite - Trust & E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) Checks
 */

import { extractJsonLd } from '../seo/schema.js';

export const eeatChecks = [
  {
    id: 'eeat_author_byline',
    category: 'eeat',
    scorecardGroup: 'onpage',
    title: 'Author Byline & Creator Attribution',
    weight: 3,
    severity: 'high',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const authorMeta = doc.querySelector('meta[name="author"]');
      const authorRel = doc.querySelector('a[rel="author"], [class*="author"], [id*="author"]');
      const { items } = extractJsonLd(doc);
      const schemaHasAuthor = items.some(it => it.author);

      if (!authorMeta && !authorRel && !schemaHasAuthor) {
        return { status: 'warn', value: 'Missing author', details: 'No author byline or author metadata found. Explicit authorship builds E-E-A-T credibility.' };
      }
      return { status: 'pass', value: 'Author attributed', details: 'Author attribution found in HTML markup / schema metadata.' };
    },
    fixKey: 'checks.eeat.author.fix',
    explainKey: 'checks.eeat.author.explain'
  },
  {
    id: 'eeat_policy_links',
    category: 'eeat',
    scorecardGroup: 'onpage',
    title: 'Privacy Policy & Terms of Service Links',
    weight: 3,
    severity: 'high',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const links = doc.querySelectorAll('a[href]');
      let hasPrivacy = false;
      let hasTerms = false;
      for (const a of links) {
        const href = (a.getAttribute('href') || '').toLowerCase();
        const text = (a.textContent || '').toLowerCase();
        if (href.includes('privacy') || text.includes('privacy')) hasPrivacy = true;
        if (href.includes('terms') || text.includes('terms') || text.includes('conditions')) hasTerms = true;
      }
      if (!hasPrivacy || !hasTerms) {
        return {
          status: 'warn',
          value: `${hasPrivacy ? 'Privacy only' : hasTerms ? 'Terms only' : 'Neither'}`,
          details: `Missing links to ${!hasPrivacy ? 'Privacy Policy' : ''} ${!hasTerms ? 'Terms of Service' : ''}. Critical for commercial trust signals.`
        };
      }
      return { status: 'pass', value: 'Privacy & Terms linked', details: 'Privacy Policy and Terms of Service links detected.' };
    },
    fixKey: 'checks.eeat.policies.fix',
    explainKey: 'checks.eeat.policies.explain'
  },
  {
    id: 'eeat_contact_about_links',
    category: 'eeat',
    scorecardGroup: 'onpage',
    title: 'About Us & Contact Page Links',
    weight: 3,
    severity: 'high',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const links = doc.querySelectorAll('a[href]');
      let hasAbout = false;
      let hasContact = false;
      for (const a of links) {
        const href = (a.getAttribute('href') || '').toLowerCase();
        const text = (a.textContent || '').toLowerCase();
        if (href.includes('about') || text.includes('about us') || text.includes('who we are')) hasAbout = true;
        if (href.includes('contact') || text.includes('contact us') || href.startsWith('mailto:')) hasContact = true;
      }
      if (!hasAbout && !hasContact) {
        return { status: 'warn', value: 'Neither linked', details: 'No About Us or Contact links found. Transparent company information is fundamental to E-E-A-T.' };
      }
      return { status: 'pass', value: 'About & Contact linked', details: 'About Us and Contact channels are clearly linked.' };
    },
    fixKey: 'checks.eeat.about_contact.fix',
    explainKey: 'checks.eeat.about_contact.explain'
  },
  {
    id: 'eeat_organization_schema',
    category: 'eeat',
    scorecardGroup: 'onpage',
    title: 'Organization / Publisher Schema',
    weight: 2,
    severity: 'medium',
    effort: 'medium',
    tier: 1,
    test: (doc) => {
      const { items } = extractJsonLd(doc);
      const hasOrg = items.some(it => it['@type'] === 'Organization' || it['@type'] === 'Corporation' || it.publisher);
      if (!hasOrg) {
        return { status: 'warn', value: 'Missing Org Schema', details: 'No Organization or publisher structured data found.' };
      }
      return { status: 'pass', value: 'Organization Schema present', details: 'Organization publisher entity declared in JSON-LD.' };
    },
    fixKey: 'checks.eeat.org_schema.fix',
    explainKey: 'checks.eeat.org_schema.explain'
  }
];
