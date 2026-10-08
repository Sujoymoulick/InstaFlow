import type { APIRoute } from 'astro';
import { getSubmissionStats, listSubmissions } from '../../../../../projects/clickfornothing/services/submissions.js';
import { listAuditLogs } from '../../../../../projects/clickfornothing/services/audit.js';
import { probeAllCfnIntegrations } from '../../../../../projects/clickfornothing/services/integrations.js';
import { listClickForNothingUsers } from '../../../../../projects/clickfornothing/services/users.js';
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
		const [stats, recentResult, auditLogs, integrations, users] = await Promise.all([
			getSubmissionStats(),
			listSubmissions({ limit: 10, sort: 'newest' }),
			listAuditLogs(10),
			probeAllCfnIntegrations(),
			listClickForNothingUsers(),
		]);

		return new Response(
			JSON.stringify({
				success: true,
				stats: {
					...stats,
					totalUsers: users.length,
				},
				recentSubmissions: recentResult.submissions,
				auditLogs,
				integrations,
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
	} catch (e: any) {
		return new Response(
			JSON.stringify({
				success: false,
				error: e.message || 'Failed to sync realtime ClickForNothing data',
				timestamp: new Date().toISOString(),
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			},
		);
	}
};
