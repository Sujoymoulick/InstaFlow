/**
 * Instaflow SEO Suite - Local SEO & NAP Checks
 */

import { extractJsonLd } from '../seo/schema.js';

export const localChecks = [
  {
    id: 'local_business_schema',
    category: 'local',
    scorecardGroup: 'onpage',
    title: 'LocalBusiness Schema Markup',
    weight: 3,
    severity: 'high',
    effort: 'medium',
    tier: 1,
    test: (doc) => {
      const { items } = extractJsonLd(doc);
      const hasLocal = items.some(it => {
        const t = it['@type'];
        return t === 'LocalBusiness' || (typeof t === 'string' && t.endsWith('Store')) || (typeof t === 'string' && t.endsWith('Restaurant'));
      });
      if (!hasLocal) {
        return { status: 'warn', value: 'Not detected', details: 'No LocalBusiness structured data found. Recommended for companies with a physical location.' };
      }
      return { status: 'pass', value: 'LocalBusiness Schema', details: 'LocalBusiness structured data is present with location properties.' };
    },
    fixKey: 'checks.local.schema.fix',
    explainKey: 'checks.local.schema.explain'
  },
  {
    id: 'local_phone_click_to_call',
    category: 'local',
    scorecardGroup: 'onpage',
    title: 'Click-to-Call Phone Links (tel:)',
    weight: 2,
    severity: 'medium',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const telLinks = doc.querySelectorAll('a[href^="tel:"]');
      if (telLinks.length === 0) {
        return { status: 'warn', value: '0 tel: links', details: 'No click-to-call <a href="tel:..."> links found. Critical for mobile local conversions.' };
      }
      return { status: 'pass', value: `${telLinks.length} tel: link(s)`, details: 'Click-to-call phone links are configured for mobile users.' };
    },
    fixKey: 'checks.local.tel.fix',
    explainKey: 'checks.local.tel.explain'
  },
  {
    id: 'local_maps_embed',
    category: 'local',
    scorecardGroup: 'onpage',
    title: 'Google Maps Location Embed',
    weight: 1,
    severity: 'low',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const mapsIframes = doc.querySelectorAll('iframe[src*="google.com/maps"], iframe[src*="maps.google.com"]');
      if (mapsIframes.length === 0) {
        return { status: 'warn', value: 'No map embed', details: 'No Google Maps iframe embed found on page.' };
      }
      return { status: 'pass', value: 'Map embed present', details: 'Google Maps interactive embed is present.' };
    },
    fixKey: 'checks.local.maps.fix',
    explainKey: 'checks.local.maps.explain'
  }
];
