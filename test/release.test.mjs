import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createBuildManifest, validateBuildManifest, writeBuildManifest } from '../scripts/lib/build-manifest.mjs';
import { htmlFacts, comparePaths, articlePaths } from '../scripts/lib/release-rules.mjs';
import { checkRelease } from '../scripts/release-check.mjs';

const baseManifest = { builtAt: '2020-01-01T12:00:00Z', publicationTime: '2020-01-01T11:59:00Z', stage: 'preview', basePath: '', site: 'https://3jwellness.com' };
const html = (url, { noindex = false, article = false } = {}) => `<html><head><meta name="description" content="測試說明"><link rel="canonical" href="${url}">${noindex ? '<meta name="robots" content="noindex,follow">' : ''}<meta property="og:type" content="${article ? 'article' : 'website'}"><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script></head><body><h1>驗證頁面</h1></body></html>`;
async function fixture({ stage = 'preview', published = false, basePath = '' } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), '3j-release-'));
  const dist = path.join(root, 'dist');
  const manifest = createBuildManifest({ ...baseManifest, stage, basePath });
  const put = async (relative, body) => { const file = path.join(root, relative); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, body); };
  const url = (relative) => `${manifest.site}${basePath}${relative}`;
  await put('dist/build-info.json', JSON.stringify(manifest));
  await put('dist/index.html', html(url('/')));
  await put('dist/search/index.html', html(url('/search/'), { noindex: true }));
  // This article is already past wall-clock time, but is future relative to this build's cutoff.
  await put('src/content/articles/not-yet.md', '---\ntitle: 尚未到建置時點\ndescription: 不可公開\nstatus: published\npublishDate: 2024-01-01\n---\n\n機密草稿\n');
  const items = [];
  if (published) {
    await put('src/content/articles/visible.md', '---\ntitle: 公開文章\ndescription: 公開說明\nstatus: published\npublishDate: 2000-01-01\n---\n\n公開內容\n');
    items.push({ slug: 'visible', url: url('/articles/visible/') });
    await put('dist/articles/visible/index.html', html(url('/articles/visible/'), { article: true, noindex: stage !== 'production' }));
  }
  await put('dist/reader-index.json', JSON.stringify({ schemaVersion: 1, items }));
  await put('dist/rss.xml', `<rss><channel>${items.map((item) => `<item><link>${item.url}</link></item>`).join('')}</channel></rss>`);
  for (const name of ['llms.txt', 'llms-full.txt']) await put(`dist/${name}`, `# 三傑\n${items.map((item) => item.url).join('\n')}\n`);
  await put('dist/sitemap-0.xml', `<urlset><url><loc>${url('/')}</loc></url>${stage === 'production' ? items.map((item) => `<url><loc>${item.url}</loc></url>`).join('') : ''}</urlset>`);
  await put('dist/sitemap-index.xml', `<sitemapindex><sitemap><loc>${url('/sitemap-0.xml')}</loc></sitemap></sitemapindex>`);
  await put('dist/pagefind/pagefind-entry.json', JSON.stringify({ languages: published ? { zh: { page_count: 1, hash: 'test_hash', wasm: 'zh' } } : {} }));
  for (const name of ['pagefind.js', 'pagefind-worker.js', ...(published ? ['pagefind.test_hash.pf_meta', 'wasm.zh.pagefind'] : [])]) await put(`dist/pagefind/${name}`, 'test-bundle');
  await put('dist/og/default.png', Buffer.from('89504e470d0a1a0a', 'hex'));
  return { root, dist, manifest, put, cleanup: () => rm(root, { recursive: true, force: true }) };
}
test('manifest exposes only allowlisted build identity and rejects unsafe site/base/time', () => {
  const manifest = createBuildManifest({ ...baseManifest, credentials: 'secret', draftPaths: ['private.md'], commit: 'a'.repeat(40) });
  assert.deepEqual(Object.keys(manifest).sort(), ['schemaVersion', 'builtAt', 'publicationTime', 'stage', 'basePath', 'site', 'commit'].sort());
  assert.equal(JSON.stringify(manifest).includes('secret'), false);
  for (const bad of [{ site: 'https://user:secret@example.com' }, { basePath: '/../private' }, { publicationTime: 'yesterday' }, { publicationTime: '2020-02-30T00:00:00Z' }, { commit: 'token' }]) assert.throws(() => createBuildManifest({ ...baseManifest, ...bad }));
  assert.throws(() => validateBuildManifest({}), /schemaVersion/);
});
test('postbuild cannot invent a different publication cutoff when the build clock is missing', async () => {
  const original = process.env.CONTENT_BUILD_TIME;
  delete process.env.CONTENT_BUILD_TIME;
  try { await assert.rejects(writeBuildManifest(), /必須固定 CONTENT_BUILD_TIME/); }
  finally { if (original === undefined) delete process.env.CONTENT_BUILD_TIME; else process.env.CONTENT_BUILD_TIME = original; }
});
test('metadata detects malformed JSON-LD, multiple headings and formal localhost references', () => {
  const valid = html('https://3jwellness.com/');
  assert.deepEqual(htmlFacts(valid, { production: true }).errors, []);
  assert.ok(htmlFacts(valid.replace('</body>', '<h1>多一個</h1></body>')).errors.some((error) => error.includes('h1')));
  assert.ok(htmlFacts(valid.replace('"@type":"WebPage"', 'bad-json')).errors.some((error) => error.includes('JSON-LD')));
  assert.ok(htmlFacts(valid.replace('https://3jwellness.com/', 'http://localhost:4321/'), { production: true }).errors.some((error) => error.includes('localhost')));
  assert.deepEqual(articlePaths(['https://3jwellness.com/base/articles/a/', 'https://evil.test/base/articles/private/'], { site: 'https://3jwellness.com', basePath: '/base' }), ['/base/articles/a/']);
  assert.ok(comparePaths(['/articles/a/'], ['/articles/private/'], 'reader').length === 2);
});
test('ordinary preview acceptance warns but does not fabricate launch readiness or fetch remotely', async () => {
  const files = await fixture();
  try {
    let fetches = 0;
    const report = await checkRelease({ root: files.root, fetcher: () => { fetches++; throw new Error('must not fetch'); } });
    assert.deepEqual(report.errors, []);
    assert.equal(report.ok, true);
    assert.equal(report.ready, false);
    assert.equal(report.live.verified, false);
    assert.equal(fetches, 0);
    assert.ok(report.readiness.some((item) => item.name === 'GA4 實收事件' && item.status === 'unverified'));
    const strict = await checkRelease({ root: files.root, strictLaunch: true });
    assert.equal(strict.ok, true);
    assert.equal(strict.ready, false);
    assert.ok(strict.readiness.filter((item) => item.blocking).length === 2);
  } finally { await files.cleanup(); }
});
test('base deployment public routes match feeds, sitemap and real Pagefind counts at manifest cutoff', async () => {
  const files = await fixture({ stage: 'production', published: true, basePath: '/base' });
  try {
    const report = await checkRelease({ root: files.root, strictLaunch: true });
    assert.deepEqual(report.errors, []);
    assert.equal(report.ready, true);
    assert.ok(report.warnings.some((warning) => warning.includes('尚無封面')));
    // Hidden content introduced into a feed must be detected, even if its date is before today's wall clock.
    await files.put('dist/reader-index.json', JSON.stringify({ schemaVersion: 1, items: [{ url: 'https://3jwellness.com/base/articles/not-yet/' }] }));
    const leaked = await checkRelease({ root: files.root });
    assert.equal(leaked.ok, false);
    assert.ok(leaked.errors.some((error) => error.includes('reader-index') && error.includes('非公開')));
  } finally { await files.cleanup(); }
});
test('noindex in sitemap, GA on search and incomplete Pagefind are failures, not readiness warnings', async () => {
  const files = await fixture();
  try {
    await files.put('dist/sitemap-0.xml', '<urlset><url><loc>https://3jwellness.com/search/</loc></url></urlset>');
    await files.put('dist/search/index.html', html('https://3jwellness.com/search/', { noindex: true }).replace('</head>', '<script src="https://www.googletagmanager.com/gtag/js?id=test"></script></head>'));
    await files.put('dist/pagefind/pagefind-entry.json', JSON.stringify({ languages: { zh: { page_count: 3, hash: 'missing', wasm: 'zh' } } }));
    const report = await checkRelease({ root: files.root });
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((error) => error.includes('noindex')));
    assert.ok(report.errors.some((error) => error.includes('不得載入 GA')));
    assert.ok(report.errors.some((error) => error.includes('搜尋隱私與 Pagefind')));
  } finally { await files.cleanup(); }
});
test('Pagefind zh-tw null wasm accepts the real unknown tokenizer fallback and requires its asset', async () => {
  const files = await fixture({ stage: 'production', published: true });
  try {
    const hash = 'zh-tw_8287b9531664f';
    await files.put('dist/pagefind/pagefind-entry.json', JSON.stringify({ languages: { 'zh-tw': { hash, wasm: null, page_count: 1 } } }));
    await files.put(`dist/pagefind/pagefind.${hash}.pf_meta`, 'real-format-metadata');
    await files.put('dist/pagefind/wasm.unknown.pagefind', 'generic-tokenizer');
    const accepted = await checkRelease({ root: files.root });
    assert.deepEqual(accepted.errors, []);
    assert.equal(accepted.ok, true);
    await rm(path.join(files.dist, 'pagefind/wasm.unknown.pagefind'));
    const missing = await checkRelease({ root: files.root });
    assert.equal(missing.ok, false);
    assert.ok(missing.errors.some((error) => error.includes('wasm.unknown.pagefind')));
    await files.put('dist/pagefind/pagefind-entry.json', JSON.stringify({ languages: { 'zh-tw': { hash, wasm: false, page_count: 1 } } }));
    const invalid = await checkRelease({ root: files.root });
    assert.ok(invalid.errors.some((error) => error.includes('wasm 名稱錯誤')));
  } finally { await files.cleanup(); }
});
test('explicit network failure cannot be reported as verified deployment', async () => {
  const files = await fixture();
  try {
    const report = await checkRelease({ root: files.root, url: 'https://3jwellness.com', fetcher: async () => { throw new Error('network unavailable'); } });
    assert.equal(report.live.requested, true);
    assert.equal(report.live.verified, false);
    assert.equal(report.ok, false);
    assert.equal(report.live.endpoints.length, 8);
    assert.ok(report.errors.every((error) => error.includes('network unavailable')));
  } finally { await files.cleanup(); }
});
