import type { APIRoute } from 'astro';
import { probeCfnDatabases } from '../../../../../projects/clickfornothing/services/databases.js';
import { verifyAdminSession } from '../../../../../lib/auth.js';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
	const session = verifyAdminSession(cookies, request);
	if (!session.authorized) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const databases = await probeCfnDatabases();
		return new Response(JSON.stringify({ success: true, databases }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
			},
		});
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e.message || 'Failed to probe databases' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
