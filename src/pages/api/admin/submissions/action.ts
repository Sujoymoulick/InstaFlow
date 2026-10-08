import type { APIRoute } from 'astro';
import { verifyAdminSession } from '../../../../lib/auth.js';
import {
	approveSubmission,
	publishSubmission,
	rejectSubmission,
	deleteSubmission,
	getSubmissionById,
} from '../../../../projects/clickfornothing/services/submissions.js';

export const prerender = false;

export const post: APIRoute = async ({ request, cookies }) => {
	const session = verifyAdminSession(cookies, request);
	if (!session.authorized || !session.email) {
		return new Response(JSON.stringify({ error: 'Unauthorized: Admin authentication required.' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const body = await request.json();
		const { id, action, reason } = body;

		if (!id) {
			return new Response(JSON.stringify({ error: 'Submission ID is required.' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const cleanAction = String(action || '').toLowerCase().trim();

		if (cleanAction === 'approve' || cleanAction === 'approved') {
			const updated = await approveSubmission(id, session.email);
			return new Response(
				JSON.stringify({
					success: true,
					message: 'Submission approved successfully.',
					submission: updated,
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			);
		} else if (cleanAction === 'publish' || cleanAction === 'published') {
			const updated = await publishSubmission(id, session.email);
			return new Response(
				JSON.stringify({
					success: true,
					message: 'Submission published live successfully.',
					submission: updated,
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			);
		} else if (cleanAction === 'reject' || cleanAction === 'rejected' || cleanAction === 'unpublish' || cleanAction === 'unpublished') {
			const cleanReason = (reason && typeof reason === 'string') ? reason.trim() : 'Submission does not meet quality requirements.';
			const updated = await rejectSubmission(id, session.email, cleanReason);
			return new Response(
				JSON.stringify({
					success: true,
					message: 'Submission rejected successfully.',
					submission: updated,
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			);
		} else if (cleanAction === 'delete' || cleanAction === 'deleted') {
			const result = await deleteSubmission(id, session.email);
			return new Response(
				JSON.stringify({
					success: true,
					message: 'Submission deleted permanently.',
					id: result.id,
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			);
		} else {
			return new Response(
				JSON.stringify({ error: 'Invalid action. Must be "approve", "publish", "reject", "unpublish", or "delete".' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } },
			);
		}
	} catch (error: any) {
		console.error('[API /admin/submissions/action] Error:', error);
		return new Response(JSON.stringify({ error: error.message || 'Action execution failed.' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
