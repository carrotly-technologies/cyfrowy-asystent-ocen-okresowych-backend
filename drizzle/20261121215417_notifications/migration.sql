CREATE TABLE "notifications" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"case_id" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_on" date NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_key_idx" ON "notifications" ("user_id","key");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" ("user_id");