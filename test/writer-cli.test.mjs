import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { writerEnvelopeSchema } from '../src/content.schemas.mjs';
import { loadContent, serializeDocument } from '../scripts/lib/content-files.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const executable = path.join(repository, 'scripts/content.mjs');
const example = JSON.parse(readFileSync(path.join(repository, 'docs/examples/writer-draft.json'), 'utf8'));

function withWorkspace(fn) {
  const root = mkdtempSync(path.join(os.tmpdir(), '3j-writer-cli-'));
  try {
    mkdirSync(path.join(root, 'src/content/authors'), { recursive: true });
    writeFileSync(path.join(root, 'src/content/authors/3j-editorial.md'), serializeDocument({ name: '測試編輯團隊', bioShort: 'CLI 自動測試用署名', isOrganization: true }, ''));
    return fn(root);
  } finally {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(root).startsWith('3j-writer-cli-'));
    rmSync(root, { recursive: true, force: true });
  }
}

function call(root, payload, flags = []) {
  const file = path.join(root, 'writer-input.json');
  writeFileSync(file, typeof payload === 'string' ? payload : JSON.stringify(payload));
  const result = spawnSync(process.execPath, [executable, 'import', file, '--json', ...flags], {
    cwd: root, encoding: 'utf8', timeout: 15000,
    env: { ...process.env, CONTENT_BUILD_TIME: '2026-11-24T00:00:00+08:00' },
  });
  assert.equal(result.error, undefined, result.error?.message);
  const raw = result.status === 0 ? result.stdout : result.stderr;
  return { ...result, json: JSON.parse(raw) };
}

test('Writer 範例與共用 schema 一致，CLI dry-run 不寫入內容目錄', () => withWorkspace((root) => {
  const parsed = writerEnvelopeSchema.parse(example);
  assert.equal(parsed.article.slug, 'example-draft');
  const result = call(root, example, ['--dry-run']);
  assert.equal(result.status, 0);
  assert.equal(result.json.status, 'valid');
  assert.equal(result.json.draft, true);
  assert.equal(result.json.dryRun, true);
  assert.equal(existsSync(path.join(root, 'src/content/articles/example-draft.md')), false);
  assert.equal(loadContent(root).articles.length, 0);
}));

test('CLI 建立草稿、相同工單重送不改檔，不同內容或撞網址回報失敗', () => withWorkspace((root) => {
  const created = call(root, example);
  assert.equal(created.status, 0);
  assert.equal(created.json.status, 'created');
  const file = path.join(root, 'src/content/articles/example-draft.md');
  const initial = readFileSync(file, 'utf8');
  const repeat = call(root, example);
  assert.equal(repeat.status, 0);
  assert.equal(repeat.json.status, 'unchanged');
  assert.equal(readFileSync(file, 'utf8'), initial);
  const conflict = call(root, { ...example, body: '人工改稿不應被覆蓋。' });
  assert.equal(conflict.status, 1);
  assert.equal(conflict.json.ok, false);
  assert.match(conflict.json.error, /已存在且內容不同/);
  const collision = call(root, { ...example, jobId: 'different-job' });
  assert.equal(collision.status, 1);
  assert.match(collision.json.error, /文章網址已存在/);
  assert.equal(readFileSync(file, 'utf8'), initial);
}));

test('CLI 即使收到明確 published 仍只建立 draft，不直接公開', () => withWorkspace((root) => {
  const payload = structuredClone(example);
  payload.article.status = 'published';
  payload.article.draft = false;
  payload.article.publishDate = '2000-01-01T00:00:00+08:00';
  payload.article.references = [{ title: 'CLI 格式測試用網址', url: 'https://example.org/' }];
  const result = call(root, payload);
  assert.equal(result.status, 0);
  assert.equal(result.json.draft, true);
  const articles = loadContent(root).articles;
  assert.equal(articles.length, 1);
  assert.equal(articles[0].data.status, 'draft');
  assert.equal(articles[0].data.draft, true);
  const stats = spawnSync(process.execPath, [executable, 'stats', '--json'], { cwd: root, encoding: 'utf8', timeout: 15000 });
  assert.equal(stats.status, 0);
  assert.equal(JSON.parse(stats.stdout).public, 0);
}));

test('CLI 對不合法 JSON、錯誤欄位、HTML 與外部圖片回傳非零且不產生草稿', () => withWorkspace((root) => {
  const missingTitle = structuredClone(example);
  delete missingTitle.article.title;
  const invalidDate = structuredClone(example);
  invalidDate.article.publishDate = '2026-02-30';
  const payloads = [
    '{ invalid JSON',
    missingTitle,
    invalidDate,
    { ...example, schemaVersion: 2 },
    { ...example, body: '<script>alert(1)</script>' },
    { ...example, body: '![外部圖](https://example.org/image.webp)' },
  ];
  for (const payload of payloads) {
    const result = call(root, payload);
    assert.equal(result.status, 1);
    assert.equal(result.json.ok, false);
    assert.equal(typeof result.json.error, 'string');
    assert.equal(loadContent(root).articles.length, 0);
  }
}));
