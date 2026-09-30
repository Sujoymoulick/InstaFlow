CREATE TABLE IF NOT EXISTS "clerk_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"publishable_key" text NOT NULL,
	"secret_key_encrypted" text NOT NULL,
	"instance_url" text,
	"project_slug" varchar(255),
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clerk_apps_name" ON "clerk_apps" USING btree ("name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clerk_apps_is_default" ON "clerk_apps" USING btree ("is_default");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_clerk_apps_created_at" ON "clerk_apps" USING btree ("created_at");
