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
  if (/\b(best|top|vs|versus|compare|review|alternative|alternatives|pros and cons|guide to buying|free|tool|tools|software|service|services|app)\b/i.test(kw)) {
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

/**
 * Calculates keyword competition difficulty score (0-100)
 */
export function calculateKeywordDifficulty(keyword = '') {
  const kw = keyword.toLowerCase().trim();
  const words = kw.split(/\s+/).length;
  let score = 55;
  if (words === 1) score = 78;
  else if (words === 2) score = 58;
  else if (words === 3) score = 42;
  else if (words >= 4) score = 28;

  if (/\b(best|software|crm|insurance|loan|hosting|vpn|mortgage|attorney|pricing|buy)\b/i.test(kw)) {
    score = Math.min(95, score + 22);
  }

  let label = 'Medium';
  if (score <= 30) label = 'Easy';
  else if (score <= 60) label = 'Medium';
  else if (score <= 80) label = 'Hard';
  else label = 'Very Hard';

  return { score, label };
}

/**
 * Estimates organic CTR percentage based on rank position
 */
export function estimateCtrForPosition(pos) {
  if (!pos || pos <= 0 || pos > 100) return '0.1%';
  if (pos === 1) return '31.7%';
  if (pos === 2) return '15.6%';
  if (pos === 3) return '9.8%';
  if (pos === 4) return '6.9%';
  if (pos === 5) return '5.1%';
  if (pos <= 10) return `${(4.5 - (pos - 6) * 0.6).toFixed(1)}%`;
  if (pos <= 20) return '1.2%';
  return '0.3%';
}

/**
 * Automatically extracts the best keyword candidates from website anatomy/text
 */
export function extractTopSiteKeywords(text = '', { title = '', h1 = '', url = '' } = {}) {
  const candidateSet = new Set();

  // Extract from title
  if (title) {
    const cleanTitle = title.replace(/[|\-_–•·].*$/g, '').trim();
    if (cleanTitle.length > 3 && cleanTitle.length < 50) {
      candidateSet.add(cleanTitle.toLowerCase());
    }
  }

  // Extract from H1
  if (h1) {
    const cleanH1 = h1.replace(/[|\-_–•·].*$/g, '').trim();
    if (cleanH1.length > 3 && cleanH1.length < 50) {
      candidateSet.add(cleanH1.toLowerCase());
    }
  }

  // Extract n-grams
  const biGrams = extractNGrams(text, 2, 2);
  const triGrams = extractNGrams(text, 3, 2);
  const uniGrams = extractNGrams(text, 1, 3);

  for (const bg of biGrams.slice(0, 8)) candidateSet.add(bg.phrase);
  for (const tg of triGrams.slice(0, 5)) candidateSet.add(tg.phrase);
  for (const ug of uniGrams.slice(0, 5)) candidateSet.add(ug.phrase);

  return Array.from(candidateSet).slice(0, 15);
}

/**
 * Client-side / unified rank intelligence analyzer
 */
export function evaluateKeywordRankLocally(keyword, { domain = '', targetUrl = '', title = '', description = '', h1 = '', bodyText = '' } = {}) {
  const kw = keyword.trim().toLowerCase();
  const diff = calculateKeywordDifficulty(kw);
  const intent = classifyKeywordIntent(kw);

  const placement = analyzeKeywordPlacement(kw, {
    title,
    description,
    h1,
    url: targetUrl,
    first100Words: bodyText.slice(0, 600),
    headings: [h1]
  });

  // Calculate estimated position
  let estimatedPos = null;
  const domClean = (domain || targetUrl || '').toLowerCase().replace(/https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  const kwSlug = kw.replace(/[^a-z0-9]/g, '');

  if (domClean.includes(kwSlug)) {
    estimatedPos = 1;
  } else if (placement.inTitle && placement.inH1) {
    estimatedPos = Math.max(2, Math.round(10 - (placement.placementScore / 15)));
  } else if (placement.inTitle) {
    estimatedPos = Math.max(5, Math.round(20 - (placement.placementScore / 10)));
  } else if (placement.hasTarget && placement.placementScore > 40) {
    estimatedPos = Math.max(12, Math.round(45 - (placement.placementScore / 5)));
  } else {
    estimatedPos = null;
  }

  let rankBucket = 'not_in_top_100';
  if (estimatedPos) {
    if (estimatedPos <= 3) rankBucket = 'top3';
    else if (estimatedPos <= 10) rankBucket = 'top10';
    else if (estimatedPos <= 20) rankBucket = 'page2';
    else if (estimatedPos <= 50) rankBucket = 'page3_5';
    else rankBucket = 'top100';
  }

  let visibilityScore = 0;
  if (estimatedPos) {
    if (estimatedPos === 1) visibilityScore = 100;
    else if (estimatedPos === 2) visibilityScore = 85;
    else if (estimatedPos === 3) visibilityScore = 75;
    else if (estimatedPos <= 5) visibilityScore = 60;
    else if (estimatedPos <= 10) visibilityScore = 45;
    else if (estimatedPos <= 20) visibilityScore = 25;
    else visibilityScore = Math.max(5, Math.round(100 - estimatedPos));
  }

  return {
    keyword,
    targetUrl,
    domain: domClean,
    rank: estimatedPos,
    rankBucket,
    visibilityScore,
    intent: intent.intent,
    intentColor: intent.color,
    difficulty: diff.score,
    difficultyLabel: diff.label,
    estimatedCtr: estimateCtrForPosition(estimatedPos),
    onPageScore: placement.placementScore,
    onPageSignals: placement,
    checkedAt: new Date().toISOString()
  };
}

