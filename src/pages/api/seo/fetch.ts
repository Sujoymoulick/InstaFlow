import type { APIRoute } from 'astro';
import https from 'node:https';
import http from 'node:http';
import { validateUrlSafety } from '../../../../seo/worker/ssrf-guard.js';

export const prerender = false;

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const TIMEOUT_MS = 10000;          // 10s

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

function fetchViaNodeHttp(targetUrl: string, maxRedirects = 5): Promise<{
	status: number;
	statusText: string;
	headers: Record<string, string>;
	html: string;
	finalUrl: string;
	timingMs: number;
	byteSize: number;
}> {
	return new Promise((resolve, reject) => {
		const startTime = Date.now();
		let urlObj: URL;
		try {
			urlObj = new URL(targetUrl);
		} catch (e: any) {
			return reject(new Error('Invalid URL format'));
		}

		const isHttps = urlObj.protocol === 'https:';
		const client = isHttps ? https : http;

		const options: https.RequestOptions = {
			hostname: urlObj.hostname,
			port: urlObj.port || (isHttps ? 443 : 80),
			path: (urlObj.pathname || '/') + urlObj.search,
			method: 'GET',
			headers: {
				'User-Agent': USER_AGENT,
				'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9',
				'Connection': 'close',
			},
			timeout: TIMEOUT_MS,
			rejectUnauthorized: false,
		};

		const req = client.request(options, (res) => {
			const statusCode = res.statusCode || 200;

			// Handle redirect hops
			if ([301, 302, 303, 307, 308].includes(statusCode) && res.headers.location && maxRedirects > 0) {
				try {
					const nextUrl = new URL(res.headers.location, targetUrl).toString();
					const nextSafety = validateUrlSafety(nextUrl);
					if (!nextSafety.safe) {
						return reject(new Error(`SSRF Block on redirect: ${nextSafety.error}`));
					}
					return resolve(fetchViaNodeHttp(nextUrl, maxRedirects - 1));
				} catch {
					// Fall through to parse body
				}
			}

			const headersObj: Record<string, string> = {};
			for (const [k, v] of Object.entries(res.headers)) {
				if (v !== undefined) {
					headersObj[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
				}
			}

			let receivedBytes = 0;
			let bodyData = '';
			res.setEncoding('utf-8');

			res.on('data', (chunk: string) => {
				receivedBytes += Buffer.byteLength(chunk);
				if (receivedBytes <= MAX_BYTES) {
					bodyData += chunk;
				}
			});

			res.on('end', () => {
				resolve({
					status: statusCode,
					statusText: res.statusMessage || 'OK',
					headers: headersObj,
					html: bodyData,
					finalUrl: urlObj.toString(),
					timingMs: Date.now() - startTime,
					byteSize: receivedBytes,
				});
			});

			res.on('error', (err) => {
				reject(err);
			});
		});

		req.on('timeout', () => {
			req.destroy(new Error(`Request timeout after ${TIMEOUT_MS}ms`));
		});

		req.on('error', (err) => {
			reject(err);
		});

		req.end();
	});
}

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
		const result = await fetchViaNodeHttp(urlToFetch);

		return new Response(
			JSON.stringify({
				url: urlToFetch,
				finalUrl: result.finalUrl,
				status: result.status,
				statusText: result.statusText,
				headers: result.headers,
				html: result.html,
				timingMs: result.timingMs,
				byteSize: result.byteSize,
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Access-Control-Allow-Origin': '*',
				},
			},
		);
	} catch (nodeHttpErr: any) {
		// Fallback to fetch API if native client encounters transport issue
		try {
			const startTime = Date.now();
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 6000);

			const response = await fetch(urlToFetch, {
				method: 'GET',
				signal: controller.signal,
				headers: {
					'User-Agent': USER_AGENT,
					'Accept': 'text/html,application/xhtml+xml',
				},
			});

			clearTimeout(timeoutId);
			const html = await response.text();

			return new Response(
				JSON.stringify({
					url: urlToFetch,
					finalUrl: response.url || urlToFetch,
					status: response.status,
					statusText: response.statusText,
					headers: {},
					html,
					timingMs: Date.now() - startTime,
					byteSize: html.length,
				}),
				{
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		} catch (fetchFallbackErr: any) {
			return new Response(
				JSON.stringify({
					error: `Failed to fetch website "${urlToFetch}": ${nodeHttpErr.message}`,
					targetUrl,
				}),
				{
					status: 502,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}
	}
}
