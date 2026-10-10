/**
 * Instaflow SEO Suite - AI-Search Readiness & GEO (Generative Engine Optimization) Checks
 */

import { extractJsonLd } from '../seo/schema.js';
import { parseRobotsTxt, KNOWN_AI_CRAWLERS, isPathAllowed } from '../seo/robots.js';
import { extractPageAnatomy } from '../parse/html.js';

export const geoChecks = [
  {
    id: 'geo_ai_crawlers_allowed',
    category: 'geo',
    scorecardGroup: 'geo',
    title: 'AI Search Crawler Access (GPTBot, ClaudeBot, Perplexity)',
    weight: 4,
    severity: 'critical',
    effort: 'low',
    tier: 1,
    test: (doc, ctx) => {
      if (!ctx.robotsTxt) {
        return { status: 'na', value: 'Robots.txt unparsed', details: 'Provide robots.txt content or run via Tier 2 proxy to verify AI crawler permissions.' };
      }
      const parsed = parseRobotsTxt(ctx.robotsTxt);
      const blocked = [];
      const criticalBots = ['GPTBot', 'ClaudeBot', 'PerplexityBot'];

      for (const bot of criticalBots) {
        if (!isPathAllowed(parsed, bot, '/')) {
          blocked.push(bot);
        }
      }

      if (blocked.length > 0) {
        return { status: 'fail', value: `${blocked.join(', ')} blocked`, details: `Critical AI bots (${blocked.join(', ')}) are blocked from crawling content in robots.txt.` };
      }
      return { status: 'pass', value: 'All AI bots allowed', details: 'GPTBot, ClaudeBot, and PerplexityBot have full permission to crawl and index content for AI citations.' };
    },
    fixKey: 'checks.geo.robots_ai_rules.fix',
    explainKey: 'checks.geo.robots_ai_rules.explain'
  },
  {
    id: 'geo_answer_first_format',
    category: 'geo',
    scorecardGroup: 'geo',
    title: 'Answer-First Direct Formatting for AI Snippets',
    weight: 4,
    severity: 'high',
    effort: 'medium',
    tier: 1,
    test: (doc, ctx) => {
      const anatomy = extractPageAnatomy(doc, ctx.rawHtml || '');
      const text = anatomy.rawText.trim();
      const firstParagraph = (text.split(/\n+/)[0] || text.slice(0, 300)).trim();

      // Check if intro begins with a direct declarative definition (e.g. "X is...", "X refers to...", "To do X, follow...")
      const isDirectAnswer = /^(?:[A-Z][a-zA-Z0-9\s-]+ (?:is|are|refers to|means|helps|provides|is designed to)|to [a-z]+,)/i.test(firstParagraph);
      
      if (!isDirectAnswer && firstParagraph.length < 50) {
        return { status: 'warn', value: 'Weak direct answer', details: 'Opening copy lacks a concise direct definition or answer in the first 2-3 sentences.' };
      }
      return { status: 'pass', value: 'Direct answer detected', details: 'Content employs direct, answer-first formatting optimizing for AI summary extraction.' };
    },
    fixKey: 'checks.geo.answer_first_formatting.fix',
    explainKey: 'checks.geo.answer_first_formatting.explain'
  },
  {
    id: 'geo_question_headings',
    category: 'geo',
    scorecardGroup: 'geo',
    title: 'Question-Style Headings (What, How, Why, Best)',
    weight: 3,
    severity: 'medium',
    effort: 'low',
    tier: 1,
    test: (doc, ctx) => {
      const anatomy = extractPageAnatomy(doc, ctx.rawHtml || '');
      const questionRegex = /^(what|how|why|when|where|which|who|can|should|is|are|best|top)\b|\?$/i;
      const questionHeadings = anatomy.headings.filter(h => questionRegex.test(h.text.trim()));

      if (anatomy.headings.length >= 3 && questionHeadings.length === 0) {
        return { status: 'warn', value: '0 question headings', details: 'No question-oriented headings found. Structuring sections as natural queries matches AI conversational search patterns.' };
      }
      return { status: 'pass', value: `${questionHeadings.length} question headings`, details: `Found ${questionHeadings.length} question-style headings aligned with natural user prompts.` };
    },
    fixKey: 'checks.geo.question_headings.fix',
    explainKey: 'checks.geo.question_headings.explain'
  },
  {
    id: 'geo_structured_lists_tables',
    category: 'geo',
    scorecardGroup: 'geo',
    title: 'Structured Tables & Lists for Data Extraction',
    weight: 3,
    severity: 'medium',
    effort: 'medium',
    tier: 1,
    test: (doc) => {
      const tables = doc.querySelectorAll('table');
      const lists = doc.querySelectorAll('ul, ol');

      if (tables.length === 0 && lists.length === 0) {
        return { status: 'warn', value: 'No tables or lists', details: 'Content has no HTML lists or data tables. LLMs favor structured bullet points and comparison tables for citing.' };
      }
      return { status: 'pass', value: `${tables.length} table(s), ${lists.length} list(s)`, details: 'Structured lists and data tables detected for machine extraction.' };
    },
    fixKey: 'checks.geo.tables_lists.fix',
    explainKey: 'checks.geo.tables_lists.explain'
  },
  {
    id: 'geo_faq_schema_markup',
    category: 'geo',
    scorecardGroup: 'geo',
    title: 'FAQ / Q&A Structured Schema',
    weight: 3,
    severity: 'medium',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const { items } = extractJsonLd(doc);
      const hasFaq = items.some(it => it['@type'] === 'FAQPage' || it['@type'] === 'QAPage');
      if (!hasFaq) {
        return { status: 'warn', value: 'No FAQ Schema', details: 'Adding FAQPage JSON-LD markup helps search and AI engines ingest high-confidence Q&A pairs.' };
      }
      return { status: 'pass', value: 'FAQPage Schema Present', details: 'FAQPage structured data is implemented.' };
    },
    fixKey: 'checks.geo.faq_schema.fix',
    explainKey: 'checks.geo.faq_schema.explain'
  },
  {
    id: 'geo_entity_sameas_clarity',
    category: 'geo',
    scorecardGroup: 'geo',
    title: 'Entity Clarity & sameAs Knowledge Graph Links',
    weight: 3,
    severity: 'medium',
    effort: 'medium',
    tier: 1,
    test: (doc) => {
      const { items } = extractJsonLd(doc);
      let hasSameAs = false;
      for (const it of items) {
        if (it.sameAs && (Array.isArray(it.sameAs) ? it.sameAs.length > 0 : Boolean(it.sameAs))) {
          hasSameAs = true;
          break;
        }
      }
      if (!hasSameAs) {
        return { status: 'warn', value: 'Missing sameAs links', details: 'No "sameAs" authority links (Wikipedia, Wikidata, LinkedIn) found in schema to anchor entity identity in knowledge graphs.' };
      }
      return { status: 'pass', value: 'sameAs entity links present', details: 'Entity authority references (sameAs) found in structured data.' };
    },
    fixKey: 'checks.geo.entity_clarity.fix',
    explainKey: 'checks.geo.entity_clarity.explain'
  },
  {
    id: 'geo_freshness_signals',
    category: 'geo',
    scorecardGroup: 'geo',
    title: 'Content Freshness Signals (dateModified / datePublished)',
    weight: 2,
    severity: 'medium',
    effort: 'low',
    tier: 1,
    test: (doc) => {
      const timeTag = doc.querySelector('time[datetime], meta[property*="modified_time"], meta[property*="published_time"]');
      const { items } = extractJsonLd(doc);
      const hasSchemaDate = items.some(it => it.datePublished || it.dateModified);

      if (!timeTag && !hasSchemaDate) {
        return { status: 'warn', value: 'No date metadata', details: 'No explicit publication or last-modified timestamp detected. Freshness signals are heavily weighted by AI engines.' };
      }
      return { status: 'pass', value: 'Date timestamps present', details: 'Explicit publication/modification timestamps found in HTML or JSON-LD.' };
    },
    fixKey: 'checks.geo.freshness.fix',
    explainKey: 'checks.geo.freshness.explain'
  }
];
