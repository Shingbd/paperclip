import { z } from "zod";

export const personalTodoSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(20000).default(""),
  category: z.string().trim().max(80).default("收件箱"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  dueAt: z.string().datetime({ offset: true }).nullable().default(null),
  timezone: z.string().refine(value => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }, "Invalid IANA timezone"),
  recurrence: z.enum(["none", "daily", "weekly"]).default("none"),
  assistMode: z.enum(["off", "suggest", "auto_draft"]).default("off"),
  automaticAnalysis: z.boolean().default(false),
  coordinatorId: z.string().uuid().nullable().default(null),
  clientRequestId: z.string().uuid(),
}).strict().superRefine((value, ctx) => {
  if (value.dueDate && value.dueAt) ctx.addIssue({ code: "custom", message: "Choose date or instant, not both" });
  if (value.recurrence !== "none" && !value.dueDate) ctx.addIssue({ code: "custom", message: "Recurring todos require a date-only due date" });
  if (value.dueDate) {
    const date = new Date(value.dueDate + "T00:00:00Z");
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.dueDate) {
      ctx.addIssue({ code: "custom", message: "Invalid calendar date" });
    }
  }
  if (value.automaticAnalysis && (value.assistMode === "off" || !value.coordinatorId)) {
    ctx.addIssue({ code: "custom", message: "Automatic analysis requires visible scope and a coordinator" });
  }
});
export type PersonalTodoInput = z.infer<typeof personalTodoSchema>;

// This schema contains advice only. It deliberately has no model-writable authorization field.
export const todoAssessmentSchema = z.object({
  assistability: z.enum(["can_execute", "can_prepare", "needs_information", "human_action"]),
  reason: z.string().min(1).max(1000),
  proposedAction: z.object({
    kind: z.enum(["draft", "external_action", "none"]),
    instructions: z.string().max(4000),
    acceptanceCriteria: z.string().max(2000),
  }).strict(),
  requiredInformation: z.array(z.string().max(500)).max(10),
  requiredCapabilities: z.array(z.string().max(100)).max(10),
}).strict();
export type TodoAssessment = z.infer<typeof todoAssessmentSchema>;
export interface TodoAssessmentReport {
  todo_id: string;
  assessed_revision: string;
  assistability: TodoAssessment["assistability"];
  reason: string;
  proposed_actions: TodoAssessment["proposedAction"][];
  required_information: string[];
  required_capabilities: string[];
  authorization_result: "authorized" | "confirmation_required" | "unavailable";
  linked_agent_task_ids: string[];
}
export type PersonalTodo = PersonalTodoInput & {
  id: string; identifier: string | null; status: string;
  revision: string; assessment: TodoAssessment | null; assessmentReport?: TodoAssessmentReport | null;
  assessmentRevision: string | null; analysisIssueId: string | null;
  executionIssueId: string | null; successorIssueId: string | null;
  rejectedRevision: string | null; ownerUserId: string;
};

export function dateInTimezone(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function nextRecurringDate(date: string, recurrence: "daily" | "weekly"): string {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + (recurrence === "daily" ? 1 : 7));
  return value.toISOString().slice(0, 10);
}
export function canCreateDraft(todo: { assistMode: string; status: string; revision: string; assessmentRevision: string | null; rejectedRevision: string | null; assessment: TodoAssessment | null }): boolean {
  return todo.status !== "done" && todo.status !== "cancelled" && todo.assistMode !== "off"
    && todo.revision === todo.assessmentRevision && todo.rejectedRevision !== todo.revision
    && todo.assessment?.proposedAction.kind === "draft"
    && ["can_execute", "can_prepare"].includes(todo.assessment.assistability)
    && todo.assessment.requiredInformation.length === 0
    && todo.assessment.requiredCapabilities.every(capability => ["text_generation", "draft"].includes(capability));
}
