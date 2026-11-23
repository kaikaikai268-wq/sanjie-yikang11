// 檢查建置產出（先跑 pnpm build；pnpm verify 會照順序跑）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(fileURLToPath(import.meta.url), '..', '..', 'dist');
const PRODUCTION = process.env.PUBLIC_SITE_STAGE === 'production';
const BASE = (process.env.PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else if (e.name.endsWith('.html')) yield p;
  }
}
const pages = async () => { const out = []; for await (const f of walk(DIST)) out.push(f); return out; };
const exists = (p) => stat(p).then(() => true, () => false);

test('站內連結都指到存在的檔案', async () => {
  const bad = [];
  for (const f of await pages()) {
    const html = await readFile(f, 'utf-8');
    for (const m of html.matchAll(/\b(?:href|src)="(\/[^"#?]*)/g)) {
      if (BASE && !m[1].startsWith(`${BASE}/`)) { bad.push(`${path.relative(DIST, f)} → ${m[1]}（沒帶子路徑 ${BASE}）`); continue; }
      const u = decodeURI(m[1]).slice(BASE.length);
      const target = path.join(DIST, u.endsWith('/') ? `${u}index.html` : u);
      if (!(await exists(target))) bad.push(`${path.relative(DIST, f)} → ${u}`);
    }
  }
  assert.deepEqual([...new Set(bad)], []);
});

test('每頁剛好一個 h1、有 title、有 description、img 都有 alt', async () => {
  const bad = [];
  for (const f of await pages()) {
    const html = await readFile(f, 'utf-8');
    const name = path.relative(DIST, f);
    if ((html.match(/<h1[\s>]/g) ?? []).length !== 1) bad.push(`${name}：h1 數量不是 1`);
    if (!/<title>[^<]+<\/title>/.test(html)) bad.push(`${name}：缺 title`);
    if (!/<meta name="description" content="[^"]+"/.test(html)) bad.push(`${name}：缺 description`);
    for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt(=|[\s>])/.test(m[0])) bad.push(`${name}：img 缺 alt`);
  }
  assert.deepEqual(bad, []);
});

test('收錄設定跟建置階段一致', async () => {
  const home = await readFile(path.join(DIST, 'index.html'), 'utf-8');
  const robots = await readFile(path.join(DIST, 'robots.txt'), 'utf-8');
  if (PRODUCTION) {
    assert.ok(!home.includes('noindex'), '正式建置不該有 noindex');
    assert.match(robots, /Allow: \//);
  } else {
    assert.ok(home.includes('noindex'), '非正式建置要 noindex');
    assert.match(robots, /Disallow: \//);
    assert.ok(!home.includes('googletagmanager'), '非正式建置不載 GA');
  }
});
