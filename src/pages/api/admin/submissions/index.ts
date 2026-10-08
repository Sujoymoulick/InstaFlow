import type { APIRoute } from 'astro';
import { isAuthorizedAdmin, verifyAdminSession } from '../../../../lib/auth.js';
import { listSubmissions, createSubmission } from '../../../../projects/clickfornothing/services/submissions.js';

export const prerender = false;

export const get: APIRoute = async ({ request, cookies }) => {
	const session = verifyAdminSession(cookies, request);
	if (!session.authorized) {
		return new Response(JSON.stringify({ error: 'Unauthorized: Admin authentication required.' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const url = new URL(request.url);
		const search = url.searchParams.get('search') || undefined;
		const status = url.searchParams.get('status') || undefined;
		const category = url.searchParams.get('category') || undefined;
		const dateRange = (url.searchParams.get('dateRange') as any) || undefined;
		const sort = (url.searchParams.get('sort') as any) || undefined;
		const page = parseInt(url.searchParams.get('page') || '1', 10);
		const limit = parseInt(url.searchParams.get('limit') || '15', 10);

		const result = await listSubmissions({
			search,
			status,
			category,
			dateRange,
			sort,
			page,
			limit,
		});

		return new Response(JSON.stringify({ success: true, ...result }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store, no-cache, must-revalidate',
			},
		});
	} catch (error: any) {
		console.error('[API /admin/submissions] Error:', error);
		return new Response(JSON.stringify({ error: error.message || 'Internal server error.' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const post: APIRoute = async ({ request, cookies }) => {
	const session = verifyAdminSession(cookies, request);
	if (!session.authorized) {
		return new Response(JSON.stringify({ error: 'Unauthorized: Admin authentication required.' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const body = await request.json();
		if (!body.title || !body.url) {
			return new Response(JSON.stringify({ error: 'Missing required fields: title and url are mandatory.' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Ensure valid URL format
		try {
			new URL(body.url);
		} catch {
			return new Response(JSON.stringify({ error: 'Invalid URL format. Please include http:// or https://' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const submission = await createSubmission({
			userId: body.userId || `admin-${session.email}`,
			userEmail: body.userEmail || session.email,
			userName: body.userName || 'Admin Created',
			title: body.title,
			description: body.description,
			url: body.url,
			previewImageUrl: body.previewImageUrl,
			category: body.category || 'General',
			tags: Array.isArray(body.tags) ? body.tags : [],
			metadata: { createdByAdmin: true, adminEmail: session.email },
		});

		return new Response(JSON.stringify({ success: true, submission }), {
			status: 201,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		console.error('[API /admin/submissions POST] Error:', error);
		return new Response(JSON.stringify({ error: error.message || 'Failed to create submission.' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const GET = get;
export const POST = post;

