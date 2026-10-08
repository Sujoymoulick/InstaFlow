import type { APIRoute } from 'astro';
import { verifyAdminSession } from '../../../../../lib/auth.js';
import { rejectSubmission } from '../../../../../projects/clickfornothing/services/submissions.js';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, cookies }) => {
	const session = verifyAdminSession(cookies, request);
	if (!session.authorized || !session.email) {
		return new Response(JSON.stringify({ error: 'Unauthorized: Admin authentication required.' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const id = params.id;
	if (!id) {
		return new Response(JSON.stringify({ error: 'Submission ID parameter is missing.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		let reason = 'Submission does not meet directory guidelines.';
		try {
			const body = await request.json();
			if (body.reason && typeof body.reason === 'string') {
				reason = body.reason.trim();
			}
		} catch {}

		const updated = await rejectSubmission(id, session.email, reason);
		return new Response(
			JSON.stringify({
				success: true,
				message: 'Submission rejected successfully.',
				submission: updated,
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			},
		);
	} catch (error: any) {
		console.error(`[API /admin/submissions/${id}/reject] Error:`, error);
		return new Response(JSON.stringify({ error: error.message || 'Failed to reject submission.' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
