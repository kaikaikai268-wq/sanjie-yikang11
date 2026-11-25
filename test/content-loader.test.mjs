import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { glob } from 'astro/loaders';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { articleSchema } from '../src/content.schemas.mjs';
import { taipeiMarkdownGlob } from '../src/lib/content-loader.mjs';
import { parseRawDocument } from '../src/lib/markdown-document.mjs';
import { isPublicFrontmatter, parseTaipeiDate } from '../src/lib/content-core.mjs';
import { loadContent } from '../scripts/lib/content-files.mjs';

const now = Date.parse('2026-11-25T00:30:00+08:00');
const options = { pattern: '**/*.md', base: './src/content/articles' };
async function withWorkspace(fn) {
  const root = mkdtempSync(path.join(os.tmpdir(), '3j-content-loader-'));
  try {
    mkdirSync(path.join(root, 'src/content/articles'), { recursive: true });
    return await fn(root);
  } finally {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(root).startsWith('3j-content-loader-'));
    rmSync(root, { recursive: true, force: true });
  }
}
function fixture(root, id, date, status = 'published', updatedDate = date) {
  writeFileSync(path.join(root, 'src/content/articles', `${id}.md`), `---\ntitle: ${id}\ndescription: 日期橋接回歸測試\nstatus: ${status}\npublishDate: ${date}\nupdatedDate: ${updatedDate}\n---\n\n## 正文\n\n日期解析測試。\n`);
}
function loaderContext(root) {
  const entries = new Map();
  const metadata = new Map();
  const counts = { clear: 0, parse: 0, render: 0 };
  const rootUrl = pathToFileURL(root + path.sep);
  const context = {
    collection: 'articles',
    config: { root: rootUrl, srcDir: new URL('src/', rootUrl), prerenderConflictBehavior: 'error' },
    logger: { warn() {}, error(message) { throw new Error(message); }, info() {} },
    meta: { get: (key) => metadata.get(key), set: (key, value) => metadata.set(key, value), has: (key) => metadata.has(key), delete: (key) => metadata.delete(key) },
    store: {
      keys: () => [...entries.keys()], values: () => [...entries.values()], entries: () => [...entries],
      get: (key) => entries.get(key), has: (key) => entries.has(key),
      set: (entry) => { entries.set(entry.id, entry); return true; },
      delete: (key) => entries.delete(key), clear: () => { counts.clear++; entries.clear(); },
      addAssetImports() {}, addModuleImport() {},
    },
    parseData: async ({ data }) => { counts.parse++; return articleSchema.parse(data); },
    generateDigest: (value) => createHash('sha256').update(value).digest('hex'),
    entryTypes: new Map([['.md', {
      // 使用 Astro 官方 parser 重現真實 glob 輸入，不能只用自家 parser 測自己。
      getEntryInfo: ({ contents }) => {
        const parsed = parseFrontmatter(contents);
        return { data: parsed.frontmatter, body: parsed.content };
      },
      getRenderFunction: async () => async ({ body }) => { counts.render++; return { html: `rendered:${body}`, metadata: { imagePaths: [] } }; },
    }]]),
  };
  return { context, entries, counts };
}

test('實際 Astro glob 的 UTC 午夜舊快取，經新 loader 轉為台北午夜且保留渲染流程', () => withWorkspace(async (root) => {
  fixture(root, 'date-published', '2026-11-25');
  fixture(root, 'date-scheduled', '2026-11-25', 'scheduled');
  const state = loaderContext(root);
  await glob(options).load(state.context);
  const old = state.entries.get('date-published');
  assert.equal(old.data.publishDate.toISOString(), '2026-11-25T00:00:00.000Z');
  assert.equal(isPublicFrontmatter(old.data, now), false, '重現原 bug：台北 00:30 尚被當成未來稿');
  const oldDigest = old.digest;
  await taipeiMarkdownGlob(options).load(state.context);
  assert.equal(state.counts.clear, 1, '即使文章 digest 不變，也遷移原 parser 的快取');
  const cli = loadContent(root);
  assert.deepEqual(cli.errors, []);
  for (const id of ['date-published', 'date-scheduled']) {
    const entry = state.entries.get(id);
    assert.equal(entry.data.publishDate.toISOString(), '2026-11-24T16:00:00.000Z');
    assert.equal(entry.data.updatedDate.toISOString(), '2026-11-24T16:00:00.000Z');
    assert.equal(entry.data.publishDate.getTime(), cli.articles.find((article) => article.id === id).data.publishDate.getTime());
    assert.equal(isPublicFrontmatter(entry.data, now), true, `${id} 在同一天台北 00:30 可公開`);
    assert.ok(entry.rendered.html.startsWith('rendered:'));
    assert.ok(entry.body.includes('日期解析測試'));
  }
  assert.equal(state.entries.get('date-published').digest, oldDigest);
}));

test('明確 UTC／offset timestamp 不減八小時，引號不改 date-only 語義', () => withWorkspace(async (root) => {
  fixture(root, 'explicit-utc-midnight', '2026-11-25T00:00:00Z');
  fixture(root, 'explicit-utc-arrived', '2026-11-24T16:00:00Z');
  fixture(root, 'explicit-taipei', '2026-11-25T00:00:00+08:00');
  fixture(root, 'quoted-date', '"2026-11-25"');
  const state = loaderContext(root);
  await taipeiMarkdownGlob(options).load(state.context);
  assert.equal(state.entries.get('explicit-utc-midnight').data.publishDate.toISOString(), '2026-11-25T00:00:00.000Z');
  assert.equal(isPublicFrontmatter(state.entries.get('explicit-utc-midnight').data, now), false);
  for (const id of ['explicit-utc-arrived', 'explicit-taipei', 'quoted-date']) {
    assert.equal(state.entries.get(id).data.publishDate.toISOString(), '2026-11-24T16:00:00.000Z');
    assert.equal(isPublicFrontmatter(state.entries.get(id).data, now), true);
  }
  const explicitDateObject = new Date('2026-11-25T00:00:00Z');
  assert.equal(parseTaipeiDate(explicitDateObject).getTime(), explicitDateObject.getTime());
}));

test('parser 遷移後保留 Astro digest 快取，不因重載而清空重 render', () => withWorkspace(async (root) => {
  fixture(root, 'cached-date', '2026-11-25');
  const state = loaderContext(root);
  const loader = taipeiMarkdownGlob(options);
  await loader.load(state.context);
  const count = { ...state.counts };
  await loader.load(state.context);
  assert.deepEqual(state.counts, count);
  assert.equal(state.entries.get('cached-date').data.publishDate.toISOString(), '2026-11-24T16:00:00.000Z');
}));

test('共用 raw parser 保留日期字串，並照常拒絕非法日曆日期', () => {
  const raw = '---\ntitle: 日期測試\ndescription: 格式測試\npublishDate: 2026-11-25\nupdatedDate: 2026-11-25T00:30:00Z\n---\n正文';
  const parsed = parseRawDocument(raw);
  assert.equal(parsed.data.publishDate, '2026-11-25');
  assert.equal(parsed.data.updatedDate, '2026-11-25T00:30:00Z');
  assert.throws(() => articleSchema.parse(parseRawDocument(raw.replace('2026-11-25\n', '2026-02-30\n')).data));
});
