/**
 * Instaflow SEO Suite - Cloudflare Worker Proxy (Tier 2)
 *
 * Deployable to Cloudflare Workers free tier.
 * Features:
 * - Full SSRF protection on initial request and redirect chains
 * - 3MB max payload limit
 * - 10s fetch timeout
 * - Max 5 redirects with loop detection
 * - Identifiable User-Agent string
 * - CORS locked to allowed origin
 */

import { validateUrlSafety } from './ssrf-guard.js';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 (compatible; SEO-Auditor/1.0)';
const MAX_BYTES = 3 * 1024 * 1024; // 3MB
const FETCH_TIMEOUT_MS = 10000;    // 10 seconds
const MAX_REDIRECTS = 5;

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors(new Response(null, { status: 204 }), env, request);
    }

    const url = new URL(request.url);

    if (url.pathname === '/health' || url.pathname === '/test') {
      return jsonResponse({ status: 'ok', message: 'Instaflow Tier 2 SEO Worker active', timestamp: Date.now() }, env, request);
    }

    if (url.pathname === '/fetch') {
      const target = url.searchParams.get('url');
      if (!target) {
        return errorResponse('Missing "url" parameter', 400, env, request);
      }

      // SSRF validation
      const safety = validateUrlSafety(target);
      if (!safety.safe) {
        return errorResponse(`SSRF Security Block: ${safety.error}`, 403, env, request);
      }

      try {
        const startTime = Date.now();
        const fetchResult = await safeFetch(target, { maxRedirects: MAX_REDIRECTS, timeoutMs: FETCH_TIMEOUT_MS });
        const timingMs = Date.now() - startTime;

        return jsonResponse({
          url: target,
          finalUrl: fetchResult.finalUrl,
          status: fetchResult.status,
          statusText: fetchResult.statusText,
          redirectChain: fetchResult.redirectChain,
          headers: fetchResult.headers,
          html: fetchResult.html,
          timingMs,
          byteSize: fetchResult.byteSize
        }, env, request);
      } catch (err) {
        return errorResponse(`Fetch failed: ${err.message}`, 502, env, request);
      }
    }

    if (url.pathname === '/robots') {
      const target = url.searchParams.get('url');
      if (!target) return errorResponse('Missing "url" param', 400, env, request);
      try {
        const u = new URL(target);
        const robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
        const res = await safeFetch(robotsUrl, { maxRedirects: 2, timeoutMs: 5000 });
        return jsonResponse({ url: robotsUrl, content: res.html, status: res.status }, env, request);
      } catch (e) {
        return errorResponse(`Robots fetch error: ${e.message}`, 502, env, request);
      }
    }

    if (url.pathname === '/sitemap') {
      const target = url.searchParams.get('url');
      if (!target) return errorResponse('Missing "url" param', 400, env, request);
      try {
        const u = new URL(target);
        const sitemapUrl = target.endsWith('.xml') ? target : `${u.protocol}//${u.host}/sitemap.xml`;
        const res = await safeFetch(sitemapUrl, { maxRedirects: 3, timeoutMs: 8000 });
        return jsonResponse({ url: sitemapUrl, xml: res.html, status: res.status }, env, request);
      } catch (e) {
        return errorResponse(`Sitemap fetch error: ${e.message}`, 502, env, request);
      }
    }

    return errorResponse('Endpoint not found', 404, env, request);
  }
};

async function safeFetch(initialUrl, { maxRedirects = 5, timeoutMs = 10000 }) {
  let currentUrl = initialUrl;
  const redirectChain = [];
  let redirectsRemaining = maxRedirects;

  while (redirectsRemaining >= 0) {
    const safety = validateUrlSafety(currentUrl);
    if (!safety.safe) {
      throw new Error(`SSRF Block on redirect: ${safety.error}`);
    }

    const controller = new AbortController();
    let isTimedOut = false;
    const timer = setTimeout(() => {
      isTimedOut = true;
      controller.abort(new Error(`Fetch timed out after ${timeoutMs}ms while connecting to ${currentUrl}`));
    }, timeoutMs);

    let res;
    try {
      res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual', // Manually inspect each hop for SSRF
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      const isRedirect = [301, 302, 303, 307, 308].includes(res.status);
      const location = res.headers.get('location');

      if (isRedirect && location) {
        clearTimeout(timer);
        const nextUrl = new URL(location, currentUrl).toString();
        redirectChain.push({ from: currentUrl, to: nextUrl, status: res.status });
        currentUrl = nextUrl;
        redirectsRemaining--;
        if (redirectsRemaining < 0) {
          throw new Error('Maximum redirect limit exceeded (5 hops)');
        }
        try { if (res.body) await res.body.cancel(); } catch {}
        continue;
      }

      // Read payload up to MAX_BYTES with idle chunk handling
      let received = 0;
      const chunks = [];

      if (res.body) {
        const reader = res.body.getReader();

        while (received < MAX_BYTES) {
          const readPromise = reader.read();

          if (received > 1024) {
            const idlePromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('STREAM_IDLE')), 3500);
            });

            try {
              const { done, value } = await Promise.race([readPromise, idlePromise]);
              if (done) break;
              chunks.push(value);
              received += value.length;
            } catch (err) {
              if (err.message === 'STREAM_IDLE') {
                try { await reader.cancel(); } catch {}
                break;
              }
              throw err;
            }
          } else {
            const { done, value } = await readPromise;
            if (done) break;
            chunks.push(value);
            received += value.length;
          }
        }

        if (received > MAX_BYTES) {
          try { await reader.cancel(); } catch {}
        }
      }

      clearTimeout(timer);

      const totalBuffer = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        totalBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      const text = new TextDecoder('utf-8').decode(totalBuffer);
      const headersObj = {};
      for (const [k, v] of res.headers.entries()) {
        headersObj[k.toLowerCase()] = v;
      }

      return {
        finalUrl: currentUrl,
        status: res.status,
        statusText: res.statusText,
        redirectChain,
        headers: headersObj,
        html: text,
        byteSize: received
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function handleCors(response, env, request) {
  const origin = request.headers.get('Origin') || '*';
  const allowed = env?.ALLOWED_ORIGIN || '*';
  const allowOrigin = (allowed === '*' || allowed === origin) ? origin : allowed;

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', allowOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return new Response(response.body, { status: response.status, headers });
}

function jsonResponse(data, env, request) {
  const resp = new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
  return handleCors(resp, env, request);
}

function errorResponse(message, status = 400, env, request) {
  const resp = new Response(JSON.stringify({ error: message, status }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
  return handleCors(resp, env, request);
}
