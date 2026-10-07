#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const base = process.env.PAPERCLIP_API_URL ?? 'http://127.0.0.1:4310/api';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Acceptance is loopback-only');
async function api(route, method = 'GET', body, expected = 200) {
  const res = await fetch(`${base}${route}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json(); assert.equal(res.status, expected, JSON.stringify(data)); return data;
}
const companies = await api('/companies');
const company = companies.filter(value => value.name === '个人工作台 · 隔离模拟').sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
assert(company, 'Run personal-bootstrap.mjs --fake in the isolated test instance first');
const agents = await api(`/companies/${company.id}/agents`);
const coordinator = agents.find(agent => agent.name === 'Coordinator');
assert(coordinator?.adapterConfig?.command?.includes('personal-fake-pi'), 'Refuse real model/device execution');
const route = `/companies/${company.id}/personal-todos`;
const input = title => ({ title, timezone: 'Asia/Shanghai', clientRequestId: crypto.randomUUID() });
const request = input('模拟：收件箱快速记录');
const created = await Promise.all(Array.from({ length: 4 }, () => api(route, 'POST', request, 201)));
assert.equal(new Set(created.map(todo => todo.id)).size, 1, 'concurrent idempotent create');
const parent = await api(`/issues/${created[0].id}`);
assert.equal(parent.assigneeAgentId, null); assert(parent.assigneeUserId, 'human assignee');
assert.equal(created[0].assistMode, 'off');
await api(`${route}/${parent.id}/analyze`, 'POST', {}, 403);
// A real platform API key for a fixture Agent, retained only in memory and revoked.
const key = await api(`/agents/${coordinator.id}/keys`, 'POST', { name: 'personal-authorization-fixture' }, 201);
try {
  for (const [path, method, body] of [[route, 'GET', undefined], [`${route}/${parent.id}/accept`, 'POST', { revision: created[0].revision }]]) {
    const response = await fetch(base + path, { method, headers: { Authorization: `Bearer ${key.token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    assert.equal(response.status, 403, 'Agent must not access human authorization endpoints');
  }
} finally { await api(`/agents/${coordinator.id}/keys/${key.id}`, 'DELETE'); }
const repeat = await api(route, 'POST', { ...input('模拟：每天喝水'), dueDate: '2026-10-09', recurrence: 'daily' }, 201);
const completed = await Promise.all([1, 2].map(() => api(`${route}/${repeat.id}/complete`, 'POST', { completed: true })));
assert(completed[0].successorIssueId); assert.equal(completed[0].successorIssueId, completed[1].successorIssueId);
await api(`${route}/${repeat.id}/complete`, 'POST', { completed: false });
const again = await api(`${route}/${repeat.id}/complete`, 'POST', { completed: true });
assert.equal(again.successorIssueId, completed[0].successorIssueId);
const next = (await api(route)).find(todo => todo.id === again.successorIssueId);
assert.equal(next.dueDate, '2026-10-10');
const travel = await api(route, 'POST', { ...input('准备旅行行李清单'), assistMode: 'suggest', coordinatorId: coordinator.id }, 201);
const dentist = await api(route, 'POST', { ...input('预约牙医'), assistMode: 'suggest', coordinatorId: coordinator.id }, 201);
const running = await api(route, 'POST', { ...input('跑步半小时'), assistMode: 'suggest', coordinatorId: coordinator.id }, 201);
for (const todo of [travel, dentist, running]) {
  const first = await api(`${route}/${todo.id}/analyze`, 'POST', {}, 202);
  const second = await api(`${route}/${todo.id}/analyze`, 'POST', {}, 202);
  assert.equal(first.analysisIssueId, second.analysisIssueId, 'analysis version deduplication');
}
async function wait(predicate, label, timeout = 180000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const list = await api(route); if (predicate(list)) return list; await new Promise(resolve => setTimeout(resolve, 2000)); }
  throw new Error(`Timed out waiting for ${label}`);
}
const assessed = await wait(list => [travel, dentist, running].every(todo => list.find(value => value.id === todo.id)?.assessment), 'fake Pi assessment through Paperclip');
const travelNow = assessed.find(todo => todo.id === travel.id);
assert.equal(travelNow.assessmentReport.todo_id, travel.id);
assert.equal(travelNow.assessmentReport.assessed_revision, travelNow.revision);
assert.equal(travelNow.assessmentReport.authorization_result, 'confirmation_required');
assert.equal(assessed.find(todo => todo.id === dentist.id).assessment.assistability, 'needs_information');
assert.equal(assessed.find(todo => todo.id === running.id).assessment.assistability, 'human_action');
await api(`${route}/${running.id}/accept`, 'POST', { revision: assessed.find(todo => todo.id === running.id).revision }, 409);
const accepted = await Promise.all([1, 2].map(() => api(`${route}/${travel.id}/accept`, 'POST', { revision: travelNow.revision })));
assert.equal(accepted[0].executionIssueId, accepted[1].executionIssueId, 'concurrent acceptance deduplication');
assert.equal(accepted[0].assessmentReport.authorization_result, 'authorized');
await wait(asyncList => asyncList.find(todo => todo.id === travel.id)?.executionIssueId, 'draft task');
const end = Date.now() + 180000;
let draft;
while (Date.now() < end) { draft = await api(`/issues/${accepted[0].executionIssueId}`); if (draft.status === 'done') break; await new Promise(resolve => setTimeout(resolve, 2000)); }
assert.equal(draft.status, 'done');
assert.equal((await api(`/issues/${travel.id}`)).status, 'todo', 'draft must not complete human action');
const documents = await api(`/issues/${travel.id}/documents`); assert(documents.some(document => document.key.startsWith('draft-')), 'draft saved as persistent artifact');
await api(`${route}/${dentist.id}/reject`, 'POST', { revision: assessed.find(todo => todo.id === dentist.id).revision });
const changed = await api(`${route}/${travel.id}`, 'PUT', { ...input('准备新的旅行清单'), clientRequestId: travel.clientRequestId, assistMode: 'off', revision: travelNow.revision });
assert.equal(changed.assessment, null);
await api(`${route}/${travel.id}/accept`, 'POST', { revision: travelNow.revision }, 409);
const archived = await api(`${route}/${parent.id}/archive`, 'POST', {});
assert.equal(archived.status, 'cancelled');
assert.equal((await api(`/issues/${parent.id}`)).status, 'cancelled', 'history is retained');
await api(`${route}/${parent.id}/complete`, 'POST', { completed: false });
const report = { layer: 'isolated API + PostgreSQL + fake Pi executable', companyId: company.id,
  passed: ['concurrent create idempotency', 'human ownership and AI off', 'Agent authorization endpoints denied', 'date-only recurrence exactly one successor', 'completion undo', 'manual assessment dedup', 'travel/dentist/running classifications (fixture)', 'concurrent draft acceptance', 'draft artifact persistence', 'human task not auto-completed', 'stale authorization rejection', 'program-computed structured authorization report', 'archive and restore without deleting history'],
  notTested: ['real model', 'remote SSH', 'Tailscale reachability', 'real Notion/Feishu', 'network partition', 'cross-device crash recovery'] };
console.log(JSON.stringify(report, null, 2));
