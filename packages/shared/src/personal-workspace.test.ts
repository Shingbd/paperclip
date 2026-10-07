import { describe, expect, it } from "vitest";
import { personalTodoSchema, todoAssessmentSchema, canCreateDraft, dateInTimezone, nextRecurringDate } from "./personal-workspace.js";
const input = { title: "准备旅行行李清单", timezone: "Asia/Shanghai", clientRequestId: "9e5f3fb3-46aa-4bf3-a1d0-a6f27e410111" };
const assessment = { assistability: "can_prepare" as const, reason: "可以生成清单，但不等于已打包", proposedAction: { kind: "draft" as const, instructions: "整理清单", acceptanceCriteria: "包含旅行所需物品" }, requiredInformation: [], requiredCapabilities: [] };
const todo = { assistMode: "suggest", status: "todo", revision: "current", assessmentRevision: "current", rejectedRevision: null, assessment };
describe("personal todo policy and calendar contracts", () => {
  it("defaults to human control with no model disclosure", () => {
    expect(personalTodoSchema.parse(input)).toMatchObject({ assistMode: "off", automaticAnalysis: false, recurrence: "none" });
  });
  it.each(["2026-02-30", "2026-13-01", "2026-00-01"])("rejects impossible calendar date %s without throwing a RangeError", dueDate => {
    expect(personalTodoSchema.safeParse({ ...input, dueDate }).success).toBe(false);
  });
  it("does not conflate a date with a precise instant", () => {
    expect(personalTodoSchema.safeParse({ ...input, dueDate: "2026-10-09", dueAt: "2026-10-09T18:00:00+08:00" }).success).toBe(false);
  });
  it("requires an explicit coordinator and visible AI scope for automatic checks", () => {
    expect(personalTodoSchema.safeParse({ ...input, automaticAnalysis: true }).success).toBe(false);
  });
  it("rejects invalid timezone", () => expect(personalTodoSchema.safeParse({ ...input, timezone: "server-default" }).success).toBe(false));
  it("calculates today in the user's timezone, not server UTC", () => {
    expect(dateInTimezone(new Date("2026-10-07T20:00:00Z"), "Asia/Shanghai")).toBe("2026-10-08");
    expect(dateInTimezone(new Date("2026-10-07T02:00:00Z"), "America/Los_Angeles")).toBe("2026-10-06");
  });
  it("keeps date-only recurrence stable across daylight saving and year changes", () => {
    expect(nextRecurringDate("2026-12-31", "daily")).toBe("2027-01-01");
    expect(nextRecurringDate("2026-03-06", "weekly")).toBe("2026-03-13");
  });
  it("never accepts a model-supplied authorization claim", () => {
    expect(todoAssessmentSchema.safeParse({ ...assessment, authorization_result: "authorized" }).success).toBe(false);
  });
  it("permits only current, non-rejected, explicitly visible local drafts", () => {
    expect(canCreateDraft(todo)).toBe(true);
    for (const change of [{ assistMode: "off" }, { status: "done" }, { status: "cancelled" }, { assessmentRevision: "old" }, { rejectedRevision: "current" }]) {
      expect(canCreateDraft({ ...todo, ...change })).toBe(false);
    }
  });
  it("never grants external actions from a title or from suggestions", () => {
    expect(canCreateDraft({ ...todo, assessment: { ...assessment, proposedAction: { ...assessment.proposedAction, kind: "external_action" } } })).toBe(false);
  });
  it("fails closed for unavailable capabilities or unanswered questions", () => {
    expect(canCreateDraft({ ...todo, assessment: { ...assessment, requiredCapabilities: ["ssh", "payments"] } })).toBe(false);
    expect(canCreateDraft({ ...todo, assessment: { ...assessment, requiredInformation: ["目的地是什么？"] } })).toBe(false);
    expect(canCreateDraft({ ...todo, assessment: { ...assessment, requiredCapabilities: ["text_generation"] } })).toBe(true);
  });
  it("requires a human to run and requests information before preparing ambiguous appointments", () => {
    for (const assistability of ["human_action", "needs_information"] as const) expect(canCreateDraft({ ...todo, assessment: { ...assessment, assistability } })).toBe(false);
  });
});
