import { pgTable, text, timestamp, boolean, uuid, jsonb, integer, index, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

export const instagramAccounts = pgTable(
	'instagram_accounts',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		instagramUserId: text('instagram_user_id').notNull().unique(),
		username: text('username').notNull(),
		name: text('name'),
		profilePictureUrl: text('profile_picture_url'),
		accessTokenEncrypted: text('access_token_encrypted').notNull(),
		tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
		scopes: text('scopes'),
		status: text('status').notNull().default('connected'), // 'connected' | 'expired' | 'disconnected' | 'error'
		lastError: text('last_error'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		igUserIdIdx: index('idx_instagram_accounts_ig_user_id').on(table.instagramUserId),
		statusIdx: index('idx_instagram_accounts_status').on(table.status),
	}),
);

export const automationRules = pgTable(
	'automation_rules',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		name: text('name').notNull(),
		triggerType: text('trigger_type').notNull(), // 'comment_to_dm' | 'dm_reply' | 'welcome_message'
		keywords: text('keywords').notNull(), // JSON string array of keywords e.g. ["pricing","info"]
		matchMode: text('match_mode').notNull().default('contains'), // 'exact' | 'contains'
		responseText: text('response_text').notNull(),
		responseUrl: text('response_url'),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		triggerTypeIdx: index('idx_automation_rules_trigger_type').on(table.triggerType),
		isActiveIdx: index('idx_automation_rules_is_active').on(table.isActive),
		createdAtIdx: index('idx_automation_rules_created_at').on(table.createdAt),
	}),
);

export const webhookEvents = pgTable(
	'webhook_events',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		eventId: text('event_id').notNull().unique(), // Unique event identifier for idempotency
		eventType: text('event_type').notNull(), // 'comment' | 'message' | 'messaging_postbacks' | 'unknown'
		senderId: text('sender_id').notNull(),
		recipientId: text('recipient_id'),
		rawPayload: jsonb('raw_payload').notNull(),
		status: text('status').notNull().default('pending'), // 'pending' | 'processed' | 'ignored' | 'failed'
		errorMessage: text('error_message'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		processedAt: timestamp('processed_at', { withTimezone: true }),
	},
	(table) => ({
		eventIdIdx: uniqueIndex('idx_webhook_events_event_id').on(table.eventId),
		statusIdx: index('idx_webhook_events_status').on(table.status),
		senderIdIdx: index('idx_webhook_events_sender_id').on(table.senderId),
		createdAtIdx: index('idx_webhook_events_created_at').on(table.createdAt),
	}),
);

export const messageLogs = pgTable(
	'message_logs',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		webhookEventId: uuid('webhook_event_id').references(() => webhookEvents.id, { onDelete: 'set null' }),
		automationRuleId: uuid('automation_rule_id').references(() => automationRules.id, { onDelete: 'set null' }),
		ruleName: text('rule_name'),
		triggerType: text('trigger_type').notNull(),
		senderId: text('sender_id').notNull(),
		matchedKeyword: text('matched_keyword'),
		incomingText: text('incoming_text'),
		sentReplyText: text('sent_reply_text'),
		sentReplyUrl: text('sent_reply_url'),
		status: text('status').notNull(), // 'sent' | 'failed' | 'skipped'
		errorDetails: text('error_details'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		senderIdIdx: index('idx_message_logs_sender_id').on(table.senderId),
		statusIdx: index('idx_message_logs_status').on(table.status),
		createdAtIdx: index('idx_message_logs_created_at').on(table.createdAt),
		ruleIdIdx: index('idx_message_logs_rule_id').on(table.automationRuleId),
	}),
);

export const automationSettings = pgTable('automation_settings', {
	id: uuid('id').defaultRandom().primaryKey(),
	globalEnabled: boolean('global_enabled').notNull().default(true),
	rateLimitPerUserMinutes: integer('rate_limit_per_user_minutes').notNull().default(5),
	defaultFallbackResponse: text('default_fallback_response'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable(
	'projects',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		name: varchar('name', { length: 255 }).notNull(),
		slug: varchar('slug', { length: 255 }).notNull().unique(),
		description: text('description'),
		category: varchar('category', { length: 100 }).notNull().default('General'),
		status: varchar('status', { length: 50 }).notNull().default('Planning'),
		logoUrl: text('logo_url'),
		liveUrl: text('live_url'),
		githubUrl: text('github_url'),
		technologies: jsonb('technologies').$type<string[]>().default([]),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => ({
		slugIdx: uniqueIndex('idx_projects_slug').on(table.slug),
		statusIdx: index('idx_projects_status').on(table.status),
		categoryIdx: index('idx_projects_category').on(table.category),
		createdAtIdx: index('idx_projects_created_at').on(table.createdAt),
		updatedAtIdx: index('idx_projects_updated_at').on(table.updatedAt),
	}),
);

export type InstagramAccount = typeof instagramAccounts.$inferSelect;
export type NewInstagramAccount = typeof instagramAccounts.$inferInsert;

export type AutomationRule = typeof automationRules.$inferSelect;
export type NewAutomationRule = typeof automationRules.$inferInsert;

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;

export type MessageLog = typeof messageLogs.$inferSelect;
export type NewMessageLog = typeof messageLogs.$inferInsert;

export type AutomationSetting = typeof automationSettings.$inferSelect;
export type NewAutomationSetting = typeof automationSettings.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
