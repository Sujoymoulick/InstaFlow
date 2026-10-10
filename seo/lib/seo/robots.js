/**
 * Instaflow SEO Suite - Robots.txt Parser, Linter & AI Crawler Analyzer
 */

export const KNOWN_AI_CRAWLERS = [
  { name: 'GPTBot', company: 'OpenAI', purpose: 'Training data & ChatGPT Search' },
  { name: 'ChatGPT-User', company: 'OpenAI', purpose: 'ChatGPT live browsing' },
  { name: 'ClaudeBot', company: 'Anthropic', purpose: 'Claude training data & search' },
  { name: 'Claude-Web', company: 'Anthropic', purpose: 'Claude browsing' },
  { name: 'PerplexityBot', company: 'Perplexity AI', purpose: 'Perplexity search indexer' },
  { name: 'Google-Extended', company: 'Google', purpose: 'Gemini & Vertex AI training' },
  { name: 'CCBot', company: 'Common Crawl', purpose: 'Open AI datasets & research' },
  { name: 'Bytespider', company: 'ByteDance', purpose: 'TikTok AI training' },
  { name: 'Applebot-Extended', company: 'Apple', purpose: 'Apple Intelligence models' },
  { name: 'cohere-ai', company: 'Cohere', purpose: 'Cohere LLM training' },
  { name: 'Diffbot', company: 'Diffbot', purpose: 'Knowledge graph extraction' }
];

/**
 * Parses raw robots.txt content into structured directives per user-agent
 */
export function parseRobotsTxt(content) {
  if (!content || typeof content !== 'string') {
    return { userAgents: {}, sitemaps: [], host: null, errors: ['Empty robots.txt content'] };
  }

  const lines = content.split(/\r?\n/);
  const userAgents = {};
  const sitemaps = [];
  let host = null;
  const errors = [];
  let currentAgents = ['*'];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNum = i + 1;
    // Strip comments
    const commentIdx = rawLine.indexOf('#');
    const cleanLine = (commentIdx !== -1 ? rawLine.substring(0, commentIdx) : rawLine).trim();
    if (!cleanLine) continue;

    const colonIdx = cleanLine.indexOf(':');
    if (colonIdx === -1) {
      errors.push({ line: lineNum, text: rawLine, message: 'Invalid directive: missing colon delimiter' });
      continue;
    }

    const field = cleanLine.substring(0, colonIdx).trim().toLowerCase();
    const value = cleanLine.substring(colonIdx + 1).trim();

    if (field === 'user-agent') {
      const agent = value.toLowerCase();
      // If previous line was not a user-agent, reset current agents
      if (lines[i - 1] && !lines[i - 1].toLowerCase().startsWith('user-agent:')) {
        currentAgents = [agent];
      } else {
        currentAgents.push(agent);
      }
      for (const ag of currentAgents) {
        if (!userAgents[ag]) {
          userAgents[ag] = { allow: [], disallow: [], crawlDelay: null };
        }
      }
    } else if (field === 'disallow') {
      for (const ag of currentAgents) {
        if (!userAgents[ag]) userAgents[ag] = { allow: [], disallow: [], crawlDelay: null };
        if (value) userAgents[ag].disallow.push(value);
      }
    } else if (field === 'allow') {
      for (const ag of currentAgents) {
        if (!userAgents[ag]) userAgents[ag] = { allow: [], disallow: [], crawlDelay: null };
        if (value) userAgents[ag].allow.push(value);
      }
    } else if (field === 'crawl-delay') {
      const delay = parseFloat(value);
      for (const ag of currentAgents) {
        if (!userAgents[ag]) userAgents[ag] = { allow: [], disallow: [], crawlDelay: null };
        userAgents[ag].crawlDelay = isNaN(delay) ? null : delay;
      }
    } else if (field === 'sitemap') {
      if (value && !sitemaps.includes(value)) {
        sitemaps.push(value);
      }
    } else if (field === 'host') {
      host = value;
    }
  }

  return {
    userAgents,
    sitemaps,
    host,
    errors
  };
}

/**
 * Tests if a specific path is allowed for a given user-agent
 */
export function isPathAllowed(robotsData, userAgent = '*', path = '/') {
  const ua = userAgent.toLowerCase();
  const rules = robotsData.userAgents[ua] || robotsData.userAgents['*'] || { allow: [], disallow: [] };

  // Longest match rule wins in Google standard
  let bestMatch = { type: 'allow', length: -1 };

  for (const pattern of rules.allow) {
    if (matchesPath(pattern, path) && pattern.length > bestMatch.length) {
      bestMatch = { type: 'allow', length: pattern.length };
    }
  }

  for (const pattern of rules.disallow) {
    if (matchesPath(pattern, path) && pattern.length >= bestMatch.length) {
      bestMatch = { type: 'disallow', length: pattern.length };
    }
  }

  return bestMatch.type === 'allow';
}

function matchesPath(pattern, path) {
  if (!pattern) return false;
  if (pattern === '/') return true;
  const regexPattern = '^' + pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\$$/, '$');
  try {
    return new RegExp(regexPattern).test(path);
  } catch (e) {
    return path.startsWith(pattern);
  }
}

/**
 * Analyzes permissions for all known AI bots
 */
export function analyzeAICrawlers(robotsContent) {
  const parsed = parseRobotsTxt(robotsContent);
  return KNOWN_AI_CRAWLERS.map(bot => {
    const isExplicitlyDefined = Boolean(parsed.userAgents[bot.name.toLowerCase()]);
    const allowedRoot = isPathAllowed(parsed, bot.name, '/');
    const allowedContent = isPathAllowed(parsed, bot.name, '/blog/article-1');
    return {
      name: bot.name,
      company: bot.company,
      purpose: bot.purpose,
      status: allowedRoot ? 'allowed' : 'blocked',
      explicitRule: isExplicitlyDefined,
      allowedRoot,
      allowedContent
    };
  });
}

/**
 * Generates a clean, modern robots.txt
 */
export function generateRobotsTxt({ allowAll = true, allowAI = true, sitemapUrl = '', customDisallow = [] } = {}) {
  let output = `# Robots.txt generated by Instaflow SEO Suite\n\n`;
  output += `User-agent: *\n`;
  if (allowAll) {
    output += `Allow: /\n`;
  }
  for (const path of customDisallow) {
    if (path.trim()) output += `Disallow: ${path.trim()}\n`;
  }
  if (!allowAll && customDisallow.length === 0) {
    output += `Disallow: /\n`;
  }

  output += `\n# AI & LLM Search Crawlers\n`;
  for (const bot of KNOWN_AI_CRAWLERS) {
    output += `User-agent: ${bot.name}\n`;
    output += allowAI ? `Allow: /\n` : `Disallow: /\n`;
  }

  if (sitemapUrl) {
    output += `\n# Sitemaps\nSitemap: ${sitemapUrl}\n`;
  }

  return output;
}
