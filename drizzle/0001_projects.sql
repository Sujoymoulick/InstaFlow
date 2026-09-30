CREATE TABLE IF NOT EXISTS "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(100) DEFAULT 'General' NOT NULL,
	"status" varchar(50) DEFAULT 'Planning' NOT NULL,
	"logo_url" text,
	"live_url" text,
	"github_url" text,
	"technologies" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_projects_slug" ON "projects" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_status" ON "projects" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_category" ON "projects" USING btree ("category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_created_at" ON "projects" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_updated_at" ON "projects" USING btree ("updated_at");
