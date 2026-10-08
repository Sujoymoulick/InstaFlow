import type { APIRoute } from 'astro';
import { verifyAdminSession } from '../../../../lib/auth.js';
import { getSubmissionStats } from '../../../../projects/clickfornothing/services/submissions.js';

export const prerender = false;

export const get: APIRoute = async ({ request, cookies }) => {
	const session = verifyAdminSession(cookies, request);
	if (!session.authorized) {
		return new Response(JSON.stringify({ error: 'Unauthorized: Admin authentication required.' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const stats = await getSubmissionStats();
		return new Response(
			JSON.stringify({
				success: true,
				stats,
				timestamp: new Date().toISOString(),
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-store, no-cache, must-revalidate',
				},
			},
		);
	} catch (error: any) {
		console.error('[API /admin/submissions/stats] Error:', error);
		return new Response(JSON.stringify({ error: error.message || 'Failed to fetch statistics.' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
