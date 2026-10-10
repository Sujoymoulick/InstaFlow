import type { APIRoute } from 'astro';
import { fetchUrlServer } from '../../../../seo/lib/seo/server-fetcher.js';

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

	return handleFetch(target.trim());
};

export const post: APIRoute = async ({ request }) => {
	try {
		const body = await request.json();
		if (!body.url || !body.url.trim()) {
			return new Response(JSON.stringify({ error: 'Missing "url" in request body.' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
			});
		}
		return handleFetch(body.url.trim());
	} catch (e: any) {
		return new Response(JSON.stringify({ error: 'Invalid JSON payload.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
		});
	}
};

export const options: APIRoute = async () => {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	});
};

async function handleFetch(targetUrl: string) {
	try {
		const result = await fetchUrlServer(targetUrl, {
			timeoutMs: 15000,
		});

		return new Response(
			JSON.stringify({
				url: result.url,
				finalUrl: result.finalUrl,
				status: result.status,
				statusText: result.statusText,
				headers: result.headers,
				html: result.html,
				timingMs: result.timingMs,
				byteSize: result.byteSize,
				redirectChain: result.redirectChain,
				isTruncated: result.isTruncated,
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			},
		);
	} catch (err: any) {
		const statusCode = err.status && Number.isInteger(err.status) ? err.status : err.name === 'SSRFError' ? 403 : 502;

		return new Response(
			JSON.stringify({
				error: err.message || `Failed to fetch website "${targetUrl}"`,
				status: statusCode,
				targetUrl,
				html: err.html || undefined,
				headers: err.headers || undefined,
			}),
			{
				status: statusCode,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			},
		);
	}
}
