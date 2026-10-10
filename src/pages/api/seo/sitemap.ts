import type { APIRoute } from 'astro';
import { validateUrlSafety } from '../../../../seo/worker/ssrf-guard.js';

export const prerender = false;

export const get: APIRoute = async ({ request }) => {
	const reqUrl = new URL(request.url);
	const target = reqUrl.searchParams.get('url');

	if (!target) {
		return new Response(JSON.stringify({ error: 'Missing target "url" parameter.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		let u = target.trim();
		if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
		const parsed = new URL(u);
		const sitemapUrl = u.endsWith('.xml') ? u : `${parsed.protocol}//${parsed.host}/sitemap.xml`;

		const safety = validateUrlSafety(sitemapUrl);
		if (!safety.safe) {
			return new Response(JSON.stringify({ error: safety.error }), { status: 403, headers: { 'Content-Type': 'application/json' } });
		}

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 8000);
		const res = await fetch(sitemapUrl, { signal: controller.signal, headers: { 'User-Agent': 'InstaflowSeoBot/1.0' } });
		clearTimeout(timeout);

		const xml = res.ok ? await res.text() : '';
		return new Response(JSON.stringify({ url: sitemapUrl, xml, status: res.status }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: { 'Content-Type': 'application/json' } });
	}
};
