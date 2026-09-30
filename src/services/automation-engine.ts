import { getDb, schema } from '../db/index.js';
import { eq, and, gt, desc } from 'drizzle-orm';
import {
	getActiveInstagramAccount,
	sendInstagramMessage,
	sendInstagramPrivateReply,
} from './instagram.js';

export interface WebhookIncomingEvent {
	eventId: string;
	eventType: 'comment' | 'message' | 'messaging_postbacks' | 'unknown';
	senderId: string;
	recipientId?: string;
	commentId?: string; // If event is a comment
	text: string;
	rawPayload: any;
}

/**
 * Normalize text for accurate keyword matching (lowercase, trim whitespace, normalize spaces)
 */
export function normalizeText(text: string): string {
	return (text || '')
		.toLowerCase()
		.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Parse keywords string from JSON array or comma-separated format
 */
export function parseKeywords(keywordsInput: string): string[] {
	if (!keywordsInput) return [];
	try {
		const parsed = JSON.parse(keywordsInput);
		if (Array.isArray(parsed)) {
			return parsed.map((k) => String(k).trim()).filter(Boolean);
		}
	} catch {
		// Not JSON, fall back to comma-separated
	}
	return keywordsInput
		.split(',')
		.map((k) => k.trim())
		.filter(Boolean);
}

/**
 * Check if the text matches any configured keyword given the match mode
 */
export function matchesRule(
	text: string,
	keywordsInput: string,
	matchMode: 'exact' | 'contains' | string,
): { matched: boolean; matchedKeyword?: string } {
	const normalizedInput = normalizeText(text);
	const keywords = parseKeywords(keywordsInput);

	for (const keyword of keywords) {
		const normalizedKeyword = normalizeText(keyword);
		if (!normalizedKeyword) continue;

		if (matchMode === 'exact') {
			if (normalizedInput === normalizedKeyword) {
				return { matched: true, matchedKeyword: keyword };
			}
		} else {
			// Contains match: check if the keyword is found in normalized input
			const pattern = new RegExp(`(^|\\s)${normalizedKeyword}(\\s|$)`, 'i');
			if (pattern.test(normalizedInput) || normalizedInput.includes(normalizedKeyword)) {
				return { matched: true, matchedKeyword: keyword };
			}
		}
	}

	return { matched: false };
}

/**
 * Main Webhook Event Processing Pipeline
 */
export async function processWebhookEvent(event: WebhookIncomingEvent): Promise<{
	success: boolean;
	status: 'processed' | 'skipped' | 'failed' | 'ignored';
	message?: string;
	logId?: string;
}> {
	const db = getDb();
	if (!db) {
		return { success: false, status: 'failed', message: 'Database connection unavailable' };
	}

	// 1. Duplicate Detection (Idempotency)
	const existingEvent = await db
		.select()
		.from(schema.webhookEvents)
		.where(eq(schema.webhookEvents.eventId, event.eventId))
		.limit(1);

	if (existingEvent.length > 0) {
		return {
			success: true,
			status: 'ignored',
			message: `Duplicate event ${event.eventId} skipped.`,
		};
	}

	// 2. Persist Webhook Event in Pending State
	const [savedEvent] = await db
		.insert(schema.webhookEvents)
		.values({
			eventId: event.eventId,
			eventType: event.eventType,
			senderId: event.senderId,
			recipientId: event.recipientId || null,
			rawPayload: event.rawPayload,
			status: 'pending',
		})
		.returning();

	try {
		// 3. Check Global Automation Settings
		const settingsList = await db.select().from(schema.automationSettings).limit(1);
		const globalEnabled = settingsList.length > 0 ? settingsList[0].globalEnabled : true;
		const rateLimitMinutes = settingsList.length > 0 ? settingsList[0].rateLimitPerUserMinutes : 5;

		if (!globalEnabled) {
			await db
				.update(schema.webhookEvents)
				.set({
					status: 'ignored',
					errorMessage: 'Global automations are paused',
					processedAt: new Date(),
				})
				.where(eq(schema.webhookEvents.id, savedEvent.id));

			return { success: true, status: 'ignored', message: 'Automations globally disabled' };
		}

		// 4. Rate Limiting Check (Prevent spamming the same user repeatedly)
		if (rateLimitMinutes > 0) {
			const rateLimitThreshold = new Date(Date.now() - rateLimitMinutes * 60 * 1000);
			const recentLogs = await db
				.select()
				.from(schema.messageLogs)
				.where(
					and(
						eq(schema.messageLogs.senderId, event.senderId),
						eq(schema.messageLogs.status, 'sent'),
						gt(schema.messageLogs.createdAt, rateLimitThreshold),
					),
				)
				.limit(1);

			if (recentLogs.length > 0) {
				await db
					.update(schema.webhookEvents)
					.set({
						status: 'ignored',
						errorMessage: `Rate limit hit: user replied to within ${rateLimitMinutes}m`,
						processedAt: new Date(),
					})
					.where(eq(schema.webhookEvents.id, savedEvent.id));

				await db.insert(schema.messageLogs).values({
					webhookEventId: savedEvent.id,
					triggerType: event.eventType,
					senderId: event.senderId,
					incomingText: event.text,
					status: 'skipped',
					errorDetails: `Rate limit threshold exceeded (${rateLimitMinutes}m)`,
				});

				return { success: true, status: 'skipped', message: 'Rate limit applied' };
			}
		}

		// 5. Check Active Connected Instagram Account
		const igAccount = await getActiveInstagramAccount();
		if (!igAccount) {
			throw new Error('No active Instagram account connected to deliver replies.');
		}

		// Do not process messages sent by our own business account
		if (event.senderId === igAccount.instagramUserId) {
			await db
				.update(schema.webhookEvents)
				.set({
					status: 'ignored',
					errorMessage: 'Self-originated event',
					processedAt: new Date(),
				})
				.where(eq(schema.webhookEvents.id, savedEvent.id));

			return { success: true, status: 'ignored', message: 'Self event ignored' };
		}

		// 6. Find Matching Active Rule
		let targetTriggerType = 'dm_reply';
		if (event.eventType === 'comment') {
			targetTriggerType = 'comment_to_dm';
		}

		const activeRules = await db
			.select()
			.from(schema.automationRules)
			.where(
				and(
					eq(schema.automationRules.isActive, true),
					eq(schema.automationRules.triggerType, targetTriggerType),
				),
			)
			.orderBy(desc(schema.automationRules.createdAt));

		let matchedRule: schema.AutomationRule | null = null;
		let matchedKeyword: string | undefined;

		for (const rule of activeRules) {
			const result = matchesRule(event.text, rule.keywords, rule.matchMode);
			if (result.matched) {
				matchedRule = rule;
				matchedKeyword = result.matchedKeyword;
				break;
			}
		}

		if (!matchedRule) {
			await db
				.update(schema.webhookEvents)
				.set({
					status: 'ignored',
					errorMessage: 'No active automation rule matched keywords',
					processedAt: new Date(),
				})
				.where(eq(schema.webhookEvents.id, savedEvent.id));

			return { success: true, status: 'ignored', message: 'No matching rule' };
		}

		// 7. Deliver Reply via Official Meta API
		let replyResult: { success: boolean; messageId?: string; error?: string };

		if (event.eventType === 'comment' && event.commentId) {
			// Official Comment-to-DM Private Reply
			replyResult = await sendInstagramPrivateReply(
				event.commentId,
				matchedRule.responseText,
				matchedRule.responseUrl,
				igAccount,
			);
		} else {
			// Direct Message Auto-Reply
			replyResult = await sendInstagramMessage(
				event.senderId,
				matchedRule.responseText,
				matchedRule.responseUrl,
				igAccount,
			);
		}

		// 8. Record Message Log & Finalize Webhook Event Status
		if (replyResult.success) {
			await db
				.update(schema.webhookEvents)
				.set({
					status: 'processed',
					processedAt: new Date(),
				})
				.where(eq(schema.webhookEvents.id, savedEvent.id));

			const [log] = await db
				.insert(schema.messageLogs)
				.values({
					webhookEventId: savedEvent.id,
					automationRuleId: matchedRule.id,
					ruleName: matchedRule.name,
					triggerType: matchedRule.triggerType,
					senderId: event.senderId,
					matchedKeyword: matchedKeyword || null,
					incomingText: event.text,
					sentReplyText: matchedRule.responseText,
					sentReplyUrl: matchedRule.responseUrl || null,
					status: 'sent',
				})
				.returning();

			return { success: true, status: 'processed', logId: log.id };
		} else {
			await db
				.update(schema.webhookEvents)
				.set({
					status: 'failed',
					errorMessage: replyResult.error,
					processedAt: new Date(),
				})
				.where(eq(schema.webhookEvents.id, savedEvent.id));

			await db.insert(schema.messageLogs).values({
				webhookEventId: savedEvent.id,
				automationRuleId: matchedRule.id,
				ruleName: matchedRule.name,
				triggerType: matchedRule.triggerType,
				senderId: event.senderId,
				matchedKeyword: matchedKeyword || null,
				incomingText: event.text,
				sentReplyText: matchedRule.responseText,
				sentReplyUrl: matchedRule.responseUrl || null,
				status: 'failed',
				errorDetails: replyResult.error,
			});

			return { success: false, status: 'failed', message: replyResult.error };
		}
	} catch (error: any) {
		console.error('Error during webhook event processing:', error);
		await db
			.update(schema.webhookEvents)
			.set({
				status: 'failed',
				errorMessage: error.message || 'Unknown processing error',
				processedAt: new Date(),
			})
			.where(eq(schema.webhookEvents.id, savedEvent.id));

		return { success: false, status: 'failed', message: error.message };
	}
}
