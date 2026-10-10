/**
 * Instaflow SEO Suite - Universal Secure Server-Side URL Fetching Engine
 *
 * Provides resilient, SSRF-protected, streaming-capable fetching for arbitrary
 * public website URLs across diverse hosting environments (Cloudflare, AWS, Vercel, Shopify, WordPress).
 */

import { validateUrlSafetyAsync, validateUrlSafety } from '../../worker/ssrf-guard.js';

export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 (compatible; InstaFlow-SEO-Auditor/2.0; +https://instaflow-weld.vercel.app/seo)';
export const DEFAULT_TIMEOUT_MS = 15000;      // 15 seconds overall deadline
export const DEFAULT_MAX_REDIRECTS = 5;       // 5 redirect hops
export const DEFAULT_MAX_BYTES = 6 * 1024 * 1024; // 6MB payload limit
export const STREAM_IDLE_TIMEOUT_MS = 3500;   // 3.5s idle threshold for chunked streams

/**
 * Normalizes input URL string into a clean, canonical format
 * @param {string} rawUrl 
 * @returns {string}
 */
export function normalizeTargetUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('URL must be a non-empty string.');
  }

  let clean = rawUrl.trim();
  if (!clean) {
    throw new Error('URL cannot be blank.');
  }

  // Prepend protocol only if no scheme is present
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(clean);
  if (!hasScheme) {
    clean = 'https://' + clean;
  }

  let parsed;
  try {
    parsed = new URL(clean);
  } catch (err) {
    throw new Error(`Invalid URL format: "${rawUrl}". Please enter a valid web address.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported protocol "${parsed.protocol}". Only HTTP and HTTPS URLs are supported.`);
  }

  // Strip embedded credentials for security
  parsed.username = '';
  parsed.password = '';

  return parsed.toString();
}

/**
 * Extracts character set from Content-Type header or HTML meta tags
 * @param {string} contentType 
 * @param {Uint8Array} rawBytes 
 * @returns {string}
 */
export function detectCharset(contentType = '', rawBytes = null) {
  const ctMatch = contentType.match(/charset=([a-zA-Z0-9_-]+)/i);
  if (ctMatch && ctMatch[1]) {
    return ctMatch[1].toLowerCase();
  }

  if (rawBytes && rawBytes.length > 0) {
    try {
      const snippet = new TextDecoder('ascii', { fatal: false }).decode(rawBytes.slice(0, 1500));
      const metaMatch = snippet.match(/<meta[^>]+charset=["']?([a-zA-Z0-9_-]+)/i);
      if (metaMatch && metaMatch[1]) {
        return metaMatch[1].toLowerCase();
      }
    } catch {}
  }

  return 'utf-8';
}

/**
 * Fetches arbitrary public website HTML with full SSRF protection,
 * redirect loop detection, streaming resilience, and clear error diagnostics.
 *
 * @param {string} rawUrl 
 * @param {object} [options]
 * @param {number} [options.timeoutMs]
 * @param {number} [options.maxRedirects]
 * @param {number} [options.maxBytes]
 * @param {string} [options.userAgent]
 * @param {AbortSignal} [options.signal] External abort signal
 * @returns {Promise<{
 *   url: string,
 *   finalUrl: string,
 *   status: number,
 *   statusText: string,
 *   headers: Record<string, string>,
 *   html: string,
 *   byteSize: number,
 *   timingMs: number,
 *   redirectChain: Array<{ from: string, to: string, status: number }>,
 *   isTruncated: boolean
 * }>}
 */
export async function fetchUrlServer(rawUrl, options = {}) {
  const targetUrl = normalizeTargetUrl(rawUrl);
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects !== undefined ? options.maxRedirects : DEFAULT_MAX_REDIRECTS;
  const maxBytes = options.maxBytes || DEFAULT_MAX_BYTES;
  const userAgent = options.userAgent || DEFAULT_USER_AGENT;

  const startTime = Date.now();
  let currentUrl = targetUrl;
  const redirectChain = [];
  const visitedUrls = new Set();
  let redirectsRemaining = maxRedirects;

  // External signal handling
  if (options.signal && options.signal.aborted) {
    const err = new Error(options.signal.reason?.message || 'Request was cancelled before execution.');
    err.name = 'AbortError';
    throw err;
  }

  // Combined AbortController with explicit timeout reason
  const abortController = new AbortController();
  let isTimedOut = false;

  const timeoutTimer = setTimeout(() => {
    isTimedOut = true;
    const timeoutErr = new Error(`Request timed out after ${timeoutMs}ms while fetching "${currentUrl}". The website may be offline, slow, or restricting automated connections.`);
    timeoutErr.name = 'TimeoutError';
    abortController.abort(timeoutErr);
  }, timeoutMs);

  // Link caller signal if provided
  let onExternalAbort = null;
  if (options.signal) {
    onExternalAbort = () => {
      const abortErr = new Error(options.signal.reason?.message || 'Request was cancelled by the user.');
      abortErr.name = 'AbortError';
      abortController.abort(abortErr);
    };
    options.signal.addEventListener('abort', onExternalAbort);
  }

  try {
    let finalResponse = null;

    // Redirect & fetch loop
    while (true) {
      if (visitedUrls.has(currentUrl)) {
        throw new Error(`Redirect loop detected: "${currentUrl}" was already visited in redirect chain.`);
      }
      visitedUrls.add(currentUrl);

      // SSRF check before connection
      const safety = await validateUrlSafetyAsync(currentUrl);
      if (!safety.safe) {
        const ssrfErr = new Error(`Security block: ${safety.error}`);
        ssrfErr.name = 'SSRFError';
        throw ssrfErr;
      }

      let res;
      try {
        res = await fetch(currentUrl, {
          method: 'GET',
          redirect: 'manual', // Manually validate each redirect for SSRF
          signal: abortController.signal,
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'no-cache'
          }
        });
      } catch (netErr) {
        if (isTimedOut) {
          throw new Error(`Request timed out after ${timeoutMs}ms while fetching "${currentUrl}".`);
        }
        if (netErr.name === 'AbortError' || netErr.name === 'TimeoutError') {
          throw netErr;
        }
        throw new Error(`Failed to establish connection to "${currentUrl}": ${netErr.message}`);
      }

      // Check for redirect status
      const isRedirect = [301, 302, 303, 307, 308].includes(res.status);
      const location = res.headers.get('location');

      if (isRedirect && location) {
        let nextUrl;
        try {
          nextUrl = new URL(location, currentUrl).toString();
        } catch {
          throw new Error(`Invalid redirect Location header received from "${currentUrl}": "${location}"`);
        }

        redirectChain.push({ from: currentUrl, to: nextUrl, status: res.status });
        redirectsRemaining--;

        if (redirectsRemaining < 0) {
          throw new Error(`Maximum redirect limit of ${maxRedirects} hops exceeded.`);
        }

        // Cleanly cancel previous response body
        try {
          if (res.body) await res.body.cancel();
        } catch {}

        currentUrl = nextUrl;
        continue; // Next hop
      }

      // Reached final destination response
      finalResponse = res;
      break;
    }

    const statusCode = finalResponse.status;
    const statusText = finalResponse.statusText || 'OK';

    // Normalize headers dictionary
    const headersObj = {};
    for (const [k, v] of finalResponse.headers.entries()) {
      headersObj[k.toLowerCase()] = v;
    }

    // Check Content-Type for binary or non-HTML resources
    const contentType = headersObj['content-type'] || '';
    if (contentType.includes('application/pdf') || contentType.includes('image/') || contentType.includes('video/') || contentType.includes('application/zip')) {
      throw new Error(`The requested URL returned a non-HTML resource (${contentType}). InstaFlow SEO Suite requires an HTML document for SEO analysis.`);
    }

    // Stream body chunks with idle timeout resilience
    let totalBytes = 0;
    const chunks = [];
    let isTruncated = false;

    if (finalResponse.body) {
      const reader = finalResponse.body.getReader();

      while (totalBytes < maxBytes) {
        const readPromise = reader.read();

        // If we already received substantial data (>1KB), don't let a lingering/hanging stream stall indefinitely
        if (totalBytes > 1024) {
          const idlePromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('STREAM_IDLE_TIMEOUT')), STREAM_IDLE_TIMEOUT_MS);
          });

          try {
            const { done, value } = await Promise.race([readPromise, idlePromise]);
            if (done) break;
            chunks.push(value);
            totalBytes += value.length;
          } catch (raceErr) {
            if (raceErr.message === 'STREAM_IDLE_TIMEOUT') {
              // Server stopped sending chunks but connection remained open. Finalize received body.
              try { await reader.cancel(); } catch {}
              break;
            }
            throw raceErr;
          }
        } else {
          // Initial chunks
          const { done, value } = await readPromise;
          if (done) break;
          chunks.push(value);
          totalBytes += value.length;
        }
      }

      if (totalBytes >= maxBytes) {
        isTruncated = true;
        try { await reader.cancel(); } catch {}
      }
    }

    // Assemble buffer
    const mergedBuffer = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      mergedBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Decode charset
    const charset = detectCharset(contentType, mergedBuffer);
    let htmlText = '';
    try {
      htmlText = new TextDecoder(charset, { fatal: false }).decode(mergedBuffer);
    } catch {
      htmlText = new TextDecoder('utf-8', { fatal: false }).decode(mergedBuffer);
    }

    const timingMs = Date.now() - startTime;

    // HTTP Error classification with actionable messages
    if (statusCode >= 400) {
      let actionHint = 'Please check the URL or use the manual HTML paste option below.';
      if (statusCode === 403) {
        actionHint = 'The website returned HTTP 403 (Forbidden) and blocked automated requests. It may be using anti-bot/WAF protection (e.g. Cloudflare). Use the manual HTML paste option below to analyze this page.';
      } else if (statusCode === 404) {
        actionHint = 'The website returned HTTP 404 (Not Found). Please make sure the URL path is correct and publicly accessible.';
      } else if (statusCode === 429) {
        const retryAfter = headersObj['retry-after'] ? ` (Retry-After: ${headersObj['retry-after']}s)` : '';
        actionHint = `The website returned HTTP 429 (Too Many Requests)${retryAfter}. The destination server is rate-limiting requests. Please try again later or use manual HTML paste.`;
      } else if (statusCode >= 500) {
        actionHint = `The website returned HTTP ${statusCode} (${statusText}). The destination server encountered an internal server error. Try again later or use manual HTML paste.`;
      }

      const httpErr = new Error(actionHint);
      httpErr.status = statusCode;
      httpErr.statusText = statusText;
      httpErr.finalUrl = currentUrl;
      httpErr.headers = headersObj;
      httpErr.html = htmlText;
      throw httpErr;
    }

    return {
      url: targetUrl,
      finalUrl: currentUrl,
      status: statusCode,
      statusText,
      headers: headersObj,
      html: htmlText,
      byteSize: totalBytes,
      timingMs,
      redirectChain,
      isTruncated
    };
  } finally {
    clearTimeout(timeoutTimer);
    if (options.signal && onExternalAbort) {
      options.signal.removeEventListener('abort', onExternalAbort);
    }
  }
}
