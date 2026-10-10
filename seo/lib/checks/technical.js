/**
 * Instaflow SEO Suite - Technical SEO Checks
 */

import { extractJsonLd, validateSchemaItems } from '../seo/schema.js';
import { ISO_639_1 } from '../seo/hreflang.js';

export const technicalChecks = [
  {
    id: 'tech_canonical_present',
    category: 'technical',
    scorecardGroup: 'onpage',
    title: 'Canonical Tag Defined',
    weight: 4,
    severity: 'critical',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const canonicals = doc.querySelectorAll('link[rel="canonical"]');
      if (canonicals.length === 0) {
        return { status: 'fail', value: 'Missing', details: 'No <link rel="canonical"> tag found. Search engines may struggle with canonical URL selection.' };
      }
      if (canonicals.length > 1) {
        return { status: 'fail', value: `${canonicals.length} tags`, details: 'Multiple canonical tags detected! Only one canonical tag is allowed.' };
      }
      const href = canonicals[0].getAttribute('href') || '';
      if (!href) return { status: 'fail', value: 'Empty href', details: 'Canonical tag has an empty href attribute.' };
      return { status: 'pass', value: href.slice(0, 45), details: `Valid canonical tag defined: ${href}` };
    },
    fixKey: 'checks.technical.canonical_tag.fix',
    explainKey: 'checks.technical.canonical_tag.explain'
  },
  {
    id: 'tech_meta_robots_index',
    category: 'technical',
    scorecardGroup: 'onpage',
    title: 'Indexation Directives (Meta Robots)',
    weight: 4,
    severity: 'critical',
    effort: 'low',
    tier: 1,
    test: (doc, ctx) => {
      const robotsMeta = doc.querySelector('meta[name="robots"]');
      const xRobots = ctx.headers ? (ctx.headers['x-robots-tag'] || ctx.headers['X-Robots-Tag']) : null;
      const content = robotsMeta ? (robotsMeta.getAttribute('content') || '').toLowerCase() : '';

      const isNoindex = content.includes('noindex') || (xRobots && xRobots.toLowerCase().includes('noindex'));
      const isNofollow = content.includes('nofollow') || (xRobots && xRobots.toLowerCase().includes('nofollow'));

      if (isNoindex) {
        return { status: 'fail', value: 'noindex active', details: 'Page specifies "noindex", which prevents Google and other search engines from indexing it.' };
      }
      if (isNofollow) {
        return { status: 'warn', value: 'nofollow active', details: 'Page specifies "nofollow", preventing search crawlers from following outbound links.' };
      }
      return { status: 'pass', value: content || 'index, follow (default)', details: 'Page is open for indexing and link following.' };
    },
    fixKey: 'checks.technical.meta_robots.fix',
    explainKey: 'checks.technical.meta_robots.explain'
  },
  {
    id: 'tech_schema_jsonld',
    category: 'technical',
    scorecardGroup: 'onpage',
    title: 'Structured Data Schema (JSON-LD)',
    weight: 3,
    severity: 'high',
    effort: 'medium',
    tier: 1,
    test: (doc) => {
      const { items, parseErrors } = extractJsonLd(doc);
      if (parseErrors.length > 0) {
        return { status: 'fail', value: 'Malformed JSON-LD', details: `JSON parse syntax error in structured data: ${parseErrors[0].message}` };
      }
      if (items.length === 0) {
        return { status: 'warn', value: 'None detected', details: 'No Schema.org JSON-LD found. Structured data improves rich results in SERPs.' };
      }
      const validation = validateSchemaItems(items);
      if (validation.errors.length > 0) {
        return { status: 'warn', value: `${validation.detectedTypes.join(', ')} (Incomplete)`, details: validation.errors[0].message };
      }
      return { status: 'pass', value: validation.detectedTypes.join(', '), details: `Valid Schema structured data detected: ${validation.detectedTypes.join(', ')}.` };
    },
    fixKey: 'checks.technical.jsonld_schema.fix',
    explainKey: 'checks.technical.jsonld_schema.explain'
  },
  {
    id: 'tech_charset_utf8',
    category: 'technical',
    scorecardGroup: 'onpage',
    title: 'Character Set Declared (UTF-8)',
    weight: 2,
    severity: 'medium',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const metaCharset = doc.querySelector('meta[charset]');
      const httpEquiv = doc.querySelector('meta[http-equiv="Content-Type" i]');
      if (!metaCharset && !httpEquiv) {
        return { status: 'fail', value: 'Missing', details: 'Missing <meta charset="utf-8"> in <head>.' };
      }
      const val = metaCharset ? metaCharset.getAttribute('charset') : 'content-type';
      return { status: 'pass', value: val.toUpperCase(), details: 'Character encoding is explicitly declared.' };
    },
    fixKey: 'checks.technical.charset_utf8.fix',
    explainKey: 'checks.technical.charset_utf8.explain'
  },
  {
    id: 'tech_doctype_html5',
    category: 'technical',
    scorecardGroup: 'onpage',
    title: 'HTML5 DOCTYPE Declaration',
    weight: 2,
    severity: 'medium',
    effort: 'low',
    tier: 1,
    test: (doc, ctx) => {
      const html = (ctx.rawHtml || '').trim();
      const hasDoctype = /^<!DOCTYPE\s+html/i.test(html);
      if (!hasDoctype) {
        return { status: 'fail', value: 'Missing', details: 'Document is missing standard <!DOCTYPE html> declaration, triggering browser quirks mode.' };
      }
      return { status: 'pass', value: '<!DOCTYPE html>', details: 'Standard HTML5 DOCTYPE is present.' };
    },
    fixKey: 'checks.technical.doctype_html5.fix',
    explainKey: 'checks.technical.doctype_html5.explain'
  },
  {
    id: 'tech_lang_attribute',
    category: 'technical',
    scorecardGroup: 'onpage',
    title: 'HTML Lang Attribute',
    weight: 2,
    severity: 'medium',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const lang = doc.documentElement?.getAttribute('lang') || '';
      if (!lang) {
        return { status: 'fail', value: 'Missing', details: 'The <html> tag is missing a "lang" attribute (e.g. <html lang="en">).' };
      }
      const code = lang.split('-')[0].toLowerCase();
      if (!ISO_639_1.has(code)) {
        return { status: 'warn', value: `"${lang}" (Unrecognized)`, details: `Language code "${lang}" may not be a standard ISO 639-1 code.` };
      }
      return { status: 'pass', value: `lang="${lang}"`, details: `Valid language attribute defined on <html>: "${lang}".` };
    },
    fixKey: 'checks.technical.lang_attribute.fix',
    explainKey: 'checks.technical.lang_attribute.explain'
  },
  {
    id: 'tech_favicon_present',
    category: 'technical',
    scorecardGroup: 'onpage',
    title: 'Favicon Icon Defined',
    weight: 1,
    severity: 'low',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const favicon = doc.querySelector('link[rel~="icon"], link[rel="shortcut icon"]');
      if (!favicon) {
        return { status: 'warn', value: 'Missing', details: 'No favicon link tag found in <head>.' };
      }
      return { status: 'pass', value: favicon.getAttribute('href') || 'Present', details: 'Favicon link tag is present.' };
    },
    fixKey: 'checks.technical.favicon_present.fix',
    explainKey: 'checks.technical.favicon_present.explain'
  },
  {
    id: 'tech_url_structure',
    category: 'technical',
    scorecardGroup: 'onpage',
    title: 'URL Structure & SEO Hygiene',
    weight: 2,
    severity: 'medium',
    effort: 'medium',
    tier: 1,
    test: (doc, ctx) => {
      if (!ctx.url) return { status: 'na', value: 'N/A', details: 'URL not provided.' };
      try {
        const u = new URL(ctx.url);
        const issues = [];
        if (/[A-Z]/.test(u.pathname)) issues.push('Contains uppercase letters');
        if (u.pathname.includes('_')) issues.push('Contains underscores (hyphens preferred)');
        if (ctx.url.length > 90) issues.push('URL length > 90 chars');
        if ([...u.searchParams.keys()].length > 3) issues.push('Excessive query parameters');

        if (issues.length > 0) {
          return { status: 'warn', value: `${issues.length} issue(s)`, details: `URL structure issues: ${issues.join(', ')}.` };
        }
        return { status: 'pass', value: 'Clean & short', details: 'URL is short, lowercase, hyphenated, and contains no spammy parameters.' };
      } catch (e) {
        return { status: 'na', value: 'N/A', details: 'Invalid URL format.' };
      }
    },
    fixKey: 'checks.technical.url_structure.fix',
    explainKey: 'checks.technical.url_structure.explain'
  },
  {
    id: 'tech_https_mixed_content',
    category: 'technical',
    scorecardGroup: 'onpage',
    title: 'HTTPS & Mixed Content Security',
    weight: 3,
    severity: 'high',
    effort: 'medium',
    tier: 1,
    test: (doc, ctx) => {
      const isHttps = ctx.url ? ctx.url.startsWith('https://') : true;
      const insecureResources = [];
      const tags = doc.querySelectorAll('script[src], link[href], img[src], iframe[src]');
      for (const t of tags) {
        const src = t.getAttribute('src') || t.getAttribute('href') || '';
        if (src.startsWith('http://')) {
          insecureResources.push(src);
        }
      }
      if (insecureResources.length > 0) {
        return { status: 'fail', value: `${insecureResources.length} insecure`, details: `Found ${insecureResources.length} insecure HTTP resource(s) on page, causing mixed content security warnings.` };
      }
      if (ctx.url && !isHttps) {
        return { status: 'fail', value: 'HTTP Insecure', details: 'Page is served over unencrypted HTTP. HTTPS is a Google ranking signal.' };
      }
      return { status: 'pass', value: 'Secure HTTPS', details: 'Page is served securely over HTTPS with no mixed content detected.' };
    },
    fixKey: 'checks.technical.https_mixed_content.fix',
    explainKey: 'checks.technical.https_mixed_content.explain'
  }
];
