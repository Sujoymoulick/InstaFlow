import type { APIRoute } from 'astro';
import { getProjects, getProjectMetrics, createProject, VALID_PROJECT_STATUSES } from '../../../services/projects.js';
import { isAuthorizedAdmin } from '../../../lib/auth.js';

export const prerender = false;

export const get: APIRoute = async ({ request }) => {
	try {
		const url = new URL(request.url);
		const status = url.searchParams.get('status') || undefined;
		const category = url.searchParams.get('category') || undefined;
		const search = url.searchParams.get('search') || undefined;

		const [projects, metrics] = await Promise.all([
			getProjects({ status, category, search }),
			getProjectMetrics(),
		]);

		return new Response(JSON.stringify({ projects, metrics }), {
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

export const post: APIRoute = async ({ request, cookies }) => {
	if (!isAuthorizedAdmin(request, cookies)) {
		return new Response(JSON.stringify({ error: 'Unauthorized: Admin authentication required' }), {
			status: 401,
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

		if (!name || typeof name !== 'string' || !name.trim()) {
			return new Response(JSON.stringify({ error: 'Project name is required' }), {
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

		if (status && !VALID_PROJECT_STATUSES.includes(status as any)) {
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

		// URL format validations if provided
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

		const liveUrlError = validateUrl(liveUrl, 'Live website URL');
		if (liveUrlError) {
			return new Response(JSON.stringify({ error: liveUrlError }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const githubUrlError = validateUrl(githubUrl, 'GitHub repository URL');
		if (githubUrlError) {
			return new Response(JSON.stringify({ error: githubUrlError }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const logoUrlError = validateUrl(logoUrl, 'Logo URL');
		if (logoUrlError) {
			return new Response(JSON.stringify({ error: logoUrlError }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const project = await createProject({
			name: name.trim(),
			slug: slug ? slug.trim() : undefined,
			description: description ? description.trim() : null,
			category: category ? category.trim() : 'General',
			status: status ? status.trim() : 'Planning',
			logoUrl: logoUrl ? logoUrl.trim() : null,
			liveUrl: liveUrl ? liveUrl.trim() : null,
			githubUrl: githubUrl ? githubUrl.trim() : null,
			technologies: technologies || [],
		});

		return new Response(JSON.stringify({ project }), {
			status: 201,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		console.error('Error creating project:', error);
		return new Response(JSON.stringify({ error: error.message || 'Failed to create project' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const GET = get;
export const POST = post;
