CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"seq" serial,
	"login" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"role" text NOT NULL,
	"position" text NOT NULL,
	"unit" text NOT NULL,
	"evaluator_id" text,
	"person_id" text,
	"email" text,
	"password_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" text PRIMARY KEY,
	"seq" serial,
	"person_id" text NOT NULL,
	"evaluator_id" text NOT NULL,
	"stage" text NOT NULL,
	"record" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_login_idx" ON "users" (lower("login"));--> statement-breakpoint
CREATE INDEX "cases_person_idx" ON "cases" ("person_id");--> statement-breakpoint
CREATE INDEX "cases_evaluator_idx" ON "cases" ("evaluator_id");