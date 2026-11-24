import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createIndex } from 'pagefind';
import { loadContent } from './lib/content-files.mjs';
import { contentSlug, isPublicFrontmatter } from '../src/lib/content-core.mjs';
import { writeBuildManifest } from './lib/build-manifest.mjs';

const root = process.cwd();
const dist = path.join(root, 'dist');
const site = process.env.PUBLIC_SITE_URL || 'https://3jwellness.com';
const base = (process.env.PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const content = loadContent(root);
const articles = content.articles.filter((entry) => isPublicFrontmatter(entry.data));
const updated = new Map(articles.map((entry) => [
  `${base}/articles/${contentSlug(entry)}/`, (entry.data.updatedDate ?? entry.data.publishDate).toISOString(),
]));
// Astro already made the sitemap. Match its entries to actual rendered noindex pages, not a second visibility rule.
for (const name of await readdir(dist)) {
  if (!/^sitemap-\d+\.xml$/.test(name)) continue;
  const file = path.join(dist, name);
  const source = await readFile(file, 'utf8');
  const blocks = source.match(/<url>[\s\S]*?<\/url>/g) ?? [];
  let result = source;
  for (const block of blocks) {
    const loc = /<loc>([^<]+)<\/loc>/.exec(block)?.[1];
    if (!loc) continue;
    const pathname = new URL(loc.replaceAll('&amp;', '&'), site).pathname;
    const local = pathname.slice(base.length);
    const html = await readFile(path.join(dist, decodeURIComponent(local), 'index.html'), 'utf8').catch(() => '');
    if (!html || /<meta\s+name="robots"[^>]*content="[^"]*noindex/i.test(html)) {
      result = result.replace(block, '');
      continue;
    }
    const date = updated.get(pathname);
    if (date) result = result.replace(block, block.replace(/<lastmod>[^<]*<\/lastmod>/, '').replace('</url>', `<lastmod>${date}</lastmod></url>`));
  }
  await writeFile(file, result);
}
const { index, errors } = await createIndex();
if (errors.length || !index) throw new Error(`Pagefind 初始化失敗：${errors.join('; ')}`);
try {
  const topics = content.topics.filter((entry) => entry.data.status === 'active' && articles.some((article) =>
    article.data.topics.includes(entry.id) || [...entry.data.articles, ...entry.data.sections.flatMap((section) => section.articles)].includes(contentSlug(article))));
  const paths = [...articles.map((entry) => `/articles/${contentSlug(entry)}/`), ...topics.map((entry) => `/topics/${entry.id}/`)];
  for (const route of paths) {
    const added = await index.addHTMLFile({ url: `${base}${route}`, content: await readFile(path.join(dist, route, 'index.html'), 'utf8') });
    if (added.errors.length) throw new Error(added.errors.join('; '));
  }
  const output = await index.writeFiles({ outputPath: path.join(dist, 'pagefind') });
  if (output.errors.length) throw new Error(output.errors.join('; '));
  console.log(`Pagefind 搜尋索引完成：${paths.length} 個公開內容頁。`);
} finally { await index.deleteIndex(); }
await writeBuildManifest({ root, dist });
