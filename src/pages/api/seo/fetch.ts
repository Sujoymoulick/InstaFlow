import type { APIRoute } from 'astro';
import { validateUrlSafety } from '../../../../seo/worker/ssrf-guard.js';

export const prerender = false;

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const TIMEOUT_MS = 8000;           // 8s

export const get: APIRoute = async ({ request }) => {
	const reqUrl = new URL(request.url);
	const target = reqUrl.searchParams.get('url');

	if (!target) {
		return new Response(JSON.stringify({ error: 'Missing target "url" query parameter.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	return handleFetch(target);
};

export const post: APIRoute = async ({ request }) => {
	try {
		const body = await request.json();
		if (!body.url) {
			return new Response(JSON.stringify({ error: 'Missing "url" in request body.' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
		return handleFetch(body.url);
	} catch (e: any) {
		return new Response(JSON.stringify({ error: 'Invalid JSON payload.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

async function handleFetch(targetUrl: string) {
	let urlToFetch = targetUrl.trim();
	if (!/^https?:\/\//i.test(urlToFetch)) {
		urlToFetch = 'https://' + urlToFetch;
	}

	const safety = validateUrlSafety(urlToFetch);
	if (!safety.safe) {
		return new Response(JSON.stringify({ error: `Security block: ${safety.error}` }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const startTime = Date.now();
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

		const response = await fetch(urlToFetch, {
			method: 'GET',
			signal: controller.signal,
			redirect: 'follow',
			headers: {
				'User-Agent': USER_AGENT,
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9',
			},
		});

		clearTimeout(timeoutId);

		const html = await response.text();
		const timingMs = Date.now() - startTime;
		const byteSize = new TextEncoder().encode(html).length;

		const headersObj: Record<string, string> = {};
		for (const [k, v] of response.headers.entries()) {
			headersObj[k.toLowerCase()] = v;
		}

		return new Response(
			JSON.stringify({
				url: urlToFetch,
				finalUrl: response.url || urlToFetch,
				status: response.status,
				statusText: response.statusText,
				headers: headersObj,
				html,
				timingMs,
				byteSize,
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			},
		);
	} catch (err: any) {
		return new Response(
			JSON.stringify({
				error: `Failed to fetch URL: ${err.message}`,
				targetUrl,
			}),
			{
				status: 502,
				headers: { 'Content-Type': 'application/json' },
			},
		);
	}
}
