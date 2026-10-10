/**
 * Instaflow SEO Suite - On-Page Checks
 */

import { estimatePixelWidth } from '../seo/url.js';
import { analyzeText } from '../seo/readability.js';
import { extractNGrams, analyzeKeywordPlacement } from '../seo/keywords.js';
import { extractPageAnatomy } from '../parse/html.js';

export const onpageChecks = [
  {
    id: 'onpage_title_present',
    category: 'onpage',
    scorecardGroup: 'onpage',
    title: 'Title Tag Present',
    weight: 4,
    severity: 'critical',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const title = (doc.title || '').trim();
      if (!title) {
        return { status: 'fail', value: 'Missing', details: 'No <title> tag found in document <head>.' };
      }
      return { status: 'pass', value: `"${title.slice(0, 45)}${title.length > 45 ? '...' : ''}"`, details: `Title tag is present (${title.length} characters).` };
    },
    fixKey: 'checks.onpage.title_tag_present.fix',
    explainKey: 'checks.onpage.title_tag_present.explain'
  },
  {
    id: 'onpage_title_length',
    category: 'onpage',
    scorecardGroup: 'onpage',
    title: 'Title Tag Length (50–60 chars, <600px)',
    weight: 3,
    severity: 'high',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const title = (doc.title || '').trim();
      if (!title) return { status: 'fail', value: '0 chars', details: 'Title is missing.' };
      const len = title.length;
      const px = estimatePixelWidth(title, true);

      if (len < 30) {
        return { status: 'warn', value: `${len} chars (${px}px)`, details: 'Title is too short (<30 chars) and may not fully describe page intent.' };
      }
      if (len > 65 || px > 600) {
        return { status: 'warn', value: `${len} chars (${px}px)`, details: `Title exceeds recommended 60 chars / 600px width and will truncate in Google SERPs.` };
      }
      return { status: 'pass', value: `${len} chars (${px}px)`, details: 'Title length is in the optimal range (50-60 characters, <600px).' };
    },
    fixKey: 'checks.onpage.title_length.fix',
    explainKey: 'checks.onpage.title_length.explain'
  },
  {
    id: 'onpage_meta_desc_present',
    category: 'onpage',
    scorecardGroup: 'onpage',
    title: 'Meta Description Tag Present',
    weight: 3,
    severity: 'high',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const descEl = doc.querySelector('meta[name="description"]');
      const desc = descEl ? (descEl.getAttribute('content') || '').trim() : '';
      if (!desc) {
        return { status: 'fail', value: 'Missing', details: 'No meta description tag found in <head>.' };
      }
      return { status: 'pass', value: `"${desc.slice(0, 45)}..."`, details: `Meta description is present (${desc.length} chars).` };
    },
    fixKey: 'checks.onpage.meta_description_present.fix',
    explainKey: 'checks.onpage.meta_description_present.explain'
  },
  {
    id: 'onpage_meta_desc_length',
    category: 'onpage',
    scorecardGroup: 'onpage',
    title: 'Meta Description Length (120–160 chars)',
    weight: 2,
    severity: 'medium',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const descEl = doc.querySelector('meta[name="description"]');
      const desc = descEl ? (descEl.getAttribute('content') || '').trim() : '';
      if (!desc) return { status: 'fail', value: '0 chars', details: 'Description missing.' };
      const len = desc.length;
      const px = estimatePixelWidth(desc, false);

      if (len < 70) {
        return { status: 'warn', value: `${len} chars`, details: 'Meta description is too short (<70 chars) to provide an engaging SERP summary.' };
      }
      if (len > 165 || px > 960) {
        return { status: 'warn', value: `${len} chars (${px}px)`, details: 'Meta description exceeds 160 characters and may be truncated on mobile/desktop.' };
      }
      return { status: 'pass', value: `${len} chars (${px}px)`, details: 'Meta description length is optimal (120-160 characters).' };
    },
    fixKey: 'checks.onpage.meta_description_length.fix',
    explainKey: 'checks.onpage.meta_description_length.explain'
  },
  {
    id: 'onpage_h1_count',
    category: 'onpage',
    scorecardGroup: 'onpage',
    title: 'Single H1 Heading',
    weight: 4,
    severity: 'critical',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const h1s = doc.querySelectorAll('h1');
      if (h1s.length === 0) {
        return { status: 'fail', value: '0 found', details: 'No H1 heading found on page. A primary H1 is required.' };
      }
      if (h1s.length > 1) {
        return { status: 'warn', value: `${h1s.length} found`, details: `Found ${h1s.length} H1 headings. Best practice is exactly one H1 per page.` };
      }
      const text = (h1s[0].textContent || '').trim();
      return { status: 'pass', value: `1 H1: "${text.slice(0, 40)}"`, details: 'Page has exactly one clear H1 heading.' };
    },
    fixKey: 'checks.onpage.h1_count.fix',
    explainKey: 'checks.onpage.h1_count.explain'
  },
  {
    id: 'onpage_heading_hierarchy',
    category: 'onpage',
    scorecardGroup: 'onpage',
    title: 'Logical Heading Order & Hierarchy',
    weight: 2,
    severity: 'medium',
    effort: 'medium',
    tier: 1,
    test: (doc) => {
      const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
      if (headings.length === 0) {
        return { status: 'warn', value: 'No headings', details: 'Page contains no heading tags.' };
      }
      const skippedLevels = [];
      let prevLevel = 0;
      for (const h of headings) {
        const level = parseInt(h.tagName?.substring(1) || '1', 10);
        if (prevLevel > 0 && level > prevLevel + 1) {
          skippedLevels.push(`H${prevLevel} to H${level}`);
        }
        prevLevel = level;
      }
      if (skippedLevels.length > 0) {
        return { status: 'warn', value: `${skippedLevels.length} skipped`, details: `Skipped heading levels detected: ${skippedLevels.join(', ')}.` };
      }
      return { status: 'pass', value: `${headings.length} headings`, details: 'Heading levels follow a clean, sequential hierarchy without skipped levels.' };
    },
    fixKey: 'checks.onpage.heading_hierarchy.fix',
    explainKey: 'checks.onpage.heading_hierarchy.explain'
  },
  {
    id: 'onpage_image_alt_coverage',
    category: 'onpage',
    scorecardGroup: 'onpage',
    title: 'Image Alt Attribute Coverage',
    weight: 3,
    severity: 'high',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const images = doc.querySelectorAll('img');
      if (images.length === 0) {
        return { status: 'pass', value: '0 images', details: 'No images found on page.' };
      }
      let missing = 0;
      for (const img of images) {
        const alt = img.getAttribute('alt');
        if (alt === null || alt.trim() === '') missing++;
      }
      const coverage = Math.round(((images.length - missing) / images.length) * 100);
      if (missing > 0) {
        return {
          status: missing === images.length ? 'fail' : 'warn',
          value: `${coverage}% (${images.length - missing}/${images.length})`,
          details: `${missing} of ${images.length} image(s) are missing descriptive alt text.`
        };
      }
      return { status: 'pass', value: `100% (${images.length}/${images.length})`, details: 'All images have descriptive alt attributes.' };
    },
    fixKey: 'checks.onpage.image_alt_coverage.fix',
    explainKey: 'checks.onpage.image_alt_coverage.explain'
  },
  {
    id: 'onpage_image_dimensions',
    category: 'onpage',
    scorecardGroup: 'onpage',
    title: 'Image Width and Height Dimensions',
    weight: 2,
    severity: 'medium',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const images = doc.querySelectorAll('img');
      if (images.length === 0) return { status: 'pass', value: '0 images', details: 'No images on page.' };
      let missing = 0;
      for (const img of images) {
        const w = img.getAttribute('width');
        const h = img.getAttribute('height');
        if (!w || !h) missing++;
      }
      if (missing > 0) {
        return { status: 'warn', value: `${missing} unconstrained`, details: `${missing} image(s) lack explicit width/height attributes, risking layout shift (CLS).` };
      }
      return { status: 'pass', value: 'All sized', details: 'All images have explicit width and height dimensions specified.' };
    },
    fixKey: 'checks.onpage.image_dimensions.fix',
    explainKey: 'checks.onpage.image_dimensions.explain'
  },
  {
    id: 'onpage_content_word_count',
    category: 'onpage',
    scorecardGroup: 'onpage',
    title: 'Content Depth & Word Count',
    weight: 3,
    severity: 'high',
    effort: 'high',
    tier: 1,
    test: (doc, ctx) => {
      const anatomy = extractPageAnatomy(doc, ctx.rawHtml || '');
      const count = anatomy.wordCount;
      if (count < 250) {
        return { status: 'fail', value: `${count} words`, details: 'Page has thin content (<250 words) which may struggle to rank in organic search.' };
      }
      if (count < 500) {
        return { status: 'warn', value: `${count} words`, details: 'Word count is moderate (250-500 words). In-depth guides (>600 words) tend to rank better.' };
      }
      return { status: 'pass', value: `${count} words`, details: `Substantive content depth detected (${count} words).` };
    },
    fixKey: 'checks.onpage.content_word_count.fix',
    explainKey: 'checks.onpage.content_word_count.explain'
  },
  {
    id: 'onpage_readability',
    category: 'onpage',
    scorecardGroup: 'onpage',
    title: 'Content Readability (Flesch Reading Ease)',
    weight: 2,
    severity: 'medium',
    effort: 'medium',
    tier: 1,
    test: (doc, ctx) => {
      const text = doc.body ? (doc.body.textContent || '') : (ctx.rawHtml || '');
      const stats = analyzeText(text);
      if (stats.wordCount < 50) {
        return { status: 'na', value: 'N/A', details: 'Insufficient text to compute readability.' };
      }
      const score = stats.fleschReadingEase;
      if (score < 40) {
        return { status: 'warn', value: `${score}/100 (${stats.easeRating})`, details: 'Content is difficult to read. Aim for 50-70 for standard web audiences.' };
      }
      return { status: 'pass', value: `${score}/100 (${stats.easeRating})`, details: 'Readability score is well balanced for general readership.' };
    },
    fixKey: 'checks.onpage.readability_score.fix',
    explainKey: 'checks.onpage.readability_score.explain'
  },
  {
    id: 'onpage_keyword_placement',
    category: 'onpage',
    scorecardGroup: 'onpage',
    title: 'Target Keyword Placement',
    weight: 3,
    severity: 'high',
    effort: 'low',
    tier: 1,
    test: (doc, ctx) => {
      if (!ctx.targetKeyword) {
        return { status: 'na', value: 'Not specified', details: 'Enter a target keyword in the audit input to evaluate placement.' };
      }
      const h1El = doc.querySelector('h1');
      const descEl = doc.querySelector('meta[name="description"]');
      const anatomy = extractPageAnatomy(doc, ctx.rawHtml || '');
      const first100 = (anatomy.rawText || '').split(/\s+/).slice(0, 100).join(' ');

      const res = analyzeKeywordPlacement(ctx.targetKeyword, {
        title: doc.title || '',
        description: descEl ? descEl.getAttribute('content') || '' : '',
        h1: h1El ? h1El.textContent || '' : '',
        url: ctx.url || '',
        first100Words: first100,
        headings: anatomy.headings
      });

      if (res.placementScore < 50) {
        return { status: 'fail', value: `${res.placementScore}% placement`, details: `Target keyword "${ctx.targetKeyword}" is missing in key areas (Title, H1, opening text).` };
      }
      if (res.placementScore < 80) {
        return { status: 'warn', value: `${res.placementScore}% placement`, details: `Target keyword found in some areas, but missing in ${!res.inTitle ? 'Title' : !res.inH1 ? 'H1' : 'Intro'}.` };
      }
      return { status: 'pass', value: `${res.placementScore}% placement`, details: `Target keyword "${ctx.targetKeyword}" is prominently placed in Title, H1, and opening copy.` };
    },
    fixKey: 'checks.onpage.target_keyword_placement.fix',
    explainKey: 'checks.onpage.target_keyword_placement.explain'
  },
  {
    id: 'onpage_anchor_text_quality',
    category: 'onpage',
    scorecardGroup: 'links',
    title: 'Anchor Text Quality & Specificity',
    weight: 2,
    severity: 'medium',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const links = doc.querySelectorAll('a[href]');
      if (links.length === 0) return { status: 'pass', value: '0 links', details: 'No links found.' };

      const genericAnchors = new Set(['click here', 'read more', 'learn more', 'here', 'more', 'link', 'view', 'website']);
      let genericCount = 0;

      for (const a of links) {
        const txt = (a.textContent || '').trim().toLowerCase();
        if (genericAnchors.has(txt)) genericCount++;
      }

      if (genericCount > 0) {
        return { status: 'warn', value: `${genericCount} generic anchor(s)`, details: `Found ${genericCount} link(s) with generic anchor text like "click here" or "learn more".` };
      }
      return { status: 'pass', value: '100% descriptive', details: 'All links use descriptive, context-rich anchor text.' };
    },
    fixKey: 'checks.onpage.anchor_text_quality.fix',
    explainKey: 'checks.onpage.anchor_text_quality.explain'
  }
];
