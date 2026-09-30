import type { APIRoute } from 'astro';
import { getInstagramMediaList, syncInstagramMedia } from '../../../services/instagram.js';
import { isAuthorizedAdmin } from '../../../lib/auth.js';

export const prerender = false;

export const get: APIRoute = async ({ url, request, cookies }) => {
	if (!isAuthorizedAdmin(request, cookies)) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const typeParam = url.searchParams.get('type') as 'all' | 'posts' | 'reels' | null;
	const limitParam = parseInt(url.searchParams.get('limit') || '50', 10);
	const offsetParam = parseInt(url.searchParams.get('offset') || '0', 10);

	try {
		const result = await getInstagramMediaList({
			type: typeParam || 'all',
			limit: isNaN(limitParam) ? 50 : limitParam,
			offset: isNaN(offsetParam) ? 0 : offsetParam,
		});

		return new Response(JSON.stringify({ success: true, media: result.media, total: result.total }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		return new Response(JSON.stringify({ success: false, error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const post: APIRoute = async ({ request, cookies }) => {
	if (!isAuthorizedAdmin(request, cookies)) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const body = await request.json().catch(() => ({}));
		const syncResult = await syncInstagramMedia(body.accountId, body.limit || 50);

		if (!syncResult.success) {
			return new Response(JSON.stringify({ success: false, error: syncResult.error }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		return new Response(
			JSON.stringify({
				success: true,
				count: syncResult.count,
				message: `Synchronized ${syncResult.count} Instagram posts & reels from Meta.`,
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			},
		);
	} catch (error: any) {
		return new Response(JSON.stringify({ success: false, error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const GET = get;
export const POST = post;
