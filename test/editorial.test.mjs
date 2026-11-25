import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDocument, loadContent } from '../scripts/lib/content-files.mjs';
import { importWriter } from '../scripts/content.mjs';
import { planTransition, applyTransition, rawSha256, runEditorial, editorialReadiness } from '../scripts/editorial.mjs';

const now = Date.parse('2026-11-24T09:00:00+08:00');
const source = { title: '流程測試用來源', url: 'https://example.org/' };
const executable = fileURLToPath(new URL('../scripts/editorial.mjs', import.meta.url));
function withWorkspace(fn) {
  const root = mkdtempSync(path.join(os.tmpdir(), '3j-editorial-'));
  try {
    mkdirSync(path.join(root, 'src/content/authors'), { recursive: true });
    mkdirSync(path.join(root, 'src/content/articles'), { recursive: true });
    writeFileSync(path.join(root, 'src/content/authors/3j-editorial.md'), serializeDocument({ name: '測試團隊', bioShort: '測試用署名', isOrganization: true }, ''));
    return fn(root);
  } finally {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(root).startsWith('3j-editorial-'));
    rmSync(root, { recursive: true, force: true });
  }
}
function article(root, id, extra = {}, body = '## 測試內容\n\n這是編輯流程的中性測試資料。') {
  const file = path.join(root, 'src/content/articles', `${id}.md`);
  writeFileSync(file, serializeDocument({ title: `${id} 編輯測試`, description: '中性流程測試', status: 'draft', author: '3j-editorial', references: [source], ...extra }, body));
  return file;
}

test('Writer 接稿可計畫發布，預設不改檔；寫入同步 draft=false，保留穩定識別碼與其他文章', () => withWorkspace((root) => {
  importWriter({ schemaVersion: 1, jobId: 'editorial-job', article: { slug: 'writer-flow', title: '接稿流程測試', description: '中性測試', references: [source] }, body: '測試正文。' }, { root });
  const otherFile = article(root, 'other');
  const untouched = readFileSync(otherFile, 'utf8');
  const file = path.join(root, 'src/content/articles/writer-flow.md');
  const original = readFileSync(file, 'utf8');
  const plan = planTransition(root, 'writer-flow', 'published', { now });
  assert.equal(plan.summary.dryRun, true);
  assert.equal(plan.summary.written, false);
  assert.equal(plan.summary.dateWasSetToNow, true);
  assert.equal(plan.summary.publishDate, '2026-11-24T09:00:00.000+08:00');
  assert.equal(readFileSync(file, 'utf8'), original);
  const result = applyTransition(plan);
  assert.equal(result.written, true);
  const published = loadContent(root).articles.find((entry) => entry.data.slug === 'writer-flow');
  assert.equal(published.data.status, 'published');
  assert.equal(published.data.draft, false);
  assert.equal(published.data.writerJobId, 'editorial-job');
  assert.equal(readFileSync(otherFile, 'utf8'), untouched);
  assert.ok(!readdirSync(path.dirname(file)).some((name) => name.endsWith('.tmp')));
}));

test('排程要求明確未來日期，未明確改日期不能把 future 稿偷發布', () => withWorkspace((root) => {
  article(root, 'future', { status: 'scheduled', publishDate: '2099-01-01', draft: false });
  assert.throws(() => planTransition(root, 'future', 'published', { now }), /仍在未來/);
  assert.throws(() => planTransition(root, 'future', 'scheduled', { now }), /明確指定/);
  assert.throws(() => planTransition(root, 'future', 'scheduled', { date: '2000-01-01', now }), /尚未到期/);
  const scheduled = planTransition(root, 'future', 'scheduled', { date: '2099-02-01T10:00:00+08:00', now });
  assert.equal(scheduled.summary.publishDate, '2099-02-01T10:00:00.000+08:00');
  assert.equal(scheduled.summary.validationAt, scheduled.summary.publishDate);
  const explicit = planTransition(root, 'future', 'published', { date: '2000-01-01', now });
  assert.equal(explicit.summary.publishDate, '2000-01-01T00:00:00.000+08:00');
  const review = planTransition(root, 'future', 'review', { now });
  assert.equal(review.summary.publishDate, '2099-01-01T00:00:00.000+08:00');
  assert.equal(review.summary.draft, true);
  assert.throws(() => planTransition(root, 'future', 'draft', { date: '2000-01-01', now }), /不改日期/);
}));

test('發布及排程在寫入前驗來源、正文、素材與完整關聯，失敗不動原稿', () => withWorkspace((root) => {
  const file = article(root, 'incomplete', { references: [] });
  const original = readFileSync(file, 'utf8');
  assert.throws(() => planTransition(root, 'incomplete', 'published', { now }), /資料來源/);
  assert.equal(editorialReadiness(root, 'incomplete', { now }).canPublish, false);
  assert.equal(readFileSync(file, 'utf8'), original);
  article(root, 'incomplete', { references: [source] }, '');
  assert.throws(() => planTransition(root, 'incomplete', 'scheduled', { date: '2099-01-01', now }), /空白正文/);
  article(root, 'incomplete', { coverImage: '/content/missing.webp', coverAlt: '測試圖片' });
  assert.throws(() => planTransition(root, 'incomplete', 'published', { now }), /圖片不存在/);
  article(root, 'incomplete', {}, '[尚未公開的稿](/articles/hidden/)');
  article(root, 'hidden');
  assert.throws(() => planTransition(root, 'incomplete', 'scheduled', { date: '2099-01-01', now }), /未發布文章/);
}));

test('舊 SHA 或計畫後人工改稿會拒絕寫入，保留人工內容與原始網址', () => withWorkspace((root) => {
  const file = article(root, 'filename-alias', { slug: 'stable-slug', writerJobId: 'stable-job' });
  const original = readFileSync(file, 'utf8');
  assert.throws(() => planTransition(root, 'stable-slug', 'review', { expectedSha: '0'.repeat(64), now }), /expected-sha/);
  const plan = planTransition(root, 'stable-slug', 'review', { expectedSha: rawSha256(original), now });
  assert.equal(plan.summary.file, 'src/content/articles/filename-alias.md');
  const edited = original + '\n人工新增的註記。\n';
  writeFileSync(file, edited);
  assert.throws(() => applyTransition(plan), /其他編輯修改/);
  assert.equal(readFileSync(file, 'utf8'), edited);
  assert.ok(!readdirSync(path.dirname(file)).some((name) => name.endsWith('.tmp')));
}));

test('封存或退回草稿不能靜默破壞其他公開文章的內鏈', () => withWorkspace((root) => {
  const file = article(root, 'target', { status: 'published', draft: false, publishDate: '2000-01-01' });
  article(root, 'incoming', { status: 'published', draft: false, publishDate: '2000-01-01' }, '[目標文章](/articles/target/)');
  const original = readFileSync(file, 'utf8');
  assert.throws(() => planTransition(root, 'target', 'archived', { now }), /未發布文章/);
  assert.equal(readFileSync(file, 'utf8'), original);
}));

test('唯讀 list 顯示狀態、缺來源與封面，CLI預設dry-run、--write才修改', () => withWorkspace((root) => {
  const file = article(root, 'cli', { references: [] });
  const listed = runEditorial(['list', '--status', 'draft', '--json'], root);
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].missingSources, true);
  assert.equal(listed.items[0].missingCover, true);
  const invoke = (args) => spawnSync(process.execPath, [executable, ...args], { cwd: root, encoding: 'utf8', timeout: 15000, env: { ...process.env, CONTENT_BUILD_TIME: '2026-11-24T09:00:00+08:00' } });
  const original = readFileSync(file, 'utf8');
  const preview = invoke(['review', 'cli', '--json']);
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(JSON.parse(preview.stdout).written, false);
  assert.equal(readFileSync(file, 'utf8'), original);
  const written = invoke(['review', 'cli', '--write', '--json']);
  assert.equal(written.status, 0, written.stderr);
  assert.equal(JSON.parse(written.stdout).written, true);
  assert.equal(loadContent(root).articles[0].data.status, 'review');
  const blocked = invoke(['publish', 'cli', '--write', '--json']);
  assert.equal(blocked.status, 1);
  assert.equal(JSON.parse(blocked.stderr).ok, false);
  assert.throws(() => runEditorial(['archive', 'cli', '--write', '--dry-run'], root), /不能同時/);
  assert.throws(() => runEditorial(['list', '--write'], root), /唯讀命令/);
}));
