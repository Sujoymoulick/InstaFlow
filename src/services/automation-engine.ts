import { getDb, schema } from '../db/index.js';
import { eq, and, gt, desc, sql } from 'drizzle-orm';
import {
	getActiveInstagramAccount,
	sendInstagramMessage,
	sendInstagramPrivateReply,
	sendInstagramPublicCommentReply,
	formatPersonalizedMessage,
} from './instagram.js';

export interface WebhookIncomingEvent {
	eventId: string;
	eventType: 'comment' | 'message' | 'messaging_postbacks' | 'unknown';
	senderId: string;
	recipientId?: string;
	commentId?: string; // If event is a comment
	mediaId?: string; // Associated Post / Reel media id
	senderUsername?: string;
	senderFirstName?: string;
	text: string;
	rawPayload: any;
}

/** Persist an event before acknowledging Meta; the webhook starts delivery and cron recovers interrupted jobs. */
export async function enqueueWebhookEvent(event: WebhookIncomingEvent): Promise<string | null> {
	const db = getDb();
	if (!db) throw new Error('Database connection unavailable; webhook event was not queued.');
	const [queued] = await db.insert(schema.webhookEvents).values({
		eventId: event.eventId,
		eventType: event.eventType,
		senderId: event.senderId,
		recipientId: event.recipientId || null,
		rawPayload: { queuedEvent: event },
		status: 'pending',
	}).onConflictDoNothing({ target: schema.webhookEvents.eventId }).returning({ id: schema.webhookEvents.id });
	return queued?.id || null;
}

/** Atomically claim a freshly queued event so the cron recovery worker cannot race delivery. */
export async function processQueuedWebhookEvent(event: WebhookIncomingEvent, eventRowId: string): Promise<void> {
	const db = getDb();
	if (!db) throw new Error('Database connection unavailable; queued event remains pending.');
	const [claimed] = await db.update(schema.webhookEvents)
		.set({ status: 'processing', processingStartedAt: new Date(), attemptCount: sql`${schema.webhookEvents.attemptCount} + 1` })
		.where(and(eq(schema.webhookEvents.id, eventRowId), eq(schema.webhookEvents.status, 'pending')))
		.returning({ id: schema.webhookEvents.id });
	if (!claimed) return;
	await processWebhookEvent(event, eventRowId);
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
	matchMode: 'exact' | 'contains' | 'any' | string,
): { matched: boolean; matchedKeyword?: string } {
	const keywords = parseKeywords(keywordsInput);

	// Match all only when the operator explicitly selected any or entered '*'.
	if (matchMode === 'any' || keywords.includes('*')) {
		return { matched: true, matchedKeyword: '*' };
	}
	if (keywords.length === 0) return { matched: false };

	const normalizedInput = normalizeText(text);

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
export async function processWebhookEvent(event: WebhookIncomingEvent, savedEventId?: string): Promise<{
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
	// The unique event_id constraint arbitrates concurrent Meta retries.
	let savedEvent: schema.WebhookEvent | undefined;
	if (savedEventId) {
		[savedEvent] = await db.select().from(schema.webhookEvents).where(eq(schema.webhookEvents.id, savedEventId)).limit(1);
		if (!savedEvent) return { success: false, status: 'failed', message: 'Queued webhook event no longer exists.' };
	} else {
		[savedEvent] = await db
		.insert(schema.webhookEvents)
		.values({
			eventId: event.eventId,
			eventType: event.eventType,
			senderId: event.senderId,
			recipientId: event.recipientId || null,
			rawPayload: event.rawPayload,
			status: 'pending',
		})
		.onConflictDoNothing({ target: schema.webhookEvents.eventId })
		.returning();
	}
	if (!savedEvent) return { success: true, status: 'ignored', message: `Duplicate event ${event.eventId} skipped.` };

	try {
		// 3. Check Global Automation Settings
		const settingsList = await db.select().from(schema.automationSettings).limit(1);
		const globalEnabled = settingsList.length > 0 ? settingsList[0].globalEnabled : true;
		const rateLimitMinutes = settingsList.length > 0 ? settingsList[0].rateLimitPerUserMinutes : 5;
		const welcomeEnabled = settingsList.length > 0 ? settingsList[0].welcomeMessageEnabled : false;
		const welcomeText = settingsList.length > 0 ? settingsList[0].welcomeMessageText : null;
		const welcomeUrl = settingsList.length > 0 ? settingsList[0].welcomeMessageUrl : null;

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

		// 6. Handle Welcome Messages / First Interactions
		if (event.eventType === 'messaging_postbacks' || (event.eventType === 'message' && welcomeEnabled && welcomeText)) {
			// Check if this is a first interaction (no previous logs for this sender)
			const prevLogs = await db
				.select()
				.from(schema.messageLogs)
				.where(eq(schema.messageLogs.senderId, event.senderId))
				.limit(1);

			if (prevLogs.length === 0 && welcomeEnabled && welcomeText) {
				const personalizedWelcome = formatPersonalizedMessage(welcomeText, {
					firstName: event.senderFirstName || event.senderUsername,
					username: event.senderUsername,
					link: welcomeUrl,
				});

				await db.update(schema.webhookEvents).set({ status: 'sending' }).where(eq(schema.webhookEvents.id, savedEvent.id));
				const replyRes = await sendInstagramMessage(
					event.senderId,
					personalizedWelcome,
					welcomeUrl,
					igAccount,
				);

				if (replyRes.success) {
					await db
						.update(schema.webhookEvents)
						.set({ status: 'processed', processedAt: new Date() })
						.where(eq(schema.webhookEvents.id, savedEvent.id));

					const [log] = await db
						.insert(schema.messageLogs)
						.values({
							webhookEventId: savedEvent.id,
							ruleName: 'Welcome Message Automation',
							triggerType: 'welcome_message',
							senderId: event.senderId,
							incomingText: event.text || 'First Interaction',
							sentReplyText: personalizedWelcome,
							sentReplyUrl: welcomeUrl || null,
							status: 'sent',
						})
						.returning();

					return { success: true, status: 'processed', logId: log.id };
				}
			}
		}

		// 7. Find Matching Active Rule
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
			if (rule.accountId && rule.accountId !== igAccount.id) continue;
			if (event.eventType === 'comment' && (!rule.mediaId || rule.mediaId !== event.mediaId)) continue;
			if (event.eventType === 'message' && rule.mediaId) continue;

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

		// 8. Personalize Message Template
		const personalizedMessage = formatPersonalizedMessage(matchedRule.responseText, {
			firstName: event.senderFirstName || event.senderUsername,
			username: event.senderUsername,
			link: matchedRule.responseUrl,
		});

		// 9. Deliver Reply via Official Meta API
		let replyResult: { success: boolean; messageId?: string; error?: string };
		let sentPublicReplyText: string | null = null;

		if (event.eventType === 'comment' && event.commentId) {
			if (!event.mediaId || !event.senderId || event.senderId === 'unknown') {
				throw new Error('Comment event is missing the media or commenter identifier required for a private reply.');
			}
			await db.update(schema.webhookEvents).set({ status: 'sending' }).where(eq(schema.webhookEvents.id, savedEvent.id));
			// A. Optional Public Comment Reply
			if (matchedRule.publicReply && matchedRule.publicReply.trim()) {
				try {
					await sendInstagramPublicCommentReply(
						event.commentId,
						matchedRule.publicReply.trim(),
						igAccount,
					);
					sentPublicReplyText = matchedRule.publicReply.trim();
				} catch (pubErr: any) {
					console.warn('Public comment reply notice (non-fatal):', pubErr.message);
				}
			}

			// B. Official Comment-to-DM Private Reply
			replyResult = await sendInstagramPrivateReply(
				event.commentId,
				personalizedMessage,
				matchedRule.responseUrl,
				igAccount,
			);

		} else {
			// Direct Message Auto-Reply
			await db.update(schema.webhookEvents).set({ status: 'sending' }).where(eq(schema.webhookEvents.id, savedEvent.id));
			replyResult = await sendInstagramMessage(
				event.senderId,
				personalizedMessage,
				matchedRule.responseUrl,
				igAccount,
			);
		}

		// 10. Record Message Log & Finalize Webhook Event Status
		if (replyResult.success) {
			await db
				.update(schema.webhookEvents)
				.set({
					status: 'processed',
					processedAt: new Date(),
				})
				.where(eq(schema.webhookEvents.id, savedEvent.id));

			// Increment rule trigger count
			await db
				.update(schema.automationRules)
				.set({
					triggerCount: sql`${schema.automationRules.triggerCount} + 1`,
					lastTriggeredAt: new Date(),
				})
				.where(eq(schema.automationRules.id, matchedRule.id));

			const [log] = await db
				.insert(schema.messageLogs)
				.values({
					webhookEventId: savedEvent.id,
					automationRuleId: matchedRule.id,
					ruleName: matchedRule.name,
					triggerType: matchedRule.triggerType,
					senderId: event.senderId,
					recipientId: event.recipientId || null,
					mediaId: event.mediaId || null,
					matchedKeyword: matchedKeyword || null,
					incomingText: event.text,
					sentReplyText: personalizedMessage,
					sentPublicReplyText,
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
				recipientId: event.recipientId || null,
				mediaId: event.mediaId || null,
				matchedKeyword: matchedKeyword || null,
				incomingText: event.text,
				sentReplyText: personalizedMessage,
				sentPublicReplyText,
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
