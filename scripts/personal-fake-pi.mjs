#!/usr/bin/env node
// Deterministic protocol fixture. Never runs shell commands or reads personal files.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const args = process.argv.slice(2);
if (args.includes('--version')) { console.log('personal-fake-pi/1 (NOT real Pi)'); process.exit(0); }
if (args.includes('--list-models')) { console.log('provider  model  context  max-out\nfake  fixture  8192  2048'); process.exit(0); }
const session = args[args.indexOf('--session') + 1];
const header = { type: 'session', version: 3, id: crypto.randomUUID(), cwd: process.cwd(), timestamp: new Date().toISOString() };
if (session) {
  const old = await fs.readFile(session, 'utf8').catch(() => '');
  if (!old.trim()) await fs.writeFile(session, JSON.stringify(header) + '\n');
}
const emit = event => console.log(JSON.stringify(event));
emit(header); emit({ type: 'agent_start' });
const prompt = args.at(-1) ?? '';
let text = '模拟草稿：\n- 衣物与洗漱用品\n- 证件、药品、充电器\n请根据行程确认；此成果不代表已打包。';
const runtimeUrl = (process.env.PAPERCLIP_API_URL ?? '').replace(/\/$/, '');
const base = runtimeUrl ? runtimeUrl.replace(/\/api$/, '') + '/api' : '';
async function api(path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${process.env.PAPERCLIP_API_KEY}`, 'X-Paperclip-Run-Id': process.env.PAPERCLIP_RUN_ID, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const result = await response.json();
  if (!response.ok) throw new Error(`Fixture API ${response.status}: ${JSON.stringify(result)}`);
  return result;
}
if (prompt.includes('仅输出一个 JSON 对象')) {
  const run = prompt.includes('跑步');
  const dentist = prompt.includes('牙医');
  text = JSON.stringify({ assistability: run ? 'human_action' : dentist ? 'needs_information' : 'can_prepare',
    reason: run ? '跑步必须由本人完成（模拟评估）' : dentist ? '预约需要时间地点偏好与单独外部动作授权（模拟评估）' : '可以整理草稿，不代表人类行动已完成（模拟评估）',
    proposedAction: { kind: run || dentist ? 'none' : 'draft', instructions: run ? '请本人完成运动' : dentist ? '请补充地点、时间与诊所偏好' : '根据已提供行程生成旅行行李清单', acceptanceCriteria: '用户核对，不自动完成原待办' },
    requiredInformation: dentist ? ['时间与地点偏好是什么？'] : [], requiredCapabilities: [] });
} else if (!args.includes('--no-tools') && base && process.env.PAPERCLIP_TASK_ID) {
  const task = await api(`/issues/${process.env.PAPERCLIP_TASK_ID}`);
  const companyId = process.env.PAPERCLIP_COMPANY_ID;
  const roster = await api(`/companies/${companyId}/agents`);
  const self = roster.find(agent => agent.id === process.env.PAPERCLIP_AGENT_ID);
  const comment = body => api(`/issues/${task.id}/comments`, 'POST', { body });
  const patch = body => api(`/issues/${task.id}`, 'PATCH', body);
  const report = async body => {
    const existing = await api(`/issues/${task.id}/documents/report`).catch(() => null);
    await api(`/issues/${task.id}/documents/report`, 'PUT', { title: '模拟验收证据', format: 'markdown', body, ...(existing?.latestRevisionId ? { baseRevisionId: existing.latestRevisionId } : {}) });
  };
  await api(`/issues/${task.id}/checkout`, 'POST', { agentId: self.id, expectedStatuses: ['todo', 'backlog', 'blocked', 'in_review'] });
  if (self.name === 'Coordinator') {
    const all = await api(`/companies/${companyId}/issues?parentId=${task.id}`);
    const children = (Array.isArray(all) ? all : all.items ?? []).filter(child => child.parentId === task.id);
    if (!children.length) {
      const worker = roster.find(agent => agent.name === 'Server Worker');
      const reviewer = roster.find(agent => agent.name === 'Reviewer');
      if (!worker || !reviewer) throw new Error('Fixture roles not installed');
      await comment('模拟协调：拆解为证据采集与独立审查；没有访问真实设备。');
      const execution = await api(`/companies/${companyId}/issues`, 'POST', { title: '模拟采集设备证据', parentId: task.id, assigneeAgentId: worker.id, status: 'todo', description: '生成明确标记为模拟的证据。验收：不声称真实网络结果。' });
      const review = await api(`/companies/${companyId}/issues`, 'POST', { title: '模拟独立审查', parentId: task.id, assigneeAgentId: reviewer.id, status: 'todo', blockedByIssueIds: [execution.id], description: `检查任务 ${execution.id} 的 report 文档，确认模拟标记；不可把模拟当真实测试。` });
      await patch({ status: 'blocked', blockedByIssueIds: [execution.id, review.id] });
      text = '模拟子任务已持久化，等待依赖；不是实际设备检查。';
    } else if (children.every(child => child.status === 'done')) {
      await report('# 模拟最终报告\nWorker 和 Reviewer 已完成模拟闭环。没有访问真实设备／真实文档。');
      await patch({ status: 'done', blockedByIssueIds: [] }); text = '模拟工作流完成，报告保存在任务文档。';
    } else {
      await patch({ status: 'blocked', blockedByIssueIds: children.filter(child => child.status !== 'done').map(child => child.id) });
      text = '继续等待模拟子任务。';
    }
  } else if (self.name === 'Reviewer') {
    const match = task.description.match(/检查任务 ([a-f0-9-]+)/);
    if (!match) throw new Error('Missing source evidence');
    const document = await api(`/issues/${match[1]}/documents/report`);
    if (!document.body?.includes('模拟')) throw new Error('Evidence did not disclose simulation');
    await report('# 模拟独立审查\n已通过平台重新读取 Worker 证据并核实模拟标记。真实设备结果未验证。');
    await patch({ status: 'done' }); text = '模拟审查通过。';
  } else {
    await comment('模拟步骤：仅产生合成证据，不采集当前服务器个人数据。');
    await report('# 模拟设备证据\n主机：fixture-server\n结果：合成数据，不是网络检测。');
    await patch({ status: 'done' }); text = '模拟执行完成。';
  }
}
const message = { role: 'assistant', content: [{ type: 'text', text }], provider: 'fake', model: 'fixture', api: 'openai-completions', stopReason: 'stop', timestamp: Date.now(), usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
emit({ type: 'message_end', message }); emit({ type: 'agent_end', messages: [message], willRetry: false }); emit({ type: 'agent_settled' });
