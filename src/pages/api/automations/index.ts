import type { APIRoute } from 'astro';
import { getDb, schema } from '../../../db/index.js';
import { desc } from 'drizzle-orm';
import { isAuthorizedAdmin } from '../../../lib/auth.js';

export const prerender = false;

export const get: APIRoute = async () => {
	const db = getDb();
	if (!db) {
		return new Response(JSON.stringify({ rules: [], error: 'DATABASE_URL not configured' }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const rules = await db
			.select()
			.from(schema.automationRules)
			.orderBy(desc(schema.automationRules.createdAt));

		return new Response(JSON.stringify({ rules }), {
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

export const post: APIRoute = async ({ request, cookies }) => {
	if (!isAuthorizedAdmin(request, cookies)) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const db = getDb();
	if (!db) {
		return new Response(JSON.stringify({ error: 'DATABASE_URL not configured' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const body = await request.json();
		const { name, triggerType, keywords, matchMode, responseText, responseUrl, isActive } = body;

		if (!name || !triggerType || !keywords || !responseText) {
			return new Response(
				JSON.stringify({ error: 'Missing required fields: name, triggerType, keywords, responseText' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } },
			);
		}

		// Ensure keywords are saved formatted as JSON array string
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

		const [createdRule] = await db
			.insert(schema.automationRules)
			.values({
				name,
				triggerType,
				keywords: formattedKeywords,
				matchMode: matchMode === 'exact' ? 'exact' : 'contains',
				responseText,
				responseUrl: responseUrl || null,
				isActive: isActive !== false,
			})
			.returning();

		return new Response(JSON.stringify({ rule: createdRule }), {
			status: 201,
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
