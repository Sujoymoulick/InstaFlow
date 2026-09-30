import type { APIRoute } from 'astro';
import { verifyAdminSession } from '../../../lib/auth.js';
import { fetchClerkData, getClerkApps } from '../../../services/clerk.js';

export const prerender = false;

export const get: APIRoute = async ({ request, cookies }) => {
	const session = verifyAdminSession(cookies, request);
	if (!session) {
		return new Response(JSON.stringify({ error: 'Unauthorized. Administrator access required.' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const url = new URL(request.url);
		const appId = url.searchParams.get('appId') || '';
		const query = url.searchParams.get('query') || '';

		const apps = await getClerkApps();
		const selectedApp = appId ? apps.find((a) => a.id === appId) : (apps.find((a) => a.isDefault) || apps[0]);

		if (!selectedApp || !selectedApp.secretKey) {
			return new Response(JSON.stringify({ error: 'No configured Clerk application found.' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const data = await fetchClerkData(selectedApp.secretKey, { query });

		return new Response(
			JSON.stringify({
				success: true,
				app: {
					id: selectedApp.id,
					name: selectedApp.name,
					publishableKey: selectedApp.publishableKey,
					instanceUrl: selectedApp.instanceUrl,
					projectSlug: selectedApp.projectSlug,
				},
				...data,
			}),
			{
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			},
		);
	} catch (err: any) {
		console.error('[API /api/clerk/users] Error:', err);
		return new Response(JSON.stringify({ error: err.message || 'Failed to fetch Clerk users.' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const GET = get;
