import type { APIRoute } from 'astro';
import { verifyAdminSession } from '../../../lib/auth.js';
import { addClerkApp, deleteClerkApp, getClerkApps } from '../../../services/clerk.js';

export const prerender = false;

export const get: APIRoute = async ({ request, cookies }) => {
	const session = verifyAdminSession(cookies, request);
	if (!session) {
		return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const apps = await getClerkApps();
		const sanitized = apps.map((a) => ({
			id: a.id,
			name: a.name,
			publishableKey: a.publishableKey,
			instanceUrl: a.instanceUrl,
			projectSlug: a.projectSlug,
			isDefault: a.isDefault,
			createdAt: a.createdAt,
		}));

		return new Response(JSON.stringify({ success: true, apps: sanitized }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err: any) {
		return new Response(JSON.stringify({ error: err.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const post: APIRoute = async ({ request, cookies }) => {
	const session = verifyAdminSession(cookies, request);
	if (!session) {
		return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const body = await request.json();
		const { name, publishableKey, secretKey, instanceUrl, projectSlug, isDefault } = body;

		if (!name || !publishableKey || !secretKey) {
			return new Response(JSON.stringify({ error: 'Name, Publishable Key, and Secret Key are required.' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		if (!secretKey.startsWith('sk_')) {
			return new Response(JSON.stringify({ error: 'Secret Key must start with sk_...' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const created = await addClerkApp({
			name,
			publishableKey,
			secretKey,
			instanceUrl,
			projectSlug,
			isDefault,
		});

		return new Response(JSON.stringify({ success: true, app: created }), {
			status: 201,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err: any) {
		return new Response(JSON.stringify({ error: err.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const del: APIRoute = async ({ request, cookies }) => {
	const session = verifyAdminSession(cookies, request);
	if (!session) {
		return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const url = new URL(request.url);
		const id = url.searchParams.get('id');
		if (!id) {
			return new Response(JSON.stringify({ error: 'App ID is required' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		await deleteClerkApp(id);
		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err: any) {
		return new Response(JSON.stringify({ error: err.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const GET = get;
export const POST = post;
export const DELETE = del;
