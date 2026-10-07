import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useCompany } from "../context/CompanyContext";
import { api } from "../api/client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { dateInTimezone, canCreateDraft, type PersonalTodo, type PersonalTodoInput, type Agent, type Issue } from "@paperclipai/shared";

type View = "收件箱" | "今天" | "即将到期" | "已完成" | "AI 可帮忙" | "待我处理" | "已归档";
const blank = (): PersonalTodoInput => ({ title: "", description: "", category: "收件箱", dueDate: null,
  dueAt: null, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, recurrence: "none", assistMode: "off",
  automaticAnalysis: false, coordinatorId: null, clientRequestId: crypto.randomUUID() });

export function PersonalWorkspace() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const client = useQueryClient();
  const [form, setForm] = useState<PersonalTodoInput>(blank);
  const [editing, setEditing] = useState<PersonalTodo | null>(null);
  const [view, setView] = useState<View>("收件箱");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [coordinatorId, setCoordinatorId] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const base = `/companies/${selectedCompanyId}/personal-todos`;
  const key = ["personal-todos", selectedCompanyId];
  const todos = useQuery({ queryKey: key, queryFn: () => api.get<PersonalTodo[]>(base), enabled: !!selectedCompanyId, refetchInterval: 10000 });
  const agents = useQuery({ queryKey: ["personal-agents", selectedCompanyId], queryFn: () => api.get<Agent[]>(`/companies/${selectedCompanyId}/agents`), enabled: !!selectedCompanyId });
  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await fn(); await client.invalidateQueries({ queryKey: key }); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  const prefix = `/${selectedCompany?.issuePrefix ?? ""}`;
  const eligibleAgents = (agents.data ?? []).filter(agent => agent.adapterType === "pi_local" && agent.status !== "terminated");
  const shown = (todos.data ?? []).filter(todo => {
    if (category && todo.category !== category) return false;
    const completed = todo.status === "done";
    if (view === "已完成") return completed;
    if (view === "已归档") return todo.status === "cancelled";
    if (completed || todo.status === "cancelled") return false;
    const due = todo.dueDate ?? (todo.dueAt ? dateInTimezone(new Date(todo.dueAt), todo.timezone) : null);
    const today = dateInTimezone(new Date(), todo.timezone);
    if (view === "今天") return due !== null && due <= today;
    if (view === "即将到期") return due !== null && due > today;
    if (view === "AI 可帮忙") return !!todo.assessment && todo.assessmentRevision === todo.revision;
    if (view === "待我处理") return todo.assessment?.assistability === "needs_information" || todo.assessment?.assistability === "human_action" || !!todo.executionIssueId;
    return !due;
  });
  if (!selectedCompanyId) return <p>请先创建并选择一个个人工作台（Company）。</p>;
  return <main className="flex flex-col gap-4 p-4">
    <h1 className="text-xl font-semibold">Agent 工作台 · 我的生活与工作</h1>
    <p className="text-muted-foreground">生活待办默认由你完成。AI 仅在显式开放范围内分析；首版自动执行只支持无工具的草稿／清单，不预约、不购买、不发送消息。</p>
    {(error || todos.error) && <p role="alert" className="text-destructive">{error || String(todos.error)}</p>}
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">给协调 Agent 提需求</h2>
      <Input aria-label="需求" value={request} onChange={e => setRequest(e.target.value)} placeholder="例如：只读检查两台设备的服务访问问题" />
      <Input aria-label="文档引用" value={documentUrl} onChange={e => setDocumentUrl(e.target.value)} placeholder="Notion / 飞书文档链接（引用，不代表已读取）" />
      <select className="border rounded-md p-2" aria-label="协调 Agent" value={coordinatorId} onChange={e => setCoordinatorId(e.target.value)}>
        <option value="">选择 Pi 协调 Agent（使用其绑定环境与月预算）</option>
        {eligibleAgents.map(agent => <option key={agent.id} value={agent.id}>{agent.name} · {agent.status} · 月预算 {agent.budgetMonthlyCents} 美分</option>)}
      </select>
      <Button disabled={busy || !request.trim() || !coordinatorId} onClick={() => act(async () => {
        const task = await api.post<Issue>(`/companies/${selectedCompanyId}/issues`, { title: request.slice(0, 120),
          description: `${request}${documentUrl ? `\n需求文档引用：${documentUrl}\n读取前验证文档连接权限，保存引用版本。` : ""}\n拆解子任务，保存验收标准，等待独立 Reviewer 的证据；不能提前完成父任务。`,
          assigneeAgentId: coordinatorId, status: "todo", idempotencyKey: requestId });
        setRequest(""); setDocumentUrl(""); setRequestId(crypto.randomUUID());
        window.location.assign(`${prefix}/issues/${task.identifier ?? task.id}`);
      })}>保存需求并提交后台</Button>
      <p className="text-muted-foreground">设备、月预算和单次运行时限在 Agent 配置中设置；没有每任务硬预算承诺。<Link to={`${prefix}/agents`}>配置 Agent</Link> · <Link to={`${prefix}/company/settings/instance/environments`}>执行环境（实验开关）</Link> · <Link to={`${prefix}/apps`}>文档连接</Link></p>
    </section>
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">{editing ? "编辑待办" : "快速记录生活待办"}</h2>
      <Input aria-label="待办标题" value={form.title} placeholder="准备旅行行李清单" onChange={e => setForm({ ...form, title: e.target.value })} />
      <details><summary>日期、分类与 AI 协助（默认关闭）</summary>
        <div className="flex flex-col gap-2">
          <Input aria-label="待办描述" placeholder="描述／完成标准（可选）" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <Input aria-label="分类" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
          <label>仅日期 <Input aria-label="到期日期" type="date" value={form.dueDate ?? ""} onChange={e => setForm({ ...form, dueDate: e.target.value || null, dueAt: null })} /></label>
          <label>具体时间（ISO 8601，包含时区偏移）<Input aria-label="到期时间" placeholder="2026-10-09T18:00:00+08:00" value={form.dueAt ?? ""} onChange={e => setForm({ ...form, dueAt: e.target.value || null, dueDate: null })} /></label>
          <label>用户时区 <Input aria-label="时区" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} /></label>
          <select aria-label="重复规则" className="border rounded-md p-2" value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value as PersonalTodoInput["recurrence"] })}>
            <option value="none">不重复</option><option value="daily">每天（仅日期）</option><option value="weekly">每周（仅日期）</option>
          </select>
          <select aria-label="AI 协助模式" className="border rounded-md p-2" value={form.assistMode} onChange={e => setForm({ ...form, assistMode: e.target.value as PersonalTodoInput["assistMode"], automaticAnalysis: false })}>
            <option value="off">关闭：不发送给模型</option><option value="suggest">建议：确认后生成草稿</option><option value="auto_draft">预授权：自动生成无工具草稿／清单</option>
          </select>
          <select aria-label="待办分析 Agent" className="border rounded-md p-2" value={form.coordinatorId ?? ""} onChange={e => setForm({ ...form, coordinatorId: e.target.value || null })}>
            <option value="">选择 Pi Agent</option>{eligibleAgents.map(agent => <option key={agent.id} value={agent.id}>{agent.name} · {agent.status}</option>)}
          </select>
          <label><input type="checkbox" disabled={form.assistMode === "off"} checked={form.automaticAnalysis} onChange={e => setForm({ ...form, automaticAnalysis: e.target.checked })} /> 开启后台每日检查：只分析变更版本，滚动 24 小时最多 5 条，使用 Agent 月预算</label>
          <p className="text-muted-foreground">关闭协助／修改待办会废弃旧建议、取消子任务的新工作；已进行的模型推理可能完成，但旧结果不会获得授权。此开关不是公司内任务隐私 ACL。</p>
        </div>
      </details>
      <div className="flex justify-between gap-2">
        <Button variant="ghost" onClick={() => { setEditing(null); setForm(blank()); }}>取消／清空</Button>
        <Button disabled={busy || !form.title.trim()} onClick={() => act(async () => {
          if (editing) await api.put(`${base}/${editing.id}`, { ...form, revision: editing.revision });
          else await api.post(base, form);
          setEditing(null); setForm(blank());
        })}>{editing ? "保存修改" : "添加待办"}</Button>
      </div>
    </section>
    <nav className="flex flex-wrap gap-2" aria-label="待办视图">
      {(["收件箱", "今天", "即将到期", "已完成", "AI 可帮忙", "待我处理", "已归档"] as View[]).map(value => <Button key={value} variant={value === view ? "default" : "outline"} onClick={() => setView(value)}>{value}</Button>)}
      <select className="border rounded-md p-2" aria-label="分类筛选" value={category} onChange={e => setCategory(e.target.value)}><option value="">全部分类</option>{[...new Set((todos.data ?? []).map(todo => todo.category))].map(value => <option key={value}>{value}</option>)}</select>
    </nav>
    {todos.isLoading ? <p>正在读取持久待办…</p> : !shown.length ? <p>这个视图没有待办。</p> : shown.map(todo => <article key={todo.id} className="flex flex-col gap-2 border rounded-md p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" disabled={busy} onClick={() => act(() => api.post(`${base}/${todo.id}/complete`, { completed: !["done", "cancelled"].includes(todo.status) }))}>{todo.status === "cancelled" ? "恢复待办" : todo.status === "done" ? "撤销完成" : "我已完成"}</Button>
        <Link to={`${prefix}/issues/${todo.identifier ?? todo.id}`}>{todo.title}</Link>
        <span className="text-muted-foreground">{todo.category} · {todo.dueDate ?? todo.dueAt ?? "无到期日"} · {todo.executionIssueId ? "AI 正在帮忙／待我验收" : "我来做"}</span>
        <Button variant="ghost" onClick={() => { setEditing(todo); setForm({ title: todo.title, description: todo.description, category: todo.category, dueDate: todo.dueDate, dueAt: todo.dueAt, timezone: todo.timezone, recurrence: todo.recurrence, assistMode: todo.assistMode, automaticAnalysis: todo.automaticAnalysis, coordinatorId: todo.coordinatorId, clientRequestId: todo.clientRequestId }); }}>编辑</Button>
        <Button variant="ghost" disabled={busy || todo.assistMode === "off" || ["done", "cancelled"].includes(todo.status)} onClick={() => act(() => api.post(`${base}/${todo.id}/analyze`, {}))}>让 AI 帮我看看</Button>
      </div>
      {todo.status !== "cancelled" && <Button variant="ghost" disabled={busy} onClick={() => {
        if (window.confirm("归档此待办并取消未来协助？历史和已保存成果会保留。")) void act(() => api.post(`${base}/${todo.id}/archive`, {}));
      }}>归档（保留历史）</Button>}
      <p>AI 可见范围：{todo.assistMode === "off" ? "不送模型" : "此待办的标题、描述、分类和到期日期"} · 定期检查{todo.automaticAnalysis ? "已开启" : "已关闭"}</p>
      {todo.analysisIssueId && <Link to={`${prefix}/issues/${todo.analysisIssueId}`}>查看真实分析任务／运行日志（失败请在任务中处理）</Link>}
      {todo.assessment && todo.assessmentRevision === todo.revision && <div className="flex flex-col gap-2">
        <p>{todo.assessment.reason}</p><p>{todo.assessment.proposedAction.instructions}</p>
        <p>程序授权：{todo.assessmentReport?.authorization_result === "authorized" ? "已在授权范围内" : todo.assessmentReport?.authorization_result === "confirmation_required" ? "待你确认" : "当前不可执行"}</p>
        {todo.assessment.requiredInformation.map(question => <p key={question}>待我回答：{question}</p>)}
        <div className="flex gap-2"><Button disabled={busy || !canCreateDraft(todo) || !!todo.executionIssueId} onClick={() => act(() => api.post(`${base}/${todo.id}/accept`, { revision: todo.revision }))}>授权生成草稿／清单</Button>
          <Button variant="outline" disabled={busy} onClick={() => act(() => api.post(`${base}/${todo.id}/reject`, { revision: todo.revision }))}>拒绝本版建议</Button></div>
      </div>}
      {todo.executionIssueId && <Link to={`${prefix}/issues/${todo.executionIssueId}`}>查看 AI 子任务与成果（不会自动勾选原待办）</Link>}
    </article>)}
  </main>;
}
