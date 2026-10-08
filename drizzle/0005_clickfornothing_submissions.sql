CREATE TABLE IF NOT EXISTS "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"user_email" text,
	"user_name" text,
	"user_avatar_url" text,
	"title" varchar(255) NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"preview_image_url" text,
	"category" varchar(100) DEFAULT 'General' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"status" varchar(50) DEFAULT 'Pending Review' NOT NULL,
	"rejection_reason" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_submissions_user_id" ON "submissions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_submissions_status" ON "submissions" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_submissions_category" ON "submissions" USING btree ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_submissions_created_at" ON "submissions" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_submissions_updated_at" ON "submissions" USING btree ("updated_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "submission_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid,
	"admin_email" text NOT NULL,
	"action" text NOT NULL,
	"previous_status" text,
	"new_status" text,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sub_audit_logs_submission_id" ON "submission_audit_logs" USING btree ("submission_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sub_audit_logs_admin_email" ON "submission_audit_logs" USING btree ("admin_email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sub_audit_logs_created_at" ON "submission_audit_logs" USING btree ("created_at");
