// End-to-end static pipeline, with temporary fixtures that are removed even on failure.
// This is deliberately opt-in: it builds twice and must not run alongside another build.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { serializeDocument } from '../scripts/lib/content-files.mjs';

const root = process.cwd();
const created = [];
const prefix = 'foundation-fixture';
async function create(relative, content) {
  const file = path.join(root, relative);
  if (existsSync(file)) throw new Error(`整合測試不覆寫既有檔案：${relative}`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, { flag: 'wx' });
  created.push(file);
}
function run(script, args, env) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', ...env }, encoding: 'utf8', timeout: 180000 });
  if (result.status !== 0) throw new Error(`${script} 失敗：\n${(result.stdout + result.stderr).slice(-12000)}${result.error ?? ''}`);
}
async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(file); else yield file;
  }
}
const publishedSlugs = Array.from({ length: 13 }, (_, i) => `${prefix}-${i + 1}`);
const hiddenSlugs = ['draft', 'review', 'archived', 'future-published', 'future-scheduled'].map((status) => `${prefix}-${status}`);
try {
  const image = await sharp({ create: { width: 1600, height: 900, channels: 3, background: { r: 40, g: 80, b: 60 } } }).png().toBuffer();
  await create(`public/content/${prefix}.png`, image);
  await create(`src/content/topics/${prefix}.md`, serializeDocument({ title: '基礎建設驗證專題', description: '只用於自動驗證的專題。', status: 'active', articles: publishedSlugs, sections: [{ title: '先理解問題', summary: '測試分段導讀。', articles: publishedSlugs.slice(0, 2) }] }, ''));
  for (let i = 0; i < publishedSlugs.length; i++) {
    const slug = publishedSlugs[i];
    const data = { title: `基礎建設驗證文章 ${i + 1}`, description: `第 ${i + 1} 篇完整管線驗證資料。`, slug, category: '健康生活', status: i === 12 ? 'scheduled' : 'published', publishDate: '2000-01-01', updatedDate: '2000-01-02', author: '3j-editorial', topics: [prefix], tags: ['管線驗證'], highlights: ['此為測試內容，不會作為健康文章發布。'], faq: [{ question: '這是什麼資料？', answer: '這是暫存的自動驗證資料。' }], references: [{ title: '測試來源', url: 'https://example.com/' }], ...(i === 0 ? { coverImage: `/content/${prefix}.png`, coverAlt: '測試用單色圖片' } : {}) };
    const body = `## 測試內容\n\n紅豆驗證文本。此為測試資料。\n\n[另一篇文章](/articles/${publishedSlugs[(i + 1) % 13]}/)\n\n## 圖片與閱讀\n\n這段用來測試文章目錄、圖片和閱讀結構。${i === 0 ? `\n\n![測試用圖片](/content/${prefix}.png)` : ''}\n\n## 繼續閱讀\n\n[主題指南](/topics/${prefix}/)\n`;
    await create(`src/content/articles/${i === 0 ? `${prefix}-filename-alias` : slug}.md`, serializeDocument(data, body));
  }
  for (const slug of hiddenSlugs) {
    const kind = slug.replace(`${prefix}-`, '');
    await create(`src/content/articles/${slug}.md`, serializeDocument({ title: `機密草稿驗證 ${kind}`, description: `NEVER_PUBLIC_${kind}`, slug, status: kind.startsWith('future') ? kind.endsWith('scheduled') ? 'scheduled' : 'published' : kind, publishDate: kind.startsWith('future') ? '2099-01-01' : '2000-01-01', references: [{ title: '測試來源', url: 'https://example.com/' }] }, `NEVER_PUBLIC_${kind}`));
  }
  for (const base of ['', '/foundation-test']) {
    const env = { PUBLIC_SITE_STAGE: 'production', PUBLIC_BASE_PATH: base, CONTENT_BUILD_TIME: new Date().toISOString() };
    run('scripts/content.mjs', ['check'], env);
    run('scripts/prepare-media.mjs', [], env);
    run('node_modules/astro/bin/astro.mjs', ['build'], env);
    run('scripts/postbuild.mjs', [], env);
    run('--test', ['test/dist.test.mjs'], env);
    const dist = path.join(root, 'dist');
    const html = await readFile(path.join(dist, `articles/${publishedSlugs[0]}/index.html`), 'utf8');
    assert.match(html, /data-reading-article/);
    assert.match(html, /srcset="[^"]*media\/content/);
    assert.ok(html.includes(`href="${base}/articles/${publishedSlugs[1]}/"`), 'Markdown 站內連結支援 base');
    assert.ok(html.includes('Article') && html.includes('dateModified') && html.includes('FAQPage'), '文章 JSON-LD');
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    for (const script of scripts) JSON.parse(script[1]);
    assert.ok(existsSync(path.join(dist, 'articles/page/2/index.html')), '文章列表分頁');
    assert.ok(existsSync(path.join(dist, 'articles/category/健康生活/page/2/index.html')), '中文分類分頁');
    for (const slug of hiddenSlugs) {
      assert.ok(!existsSync(path.join(dist, `articles/${slug}/index.html`)), `${slug} 不產生 HTML`);
      assert.ok(!existsSync(path.join(dist, `articles/${slug}.txt`)), `${slug} 不產生純文字`);
    }
    for await (const file of files(dist)) {
      if (!/\.(html|xml|txt|json)$/.test(file)) continue;
      assert.ok(!(await readFile(file, 'utf8')).includes('NEVER_PUBLIC_'), `隱藏正文不外洩：${path.relative(dist, file)}`);
    }
    const reader = JSON.parse(await readFile(path.join(dist, 'reader-index.json'), 'utf8'));
    assert.equal(reader.items.filter((item) => item.slug.startsWith(prefix)).length, 13, '讀者索引只含公開稿');
    const rss = await readFile(path.join(dist, 'rss.xml'), 'utf8');
    assert.ok(rss.includes(`${base}/articles/${publishedSlugs[0]}/`), 'RSS 公開文章');
    const sitemap = (await Promise.all((await readdir(dist)).filter((name) => /^sitemap-\d+\.xml$/.test(name)).map((name) => readFile(path.join(dist, name), 'utf8')))).join('');
    assert.ok(!sitemap.includes(`${base}/search/`), 'noindex 搜尋頁不進 sitemap');
    assert.match(sitemap, /<lastmod>2000-01-01T16:00:00.000Z<\/lastmod>/);
    const search = await readFile(path.join(dist, 'search/index.html'), 'utf8');
    assert.ok(!search.includes('googletagmanager'), '搜尋頁不載入 GA，查詢字不送自動事件');
    assert.ok(existsSync(path.join(dist, 'pagefind/pagefind.js')), '搜尋 bundle');
    const indexEntry = JSON.parse(await readFile(path.join(dist, 'pagefind/pagefind-entry.json'), 'utf8'));
    assert.ok(Object.values(indexEntry.languages).reduce((sum, language) => sum + language.page_count, 0) >= 14, '文章與專題都進入Pagefind實際索引');
    console.log(`整合驗證通過：${base || '根網域'}，公開/隱藏狀態、分頁、圖片、JSON-LD、RSS、sitemap、索引。`);
  }
} finally {
  for (const file of created.reverse()) await unlink(file);
  // Do not leave fixture-bearing HTML available after the test.
  const cleanupEnv = { PUBLIC_BASE_PATH: '', PUBLIC_SITE_STAGE: '', CONTENT_BUILD_TIME: new Date().toISOString() };
  run('scripts/prepare-media.mjs', [], cleanupEnv);
  run('node_modules/astro/bin/astro.mjs', ['build'], cleanupEnv);
  run('scripts/postbuild.mjs', [], cleanupEnv);
}
