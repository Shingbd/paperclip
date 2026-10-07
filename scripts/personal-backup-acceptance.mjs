#!/usr/bin/env node
// Opt-in logical database roundtrip only. Never overwrites or drops a database.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDb } from '../packages/db/src/client.ts';
import { runDatabaseBackup, runDatabaseRestore } from '../packages/db/src/backup-lib.ts';
if (process.env.PERSONAL_ALLOW_ISOLATED_RESTORE !== '1') throw new Error('Explicit PERSONAL_ALLOW_ISOLATED_RESTORE=1 required');
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
process.umask(0o077);
const health = await (await fetch('http://127.0.0.1:4310/api/health')).json();
assert.equal(health.status, 'ok');
await fs.access('.personal-runtime/state/instances/default/db/PG_VERSION');
// Public upstream development defaults, restricted to this isolated loopback cluster.
const url = 'postgres://paperclip:paperclip@127.0.0.1:54329/paperclip';
const source = createDb(url);
let target;
const database = `personal_restore_${Date.now()}`;
try {
  const tables = ['personal_todos', 'issues', 'documents', 'document_revisions'];
  const before = {};
  for (const table of tables) before[table] = Number((await source.$client.unsafe(`select count(*) as n from "${table}"`))[0].n);
  const backup = await runDatabaseBackup({ connectionString: url, backupDir: '.personal-runtime/restore-evidence/backups', filenamePrefix: 'personal-acceptance', retention: { dailyDays: 7, weeklyWeeks: 4, monthlyMonths: 1 } });
  await source.$client.unsafe(`create database "${database}"`);
  const targetUrl = url.replace(/\/paperclip$/, '/' + database);
  await runDatabaseRestore({ connectionString: targetUrl, backupFile: backup.backupFile });
  target = createDb(targetUrl);
  const restored = {};
  for (const table of tables) restored[table] = Number((await target.$client.unsafe(`select count(*) as n from "${table}"`))[0].n);
  assert.deepEqual(restored, before, 'Run only after fixture tests are idle; counts changed during backup');
  console.log(JSON.stringify({ layer: 'real logical backup/restore of isolated fixture PostgreSQL', database, backupBytes: backup.sizeBytes, restoredCounts: restored, passed: ['upstream logical backup', 'restore into a newly created database', 'todo/issue/document/revision counts preserved'], notTested: ['application restart on restored database', 'secret decryption', 'attachments and Pi sessions', 'remote process reconciliation', 'full disaster recovery'] }, null, 2));
} finally {
  if (target) await target.$client.end();
  await source.$client.end();
}
