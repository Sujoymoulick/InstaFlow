import type { APIRoute } from 'astro';
import { verifyAdminSession } from '../../../../../lib/auth.js';
import { getSubmissionById, deleteSubmission } from '../../../../../projects/clickfornothing/services/submissions.js';

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

