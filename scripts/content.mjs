#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { writerEnvelopeSchema } from '../src/content.schemas.mjs';
import { contentSlug, isPublicFrontmatter, publicationNow } from '../src/lib/content-core.mjs';
import { checkContent, loadContent, serializeDocument } from './lib/content-files.mjs';

/** Writer 接稿只建草稿；重送同一份工單不新增文章、不覆寫人工改稿。 */
export function importWriter(payload, { root = process.cwd(), dryRun = false } = {}) {
  const envelope = writerEnvelopeSchema.parse(payload);
  const data = { ...envelope.article, status: 'draft', draft: true, writerJobId: envelope.jobId };
  if (!data.slug) throw new Error('Writer article.slug 必填，網址建立後保持穩定');
  const content = loadContent(root);
  if (content.errors.length) throw new Error(content.errors.join('\n'));
  const previous = content.articles.find((entry) => entry.data.writerJobId === envelope.jobId);
  const serialized = serializeDocument(data, envelope.body);
  if (previous) {
    if (serializeDocument(previous.data, previous.body) === serialized)
      return { status: 'unchanged', slug: contentSlug(previous), dryRun };
    throw new Error('同一 Writer jobId 已存在且內容不同；請在原草稿人工編輯，避免覆寫');
  }
  if (content.articles.some((entry) => contentSlug(entry) === data.slug)) throw new Error(`文章網址已存在：${data.slug}`);
  const file = path.join(root, 'src/content/articles', `${data.slug}.md`);
  const entry = { id: data.slug, file, data, body: envelope.body };
  const check = checkContent({ ...content, articles: [...content.articles, entry] }, { root });
  if (check.errors.length) throw new Error(check.errors.join('\n'));
  if (existsSync(file)) throw new Error(`檔案已存在：${file}`);
  if (!dryRun) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, serialized, { encoding: 'utf8', flag: 'wx' });
  }
  return { status: dryRun ? 'valid' : 'created', slug: data.slug, file: path.relative(root, file).replace(/\\/g, '/'), draft: true, dryRun, warnings: check.warnings };
}

export function contentStats(content, now = publicationNow()) {
  const counts = {};
  for (const entry of content.articles) counts[entry.data.status] = (counts[entry.data.status] ?? 0) + 1;
  return { articles: content.articles.length, public: content.articles.filter((entry) => isPublicFrontmatter(entry.data, now)).length,
    authors: content.authors.length, topics: content.topics.length, byStatus: counts, errors: content.errors };
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'stats';
  let result;
  if (command === 'import') {
    const file = args.slice(1).find((arg) => !arg.startsWith('--'));
    if (!file) throw new Error('用法：pnpm writer:import <Writer JSON 檔> [--dry-run] [--json]');
    result = importWriter(JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, '')), { dryRun: args.includes('--dry-run') });
  } else if (command === 'check') {
    const content = loadContent();
    result = checkContent(content);
    result.ok = result.errors.length === 0;
    if (!result.ok) process.exitCode = 1;
  } else if (command === 'stats') {
    result = contentStats(loadContent());
    if (result.errors.length) process.exitCode = 1;
  } else throw new Error('未知指令；使用 stats、check 或 import');
  if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); }
  catch (error) { console.error(JSON.stringify({ ok: false, error: error.message }, null, 2)); process.exitCode = 1; }
}
