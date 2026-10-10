/**
 * Instaflow SEO Suite - Resilient Multi-Proxy Fetcher
 * Guarantees reliable scanning of any submitted URL with automatic fallback
 * between Cloudflare Worker proxy and local `/api/seo/fetch` backend.
 */

import { normalizeUrl } from './url.js';

/**
 * Fetches webpage HTML and response headers with automatic proxy failover
 */
export async function fetchWebsiteResilient(url, ctx = {}) {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    throw new Error('Invalid or empty URL provided.');
  }

  const proxiesToTry = [];

  // 1. Always prioritize local /api/seo endpoint first if available or configured
  if (ctx.proxyUrl && ctx.proxyUrl.startsWith('/')) {
    proxiesToTry.push(ctx.proxyUrl.replace(/\/$/, ''));
  }
  if (!proxiesToTry.includes('/api/seo')) {
    proxiesToTry.push('/api/seo');
  }

  // 2. Add custom configured proxy (e.g. Cloudflare Worker or Vercel)
  if (ctx.proxyUrl && !proxiesToTry.includes(ctx.proxyUrl.replace(/\/$/, ''))) {
    proxiesToTry.push(ctx.proxyUrl.replace(/\/$/, ''));
  }

  // 3. Add public Cloudflare worker fallback
  if (!proxiesToTry.includes('https://instaflow-seo-proxy.sujoymoulick05.workers.dev')) {
    proxiesToTry.push('https://instaflow-seo-proxy.sujoymoulick05.workers.dev');
  }

  let lastError = null;

  for (const proxyBase of proxiesToTry) {
    try {
      const endpoint = `${proxyBase}/fetch?url=${encodeURIComponent(normalized)}`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000); // 6s per proxy attempt

      const res = await fetch(endpoint, { signal: ctrl.signal });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.error && !data.html) {
        throw new Error(data.error);
      }

      return {
        url: normalized,
        finalUrl: data.finalUrl || normalized,
        status: data.status || res.status,
        statusText: data.statusText || 'OK',
        html: data.html || '',
        headers: data.headers || {},
        timingMs: data.timingMs || 0,
        byteSize: data.byteSize || (data.html ? new TextEncoder().encode(data.html).length : 0),
        usedProxy: proxyBase
      };
    } catch (err) {
      lastError = err;
      // Continue to next proxy candidate in loop
    }
  }

  // Final direct attempt if proxies failed
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const directRes = await fetch(normalized, {
      signal: ctrl.signal,
      headers: { 'Accept': 'text/html,application/xhtml+xml' }
    });
    clearTimeout(timer);
    if (directRes.ok) {
      const text = await directRes.text();
      return {
        url: normalized,
        finalUrl: directRes.url || normalized,
        status: directRes.status,
        statusText: directRes.statusText,
        html: text,
        headers: {},
        timingMs: 500,
        byteSize: text.length,
        usedProxy: 'direct'
      };
    }
  } catch (directErr) {}

  throw new Error(`Unable to fetch "${normalized}". ${lastError?.message || 'Connection timed out'}`);
}

/**
 * Fetches robots.txt content with proxy failover
 */
export async function fetchRobotsResilient(url, ctx = {}) {
  const normalized = normalizeUrl(url);
  if (!normalized) return '';

  const proxiesToTry = [];
  if (ctx.proxyUrl) proxiesToTry.push(ctx.proxyUrl.replace(/\/$/, ''));
  proxiesToTry.push('/api/seo');
  if (!proxiesToTry.includes('https://instaflow-seo-proxy.sujoymoulick05.workers.dev')) {
    proxiesToTry.push('https://instaflow-seo-proxy.sujoymoulick05.workers.dev');
  }

  for (const proxyBase of proxiesToTry) {
    try {
      const endpoint = `${proxyBase}/robots?url=${encodeURIComponent(normalized)}`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        return data.content || '';
      }
    } catch (e) {
      // Continue loop
    }
  }
  return '';
}

/**
 * Fetches all submitted sites from database / backend
 */
export async function fetchAllSubmittedSites() {
  try {
    const res = await fetch('/api/seo/submissions');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.sites) && data.sites.length > 0) {
        return data.sites;
      }
    }
  } catch (e) {
    console.warn('[SEO Fetcher] Could not load submissions from API:', e);
  }

  // Default fallback sites
  return [
    {
      id: 'sub_1',
      title: 'FreePDFly',
      url: 'https://freepdfly.com/',
      category: 'PDF Tools',
      status: 'Published'
    },
    {
      id: 'sub_2',
      title: 'InstaFlow',
      url: 'https://instaflow.sendvirtualgift.com',
      category: 'SaaS Platform',
      status: 'Published'
    }
  ];
}
