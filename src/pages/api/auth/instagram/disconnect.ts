import type { APIRoute } from 'astro';
import { isAuthorizedAdmin } from '../../../../lib/auth.js';
import { disconnectInstagramAccount } from '../../../../services/instagram.js';

export const prerender = false;

export const post: APIRoute = async ({ request, cookies }) => {
	if (!isAuthorizedAdmin(request, cookies)) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const body = await request.json();
		const { accountId } = body;

		if (!accountId) {
			return new Response(JSON.stringify({ error: 'Account ID required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const success = await disconnectInstagramAccount(accountId);
		return new Response(JSON.stringify({ success }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const POST = post;
