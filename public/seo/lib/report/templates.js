/**
 * Instaflow SEO Suite - Report Template Definitions
 */

export const REPORT_TEMPLATES = [
  {
    id: 'full_audit',
    name: 'Comprehensive 360° SEO & GEO Audit',
    description: 'Includes all 100+ checks across On-Page, Technical, GEO, Usability, Speed, and Links.',
    groups: ['onpage', 'geo', 'links', 'usability', 'performance'],
    includeScorecard: true,
    includeTopFixes: true,
    includeAnatomy: true
  },
  {
    id: 'executive_summary',
    name: 'Executive & C-Level Summary',
    description: 'High-level scorecard rings, radar pentagon chart, and top 5 highest-impact action items.',
    groups: ['onpage', 'geo', 'links', 'usability', 'performance'],
    includeScorecard: true,
    includeTopFixes: true,
    includeAnatomy: false,
    maxFixes: 5
  },
  {
    id: 'geo_ai_readiness',
    name: 'AI-Search & GEO Readiness Focus',
    description: 'Deep dive into AI crawlers (GPTBot, ClaudeBot), schema entities, answer-first formatting, and llms.txt.',
    groups: ['geo', 'onpage'],
    includeScorecard: true,
    includeTopFixes: true,
    includeAnatomy: true
  },
  {
    id: 'technical_performance',
    name: 'Technical SEO & Performance Audit',
    description: 'Focuses on canonicals, robots directives, schema JSON-LD, render blocking, and Core Web Vitals.',
    groups: ['performance', 'usability', 'links'],
    includeScorecard: true,
    includeTopFixes: true,
    includeAnatomy: false
  }
];
