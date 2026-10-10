/**
 * Instaflow SEO Suite - Resilient URL Fetcher (Client / Browser Service)
 *
 * Guarantees reliable scanning of arbitrary submitted URLs through the server-side
 * `/api/seo/fetch` backend endpoint, with informative error diagnostics and clean cancellation.
 */

import { normalizeUrl } from './url.js';

const CLIENT_FETCH_TIMEOUT_MS = 20000; // 20s overall timeout for browser requests

/**
 * Fetches webpage HTML and response headers via server-side proxy
 *
 * @param {string} url 
 * @param {object} [ctx]
 * @param {string} [ctx.proxyUrl] Custom proxy base path (defaults to '/api/seo')
 * @param {AbortSignal} [ctx.signal] Optional external cancellation signal
 * @returns {Promise<{
 *   url: string,
 *   finalUrl: string,
 *   status: number,
 *   statusText: string,
 *   html: string,
 *   headers: Record<string, string>,
 *   timingMs: number,
 *   byteSize: number,
 *   usedProxy: string
 * }>}
 */
export async function fetchWebsiteResilient(url, ctx = {}) {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    throw new Error('Please enter a valid website URL to scan (e.g. https://example.com).');
  }

  // Build ordered list of proxy endpoints to try
  const proxiesToTry = [];

  // 1. Always prioritize local /api/seo server endpoint
  if (ctx.proxyUrl && ctx.proxyUrl.startsWith('/')) {
    proxiesToTry.push(ctx.proxyUrl.replace(/\/$/, ''));
  }
  if (!proxiesToTry.includes('/api/seo')) {
    proxiesToTry.push('/api/seo');
  }

  // 2. Add custom configured proxy URL if provided and distinct
  if (ctx.proxyUrl && !proxiesToTry.includes(ctx.proxyUrl.replace(/\/$/, ''))) {
    proxiesToTry.push(ctx.proxyUrl.replace(/\/$/, ''));
  }

  let lastError = null;

  for (const proxyBase of proxiesToTry) {
    // If caller already cancelled, abort early
    if (ctx.signal && ctx.signal.aborted) {
      const err = new Error(ctx.signal.reason?.message || 'Scan was cancelled.');
      err.name = 'AbortError';
      throw err;
    }

    const ctrl = new AbortController();
    let isTimedOut = false;

    const timer = setTimeout(() => {
      isTimedOut = true;
      const timeoutErr = new Error(`Request timed out after ${Math.round(CLIENT_FETCH_TIMEOUT_MS / 1000)}s while connecting to ${normalized}. The website may be slow, down, or blocking automated scanners.`);
      timeoutErr.name = 'TimeoutError';
      ctrl.abort(timeoutErr);
    }, CLIENT_FETCH_TIMEOUT_MS);

    // Forward caller's cancellation signal if provided
    let onExternalAbort = null;
    if (ctx.signal) {
      onExternalAbort = () => {
        const cancelErr = new Error(ctx.signal.reason?.message || 'Scan was cancelled.');
        cancelErr.name = 'AbortError';
        ctrl.abort(cancelErr);
      };
      ctx.signal.addEventListener('abort', onExternalAbort);
    }

    try {
      const endpoint = `${proxyBase}/fetch?url=${encodeURIComponent(normalized)}`;
      const res = await fetch(endpoint, {
        method: 'GET',
        signal: ctrl.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timer);

      const data = await res.json().catch(() => null);

      if (!res.ok || (data && data.error && !data.html)) {
        const errorMsg = data?.error || `HTTP ${res.status}: ${res.statusText || 'Fetch failed'}`;
        const serverErr = new Error(errorMsg);
        serverErr.status = data?.status || res.status;
        serverErr.targetUrl = normalized;
        // If the server explicitly returned a known client/security error, don't fall back to other proxies
        if (res.status === 400 || res.status === 403 || res.status === 404 || res.status === 429) {
          throw serverErr;
        }
        lastError = serverErr;
        continue;
      }

      if (!data || typeof data.html !== 'string') {
        throw new Error('Invalid response structure received from SEO fetch endpoint.');
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
      clearTimeout(timer);
      if (err.name === 'AbortError' && ctx.signal?.aborted) {
        throw err;
      }
      if (isTimedOut) {
        lastError = new Error(`Connection timed out after ${Math.round(CLIENT_FETCH_TIMEOUT_MS / 1000)}s while fetching "${normalized}".`);
      } else {
        lastError = err;
      }

      // If it's a specific HTTP status error (like 403, 404), throw immediately
      if (err.status && err.status >= 400 && err.status < 500) {
        throw err;
      }
    } finally {
      clearTimeout(timer);
      if (ctx.signal && onExternalAbort) {
        ctx.signal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  throw new Error(`Unable to fetch "${normalized}". ${lastError?.message || 'The server could not be reached.'}`);
}

/**
 * Fetches robots.txt content with proxy failover
 *
 * @param {string} url 
 * @param {object} [ctx]
 * @returns {Promise<string>}
 */
export async function fetchRobotsResilient(url, ctx = {}) {
  const normalized = normalizeUrl(url);
  if (!normalized) return '';

  const proxyBase = (ctx.proxyUrl && ctx.proxyUrl.startsWith('/')) ? ctx.proxyUrl.replace(/\/$/, '') : '/api/seo';

  try {
    const endpoint = `${proxyBase}/robots?url=${encodeURIComponent(normalized)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      ctrl.abort(new Error('Robots.txt request timed out'));
    }, 10000);

    const res = await fetch(endpoint, { signal: ctrl.signal });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json().catch(() => null);
      return data?.content || '';
    }
  } catch {
    // Non-fatal: empty robots.txt implies unrestricted crawling
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
