import type { APIRoute } from 'astro';
import { verifyAdminSession } from '../../../../../lib/auth.js';
import {
	getSubmissionById,
	approveSubmission,
	publishSubmission,
	rejectSubmission,
	deleteSubmission,
} from '../../../../../projects/clickfornothing/services/submissions.js';

export const prerender = false;

export const GET: APIRoute = async ({ params, request, cookies }) => {
	const session = verifyAdminSession(cookies, request);
	if (!session.authorized) {
		return new Response(JSON.stringify({ error: 'Unauthorized: Admin authentication required.' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const id = params.id;
	if (!id) {
		return new Response(JSON.stringify({ error: 'Submission ID is required.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const submission = await getSubmissionById(id);
		if (!submission) {
			return new Response(JSON.stringify({ error: `Submission with ID "${id}" was not found.` }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		return new Response(JSON.stringify({ success: true, submission }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		console.error(`[API /admin/submissions/${id}] Error:`, error);
		return new Response(JSON.stringify({ error: error.message || 'Internal server error.' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

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
		return new Response(JSON.stringify({ error: 'Submission ID is required.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		let body: any = {};
		try {
			body = await request.json();
		} catch {}

		const action = String(body.action || new URL(request.url).searchParams.get('action') || '').toLowerCase().trim();
		const reason = body.reason || body.rejectionReason || 'Submission does not meet quality requirements.';

		if (action === 'approve') {
			const updated = await approveSubmission(id, session.email);
			return new Response(JSON.stringify({ success: true, message: 'Submission approved.', submission: updated }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		} else if (action === 'publish') {
			const updated = await publishSubmission(id, session.email);
			return new Response(JSON.stringify({ success: true, message: 'Submission published live.', submission: updated }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		} else if (action === 'reject') {
			const updated = await rejectSubmission(id, session.email, reason);
			return new Response(JSON.stringify({ success: true, message: 'Submission rejected.', submission: updated }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		} else if (action === 'delete') {
			const result = await deleteSubmission(id, session.email);
			return new Response(JSON.stringify({ success: true, message: 'Submission deleted.', id: result.id }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		} else {
			return new Response(JSON.stringify({ error: 'Invalid action. Must be "approve", "publish", "reject", or "delete".' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	} catch (error: any) {
		console.error(`[API /admin/submissions/${id} POST] Error:`, error);
		return new Response(JSON.stringify({ error: error.message || 'Action failed.' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const PUT = POST;
export const PATCH = POST;

export const DELETE: APIRoute = async ({ params, request, cookies }) => {
	const session = verifyAdminSession(cookies, request);
	if (!session.authorized || !session.email) {
		return new Response(JSON.stringify({ error: 'Unauthorized: Admin authentication required.' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const id = params.id;
	if (!id) {
		return new Response(JSON.stringify({ error: 'Submission ID is required.' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const result = await deleteSubmission(id, session.email);
		return new Response(
			JSON.stringify({
				success: true,
				message: 'Submission deleted successfully.',
				id: result.id,
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			},
		);
	} catch (error: any) {
		console.error(`[API /admin/submissions/${id} DELETE] Error:`, error);
		return new Response(JSON.stringify({ error: error.message || 'Failed to delete submission.' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
