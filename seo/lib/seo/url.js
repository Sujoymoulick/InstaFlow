/**
 * Instaflow SEO Suite - URL Cleaner, Slug Generator, UTM Builder & Pixel Width Estimator
 */

export function slugify(text = '') {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function buildUtmUrl(baseUrl, { source = '', medium = '', campaign = '', term = '', content = '' } = {}) {
  try {
    const url = new URL(baseUrl);
    if (source) url.searchParams.set('utm_source', source.trim());
    if (medium) url.searchParams.set('utm_medium', medium.trim());
    if (campaign) url.searchParams.set('utm_campaign', campaign.trim());
    if (term) url.searchParams.set('utm_term', term.trim());
    if (content) url.searchParams.set('utm_content', content.trim());
    return url.toString();
  } catch (e) {
    return baseUrl;
  }
}

export function normalizeUrl(rawUrl = '') {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.port ? ':' + parsed.port : ''}${parsed.pathname || '/'}${parsed.search}${parsed.hash}`;
  } catch (e) {
    return url;
  }
}

export function extractDomain(rawUrl = '') {
  if (!rawUrl) return '';
  const norm = normalizeUrl(rawUrl);
  try {
    const parsed = new URL(norm);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return rawUrl.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0];
  }
}

export function cleanUrlList(rawText = '') {
  const lines = rawText.split(/[\r\n,]+/).map(l => l.trim()).filter(Boolean);
  const normalized = [];
  const invalid = [];
  const seen = new Set();
  const duplicates = [];

  for (const line of lines) {
    let candidate = line;
    if (!/^https?:\/\//i.test(candidate)) {
      candidate = 'https://' + candidate;
    }
    try {
      const url = new URL(candidate);
      // Remove trailing slash and lower case hostname
      const clean = `${url.protocol}//${url.hostname.toLowerCase()}${url.port ? ':' + url.port : ''}${url.pathname.replace(/\/+$/, '') || '/'}${url.search}${url.hash}`;
      if (seen.has(clean)) {
        duplicates.push(clean);
      } else {
        seen.add(clean);
        normalized.push(clean);
      }
    } catch (e) {
      invalid.push(line);
    }
  }

  normalized.sort();

  return {
    totalInput: lines.length,
    validCount: normalized.length,
    duplicateCount: duplicates.length,
    invalidCount: invalid.length,
    cleanedUrls: normalized,
    invalidUrls: invalid,
    duplicateUrls: duplicates
  };
}

/**
 * Estimates rendered pixel width of text in Google SERP title/description (Arial/Roboto proportions)
 */
export function estimatePixelWidth(text = '', isTitle = true) {
  if (!text) return 0;
  // Font scale factors approx: 18px bold for title (~10.5px avg char width), 14px regular for desc (~7.5px avg)
  const baseScale = isTitle ? 10.5 : 7.2;
  const wideChars = new Set(['W', 'M', 'w', 'm', '@', '%', '&', 'Q', 'O', 'D']);
  const narrowChars = new Set(['i', 'l', 'I', 'j', 't', '!', '.', ',', ':', ';', '|', '\'', ' ']);

  let width = 0;
  for (const char of text) {
    if (wideChars.has(char)) width += baseScale * 1.45;
    else if (narrowChars.has(char)) width += baseScale * 0.55;
    else if (char === char.toUpperCase() && /[A-Z]/.test(char)) width += baseScale * 1.2;
    else width += baseScale * 0.95;
  }
  return Math.round(width);
}
