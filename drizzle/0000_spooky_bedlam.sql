CREATE TABLE "automation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"trigger_type" text NOT NULL,
	"keywords" text NOT NULL,
	"match_mode" text DEFAULT 'contains' NOT NULL,
	"response_text" text NOT NULL,
	"response_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"global_enabled" boolean DEFAULT true NOT NULL,
	"rate_limit_per_user_minutes" integer DEFAULT 5 NOT NULL,
	"default_fallback_response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instagram_user_id" text NOT NULL,
	"username" text NOT NULL,
	"name" text,
	"profile_picture_url" text,
	"access_token_encrypted" text NOT NULL,
	"token_expires_at" timestamp with time zone,
	"scopes" text,
	"status" text DEFAULT 'connected' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instagram_accounts_instagram_user_id_unique" UNIQUE("instagram_user_id")
);
--> statement-breakpoint
CREATE TABLE "message_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_event_id" uuid,
	"automation_rule_id" uuid,
	"rule_name" text,
	"trigger_type" text NOT NULL,
	"sender_id" text NOT NULL,
	"matched_keyword" text,
	"incoming_text" text,
	"sent_reply_text" text,
	"sent_reply_url" text,
	"status" text NOT NULL,
	"error_details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"sender_id" text NOT NULL,
	"recipient_id" text,
	"raw_payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "webhook_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_webhook_event_id_webhook_events_id_fk" FOREIGN KEY ("webhook_event_id") REFERENCES "public"."webhook_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_automation_rule_id_automation_rules_id_fk" FOREIGN KEY ("automation_rule_id") REFERENCES "public"."automation_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_automation_rules_trigger_type" ON "automation_rules" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "idx_automation_rules_is_active" ON "automation_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_automation_rules_created_at" ON "automation_rules" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_instagram_accounts_ig_user_id" ON "instagram_accounts" USING btree ("instagram_user_id");--> statement-breakpoint
CREATE INDEX "idx_instagram_accounts_status" ON "instagram_accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_message_logs_sender_id" ON "message_logs" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_message_logs_status" ON "message_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_message_logs_created_at" ON "message_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_message_logs_rule_id" ON "message_logs" USING btree ("automation_rule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_webhook_events_event_id" ON "webhook_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_status" ON "webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_sender_id" ON "webhook_events" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_created_at" ON "webhook_events" USING btree ("created_at");