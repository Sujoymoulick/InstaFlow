import type { APIRoute } from 'astro';
import { validateUrlSafety } from '../../../../seo/worker/ssrf-guard.js';

export const prerender = false;

export const get: APIRoute = async ({ request }) => {
	const reqUrl = new URL(request.url);
	const target = reqUrl.searchParams.get('url');

	if (!target) {
		return new Response(JSON.stringify({ error: 'Missing target "url" query parameter.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		let u = target.trim();
		if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
		const parsed = new URL(u);
		const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;

		const safety = validateUrlSafety(robotsUrl);
		if (!safety.safe) {
			return new Response(JSON.stringify({ error: safety.error }), { status: 403, headers: { 'Content-Type': 'application/json' } });
		}

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 4000);
		const res = await fetch(robotsUrl, {
			signal: controller.signal,
			headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' },
		});
		clearTimeout(timeout);

		const content = res.ok ? await res.text() : '';
		return new Response(JSON.stringify({ url: robotsUrl, content, status: res.status }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: { 'Content-Type': 'application/json' } });
	}
};
