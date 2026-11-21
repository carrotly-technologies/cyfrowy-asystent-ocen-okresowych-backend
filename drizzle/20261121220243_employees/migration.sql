CREATE TABLE "assessment_history" (
	"id" text PRIMARY KEY,
	"employee_id" text NOT NULL,
	"assessed_on" date NOT NULL,
	"acknowledged_on" date,
	"result" text NOT NULL,
	"level" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_absences" (
	"id" text PRIMARY KEY,
	"employee_id" text NOT NULL,
	"type" text NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"justified" boolean NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" text PRIMARY KEY,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"unit" text NOT NULL,
	"position" text NOT NULL,
	"employment" text NOT NULL,
	"office_head" boolean NOT NULL,
	"manages_people" boolean NOT NULL,
	"appointed_year" integer,
	"grade" text,
	"grade_granted_on" date,
	"indefinite_since" date,
	"evaluator_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluator_substitutions" (
	"id" text PRIMARY KEY,
	"evaluator_id" text NOT NULL,
	"substitute_id" text NOT NULL,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "assessment_history_employee_idx" ON "assessment_history" ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_absences_employee_idx" ON "employee_absences" ("employee_id");--> statement-breakpoint
ALTER TABLE "assessment_history" ADD CONSTRAINT "assessment_history_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "employee_absences" ADD CONSTRAINT "employee_absences_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE;