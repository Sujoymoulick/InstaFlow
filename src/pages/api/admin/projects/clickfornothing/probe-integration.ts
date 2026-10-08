import type { APIRoute } from 'astro';
import { probeAllCfnIntegrations } from '../../../../../projects/clickfornothing/services/integrations.js';
import { verifyAdminSession } from '../../../../../lib/auth.js';

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies }) => {
	const session = verifyAdminSession(cookies, request);
	if (!session.authorized) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const integrations = await probeAllCfnIntegrations();
		return new Response(JSON.stringify({ success: true, integrations }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
			},
		});
	} catch (e: any) {
		return new Response(JSON.stringify({ error: e.message || 'Failed to probe integrations' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
