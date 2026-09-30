import type { APIRoute } from 'astro';
import { getDb, schema } from '../../../db/index.js';
import { eq } from 'drizzle-orm';
import { isAuthorizedAdmin } from '../../../lib/auth.js';

export const prerender = false;

export const get: APIRoute = async ({ request, cookies }) => {
	if (!isAuthorizedAdmin(request, cookies)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
	const db = getDb();
	if (!db) {
		return new Response(JSON.stringify({ success: true, settings: null }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	try {
		const settingsList = await db.select().from(schema.automationSettings).limit(1);
		return new Response(JSON.stringify({ success: true, settings: settingsList[0] || null }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		return new Response(JSON.stringify({ success: false, error: error.message }), {
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
		const { welcomeMessageEnabled, welcomeMessageText, welcomeFollowUpText, welcomeMessageUrl } = body;

		const existing = await db.select().from(schema.automationSettings).limit(1);

		let saved;
		if (existing.length > 0) {
			[saved] = await db
				.update(schema.automationSettings)
				.set({
					welcomeMessageEnabled: typeof welcomeMessageEnabled === 'boolean' ? welcomeMessageEnabled : existing[0].welcomeMessageEnabled,
					welcomeMessageText: welcomeMessageText !== undefined ? welcomeMessageText : existing[0].welcomeMessageText,
					welcomeFollowUpText: welcomeFollowUpText !== undefined ? welcomeFollowUpText : existing[0].welcomeFollowUpText,
					welcomeMessageUrl: welcomeMessageUrl !== undefined ? welcomeMessageUrl : existing[0].welcomeMessageUrl,
					updatedAt: new Date(),
				})
				.where(eq(schema.automationSettings.id, existing[0].id))
				.returning();
		} else {
			[saved] = await db
				.insert(schema.automationSettings)
				.values({
					welcomeMessageEnabled: Boolean(welcomeMessageEnabled),
					welcomeMessageText: welcomeMessageText || 'Hey {{first_name}}! Welcome to our page. How can we help you today?',
					welcomeFollowUpText: welcomeFollowUpText || null,
					welcomeMessageUrl: welcomeMessageUrl || null,
				})
				.returning();
		}

		return new Response(JSON.stringify({ success: true, settings: saved }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error: any) {
		return new Response(JSON.stringify({ success: false, error: error.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const GET = get;
export const POST = post;
