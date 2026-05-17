CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"rate_limit" integer,
	"max_concurrent" integer DEFAULT 5 NOT NULL,
	"timeout_seconds" integer DEFAULT 30 NOT NULL,
	"created_at" text NOT NULL,
	"last_used_at" text,
	CONSTRAINT "api_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sandbox_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"language" text NOT NULL,
	"status" text NOT NULL,
	"exit_code" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"api_key" text NOT NULL,
	"organization" text NOT NULL,
	"max_concurrent_sandboxes" integer DEFAULT 5 NOT NULL,
	"max_execution_time_seconds" integer DEFAULT 30 NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 60 NOT NULL,
	"active_sandboxes" integer DEFAULT 0 NOT NULL,
	"total_executions" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "tenants_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"org" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;