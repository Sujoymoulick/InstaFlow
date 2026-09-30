-- Durable webhook processing queue for Vercel serverless deployments.
ALTER TABLE IF EXISTS "webhook_events" ADD COLUMN IF NOT EXISTS "attempt_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE IF EXISTS "webhook_events" ADD COLUMN IF NOT EXISTS "processing_started_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_events_queue" ON "webhook_events" USING btree ("status", "created_at");
