import type { APIRoute } from 'astro';

export const prerender = false;

export const get: APIRoute = async ({ request }) => {
	const reqUrl = new URL(request.url);
	const query = reqUrl.searchParams.get('q');

	if (!query) {
		return new Response(JSON.stringify({ error: 'Missing search query "q".' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const target = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
		const res = await fetch(target, {
			headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
		});

		if (res.ok) {
			const data = await res.json();
			const suggestions = Array.isArray(data[1]) ? data[1] : [];
			return new Response(JSON.stringify({ query, suggestions }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		return new Response(JSON.stringify({ query, suggestions: [] }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (e: any) {
		return new Response(JSON.stringify({ query, suggestions: [], error: e.message }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
