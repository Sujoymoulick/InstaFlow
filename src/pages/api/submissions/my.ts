import type { APIRoute } from 'astro';
import { listSubmissions } from '../../../projects/clickfornothing/services/submissions.js';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
	try {
		const url = new URL(request.url);
		let userId = request.headers.get('x-user-id') || url.searchParams.get('userId');

		if (!userId) {
			return new Response(JSON.stringify({ error: 'Missing user identification.' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const result = await listSubmissions({ limit: 100 });
		const userSubmissions = result.submissions.filter((s) => s.userId === userId);

		return new Response(
			JSON.stringify({
				success: true,
				submissions: userSubmissions,
				total: userSubmissions.length,
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			},
		);
	} catch (error: any) {
		console.error('[API /api/submissions/my] Error:', error);
		return new Response(JSON.stringify({ error: error.message || 'Internal error.' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
