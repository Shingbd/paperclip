CREATE TABLE "personal_todos" (
	"issue_id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"owner_user_id" text NOT NULL,
	"client_request_id" uuid NOT NULL,
	"category" text DEFAULT '收件箱' NOT NULL,
	"due_date" text,
	"due_at" timestamp with time zone,
	"timezone" text NOT NULL,
	"recurrence" text DEFAULT 'none' NOT NULL,
	"assist_mode" text DEFAULT 'off' NOT NULL,
	"automatic_analysis" boolean DEFAULT false NOT NULL,
	"coordinator_id" uuid,
	"next_assessment_at" timestamp with time zone,
	"assessment" jsonb,
	"assessment_revision" text,
	"analysis_revision" text,
	"analysis_issue_id" uuid,
	"execution_issue_id" uuid,
	"successor_issue_id" uuid,
	"rejected_revision" text
);
--> statement-breakpoint
ALTER TABLE "personal_todos" ADD CONSTRAINT "personal_todos_coordinator_id_agents_id_fk" FOREIGN KEY ("coordinator_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_todos" ADD CONSTRAINT "personal_todos_analysis_issue_id_issues_id_fk" FOREIGN KEY ("analysis_issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_todos" ADD CONSTRAINT "personal_todos_execution_issue_id_issues_id_fk" FOREIGN KEY ("execution_issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_todos" ADD CONSTRAINT "personal_todos_successor_issue_id_issues_id_fk" FOREIGN KEY ("successor_issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_todos" ADD CONSTRAINT "personal_todos_company_id_issue_id_issues_company_id_id_fk" FOREIGN KEY ("company_id","issue_id") REFERENCES "public"."issues"("company_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "personal_todos_owner_idx" ON "personal_todos" USING btree ("company_id","owner_user_id");--> statement-breakpoint
CREATE INDEX "personal_todos_analysis_due_idx" ON "personal_todos" USING btree ("next_assessment_at");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_todos_request_idx" ON "personal_todos" USING btree ("company_id","owner_user_id","client_request_id");