#!/usr/bin/env node
// Does not stop/start services: the operator controls only the isolated instance.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const base = 'http://127.0.0.1:4310/api';
async function api(path) { const r = await fetch(base + path, { signal: AbortSignal.timeout(5000) }); assert(r.ok, `API ${r.status}`); return r.json(); }
const statePath = '.personal-runtime/restart-acceptance.json';
async function snapshot(companyId, taskId) {
  const todos = (await api(`/companies/${companyId}/personal-todos`)).map(x => ({ id: x.id, status: x.status, title: x.title, dueDate: x.dueDate, successorIssueId: x.successorIssueId, ownerUserId: x.ownerUserId })).sort((a,b) => a.id.localeCompare(b.id));
  const parent = await api(`/issues/${taskId}`);
  assert.equal(parent.status, 'done');
  const report = await api(`/issues/${taskId}/documents/report`);
  return { companyId, taskId, todos, parentStatus: parent.status, reportRevision: report.latestRevisionId, reportHash: crypto.createHash('sha256').update(report.body).digest('hex') };
}
if (process.argv.includes('--before')) {
  const workflow = JSON.parse(await fs.readFile('.personal-runtime/workflow-acceptance.json', 'utf8'));
  const state = await snapshot(workflow.companyId, workflow.taskId);
  assert(state.todos.length > 0);
  await fs.writeFile(statePath, JSON.stringify(state));
  console.log('Saved isolated todo/report snapshot; no service control was performed.');
} else {
  const before = JSON.parse(await fs.readFile(statePath, 'utf8'));
  assert.deepEqual(await snapshot(before.companyId, before.taskId), before);
  console.log(JSON.stringify({ layer: 'real isolated center restart + fixture PostgreSQL', passed: ['human todo state/ownership persists', 'recurrence successor identity persists', 'completed workflow persists', 'report content and revision persist'], notTested: ['in-flight run recovery', 'remote process recovery', 'network partition', 'external side effects'] }, null, 2));
}
