#!/usr/bin/env node
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fake = process.argv.includes('--fake');
const base = (process.env.PAPERCLIP_API_URL ?? 'http://127.0.0.1:4310/api').replace(/\/$/, '');
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) throw new Error('Bootstrap requires loopback; use the authenticated UI for network deployment');
async function api(route, body) {
  const response = await fetch(`${base}${route}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(process.env.PAPERCLIP_BOARD_API_KEY ? { Authorization: `Bearer ${process.env.PAPERCLIP_BOARD_API_KEY}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json(); if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(result)}`); return result;
}
const company = await api('/companies', { name: fake ? '个人工作台 · 隔离模拟' : '个人工作台', description: '人类待办与 Pi Agent 协作；授权边界由程序控制', issuePrefix: fake ? 'SIM' : 'LIFE' });
const roles = [['Coordinator', 'ceo'], ['VPS Operator', 'engineer'], ['Server Worker', 'engineer'], ['Reviewer', 'qa']];
let manager;
for (const [name, role] of roles) {
  const slug = name.toLowerCase().replaceAll(' ', '-');
  const cwd = path.join(root, '.personal-runtime', 'workspaces', company.id, slug);
  const piDir = path.join(root, '.personal-runtime', 'pi-config', company.id, slug);
  await fs.mkdir(cwd, { recursive: true }); await fs.mkdir(piDir, { recursive: true });
  const agent = await api(`/companies/${company.id}/agents`, { name, role, status: fake ? 'idle' : 'paused', reportsTo: manager ?? null,
    capabilities: `${name}; real devices require explicit environment binding; no root shell`, adapterType: 'pi_local',
    adapterConfig: { command: fake ? path.join(root, 'scripts/personal-fake-pi.mjs') : process.env.PERSONAL_PI_COMMAND ?? 'pi',
      cwd, model: fake ? 'fake/fixture' : process.env.PERSONAL_PI_MODEL ?? '', timeoutSec: 120, graceSec: 5,
      instructionsFilePath: path.join(root, 'personal/roles', `${slug}.md`),
      env: { PI_CODING_AGENT_DIR: piDir, PI_SKIP_VERSION_CHECK: '1', PI_TELEMETRY: '0' } },
    runtimeConfig: { heartbeat: { enabled: true, intervalSec: 0, wakeOnDemand: true, maxConcurrentRuns: 1 } }, budgetMonthlyCents: fake ? 100 : 10 });
  if (!manager) manager = agent.id;
}
console.log(JSON.stringify({ companyId: company.id, mode: fake ? 'FAKE — no real Pi/model/device access' : 'REAL configuration only — all roles paused', url: `http://127.0.0.1:4310/${company.issuePrefix}/personal` }, null, 2));
