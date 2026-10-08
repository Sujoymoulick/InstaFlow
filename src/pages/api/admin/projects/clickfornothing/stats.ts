import type { APIRoute } from 'astro';
import { getSubmissionStats } from '../../../../../projects/clickfornothing/services/submissions.js';
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
		const stats = await getSubmissionStats();
		return new Response(JSON.stringify({ success: true, stats }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
			},
		});
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e.message || 'Failed to fetch submission stats' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
