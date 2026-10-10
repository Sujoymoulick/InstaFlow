/**
 * Instaflow SEO Suite - Keyword Density, N-Grams, Clustering & Intent Classification
 */

export const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during',
  'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
  'just', 'me', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very',
  'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would',
  'you', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Extracts top n-grams (1, 2, 3 words) and densities
 */
export function extractNGrams(text = '', n = 1, minCount = 2) {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  const totalWords = words.length;
  if (totalWords === 0) return [];

  const counts = {};

  for (let i = 0; i <= words.length - n; i++) {
    const phrase = words.slice(i, i + n).join(' ');
    // Avoid phrases where start or end is a stopword if n > 1
    if (n > 1) {
      const parts = phrase.split(' ');
      if (STOP_WORDS.has(parts[0]) || STOP_WORDS.has(parts[parts.length - 1])) {
        continue;
      }
    }
    counts[phrase] = (counts[phrase] || 0) + 1;
  }

  const results = Object.entries(counts)
    .filter(([_, count]) => count >= minCount)
    .map(([phrase, count]) => ({
      phrase,
      count,
      density: Math.round((count / (totalWords / n)) * 1000) / 10 // %
    }))
    .sort((a, b) => b.count - a.count);

  return results.slice(0, 30);
}

/**
 * Checks placement of target keyword across strategic on-page areas
 */
export function analyzeKeywordPlacement(targetKeyword, { title = '', description = '', h1 = '', url = '', first100Words = '', headings = [], imageAlts = [] }) {
  if (!targetKeyword || !targetKeyword.trim()) {
    return { targetKeyword: '', hasTarget: false };
  }

  const kw = targetKeyword.trim().toLowerCase();
  const kwTokens = kw.split(/\s+/).filter(Boolean);

  function containsKw(str) {
    if (!str) return false;
    const s = str.toLowerCase();
    return s.includes(kw) || (kwTokens.length > 1 && kwTokens.every(t => s.includes(t)));
  }

  const inTitle = containsKw(title);
  const inDescription = containsKw(description);
  const inH1 = containsKw(h1);
  const inUrl = containsKw(url);
  const inFirst100 = containsKw(first100Words);
  const inHeadings = headings.some(h => containsKw(h.text || h));
  const inImageAlt = imageAlts.some(alt => containsKw(alt));

  const score = [inTitle, inDescription, inH1, inUrl, inFirst100, inHeadings].filter(Boolean).length;

  return {
    targetKeyword: kw,
    hasTarget: true,
    inTitle,
    inDescription,
    inH1,
    inUrl,
    inFirst100,
    inHeadings,
    inImageAlt,
    placementScore: Math.round((score / 6) * 100)
  };
}

/**
 * Classifies search intent based on rule-based trigger phrases
 */
export function classifyKeywordIntent(keyword = '') {
  const kw = keyword.toLowerCase().trim();

  // Transactional patterns
  if (/\b(buy|order|purchase|cheap|discount|coupon|deal|pricing|price|cost|quote|hire|shop)\b/i.test(kw)) {
    return { intent: 'Transactional', confidence: 0.9, color: 'emerald' };
  }

  // Commercial / Investigation patterns
  if (/\b(best|top|vs|versus|compare|review|alternative|alternatives|pros and cons|guide to buying)\b/i.test(kw)) {
    return { intent: 'Commercial', confidence: 0.85, color: 'blue' };
  }

  // Navigational patterns
  if (/\b(login|sign in|portal|official website|app|download|contact support)\b/i.test(kw)) {
    return { intent: 'Navigational', confidence: 0.8, color: 'purple' };
  }

  // Informational (default)
  return { intent: 'Informational', confidence: 0.75, color: 'amber' };
}

/**
 * Groups keywords into semantic topic clusters based on shared token overlap
 */
export function clusterKeywords(keywordList = []) {
  const clusters = {};
  const cleaned = keywordList.map(k => k.trim()).filter(Boolean);

  for (const kw of cleaned) {
    const tokens = kw.toLowerCase().split(/\s+/).filter(t => !STOP_WORDS.has(t) && t.length > 2);
    let matchedCluster = null;

    for (const clusterName of Object.keys(clusters)) {
      const clusterTokens = clusterName.toLowerCase().split(/\s+/);
      const overlap = tokens.filter(t => clusterTokens.includes(t));
      if (overlap.length >= 1) {
        matchedCluster = clusterName;
        break;
      }
    }

    const parentName = matchedCluster || (tokens[0] || 'other');
    if (!clusters[parentName]) {
      clusters[parentName] = [];
    }

    const intent = classifyKeywordIntent(kw);
    clusters[parentName].push({ keyword: kw, intent: intent.intent });
  }

  return Object.entries(clusters).map(([cluster, items]) => ({
    cluster,
    count: items.length,
    keywords: items
  })).sort((a, b) => b.count - a.count);
}
