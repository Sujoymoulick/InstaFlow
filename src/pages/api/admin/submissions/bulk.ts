import type { APIRoute } from 'astro';
import { verifyAdminSession } from '../../../../lib/auth.js';
import {
	bulkApproveSubmissions,
	bulkRejectSubmissions,
	bulkPublishSubmissions,
	bulkDeleteSubmissions,
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
		const { action, ids, reason } = body;

		if (!Array.isArray(ids) || ids.length === 0) {
			return new Response(JSON.stringify({ error: 'Array of submission IDs is required.' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		if (action === 'approve') {
			const res = await bulkApproveSubmissions(ids, session.email);
			return new Response(
				JSON.stringify({
					success: true,
					message: `Successfully approved ${res.affectedCount} submission(s).`,
					affectedCount: res.affectedCount,
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			);
		} else if (action === 'reject') {
			const res = await bulkRejectSubmissions(ids, session.email, reason);
			return new Response(
				JSON.stringify({
					success: true,
					message: `Successfully rejected ${res.affectedCount} submission(s).`,
					affectedCount: res.affectedCount,
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			);
		} else if (action === 'publish') {
			const res = await bulkPublishSubmissions(ids, session.email);
			return new Response(
				JSON.stringify({
					success: true,
					message: `Successfully published ${res.affectedCount} submission(s).`,
					affectedCount: res.affectedCount,
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			);
		} else if (action === 'delete') {
			const res = await bulkDeleteSubmissions(ids, session.email);
			return new Response(
				JSON.stringify({
					success: true,
					message: `Successfully deleted ${res.affectedCount} submission(s).`,
					affectedCount: res.affectedCount,
				}),
				{ status: 200, headers: { 'Content-Type': 'application/json' } },
			);
		} else {
			return new Response(
				JSON.stringify({ error: 'Invalid action. Must be "approve", "reject", "publish", or "delete".' }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}
	} catch (error: any) {
		console.error('[API /admin/submissions/bulk] Error:', error);
		return new Response(JSON.stringify({ error: error.message || 'Bulk operation failed.' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

