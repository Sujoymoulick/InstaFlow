import type { APIRoute } from 'astro';
import { getProjectById, updateProject, deleteProject, VALID_PROJECT_STATUSES } from '../../../../services/projects.js';
import { isAuthorizedAdmin } from '../../../../lib/auth.js';

export const prerender = false;

export const get: APIRoute = async ({ params }) => {
	const id = params.id;
	if (!id) {
		return new Response(JSON.stringify({ error: 'Project ID is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const project = await getProjectById(id);
		if (!project) {
			return new Response(JSON.stringify({ error: 'Project not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		return new Response(JSON.stringify({ project }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const put: APIRoute = async ({ params, request, cookies }) => {
	if (!isAuthorizedAdmin(request, cookies)) {
		return new Response(JSON.stringify({ error: 'Unauthorized: Admin authentication required' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const id = params.id;
	if (!id) {
		return new Response(JSON.stringify({ error: 'Project ID is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		let body: any;
		try {
			body = await request.json();
		} catch {
			return new Response(JSON.stringify({ error: 'Invalid JSON request body' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const { name, slug, description, category, status, logoUrl, liveUrl, githubUrl, technologies } = body;

		if (name !== undefined) {
			if (typeof name !== 'string' || !name.trim()) {
				return new Response(JSON.stringify({ error: 'Project name cannot be empty' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}
			if (name.trim().length > 255) {
				return new Response(JSON.stringify({ error: 'Project name must be 255 characters or fewer' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		if (status !== undefined && !VALID_PROJECT_STATUSES.includes(status as any)) {
			return new Response(
				JSON.stringify({
					error: `Invalid status "${status}". Allowed values: ${VALID_PROJECT_STATUSES.join(', ')}`,
				}),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' },
				},
			);
		}

		const validateUrl = (val: any, label: string) => {
			if (val && typeof val === 'string' && val.trim()) {
				try {
					new URL(val.trim());
				} catch {
					return `${label} must be a valid URL (e.g. https://example.com)`;
				}
			}
			return null;
		};

		if (liveUrl !== undefined) {
			const err = validateUrl(liveUrl, 'Live website URL');
			if (err) return new Response(JSON.stringify({ error: err }), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		if (githubUrl !== undefined) {
			const err = validateUrl(githubUrl, 'GitHub repository URL');
			if (err) return new Response(JSON.stringify({ error: err }), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		if (logoUrl !== undefined) {
			const err = validateUrl(logoUrl, 'Logo URL');
			if (err) return new Response(JSON.stringify({ error: err }), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		const updated = await updateProject(id, {
			name: name !== undefined ? name.trim() : undefined,
			slug: slug !== undefined ? slug.trim() : undefined,
			description: description !== undefined ? (description?.trim() || null) : undefined,
			category: category !== undefined ? (category?.trim() || 'General') : undefined,
			status: status !== undefined ? status.trim() : undefined,
			logoUrl: logoUrl !== undefined ? (logoUrl?.trim() || null) : undefined,
			liveUrl: liveUrl !== undefined ? (liveUrl?.trim() || null) : undefined,
			githubUrl: githubUrl !== undefined ? (githubUrl?.trim() || null) : undefined,
			technologies: technologies !== undefined ? technologies : undefined,
		});

		return new Response(JSON.stringify({ project: updated }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		console.error('Error updating project:', error);
		const statusCode = error.message?.includes('not found') ? 404 : error.message?.includes('already in use') ? 409 : 500;
		return new Response(JSON.stringify({ error: error.message || 'Failed to update project' }), {
			status: statusCode,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const del: APIRoute = async ({ params, request, cookies }) => {
	if (!isAuthorizedAdmin(request, cookies)) {
		return new Response(JSON.stringify({ error: 'Unauthorized: Admin authentication required' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const id = params.id;
	if (!id) {
		return new Response(JSON.stringify({ error: 'Project ID is required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const success = await deleteProject(id);
		if (!success) {
			return new Response(JSON.stringify({ error: 'Project not found or already deleted' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		return new Response(JSON.stringify({ success: true }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		console.error('Error deleting project:', error);
		return new Response(JSON.stringify({ error: error.message || 'Failed to delete project' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const GET = get;
export const PUT = put;
export const DELETE = del;
