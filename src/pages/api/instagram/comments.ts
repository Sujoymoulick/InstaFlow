import type { APIRoute } from 'astro';
import { fetchInstagramComments } from '../../../services/instagram.js';
import { isAuthorizedAdmin } from '../../../lib/auth.js';

export const prerender = false;

export const get: APIRoute = async ({ url, request, cookies }) => {
	if (!isAuthorizedAdmin(request, cookies)) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const mediaId = url.searchParams.get('mediaId');
	if (!mediaId) {
		return new Response(JSON.stringify({ success: false, error: 'mediaId parameter is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const limit = parseInt(url.searchParams.get('limit') || '25', 10);

	try {
		const result = await fetchInstagramComments(mediaId, isNaN(limit) ? 25 : limit);
		return new Response(JSON.stringify(result), {
			status: result.success ? 200 : 400,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		return new Response(JSON.stringify({ success: false, error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const GET = get;
