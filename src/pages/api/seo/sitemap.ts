import type { APIRoute } from 'astro';
import { validateUrlSafetyAsync } from '../../../../seo/worker/ssrf-guard.js';

export const prerender = false;

export const get: APIRoute = async ({ request }) => {
	const reqUrl = new URL(request.url);
	const target = reqUrl.searchParams.get('url');

	if (!target || !target.trim()) {
		return new Response(JSON.stringify({ error: 'Missing target "url" parameter.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
		});
	}

	try {
		let u = target.trim();
		if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
		const parsed = new URL(u);
		const sitemapUrl = u.endsWith('.xml') ? u : `${parsed.protocol}//${parsed.host}/sitemap.xml`;

		const safety = await validateUrlSafetyAsync(sitemapUrl);
		if (!safety.safe) {
			return new Response(JSON.stringify({ error: safety.error }), {
				status: 403,
				headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
			});
		}

		const controller = new AbortController();
		const timeout = setTimeout(() => {
			const err = new Error('Sitemap request timed out after 10000ms');
			err.name = 'TimeoutError';
			controller.abort(err);
		}, 10000);

		try {
			const res = await fetch(sitemapUrl, {
				signal: controller.signal,
				headers: {
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 (compatible; InstaFlow-SitemapBot/1.0)',
					'Accept': 'application/xml,text/xml,*/*',
				},
			});
			clearTimeout(timeout);

			const xml = res.ok ? await res.text() : '';
			return new Response(JSON.stringify({ url: sitemapUrl, xml, status: res.status }), {
				status: 200,
				headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
			});
		} finally {
			clearTimeout(timeout);
		}
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e.message || 'Failed to fetch sitemap.' }), {
			status: 502,
			headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
		});
	}
};
