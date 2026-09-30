import type { APIRoute } from 'astro';
import { getDb, schema } from '../../../db/index.js';
import { desc } from 'drizzle-orm';
import { isAuthorizedAdmin } from '../../../lib/auth.js';
import { getActiveInstagramAccount } from '../../../services/instagram.js';

export const prerender = false;

export const get: APIRoute = async ({ request, cookies }) => {
	if (!isAuthorizedAdmin(request, cookies)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
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
		const {
			name,
			triggerType,
			automationType,
			mediaId,
			keywords,
			matchMode,
			publicReply,
			responseText,
			responseUrl,
			isActive,
		} = body;

		if (!name || (!triggerType && !automationType) || !responseText) {
			return new Response(
				JSON.stringify({ error: 'Missing required fields: name, triggerType, responseText' }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } },
			);
		}

		const resolvedTriggerType = triggerType || automationType || 'comment_to_dm';
		const resolvedAutomationType = automationType || triggerType || 'comment_to_dm';
		if (!['comment_to_dm', 'dm_reply', 'welcome_message'].includes(resolvedTriggerType)) {
			return new Response(JSON.stringify({ error: 'Unsupported trigger type.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}
		if (resolvedTriggerType === 'comment_to_dm' && !mediaId) {
			return new Response(JSON.stringify({ error: 'Select a post or reel for comment-to-DM automation.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}
		if (resolvedTriggerType !== 'welcome_message' && matchMode !== 'any' && (!keywords || (Array.isArray(keywords) && keywords.length === 0) || (typeof keywords === 'string' && !keywords.trim()))) {
			return new Response(JSON.stringify({ error: 'Add at least one trigger keyword or explicitly choose match any.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
		}

		// Ensure keywords are saved formatted as JSON array string
		let formattedKeywords = keywords;
		if (Array.isArray(keywords)) {
			formattedKeywords = JSON.stringify(keywords);
		} else if (typeof keywords === 'string') {
			if (keywords.startsWith('[')) {
				formattedKeywords = keywords;
			} else {
				formattedKeywords = JSON.stringify(
					keywords
						.split(',')
						.map((k: string) => k.trim())
						.filter(Boolean),
				);
			}
		} else {
			formattedKeywords = JSON.stringify([]);
		}

		// Look up active Instagram account
		const activeAccount = await getActiveInstagramAccount();
		if (!activeAccount) return new Response(JSON.stringify({ error: 'Connect an Instagram account before creating automations.' }), { status: 409, headers: { 'Content-Type': 'application/json' } });

		const [createdRule] = await db
			.insert(schema.automationRules)
			.values({
				accountId: activeAccount?.id || null,
				mediaId: mediaId || null,
				name,
				automationType: resolvedAutomationType,
				triggerType: resolvedTriggerType,
				keywords: formattedKeywords,
				matchMode: matchMode === 'exact' ? 'exact' : matchMode === 'any' ? 'any' : 'contains',
				publicReply: publicReply || null,
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
