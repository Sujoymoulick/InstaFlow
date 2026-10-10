/**
 * Instaflow SEO Suite - Vercel Serverless Function Proxy (Tier 2)
 *
 * Deployable as a Vercel Serverless / Edge Function at /api/seo/proxy
 */

import { validateUrlSafety } from './ssrf-guard.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { url, action = 'fetch' } = req.query;

  if (action === 'health' || action === 'test') {
    return res.status(200).json({ status: 'ok', runtime: 'Vercel Serverless Function', timestamp: Date.now() });
  }

  if (!url) {
    return res.status(400).json({ error: 'Missing required "url" parameter' });
  }

  const safety = validateUrlSafety(url);
  if (!safety.safe) {
    return res.status(403).json({ error: `SSRF Security Block: ${safety.error}` });
  }

  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let targetUrl = url;
    if (action === 'robots') {
      const u = new URL(url);
      targetUrl = `${u.protocol}//${u.host}/robots.txt`;
    } else if (action === 'sitemap') {
      const u = new URL(url);
      targetUrl = url.endsWith('.xml') ? url : `${u.protocol}//${u.host}/sitemap.xml`;
    }

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'InstaflowSeoBot/1.0 (+https://instaflow.io/bot; SEO Audit & Health Checker)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    clearTimeout(timeout);
    const html = await response.text();
    const timingMs = Date.now() - startTime;

    const headers = {};
    for (const [k, v] of response.headers.entries()) {
      headers[k.toLowerCase()] = v;
    }

    return res.status(200).json({
      url,
      finalUrl: response.url || targetUrl,
      status: response.status,
      statusText: response.statusText,
      headers,
      html,
      timingMs,
      byteSize: new TextEncoder().encode(html).length
    });
  } catch (err) {
    return res.status(502).json({ error: `Fetch error: ${err.message}` });
  }
}
