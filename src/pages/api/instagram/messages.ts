import type { APIRoute } from 'astro';
import { fetchConversationMessages, sendInstagramMessage } from '../../../services/instagram.js';
import { isAuthorizedAdmin } from '../../../lib/auth.js';
import { getDb, schema } from '../../../db/index.js';

export const prerender = false;

export const get: APIRoute = async ({ request, cookies, url }) => {
	if (!isAuthorizedAdmin(request, cookies)) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const conversationId = url.searchParams.get('conversationId');
	if (!conversationId) {
		return new Response(JSON.stringify({ success: false, error: 'conversationId parameter is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const limit = parseInt(url.searchParams.get('limit') || '50', 10);

	try {
		const result = await fetchConversationMessages(conversationId, isNaN(limit) ? 50 : limit);
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

export const post: APIRoute = async ({ request, cookies }) => {
	if (!isAuthorizedAdmin(request, cookies)) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const body = await request.json();
		const { recipientId, text, url } = body;

		if (!recipientId || !text) {
			return new Response(JSON.stringify({ success: false, error: 'recipientId and text are required.' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const result = await sendInstagramMessage(recipientId, text, url);

		if (result.success) {
			// Log sent message
			const db = getDb();
			if (db) {
				await db.insert(schema.messageLogs).values({
					triggerType: 'direct_inbox_reply',
					ruleName: 'Manual Dashboard Reply',
					senderId: 'admin_dashboard',
					recipientId,
					sentReplyText: text,
					sentReplyUrl: url || null,
					status: 'sent',
				});
			}

			return new Response(JSON.stringify({ success: true, messageId: result.messageId }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		} else {
			return new Response(JSON.stringify({ success: false, error: result.error }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	} catch (error: any) {
		return new Response(JSON.stringify({ success: false, error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const GET = get;
export const POST = post;
