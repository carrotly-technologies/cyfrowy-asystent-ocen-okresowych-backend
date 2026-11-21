CREATE TABLE "pulse_responses" (
	"id" text PRIMARY KEY,
	"person_id" text NOT NULL,
	"date" date NOT NULL,
	"answers" jsonb NOT NULL,
	"comment" text,
	"share_comment" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pulse_responses_person_date_idx" ON "pulse_responses" ("person_id","date");