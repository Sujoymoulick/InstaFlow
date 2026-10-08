import type { APIRoute } from 'astro';
import { verifyAdminSession } from '../../../../../lib/auth.js';
import { deleteSubmission } from '../../../../../projects/clickfornothing/services/submissions.js';

export const prerender = false;

const handleDelete: APIRoute = async ({ params, request, cookies }) => {
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
				message: 'Submission permanently deleted.',
				id: result.id,
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			},
		);
	} catch (error: any) {
		console.error(`[API /admin/submissions/${id}/delete] Error:`, error);
		return new Response(JSON.stringify({ error: error.message || 'Failed to delete submission.' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const POST = handleDelete;
export const DELETE = handleDelete;
