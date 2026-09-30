-- Migration: 0002_instagram_content_inbox.sql
-- Add instagram_media, conversations, and extend automation_rules & message_logs

ALTER TABLE IF EXISTS "instagram_accounts" ADD COLUMN IF NOT EXISTS "user_id" text;
--> statement-breakpoint
ALTER TABLE IF EXISTS "instagram_accounts" ADD COLUMN IF NOT EXISTS "connected_at" timestamp with time zone DEFAULT now();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "instagram_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid REFERENCES "instagram_accounts"("id") ON DELETE CASCADE,
	"media_id" text NOT NULL UNIQUE,
	"media_type" text NOT NULL,
	"caption" text,
	"media_url" text,
	"thumbnail_url" text,
	"permalink" text,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"timestamp" timestamp with time zone,
	"last_synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_instagram_media_media_id" ON "instagram_media" USING btree ("media_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_instagram_media_account_id" ON "instagram_media" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_instagram_media_media_type" ON "instagram_media" USING btree ("media_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_instagram_media_timestamp" ON "instagram_media" USING btree ("timestamp");
--> statement-breakpoint

ALTER TABLE IF EXISTS "automation_rules" ADD COLUMN IF NOT EXISTS "account_id" uuid REFERENCES "instagram_accounts"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE IF EXISTS "automation_rules" ADD COLUMN IF NOT EXISTS "media_id" text;
--> statement-breakpoint
ALTER TABLE IF EXISTS "automation_rules" ADD COLUMN IF NOT EXISTS "automation_type" text DEFAULT 'comment_to_dm' NOT NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "automation_rules" ADD COLUMN IF NOT EXISTS "public_reply" text;
--> statement-breakpoint
ALTER TABLE IF EXISTS "automation_rules" ADD COLUMN IF NOT EXISTS "trigger_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "automation_rules" ADD COLUMN IF NOT EXISTS "last_triggered_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_automation_rules_media_id" ON "automation_rules" USING btree ("media_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_automation_rules_account_id" ON "automation_rules" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_automation_rules_automation_type" ON "automation_rules" USING btree ("automation_type");
--> statement-breakpoint

ALTER TABLE IF EXISTS "message_logs" ADD COLUMN IF NOT EXISTS "recipient_id" text;
--> statement-breakpoint
ALTER TABLE IF EXISTS "message_logs" ADD COLUMN IF NOT EXISTS "media_id" text;
--> statement-breakpoint
ALTER TABLE IF EXISTS "message_logs" ADD COLUMN IF NOT EXISTS "sent_public_reply_text" text;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid REFERENCES "instagram_accounts"("id") ON DELETE CASCADE,
	"instagram_conversation_id" text NOT NULL UNIQUE,
	"participant_id" text NOT NULL,
	"participant_username" text,
	"participant_name" text,
	"participant_profile_pic" text,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"last_message_text" text,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_conversations_ig_id" ON "conversations" USING btree ("instagram_conversation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversations_account_id" ON "conversations" USING btree ("account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversations_participant_id" ON "conversations" USING btree ("participant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_conversations_last_message_at" ON "conversations" USING btree ("last_message_at");
--> statement-breakpoint

ALTER TABLE IF EXISTS "automation_settings" ADD COLUMN IF NOT EXISTS "welcome_message_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "automation_settings" ADD COLUMN IF NOT EXISTS "welcome_message_text" text;
--> statement-breakpoint
ALTER TABLE IF EXISTS "automation_settings" ADD COLUMN IF NOT EXISTS "welcome_follow_up_text" text;
--> statement-breakpoint
ALTER TABLE IF EXISTS "automation_settings" ADD COLUMN IF NOT EXISTS "welcome_message_url" text;
