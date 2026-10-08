import type { APIRoute } from 'astro';
import { verifyAdminSession } from '../../../../lib/auth.js';
import { approveSubmission } from '../../../../projects/clickfornothing/services/submissions.js';

export const prerender = false;

export const post: APIRoute = async ({ request, cookies, url }) => {
	const session = verifyAdminSession(cookies, request);
	if (!session.authorized || !session.email) {
		return new Response(JSON.stringify({ error: 'Unauthorized: Admin authentication required.' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		let id = url.searchParams.get('id');
		try {
			const body = await request.json();
			if (body?.id) id = String(body.id);
		} catch {}

		if (!id) {
			return new Response(JSON.stringify({ error: 'Submission ID is required.' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const updated = await approveSubmission(id, session.email);
		return new Response(
			JSON.stringify({
				success: true,
				message: 'Submission approved successfully.',
				submission: updated,
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			},
		);
	} catch (error: any) {
		console.error('[API /admin/submissions/approve] Error:', error);
		return new Response(JSON.stringify({ error: error.message || 'Failed to approve submission.' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const put = post;
export const patch = post;
