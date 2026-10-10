/**
 * Instaflow SEO Suite - Link Architecture & Hygiene Checks
 */

export const linksChecks = [
  {
    id: 'links_internal_count',
    category: 'links',
    scorecardGroup: 'links',
    title: 'Internal Linking Architecture',
    weight: 3,
    severity: 'high',
    effort: 'medium',
    tier: 1,
    test: (doc, ctx) => {
      const links = doc.querySelectorAll('a[href]');
      if (links.length === 0) {
        return { status: 'fail', value: '0 links', details: 'Page contains zero links. Proper internal linking distributes link equity (PageRank).' };
      }
      let internal = 0;
      let external = 0;
      const host = ctx.url ? new URL(ctx.url).hostname : '';

      for (const a of links) {
        const href = a.getAttribute('href') || '';
        if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
        if (href.startsWith('/') || (host && href.includes(host))) {
          internal++;
        } else {
          external++;
        }
      }

      if (internal < 3) {
        return { status: 'warn', value: `${internal} internal link(s)`, details: 'Page has very few internal links (<3). Add relevant contextual links to related content.' };
      }
      return { status: 'pass', value: `${internal} internal, ${external} external`, details: `Healthy internal linking structure (${internal} internal links).` };
    },
    fixKey: 'checks.links.internal_count.fix',
    explainKey: 'checks.links.internal_count.explain'
  },
  {
    id: 'links_outbound_hygiene',
    category: 'links',
    scorecardGroup: 'links',
    title: 'Outbound Link Hygiene & rel="noopener"',
    weight: 2,
    severity: 'medium',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const blankLinks = doc.querySelectorAll('a[target="_blank"]');
      let missingNoopener = 0;
      for (const a of blankLinks) {
        const rel = (a.getAttribute('rel') || '').toLowerCase();
        if (!rel.includes('noopener') && !rel.includes('noreferrer')) {
          missingNoopener++;
        }
      }
      if (missingNoopener > 0) {
        return { status: 'warn', value: `${missingNoopener} missing rel`, details: `Found ${missingNoopener} target="_blank" links without rel="noopener" or rel="noreferrer" (security/performance risk).` };
      }
      return { status: 'pass', value: 'All safe', details: 'All external target="_blank" links specify secure rel attributes.' };
    },
    fixKey: 'checks.links.outbound_hygiene.fix',
    explainKey: 'checks.links.outbound_hygiene.explain'
  },
  {
    id: 'links_broken_status',
    category: 'links',
    scorecardGroup: 'links',
    title: 'Broken Links (404 / 500 status)',
    weight: 4,
    severity: 'critical',
    effort: 'high',
    tier: 2,
    test: (doc, ctx) => {
      if (!ctx.crawlLinkResults && !ctx.brokenLinks) {
        return { status: 'na', value: 'Requires Proxy', details: 'Run crawl or connect Tier 2 proxy to verify live HTTP status codes of links.' };
      }
      const broken = ctx.brokenLinks || (ctx.crawlLinkResults ? ctx.crawlLinkResults.filter(l => l.status >= 400) : []);
      if (broken.length > 0) {
        return { status: 'fail', value: `${broken.length} broken link(s)`, details: `Detected ${broken.length} broken link(s) returning 4xx/5xx status.` };
      }
      return { status: 'pass', value: '0 broken links', details: 'All verified links returned successful 200 HTTP status.' };
    },
    fixKey: 'checks.links.broken.fix',
    explainKey: 'checks.links.broken.explain'
  }
];
