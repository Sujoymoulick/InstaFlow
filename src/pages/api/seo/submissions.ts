import type { APIRoute } from 'astro';
import { listSubmissions } from '../../../projects/clickfornothing/services/submissions.js';
import { isCfnDatabaseConfigured, getCfnSql } from '../../../projects/clickfornothing/services/clients.js';

export const prerender = false;

export const get: APIRoute = async ({ request }) => {
	try {
		const url = new URL(request.url);
		const limit = parseInt(url.searchParams.get('limit') || '50', 10);
		const status = url.searchParams.get('status') || 'all';

		let sites: Array<{
			id: string;
			title: string;
			url: string;
			category?: string;
			status?: string;
			userName?: string | null;
			createdAt?: string;
		}> = [];

		if (isCfnDatabaseConfigured()) {
			try {
				const sql = getCfnSql();
				const rows = await sql`
					SELECT id, name as title, url, category, status, user_name, created_at
					FROM website_submissions
					ORDER BY id DESC
					LIMIT ${Math.min(limit, 100)};
				`;

				sites = rows.map((r: any) => ({
					id: String(r.id),
					title: r.title || r.name || 'Untitled Site',
					url: r.url || '',
					category: r.category || 'General',
					status: r.status || 'pending_review',
					userName: r.user_name || null,
					createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
				}));
			} catch (dbErr) {
				console.warn('[API /api/seo/submissions] DB query failed, using service fallback:', dbErr);
			}
		}

		if (sites.length === 0) {
			const res = await listSubmissions({ limit, status });
			sites = res.submissions.map((s) => ({
				id: s.id,
				title: s.title,
				url: s.url,
				category: s.category,
				status: s.status,
				userName: s.userName,
				createdAt: s.createdAt,
			}));
		}

		// Include default demo / showcase sites if empty
		if (sites.length === 0) {
			sites = [
				{
					id: 'site_freepdfly',
					title: 'FreePDFly',
					url: 'https://freepdfly.com/',
					category: 'PDF Tools',
					status: 'Published',
					userName: 'Sujoy Moulick',
					createdAt: new Date().toISOString(),
				},
				{
					id: 'site_instaflow',
					title: 'InstaFlow',
					url: 'https://instaflow.sendvirtualgift.com',
					category: 'SaaS Platform',
					status: 'Published',
					userName: 'Admin',
					createdAt: new Date().toISOString(),
				},
			];
		}

		return new Response(
			JSON.stringify({
				success: true,
				total: sites.length,
				sites,
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-store, no-cache, must-revalidate',
				},
			},
		);
	} catch (error: any) {
		console.error('[API /api/seo/submissions] Error:', error);
		return new Response(
			JSON.stringify({
				error: error.message || 'Failed to list site submissions.',
				sites: [],
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			},
		);
	}
};

export const GET = get;
