import type { APIRoute } from 'astro';
import { fetchInstagramConversations } from '../../../services/instagram.js';
import { isAuthorizedAdmin } from '../../../lib/auth.js';
import { getDb, schema } from '../../../db/index.js';
import { desc } from 'drizzle-orm';

export const prerender = false;

export const get: APIRoute = async ({ request, cookies, url }) => {
	if (!isAuthorizedAdmin(request, cookies)) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const refresh = url.searchParams.get('refresh') === 'true';
	const limit = parseInt(url.searchParams.get('limit') || '20', 10);

	try {
		if (refresh) {
			const apiResult = await fetchInstagramConversations(isNaN(limit) ? 20 : limit);
			return new Response(JSON.stringify(apiResult), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// First try fetching cached conversations from local DB
		const db = getDb();
		if (db) {
			const localConvos = await db
				.select()
				.from(schema.conversations)
				.orderBy(desc(schema.conversations.lastMessageAt))
				.limit(isNaN(limit) ? 20 : limit);

			if (localConvos.length > 0) {
				return new Response(JSON.stringify({ success: true, conversations: localConvos }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		// Fall back to live Meta Graph API fetch
		const apiResult = await fetchInstagramConversations(isNaN(limit) ? 20 : limit);
		return new Response(JSON.stringify(apiResult), {
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

export const GET = get;
