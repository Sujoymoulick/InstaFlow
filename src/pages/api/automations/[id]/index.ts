import type { APIRoute } from 'astro';
import { getDb, schema } from '../../../../db/index.js';
import { eq } from 'drizzle-orm';
import { isAuthorizedAdmin } from '../../../../lib/auth.js';

export const prerender = false;

export const get: APIRoute = async ({ params }) => {
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

	const rules = await db
		.select()
		.from(schema.automationRules)
		.where(eq(schema.automationRules.id, id))
		.limit(1);

	if (rules.length === 0) {
		return new Response(JSON.stringify({ error: 'Rule not found' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	return new Response(JSON.stringify({ rule: rules[0] }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' },
	});
};

export const put: APIRoute = async ({ params, request, cookies }) => {
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
		const body = await request.json();
		const { name, triggerType, keywords, matchMode, responseText, responseUrl, isActive } = body;

		let formattedKeywords = keywords;
		if (Array.isArray(keywords)) {
			formattedKeywords = JSON.stringify(keywords);
		} else if (typeof keywords === 'string' && !keywords.startsWith('[')) {
			formattedKeywords = JSON.stringify(
				keywords
					.split(',')
					.map((k) => k.trim())
					.filter(Boolean),
			);
		}

		const [updated] = await db
			.update(schema.automationRules)
			.set({
				name,
				triggerType,
				keywords: formattedKeywords,
				matchMode: matchMode === 'exact' ? 'exact' : 'contains',
				responseText,
				responseUrl: responseUrl || null,
				isActive: typeof isActive === 'boolean' ? isActive : undefined,
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

export const del: APIRoute = async ({ params, request, cookies }) => {
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
		await db.delete(schema.automationRules).where(eq(schema.automationRules.id, id));
		return new Response(JSON.stringify({ success: true }), {
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
export const PUT = put;
export const DELETE = del;
