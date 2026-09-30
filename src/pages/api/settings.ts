import type { APIRoute } from 'astro';
import { getDb, schema } from '../../db/index.js';
import { eq } from 'drizzle-orm';
import { isAuthorizedAdmin } from '../../lib/auth.js';

export const prerender = false;

export const get: APIRoute = async ({ request, cookies }) => {
	if (!isAuthorizedAdmin(request, cookies)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
	const db = getDb();
	if (!db) {
		return new Response(
			JSON.stringify({
				settings: {
					globalEnabled: true,
					rateLimitPerUserMinutes: 5,
					defaultFallbackResponse: null,
				},
				dbConfigured: false,
			}),
			{ status: 200, headers: { 'Content-Type': 'application/json' } },
		);
	}

	try {
		const existing = await db.select().from(schema.automationSettings).limit(1);
		if (existing.length > 0) {
			return new Response(JSON.stringify({ settings: existing[0], dbConfigured: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Insert initial default
		const [created] = await db
			.insert(schema.automationSettings)
			.values({
				globalEnabled: true,
				rateLimitPerUserMinutes: 5,
			})
			.returning();

		return new Response(JSON.stringify({ settings: created, dbConfigured: true }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		return new Response(JSON.stringify({ error: error.message, dbConfigured: false }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const post: APIRoute = async ({ request, cookies }) => {
	if (!isAuthorizedAdmin(request, cookies)) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const db = getDb();
	if (!db) {
		return new Response(JSON.stringify({ error: 'Database not configured' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const body = await request.json();
		const { globalEnabled, rateLimitPerUserMinutes, defaultFallbackResponse } = body;
		if (typeof rateLimitPerUserMinutes === 'number' && (!Number.isFinite(rateLimitPerUserMinutes) || rateLimitPerUserMinutes < 0 || rateLimitPerUserMinutes > 1440)) {
			return new Response(JSON.stringify({ error: 'rateLimitPerUserMinutes must be between 0 and 1440.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		const existing = await db.select().from(schema.automationSettings).limit(1);

		let result;
		if (existing.length > 0) {
			const [updated] = await db
				.update(schema.automationSettings)
				.set({
					globalEnabled: typeof globalEnabled === 'boolean' ? globalEnabled : existing[0].globalEnabled,
					rateLimitPerUserMinutes:
						typeof rateLimitPerUserMinutes === 'number'
							? rateLimitPerUserMinutes
							: existing[0].rateLimitPerUserMinutes,
					defaultFallbackResponse:
						defaultFallbackResponse !== undefined
							? defaultFallbackResponse
							: existing[0].defaultFallbackResponse,
					updatedAt: new Date(),
				})
				.where(eq(schema.automationSettings.id, existing[0].id))
				.returning();
			result = updated;
		} else {
			const [created] = await db
				.insert(schema.automationSettings)
				.values({
					globalEnabled: globalEnabled !== false,
					rateLimitPerUserMinutes: rateLimitPerUserMinutes || 5,
					defaultFallbackResponse: defaultFallbackResponse || null,
				})
				.returning();
			result = created;
		}

		return new Response(JSON.stringify({ settings: result }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const GET = get;
export const POST = post;
