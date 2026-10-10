/**
 * Instaflow SEO Suite - Vercel Serverless Function Proxy (Tier 2)
 *
 * Deployable as a Vercel Serverless Function at /api/seo/proxy
 */

import { fetchUrlServer } from '../lib/seo/server-fetcher.js';

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

  try {
    let targetUrl = url;
    if (action === 'robots') {
      const u = new URL(url.startsWith('http') ? url : 'https://' + url);
      targetUrl = `${u.protocol}//${u.host}/robots.txt`;
    } else if (action === 'sitemap') {
      const u = new URL(url.startsWith('http') ? url : 'https://' + url);
      targetUrl = url.endsWith('.xml') ? url : `${u.protocol}//${u.host}/sitemap.xml`;
    }

    const fetchResult = await fetchUrlServer(targetUrl, {
      timeoutMs: 15000
    });

    return res.status(200).json({
      url,
      finalUrl: fetchResult.finalUrl,
      status: fetchResult.status,
      statusText: fetchResult.statusText,
      headers: fetchResult.headers,
      html: fetchResult.html,
      timingMs: fetchResult.timingMs,
      byteSize: fetchResult.byteSize,
      redirectChain: fetchResult.redirectChain,
      isTruncated: fetchResult.isTruncated
    });
  } catch (err) {
    const statusCode = err.status || (err.name === 'SSRFError' ? 403 : 502);
    return res.status(statusCode).json({ error: `Fetch error: ${err.message}` });
  }
}
