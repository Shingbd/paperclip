import { pgTable, uuid, text, timestamp, boolean, jsonb, index, uniqueIndex, foreignKey } from "drizzle-orm/pg-core";
import { issues } from "./issues.js";
import { agents } from "./agents.js";
import type { TodoAssessment } from "@paperclipai/shared";

// Sidecar settings, never a second task/run store. Title, status, owner and history stay in Issues.
export const personalTodos = pgTable("personal_todos", {
  issueId: uuid("issue_id").primaryKey(),
  companyId: uuid("company_id").notNull(),
  ownerUserId: text("owner_user_id").notNull(),
  clientRequestId: uuid("client_request_id").notNull(),
  category: text("category").notNull().default("收件箱"),
  dueDate: text("due_date"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  timezone: text("timezone").notNull(),
  recurrence: text("recurrence").notNull().default("none"),
  assistMode: text("assist_mode").notNull().default("off"),
  automaticAnalysis: boolean("automatic_analysis").notNull().default(false),
  coordinatorId: uuid("coordinator_id").references(() => agents.id, { onDelete: "set null" }),
  nextAssessmentAt: timestamp("next_assessment_at", { withTimezone: true }),
  assessment: jsonb("assessment").$type<TodoAssessment | null>(),
  assessmentRevision: text("assessment_revision"),
  analysisRevision: text("analysis_revision"),
  analysisIssueId: uuid("analysis_issue_id").references(() => issues.id, { onDelete: "set null" }),
  executionIssueId: uuid("execution_issue_id").references(() => issues.id, { onDelete: "set null" }),
  successorIssueId: uuid("successor_issue_id").references(() => issues.id, { onDelete: "set null" }),
  rejectedRevision: text("rejected_revision"),
}, table => ({
  taskCompany: foreignKey({ columns: [table.companyId, table.issueId], foreignColumns: [issues.companyId, issues.id] }).onDelete("cascade"),
  ownerIdx: index("personal_todos_owner_idx").on(table.companyId, table.ownerUserId),
  dueIdx: index("personal_todos_analysis_due_idx").on(table.nextAssessmentAt),
  requestIdx: uniqueIndex("personal_todos_request_idx").on(table.companyId, table.ownerUserId, table.clientRequestId),
}));
