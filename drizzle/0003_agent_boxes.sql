CREATE TABLE "boxes" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"owner_id" text NOT NULL,
	"status" text NOT NULL,
	"image" text NOT NULL,
	"memory_mib" integer NOT NULL,
	"workspace_path" text,
	"created_at" text NOT NULL,
	"started_at" text NOT NULL,
	"last_used_at" text NOT NULL,
	"stopped_at" text
);
--> statement-breakpoint
CREATE INDEX "boxes_owner_id_idx" ON "boxes" USING btree ("owner_id");