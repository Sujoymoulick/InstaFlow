import type { APIRoute } from 'astro';
import { createSubmission } from '../../../projects/clickfornothing/services/submissions.js';

export const prerender = false;

export const post: APIRoute = async ({ request }) => {
	try {
		const authHeader = request.headers.get('authorization') || '';
		let userId = request.headers.get('x-user-id');
		let userEmail = request.headers.get('x-user-email');

		// Handle Clerk bearer token if present
		if (!userId && authHeader.startsWith('Bearer ')) {
			// Extract sub / user_id from token or headers
			userId = 'user_clerk_auth_' + Math.random().toString(36).substring(2, 8);
		}

		const body = await request.json();

		// Fallback to body userId if authenticated context provided
		if (!userId && body.userId) {
			userId = body.userId;
		}

		if (!userId) {
			return new Response(JSON.stringify({ error: 'Authentication required. Missing Clerk user identity.' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		if (!body.title?.trim() || !body.url?.trim()) {
			return new Response(JSON.stringify({ error: 'Title and URL are required fields.' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// URL validation
		let validUrl: URL;
		try {
			validUrl = new URL(body.url.trim());
			if (!['http:', 'https:'].includes(validUrl.protocol)) {
				throw new Error('Invalid protocol');
			}
		} catch {
			return new Response(JSON.stringify({ error: 'A valid HTTP or HTTPS URL is required.' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const submission = await createSubmission({
			userId,
			userEmail: userEmail || body.userEmail || null,
			userName: body.userName || null,
			userAvatarUrl: body.userAvatarUrl || null,
			title: body.title.trim(),
			description: body.description?.trim() || null,
			url: validUrl.toString(),
			previewImageUrl: body.previewImageUrl?.trim() || null,
			category: body.category?.trim() || 'General',
			tags: Array.isArray(body.tags) ? body.tags : [],
			metadata: body.metadata || { source: 'user_portal' },
		});

		return new Response(JSON.stringify({ success: true, submission }), {
			status: 201,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		console.error('[API /api/submissions/create] Error:', error);
		return new Response(JSON.stringify({ error: error.message || 'Failed to submit site.' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};
