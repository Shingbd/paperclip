#!/usr/bin/env node
// Loopback fixture only. This does not verify a model, SSH device or cloud document provider.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = (process.env.PAPERCLIP_API_URL ?? 'http://127.0.0.1:4310/api').replace(/\/$/, '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) throw new Error('Isolated loopback fixture required');
async function api(path, method = 'GET', body) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json(); assert(r.ok, `API ${method} ${path}: ${r.status}`); return data;
}
const companies = await api('/companies');
const company = companies.filter(x => x.name === '个人工作台 · 隔离模拟').sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
assert(company, 'Run personal-bootstrap.mjs --fake first');
const agents = await api(`/companies/${company.id}/agents`);
const coordinator = agents.find(x => x.name === 'Coordinator');
assert(coordinator.adapterConfig.command.endsWith('personal-fake-pi.mjs'), 'Must not run a real model');
let task;
if (process.argv.includes('--resume')) {
  const state = JSON.parse(await fs.readFile('.personal-runtime/workflow-acceptance.json', 'utf8'));
  assert.equal(state.companyId, company.id); task = await api(`/issues/${state.taskId}`);
} else {
  task = await api(`/companies/${company.id}/issues`, 'POST', { title: '模拟：多 Agent 设备证据与独立审查', description: '仅验证持久化协调，不访问真实设备或文档。保存 Worker 证据，Reviewer 独立重新读取证据，父任务等待依赖。', assigneeAgentId: coordinator.id, status: 'todo' });
  await fs.mkdir('.personal-runtime', { recursive: true });
  await fs.writeFile('.personal-runtime/workflow-acceptance.json', JSON.stringify({ companyId: company.id, taskId: task.id }));
}
const until = Date.now() + 240_000;
while (Date.now() < until) {
  task = await api(`/issues/${task.id}`);
  if (task.status === 'done') break;
  await new Promise(r => setTimeout(r, 3000));
}
assert.equal(task.status, 'done', `Workflow did not finish: ${task.status}`);
const result = await api(`/companies/${company.id}/issues?parentId=${task.id}`);
const children = (Array.isArray(result) ? result : result.items).filter(x => x.parentId === task.id);
assert.equal(children.length, 2);
assert(children.every(x => x.status === 'done'));
assert.equal(new Set(children.map(x => x.assigneeAgentId)).size, 2);
for (const child of [...children, task]) {
  const document = await api(`/issues/${child.id}/documents/report`);
  assert(document.body.includes('模拟'));
  assert(document.latestRevisionId);
}
console.log(JSON.stringify({ layer: 'isolated API + PostgreSQL + fake Pi roles', companyId: company.id, taskId: task.id, passed: ['persistent decomposition', 'different worker/reviewer identities', 'dependency wait', 'reviewer rereads stored evidence', 'three versioned report documents', 'parent completion after children'], notTested: ['real Pi/model', 'SSH', 'external document publication', 'distributed recovery'] }, null, 2));
