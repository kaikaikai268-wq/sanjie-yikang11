#!/usr/bin/env node
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadContent } from './lib/content-files.mjs';
import { contentSlug, isPublicFrontmatter } from '../src/lib/content-core.mjs';
import { validateBuildManifest } from './lib/build-manifest.mjs';
import { htmlFacts, articlePaths, comparePaths, sitemapUrls, textUrls } from './lib/release-rules.mjs';

async function walk(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('驗收不讀取 dist 內的 symbolic link。');
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(file));
    else result.push(file);
  }
  return result;
}
async function liveCheck(baseUrl, manifest, fetcher) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw new Error('--url 必須是不含帳密、query 或 hash 的 http/https 網址。');
  if (base.pathname.replace(/\/$/, '') !== manifest.basePath) throw new Error('--url 路徑必須與 build manifest 的 basePath 相同。');
  base.pathname = `${manifest.basePath}/`;
  const routes = ['build-info.json', 'reader-index.json', 'rss.xml', 'llms.txt', 'sitemap-index.xml', 'search/', 'og/default.png', 'pagefind/pagefind.js'];
  const errors = [];
  const endpoints = await Promise.all(routes.map(async (route) => {
    try {
      const response = await fetcher(new URL(route, base), { signal: AbortSignal.timeout(10_000), credentials: 'omit', redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (route === 'build-info.json') {
        const deployed = validateBuildManifest(await response.json());
        for (const key of ['builtAt', 'publicationTime', 'stage', 'basePath', 'site', 'commit']) if (deployed[key] !== manifest[key]) throw new Error('線上 build-info 與本次本機產物不同，尚未驗證這次發布');
      } else if (route === 'search/') {
        const html = await response.text();
        const facts = htmlFacts(html, { production: manifest.stage === 'production' });
        if (facts.errors.length || !facts.noindex) throw new Error('線上搜尋頁結構或 noindex 不符');
        if (/googletagmanager\.com|google-analytics\.com/.test(html)) throw new Error('線上搜尋頁不得載入 GA');
      } else if (route === 'reader-index.json') {
        const json = await response.json();
        if (json.schemaVersion !== 1 || !Array.isArray(json.items)) throw new Error('線上 reader-index 格式錯誤');
      } else if (route === 'og/default.png') {
        if (!(response.headers.get('content-type') || '').startsWith('image/')) throw new Error('線上預設分享圖不是圖片回應');
      } else if (!(await response.text()).trim()) throw new Error('空白回應');
      return { path: route, status: 'passed' };
    } catch (error) {
      errors.push(`線上 ${route}：${error.message || '網路連線失敗'}`);
      return { path: route, status: 'failed' };
    }
  }));
  return { url: base.href, endpoints, errors, verified: errors.length === 0 };
}
export async function checkRelease({ root = process.cwd(), dist = path.join(root, 'dist'), strictLaunch = false, url, fetcher = fetch } = {}) {
  const errors = [], warnings = [], checks = [], readiness = [];
  const report = { schemaVersion: 1, scope: url ? 'local-build-and-public-endpoints' : 'local-build', ok: false, ready: false, strictLaunch, checks, errors, warnings, readiness, live: { requested: Boolean(url), verified: false } };
  let manifest;
  try { manifest = validateBuildManifest(JSON.parse(await readFile(path.join(dist, 'build-info.json'), 'utf8'))); }
  catch (error) { errors.push(`Build manifest 無法驗收：${error.message}。先執行 pnpm build。`); return report; }
  report.manifest = manifest;
  const production = manifest.stage === 'production';
  const now = Date.parse(manifest.publicationTime);
  const content = loadContent(root);
  errors.push(...content.errors.map((error) => `來源內容：${error}`));
  const articles = content.articles.filter((entry) => isPublicFrontmatter(entry.data, now));
  const expected = articles.map((entry) => `${manifest.basePath}/articles/${contentSlug(entry)}/`).sort();
  const topics = content.topics.filter((entry) => entry.data.status === 'active' && articles.some((article) => article.data.topics.includes(entry.id) || [...entry.data.articles, ...entry.data.sections.flatMap((section) => section.articles)].includes(contentSlug(article))));
  const read = (relative) => readFile(path.join(dist, relative), 'utf8');
  const checked = async (label, run) => {
    const before = errors.length;
    try { await run(); } catch (error) { errors.push(`${label}：${error.message}`); }
    checks.push({ name: label, status: errors.length === before ? 'passed' : 'failed' });
  };
  let files = [];
  await checked('HTML metadata 與公開文章路由', async () => {
    files = await walk(dist);
    const actual = [];
    report.noindexPaths = [];
    for (const file of files.filter((name) => name.endsWith('.html'))) {
      const html = await readFile(file, 'utf8');
      const relative = path.relative(dist, file).replace(/\\/g, '/');
      const facts = htmlFacts(html, { production });
      errors.push(...facts.errors.map((error) => `${relative}：${error}`));
      if (facts.canonical) {
        const canonical = new URL(facts.canonical, manifest.site);
        if (canonical.origin !== new URL(manifest.site).origin || (manifest.basePath && !canonical.pathname.startsWith(`${manifest.basePath}/`))) errors.push(`${relative}：canonical 不是本站／部署子路徑`);
        if (facts.noindex) report.noindexPaths.push(decodeURIComponent(canonical.pathname));
        if (facts.isArticle) actual.push(decodeURIComponent(canonical.pathname));
      }
    }
    errors.push(...comparePaths(expected, actual, 'HTML 文章路由'));
    if (new Set(actual).size !== actual.length) errors.push('HTML 有重複文章 canonical');
    for (const route of expected) {
      const relative = route.slice(manifest.basePath.length);
      await stat(path.join(dist, relative, 'index.html'));
    }
  });
  await checked('Reader 索引與 RSS／LLM 公開集合', async () => {
    const reader = JSON.parse(await read('reader-index.json'));
    if (reader.schemaVersion !== 1 || !Array.isArray(reader.items) || reader.items.some((item) => typeof item.url !== 'string')) throw new Error('reader-index 格式錯誤');
    const readerPaths = articlePaths(reader.items.map((item) => item.url), manifest);
    errors.push(...comparePaths(expected, readerPaths, 'reader-index'));
    if (readerPaths.length !== reader.items.length || new Set(readerPaths).size !== readerPaths.length) errors.push('reader-index 有非本站文章網址或重複項目');
    const rss = await read('rss.xml');
    if (!/<rss\b/.test(rss) || !/<\/rss>\s*$/.test(rss)) throw new Error('RSS 缺少完整 rss 根元素');
    const rssLinks = [...rss.matchAll(/<item>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<\/item>/g)].map((match) => match[1]);
    const rssPaths = articlePaths(rssLinks, manifest);
    errors.push(...comparePaths(expected, rssPaths, 'RSS'));
    if (rssPaths.length !== rssLinks.length) errors.push('RSS 含非本站文章網址');
    if (new Set(rssLinks).size !== rssLinks.length) errors.push('RSS 有重複文章');
    for (const name of ['llms.txt', 'llms-full.txt']) errors.push(...comparePaths(expected, articlePaths(textUrls(await read(name)), manifest), name));
  });
  await checked('Sitemap 與 noindex 一致', async () => {
    const names = files.filter((name) => /^sitemap-\d+\.xml$/.test(path.basename(name)));
    if (!names.length) throw new Error('缺少 sitemap 分片');
    const urls = (await Promise.all(names.map((name) => readFile(name, 'utf8')))).flatMap(sitemapUrls);
    errors.push(...comparePaths(production ? expected : [], articlePaths(urls, manifest), 'sitemap'));
    const noindex = new Set(report.noindexPaths || []);
    for (const value of urls) if (noindex.has(decodeURIComponent(new URL(value, manifest.site).pathname))) errors.push('sitemap 包含 noindex 頁面');
  });
  await checked('搜尋隱私與 Pagefind 實際索引', async () => {
    const html = await read('search/index.html');
    if (!htmlFacts(html).noindex) errors.push('搜尋頁必須 noindex');
    if (/googletagmanager\.com|google-analytics\.com/.test(html)) errors.push('搜尋頁不得載入 GA');
    const entry = JSON.parse(await read('pagefind/pagefind-entry.json'));
    if (!entry.languages || typeof entry.languages !== 'object' || Array.isArray(entry.languages)) throw new Error('Pagefind languages 格式錯誤');
    let count = 0;
    for (const language of Object.values(entry.languages)) {
      if (!Number.isInteger(language.page_count) || language.page_count < 0) throw new Error('Pagefind page_count 格式錯誤');
      count += language.page_count;
      if (typeof language.hash !== 'string' || !/^[\w-]+$/.test(language.hash) || (language.wasm !== null && (typeof language.wasm !== 'string' || !/^[\w-]+$/.test(language.wasm)))) throw new Error('Pagefind metadata 或 wasm 名稱錯誤');
      await stat(path.join(dist, 'pagefind', `pagefind.${language.hash}.pf_meta`));
      // Pagefind 1.6 uses null for languages handled by its generic tokenizer (e.g. zh-tw).
      await stat(path.join(dist, 'pagefind', `wasm.${language.wasm ?? 'unknown'}.pagefind`));
    }
    if (count !== articles.length + topics.length) errors.push(`Pagefind 索引集合與公開文章／專題數量不一致（預期 ${articles.length + topics.length}，索引 ${count}）`);
    for (const name of ['pagefind.js', 'pagefind-worker.js']) if (!(await read(`pagefind/${name}`)).trim()) errors.push(`Pagefind ${name} 為空`);
  });
  await checked('預設分享圖片', async () => {
    const image = await readFile(path.join(dist, 'og/default.png'));
    if (image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') errors.push('預設 OG 不是 PNG 圖片');
  });
  if (!articles.length) { warnings.push('尚無公開文章：基礎設施可驗證，內容上線仍待首批文章。'); readiness.push({ name: '公開文章', status: strictLaunch ? 'blocked' : 'pending', blocking: strictLaunch }); }
  else readiness.push({ name: '公開文章', status: 'ready', blocking: false });
  if (!production) { warnings.push('本次是 preview 建置，不代表正式收錄或上線。'); readiness.push({ name: '正式建置', status: strictLaunch ? 'blocked' : 'pending', blocking: strictLaunch }); }
  else readiness.push({ name: '正式建置', status: 'ready', blocking: false });
  if (articles.some((entry) => !entry.data.coverImage)) warnings.push('部分公開文章尚無封面，會使用預設分享圖；正式內容品質仍可補強。');
  const home = await read('index.html').catch(() => '');
  if (!/data-ga-shop(?:[\s=>])/.test(home)) { warnings.push('尚未設定或顯示購物入口；不影響內容基礎設施驗證。'); readiness.push({ name: '購物導流', status: 'pending', blocking: false }); }
  else readiness.push({ name: '購物導流', status: 'ready', blocking: false });
  warnings.push('GA4 實收事件尚未由此工具驗證；程式存在不代表 GA 已收到。');
  readiness.push({ name: 'GA4 實收事件', status: 'unverified', blocking: false });
  if (url) {
    try { report.live = { requested: true, ...await liveCheck(url, manifest, fetcher) }; errors.push(...report.live.errors); }
    catch (error) { errors.push(`線上驗收未完成：${error.message}`); }
  }
  delete report.noindexPaths;
  report.ok = errors.length === 0;
  // ready means minimum mechanical launch conditions, independent of whether this run is strict.
  // It never asserts deployment or GA event delivery; those have separate evidence fields.
  report.ready = report.ok && production && articles.length > 0;
  return report;
}
export async function main(args = process.argv.slice(2)) {
  let strictLaunch = false, url;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--help') { console.log('node scripts/release-check.mjs [--strict-launch] [--url https://3jwellness.com]\n預設只驗 dist，不連網、不寫遠端。--strict-launch 要求正式建置與公開文章。'); return; }
    if (args[index] === '--strict-launch') strictLaunch = true;
    else if (args[index] === '--url' && args[index + 1] && !args[index + 1].startsWith('--')) url = args[++index];
    else throw new Error('不支援的驗收參數，請參考 --help。');
  }
  const report = await checkRelease({ strictLaunch, url });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  else if (strictLaunch && !report.ready) process.exitCode = 2;
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((error) => { console.error(`發布驗收未完成：${error.message}`); process.exitCode = 1; });
