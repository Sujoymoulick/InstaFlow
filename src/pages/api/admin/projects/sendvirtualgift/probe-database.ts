import type { APIRoute } from 'astro';
import { getSvgDatabasesHealth } from '../../../../../projects/sendvirtualgift/services/databases.js';
import { verifyAdminSession } from '../../../../../lib/auth.js';

export const prerender = false;

export const get: APIRoute = async ({ request, cookies }) => {
	const session = verifyAdminSession(cookies, request);
	if (!session.authorized) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const databases = await getSvgDatabasesHealth();
		return new Response(JSON.stringify({ success: true, databases }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
