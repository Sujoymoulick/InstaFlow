/**
 * Instaflow SEO Suite - Social Graph & Twitter Card Checks
 */

export const socialChecks = [
  {
    id: 'social_og_title',
    category: 'social',
    scorecardGroup: 'onpage',
    title: 'Open Graph Title (og:title)',
    weight: 2,
    severity: 'medium',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const tag = doc.querySelector('meta[property="og:title"]');
      const val = tag ? (tag.getAttribute('content') || '').trim() : '';
      if (!val) return { status: 'warn', value: 'Missing', details: 'Missing <meta property="og:title"> tag for social link previews.' };
      return { status: 'pass', value: `"${val.slice(0, 35)}..."`, details: 'Open Graph title tag is present.' };
    },
    fixKey: 'checks.social.og_title.fix',
    explainKey: 'checks.social.og_title.explain'
  },
  {
    id: 'social_og_image',
    category: 'social',
    scorecardGroup: 'onpage',
    title: 'Open Graph Image (og:image)',
    weight: 3,
    severity: 'high',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const tag = doc.querySelector('meta[property="og:image"]');
      const val = tag ? (tag.getAttribute('content') || '').trim() : '';
      if (!val) return { status: 'warn', value: 'Missing', details: 'Missing <meta property="og:image">. Social shares will lack rich visual cards.' };
      return { status: 'pass', value: val.slice(0, 40), details: 'Open Graph share image is configured.' };
    },
    fixKey: 'checks.social.og_image.fix',
    explainKey: 'checks.social.og_image.explain'
  },
  {
    id: 'social_og_description',
    category: 'social',
    scorecardGroup: 'onpage',
    title: 'Open Graph Description (og:description)',
    weight: 2,
    severity: 'medium',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const tag = doc.querySelector('meta[property="og:description"]');
      const val = tag ? (tag.getAttribute('content') || '').trim() : '';
      if (!val) return { status: 'warn', value: 'Missing', details: 'Missing <meta property="og:description"> tag.' };
      return { status: 'pass', value: `"${val.slice(0, 35)}..."`, details: 'Open Graph description is configured.' };
    },
    fixKey: 'checks.social.og_desc.fix',
    explainKey: 'checks.social.og_desc.explain'
  },
  {
    id: 'social_twitter_card',
    category: 'social',
    scorecardGroup: 'onpage',
    title: 'Twitter Card Meta (twitter:card)',
    weight: 2,
    severity: 'medium',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const tag = doc.querySelector('meta[name="twitter:card"]');
      const val = tag ? (tag.getAttribute('content') || '').trim() : '';
      if (!val) return { status: 'warn', value: 'Missing', details: 'Missing <meta name="twitter:card" content="summary_large_image">.' };
      return { status: 'pass', value: val, details: `Twitter Card type defined: ${val}` };
    },
    fixKey: 'checks.social.twitter_card.fix',
    explainKey: 'checks.social.twitter_card.explain'
  }
];
