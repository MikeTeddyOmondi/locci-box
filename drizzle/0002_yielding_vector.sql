CREATE TABLE "bob_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"role" text NOT NULL,
	"parts" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bob_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text DEFAULT 'New review' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "bob_messages_thread_id_idx" ON "bob_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "bob_threads_user_id_idx" ON "bob_threads" USING btree ("user_id");