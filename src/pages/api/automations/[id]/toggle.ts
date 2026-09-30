import type { APIRoute } from 'astro';
import { getDb, schema } from '../../../../db/index.js';
import { eq } from 'drizzle-orm';
import { isAuthorizedAdmin } from '../../../../lib/auth.js';

export const prerender = false;

export const post: APIRoute = async ({ params, request, cookies }) => {
	if (!isAuthorizedAdmin(request, cookies)) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const db = getDb();
	if (!db) {
		return new Response(JSON.stringify({ error: 'Database not available' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const id = params.id;
	if (!id) {
		return new Response(JSON.stringify({ error: 'Rule ID required' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const existing = await db
			.select()
			.from(schema.automationRules)
			.where(eq(schema.automationRules.id, id))
			.limit(1);

		if (existing.length === 0) {
			return new Response(JSON.stringify({ error: 'Rule not found' }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		const newStatus = !existing[0].isActive;

		const [updated] = await db
			.update(schema.automationRules)
			.set({
				isActive: newStatus,
				updatedAt: new Date(),
			})
			.where(eq(schema.automationRules.id, id))
			.returning();

		return new Response(JSON.stringify({ rule: updated }), {
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

export const POST = post;
