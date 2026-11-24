#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { articleSchema, slugSchema } from '../src/content.schemas.mjs';
import { contentSlug, isPublicFrontmatter, parseTaipeiDate, publicationNow } from '../src/lib/content-core.mjs';
import { checkContent, loadContent, parseDocument, serializeDocument } from './lib/content-files.mjs';

const STATES = ['draft', 'review', 'scheduled', 'published', 'archived'];
const ACTIONS = { draft: 'draft', review: 'review', submit: 'review', schedule: 'scheduled', scheduled: 'scheduled', publish: 'published', published: 'published', archive: 'archived', archived: 'archived' };
export const rawSha256 = (raw) => createHash('sha256').update(raw).digest('hex');
export const taipeiIso = (time) => new Date((time instanceof Date ? time.getTime() : time) + 8 * 60 * 60 * 1000).toISOString().replace('Z', '+08:00');

function readWorkspace(root) {
  const content = loadContent(root);
  if (content.errors.length) throw new Error(content.errors.join('\n'));
  return content;
}

function selectArticle(content, slug) {
  slugSchema.parse(slug);
  const selected = content.articles.filter((entry) => contentSlug(entry) === slug);
  if (selected.length !== 1) throw new Error(selected.length ? `文章網址重複，無法安全選取：${slug}` : `找不到文章：${slug}`);
  return selected[0];
}

function checkedFile(file, root) {
  const articles = path.resolve(root, 'src/content/articles');
  if (!path.resolve(file).startsWith(articles + path.sep) || !file.endsWith('.md')) throw new Error('編輯範圍必須是 src/content/articles 下的 Markdown');
  if (lstatSync(articles).isSymbolicLink() || lstatSync(file).isSymbolicLink()) throw new Error('編輯工具不跟隨 symbolic link');
  const actualRoot = realpathSync(articles);
  const expectedRoot = path.join(realpathSync(path.resolve(root)), 'src/content/articles');
  if (actualRoot !== expectedRoot) throw new Error('內容根目錄的實際位置已變更，拒絕透過父目錄連結改寫文章');
  if (!realpathSync(file).startsWith(actualRoot + path.sep)) throw new Error('文章實際路徑超出內容目錄');
  if (!lstatSync(file).isFile()) throw new Error('文章不是一般檔案');
  return file;
}

function recheckSha(file, sha, root) {
  checkedFile(file, root);
  if (rawSha256(readFileSync(file, 'utf8')) !== sha) throw new Error('文章已被其他編輯修改；請重新讀取最新版並檢查計畫，沒有覆寫原稿');
}

function candidateFor(entry, target, { date, now }) {
  if (!STATES.includes(target)) throw new Error(`不支援的狀態：${target}`);
  if (date !== undefined && !['published', 'scheduled'].includes(target)) throw new Error('只有發布或排程可以指定 --date；退回草稿、送審與封存不改日期');
  const data = { ...entry.data, status: target, draft: !['published', 'scheduled'].includes(target) };
  if (target === 'scheduled') {
    if (date === undefined) throw new Error('排程必須明確指定未來的 --date');
    data.publishDate = parseTaipeiDate(date);
    if (!Number.isFinite(data.publishDate.getTime()) || data.publishDate.getTime() <= now) throw new Error('排程日期必須是合法、尚未到期的台北日期時間');
  }
  if (target === 'published') {
    data.publishDate = date === undefined ? data.publishDate ?? new Date(now) : parseTaipeiDate(date);
    if (!Number.isFinite(data.publishDate.getTime())) throw new Error('發布日期不是合法日期時間');
    if (data.publishDate.getTime() > now) throw new Error('此稿的發布日期仍在未來；請保留排程，或明確使用 --date 指定已到期日期後再發布');
  }
  return articleSchema.parse(data);
}

function validationFor(content, entry, data, root, now) {
  const candidate = { ...entry, data };
  return checkContent({ ...content, articles: content.articles.map((item) => item.file === entry.file ? candidate : item) }, { root, now });
}

export function editorialReadiness(root, slug, { now = publicationNow() } = {}) {
  const content = readWorkspace(root);
  const entry = selectArticle(content, slug);
  const raw = readFileSync(checkedFile(entry.file, root), 'utf8');
  const errors = [];
  const warnings = [];
  if (!entry.data.publishDate) warnings.push('尚未設定發布日期；publish 計畫會明確列出當下的台北日期時間');
  try {
    const data = candidateFor(entry, 'published', { now });
    const checked = validationFor(content, entry, data, root, now);
    errors.push(...checked.errors);
    warnings.push(...checked.warnings);
  } catch (error) { errors.push(error.message); }
  return { slug, status: entry.data.status, draft: entry.data.draft, publicNow: isPublicFrontmatter(entry.data, now),
    publishDate: entry.data.publishDate ? taipeiIso(entry.data.publishDate) : null,
    sourceSha256: rawSha256(raw), canPublish: errors.length === 0, errors, warnings: [...new Set(warnings)] };
}

export function listEditorial(root, { statuses = STATES, now = publicationNow() } = {}) {
  for (const status of statuses) if (!STATES.includes(status)) throw new Error(`不支援的狀態：${status}`);
  const content = readWorkspace(root);
  return { ok: true, checkedAt: taipeiIso(now), items: content.articles.filter((entry) => statuses.includes(entry.data.status)).map((entry) => ({
    slug: contentSlug(entry), title: entry.data.title, status: entry.data.status, draft: entry.data.draft,
    publicNow: isPublicFrontmatter(entry.data, now), publishDate: entry.data.publishDate ? taipeiIso(entry.data.publishDate) : null,
    sourceSha256: rawSha256(readFileSync(checkedFile(entry.file, root), 'utf8')),
    missingSources: entry.data.references.length === 0, missingCover: !entry.data.coverImage,
  })) };
}

/** 只產生可檢視計畫；不改檔、不 build、不連網。 */
export function planTransition(root, slug, target, { date, expectedSha, now = publicationNow() } = {}) {
  const content = readWorkspace(root);
  const selected = selectArticle(content, slug);
  const file = checkedFile(selected.file, root);
  const raw = readFileSync(file, 'utf8');
  const sha = rawSha256(raw);
  if (expectedSha !== undefined && (!/^[a-f0-9]{64}$/i.test(expectedSha) || expectedSha.toLowerCase() !== sha)) throw new Error('expected-sha 與目前原稿不一致，沒有改檔');
  const entry = { ...selected, ...parseDocument(raw, articleSchema) };
  if (contentSlug(entry) !== slug) throw new Error('讀取期間文章網址已變更，請重新列出文章');
  const data = candidateFor(entry, target, { date, now });
  if (['published', 'scheduled'].includes(target) && !entry.body.trim()) throw new Error('發布或排程不能使用空白正文');
  const validationAt = target === 'scheduled' ? data.publishDate.getTime() : now;
  const checked = validationFor(content, entry, data, root, validationAt);
  if (checked.errors.length) throw new Error(checked.errors.join('\n'));
  return { root: path.resolve(root), file, previousRaw: raw, nextRaw: serializeDocument(data, entry.body), sourceSha256: sha,
    summary: { ok: true, slug, file: path.relative(root, file).replace(/\\/g, '/'), from: entry.data.status, to: target,
      previousDraft: entry.data.draft, draft: data.draft, publishDate: data.publishDate ? taipeiIso(data.publishDate) : null,
      validationAt: taipeiIso(validationAt),
      dateWasSetToNow: target === 'published' && date === undefined && !entry.data.publishDate,
      sourceSha256: sha, plannedSha256: rawSha256(serializeDocument(data, entry.body)), warnings: checked.warnings,
      dryRun: true, written: false } };
}

/** 同目錄暫存＋rename；讀後與rename前都核對原稿SHA。 */
export function applyTransition(plan) {
  const { file, root, sourceSha256, nextRaw } = plan;
  recheckSha(file, sourceSha256, root);
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.editorial-${randomUUID()}.tmp`);
  let handle;
  try {
    handle = openSync(temporary, 'wx', lstatSync(file).mode & 0o777);
    writeFileSync(handle, nextRaw, 'utf8');
    fsyncSync(handle);
    closeSync(handle);
    handle = undefined;
    recheckSha(file, sourceSha256, root);
    renameSync(temporary, file);
  } finally {
    if (handle !== undefined) closeSync(handle);
    if (existsSync(temporary)) unlinkSync(temporary);
  }
  return { ...plan.summary, dryRun: false, written: true };
}

function parseArguments(args) {
  const positionals = [];
  const options = {};
  const values = new Set(['--date', '--expected-sha', '--status']);
  for (let i = 0; i < args.length; i++) {
    const value = args[i];
    if (values.has(value)) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`${value} 缺少值`);
      if (options[value] !== undefined) throw new Error(`不能重複指定 ${value}`);
      options[value] = args[++i];
    } else if (['--write', '--dry-run', '--json'].includes(value)) options[value] = true;
    else if (value.startsWith('--')) throw new Error(`未知選項：${value}`);
    else positionals.push(value);
  }
  if (options['--write'] && options['--dry-run']) throw new Error('--write 與 --dry-run 不能同時使用');
  return { positionals, options };
}

export function runEditorial(args, root = process.cwd()) {
  const { positionals, options } = parseArguments(args);
  const command = positionals[0] || 'list';
  if (['list', 'readiness'].includes(command)) {
    if (options['--write'] || options['--date'] || options['--expected-sha']) throw new Error('唯讀命令不接受寫入或日期選項');
    if (command === 'list') {
      if (positionals.length > 1) throw new Error('list 不接受文章參數');
      return listEditorial(root, { statuses: options['--status'] ? options['--status'].split(',') : STATES });
    }
    if (positionals.length !== 2 || options['--status']) throw new Error('用法：editorial readiness <slug>');
    const result = editorialReadiness(root, positionals[1]);
    return { ok: result.canPublish, ...result };
  }
  if (options['--status']) throw new Error('--status 只用於 list');
  let slug, target;
  if (command === 'transition') {
    if (positionals.length !== 3) throw new Error('用法：editorial transition <slug> <draft|review|scheduled|published|archived>');
    [, slug, target] = positionals;
  } else {
    target = ACTIONS[command];
    slug = positionals[1];
    if (!target || positionals.length !== 2) throw new Error('用法：editorial <review|publish|schedule|archive|draft> <slug> [--date 日期] [--write]');
  }
  const plan = planTransition(root, slug, target, { date: options['--date'], expectedSha: options['--expected-sha'] });
  return options['--write'] ? applyTransition(plan) : plan.summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = runEditorial(process.argv.slice(2));
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch (error) { console.error(JSON.stringify({ ok: false, error: error.message }, null, 2)); process.exitCode = 1; }
}
