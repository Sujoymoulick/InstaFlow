/**
 * Instaflow SEO Suite - Dedicated Cloudflare Worker Proxy
 *
 * Fully self-contained single-file worker for Cloudflare Workers Free Tier.
 * Features:
 * - Full SSRF protection against private IP ranges, loopbacks & cloud metadata
 * - Live URL HTML fetcher (/fetch?url=...)
 * - Robots.txt & AI Crawler rules fetcher (/robots?url=...)
 * - XML Sitemap fetcher (/sitemap?url=...)
 * - Google Autocomplete suggest proxy (/suggest?q=...)
 * - Health check endpoint (/health)
 * - Automatic CORS handling
 */

// ==========================================
// 1. SSRF SECURITY GUARD
// ==========================================
const BLOCKED_IPV4_RANGES = [
  '0.',        // 0.0.0.0/8
  '10.',       // 10.0.0.0/8
  '127.',      // 127.0.0.0/8 Loopback
  '169.254.',  // Link-local / Cloud metadata (AWS, GCP, Azure 169.254.169.254)
  '172.16.', '172.17.', '172.18.', '172.19.', '172.2', '172.3', // 172.16.0.0/12
  '192.168.',  // 192.168.0.0/16
  '100.64.',   // Shared address space
  '198.18.',   // Benchmarking
  '224.',      // Multicast
  '240.'       // Reserved
];

const ALLOWED_PORTS = new Set(['80', '443', '8080', '8443', '']);

function validateUrlSafety(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    return { safe: false, error: 'URL must be a valid non-empty string' };
  }

  let parsed;
  try {
    let u = urlString.trim();
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    parsed = new URL(u);
  } catch (e) {
    return { safe: false, error: 'Invalid URL syntax' };
  }

  // Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, error: `Disallowed protocol "${parsed.protocol}". Only HTTP and HTTPS are permitted.` };
  }

  // Port check
  if (!ALLOWED_PORTS.has(parsed.port)) {
    return { safe: false, error: `Disallowed port "${parsed.port}". Only standard ports (80, 443, 8080, 8443) are allowed.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost, link-local, internal hosts, and cloud metadata
  if (
    hostname === 'localhost' ||
    hostname === 'localhost.localdomain' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname === '169.254.169.254' ||
    hostname === 'metadata.google.internal' ||
    hostname === '[::1]' ||
    hostname === '0.0.0.0'
  ) {
    return { safe: false, error: `Access to private/internal host "${hostname}" is blocked.` };
  }

  // Block private IP prefixes
  for (const prefix of BLOCKED_IPV4_RANGES) {
    if (hostname.startsWith(prefix)) {
      return { safe: false, error: `Access to private IP space (${prefix}*) is blocked.` };
    }
  }

  return { safe: true, url: parsed };
}

// ==========================================
// 2. WORKER CONFIGURATION & CONSTANTS
// ==========================================
const USER_AGENT = 'Mozilla/5.0 (compatible; InstaflowSeoBot/1.0; +https://instaflow.io; SEO Audit)';
const MAX_BYTES = 4 * 1024 * 1024; // 4MB
const FETCH_TIMEOUT_MS = 10000;    // 10 seconds
const MAX_REDIRECTS = 5;

// ==========================================
// 3. MAIN CLOUDFLARE FETCH HANDLER
// ==========================================
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors(new Response(null, { status: 204 }), env, request);
    }

    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/' || url.pathname === '/health' || url.pathname === '/test') {
      return jsonResponse({
        status: 'ok',
        service: 'Instaflow SEO Suite Tier 2 Proxy Worker',
        runtime: 'Cloudflare Workers (Free Tier)',
        timestamp: Date.now(),
        endpoints: ['/fetch?url=...', '/robots?url=...', '/sitemap?url=...', '/suggest?q=...', '/health']
      }, env, request);
    }

    // 1. Live Page Fetcher Endpoint (/fetch?url=...)
    if (url.pathname === '/fetch') {
      const target = url.searchParams.get('url');
      if (!target) {
        return errorResponse('Missing "url" query parameter. Example: /fetch?url=https://example.com', 400, env, request);
      }

      const safety = validateUrlSafety(target);
      if (!safety.safe) {
        return errorResponse(`SSRF Security Block: ${safety.error}`, 403, env, request);
      }

      try {
        const startTime = Date.now();
        const fetchResult = await safeFetch(safety.url.toString(), { maxRedirects: MAX_REDIRECTS, timeoutMs: FETCH_TIMEOUT_MS });
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

    // 2. Robots.txt Fetcher (/robots?url=...)
    if (url.pathname === '/robots') {
      const target = url.searchParams.get('url');
      if (!target) return errorResponse('Missing "url" query parameter', 400, env, request);
      try {
        let u = target.trim();
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        const parsed = new URL(u);
        const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;

        const safety = validateUrlSafety(robotsUrl);
        if (!safety.safe) return errorResponse(safety.error, 403, env, request);

        const res = await safeFetch(robotsUrl, { maxRedirects: 2, timeoutMs: 6000 });
        return jsonResponse({ url: robotsUrl, content: res.html, status: res.status }, env, request);
      } catch (e) {
        return errorResponse(`Robots fetch error: ${e.message}`, 502, env, request);
      }
    }

    // 3. XML Sitemap Fetcher (/sitemap?url=...)
    if (url.pathname === '/sitemap') {
      const target = url.searchParams.get('url');
      if (!target) return errorResponse('Missing "url" query parameter', 400, env, request);
      try {
        let u = target.trim();
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        const parsed = new URL(u);
        const sitemapUrl = u.endsWith('.xml') ? u : `${parsed.protocol}//${parsed.host}/sitemap.xml`;

        const safety = validateUrlSafety(sitemapUrl);
        if (!safety.safe) return errorResponse(safety.error, 403, env, request);

        const res = await safeFetch(sitemapUrl, { maxRedirects: 3, timeoutMs: 8000 });
        return jsonResponse({ url: sitemapUrl, xml: res.html, status: res.status }, env, request);
      } catch (e) {
        return errorResponse(`Sitemap fetch error: ${e.message}`, 502, env, request);
      }
    }

    // 4. Google Suggestions Proxy (/suggest?q=...)
    if (url.pathname === '/suggest') {
      const q = url.searchParams.get('q');
      if (!q) return errorResponse('Missing "q" query parameter', 400, env, request);
      try {
        const suggestUrl = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`;
        const res = await fetch(suggestUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (res.ok) {
          const data = await res.json();
          return jsonResponse({ query: q, suggestions: Array.isArray(data[1]) ? data[1] : [] }, env, request);
        }
        return jsonResponse({ query: q, suggestions: [] }, env, request);
      } catch (e) {
        return jsonResponse({ query: q, suggestions: [], error: e.message }, env, request);
      }
    }

    return errorResponse('Endpoint not found. Use /health, /fetch, /robots, /sitemap, or /suggest', 404, env, request);
  }
};

// ==========================================
// 4. SAFE FETCH & REDIRECT INSPECTOR
// ==========================================
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
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res;
    try {
      res = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual', // Manually check every redirect hop for SSRF
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br'
        }
      });
    } finally {
      clearTimeout(timer);
    }

    const isRedirect = [301, 302, 303, 307, 308].includes(res.status);
    const location = res.headers.get('location');

    if (isRedirect && location) {
      const nextUrl = new URL(location, currentUrl).toString();
      redirectChain.push({ from: currentUrl, to: nextUrl, status: res.status });
      currentUrl = nextUrl;
      redirectsRemaining--;
      if (redirectsRemaining < 0) {
        throw new Error('Maximum redirect limit exceeded (5 hops)');
      }
      continue;
    }

    // Stream response body with size limit
    const reader = res.body.getReader();
    let received = 0;
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > MAX_BYTES) {
        throw new Error(`Response payload exceeded size limit of 4MB (${(received / 1024 / 1024).toFixed(1)}MB)`);
      }
      chunks.push(value);
    }

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
  }
}

// ==========================================
// 5. CORS & RESPONSE HELPERS
// ==========================================
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
  const resp = new Response(JSON.stringify(data, null, 2), {
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
