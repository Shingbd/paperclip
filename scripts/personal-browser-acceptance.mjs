#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
const base = 'http://127.0.0.1:4310';
const companies = await (await fetch(base + '/api/companies')).json();
const company = companies.filter(x => x.name === '个人工作台 · 隔离模拟').sort((a,b) => Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
assert(company, 'Run the fake bootstrap first');
await fs.mkdir('.personal-runtime/browser-evidence', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
  await page.goto(`${base}/${company.issuePrefix}/personal`);
  await page.getByRole('heading', { name: 'Agent 工作台 · 我的生活与工作' }).waitFor();
  const title = `模拟：浏览器记录 ${Date.now()}`;
  await page.getByLabel('待办标题', { exact: true }).fill(title);
  await page.getByRole('button', { name: '添加待办', exact: true }).click();
  const card = page.locator('article').filter({ has: page.getByRole('link', { name: title, exact: true }) });
  await card.waitFor();
  assert(await card.getByRole('button', { name: '让 AI 帮我看看' }).isDisabled());
  await card.getByRole('button', { name: '我已完成', exact: true }).click();
  await page.getByRole('button', { name: '已完成', exact: true }).click();
  await card.getByRole('button', { name: '撤销完成' }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: '已完成', exact: true }).click();
  await card.getByRole('button', { name: '撤销完成' }).waitFor();
  await card.getByRole('button', { name: '撤销完成' }).click();
  await page.getByRole('button', { name: '收件箱', exact: true }).click();
  await card.getByRole('button', { name: '我已完成', exact: true }).waitFor();
  await page.screenshot({ path: '.personal-runtime/browser-evidence/personal-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '.personal-runtime/browser-evidence/personal-mobile.png', fullPage: true });
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log(JSON.stringify({ layer: 'real Chromium + isolated fake company', passed: ['Chinese route renders', 'create todo through UI', 'AI off disables analysis', 'human completion', 'completion survives reload', 'undo completion', 'desktop/mobile screenshots', 'no uncaught browser errors'], notTested: ['cross-device login', 'real model/device/provider'] }, null, 2));
} finally { await browser.close(); }
