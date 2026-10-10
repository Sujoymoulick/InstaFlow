import type { APIRoute } from 'astro';
import { validateUrlSafetyAsync } from '../../../../seo/worker/ssrf-guard.js';

export const prerender = false;

export const get: APIRoute = async ({ request }) => {
	const reqUrl = new URL(request.url);
	const target = reqUrl.searchParams.get('url');

	if (!target || !target.trim()) {
		return new Response(JSON.stringify({ error: 'Missing target "url" query parameter.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
		});
	}

	try {
		let u = target.trim();
		if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
		const parsed = new URL(u);
		const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;

		const safety = await validateUrlSafetyAsync(robotsUrl);
		if (!safety.safe) {
			return new Response(JSON.stringify({ error: safety.error }), {
				status: 403,
				headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
			});
		}

		const controller = new AbortController();
		const timeout = setTimeout(() => {
			const err = new Error('Robots.txt request timed out after 8000ms');
			err.name = 'TimeoutError';
			controller.abort(err);
		}, 8000);

		try {
			const res = await fetch(robotsUrl, {
				signal: controller.signal,
				headers: {
					'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 (compatible; InstaFlow-RobotsBot/1.0)',
					'Accept': 'text/plain,text/html,*/*',
				},
			});
			clearTimeout(timeout);

			const content = res.ok ? await res.text() : '';
			return new Response(JSON.stringify({ url: robotsUrl, content, status: res.status }), {
				status: 200,
				headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
			});
		} finally {
			clearTimeout(timeout);
		}
	} catch (e: any) {
		// Non-fatal for robots.txt: return empty content rather than breaking the entire audit
		return new Response(
			JSON.stringify({
				url: target,
				content: '',
				status: 0,
				warning: `Robots.txt could not be retrieved: ${e.message}`,
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
			},
		);
	}
};
