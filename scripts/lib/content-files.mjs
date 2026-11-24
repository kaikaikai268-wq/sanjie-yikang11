import { existsSync, readFileSync, readdirSync, realpathSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { load, dump, JSON_SCHEMA } from 'js-yaml';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { articleSchema, authorSchema, topicSchema, slugSchema } from '../../src/content.schemas.mjs';
import { contentSlug, isPublicFrontmatter, isSafeLocalImage, normalizedText, publicationNow } from '../../src/lib/content-core.mjs';

export function parseDocument(raw, schema) {
  const match = raw.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error('缺少 YAML frontmatter');
  const data = schema.parse(load(match[1], { schema: JSON_SCHEMA }));
  return { data, body: match[2].trim() };
}

export function serializeDocument(data, body) {
  return `---\n${dump(data, { noRefs: true, lineWidth: -1, sortKeys: false }).trimEnd()}\n---\n\n${body.trim()}\n`;
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  if (lstatSync(directory).isSymbolicLink()) throw new Error(`內容目錄不能使用 symbolic link：${directory}`);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) throw new Error(`內容目錄不能使用 symbolic link：${entry.name}`);
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : entry.name.endsWith('.md') ? [file] : [];
  });
}

/** 所有 Node 工具共用；解析失敗累積在 errors，不讓壞稿被誤認為可公開內容。 */
export function loadContent(root = process.cwd()) {
  const result = { articles: [], authors: [], topics: [], errors: [] };
  for (const [collection, schema] of [['articles', articleSchema], ['authors', authorSchema], ['topics', topicSchema]]) {
    const directory = path.join(root, 'src', 'content', collection);
    let files;
    try { files = walk(directory); }
    catch (error) { result.errors.push(error.message); continue; }
    for (const file of files) {
      try {
        const id = path.relative(directory, file).replace(/\\/g, '/').replace(/\.md$/, '');
        slugSchema.parse(id);
        result[collection].push({ id, file, ...parseDocument(readFileSync(file, 'utf8'), schema) });
      } catch (error) { result.errors.push(`${path.relative(root, file)}：${error.message}`); }
    }
  }
  return result;
}

function assertAsset(root, value, errors, label) {
  if (!isSafeLocalImage(value)) { errors.push(`${label}：圖片路徑不安全：${value}`); return; }
  const publicRoot = path.resolve(root, 'public');
  const target = path.resolve(publicRoot, `.${value}`);
  if (!existsSync(target)) { errors.push(`${label}：圖片不存在：${value}`); return; }
  const resolved = realpathSync(target);
  if (!resolved.startsWith(`${realpathSync(publicRoot)}${path.sep}`)) errors.push(`${label}：圖片連結超出 public 目錄`);
}

export function decodeLink(value) {
  return value.replace(/&#(?:x([a-f0-9]+)|(\d+));?/gi, (_, hex, decimal) => {
    const point = Number.parseInt(hex || decimal, hex ? 16 : 10);
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
  }).replace(/&(colon|tab|newline|amp);/gi, (_, entity) => ({ colon: ':', tab: '\t', newline: '\n', amp: '&' })[entity.toLowerCase()]);
}

/** CommonMark AST，避免用 regex 猜 fence、list 與 HTML 的實際渲染語意。 */
export function inspectMarkdown(body) {
  const tree = fromMarkdown(body);
  const definitions = new Map();
  const nodes = [];
  const visit = (node) => { nodes.push(node); for (const child of node.children ?? []) visit(child); };
  visit(tree);
  for (const node of nodes) if (node.type === 'definition') definitions.set(node.identifier, node.url);
  const links = [];
  const images = [];
  let hasHtml = false;
  let hasH1 = false;
  for (const node of nodes) {
    if (node.type === 'html') {
      // 只允許完整、合法且沒有 -- 內嵌的 HTML 註解；其餘 raw HTML 一律拒收。
      const remainder = node.value.replace(/<!--(?!>|->)(?:(?!--)[\s\S])*-->/g, '').trim();
      if (remainder) hasHtml = true;
    }
    if (node.type === 'heading' && node.depth === 1) hasH1 = true;
    let url;
    if (['link', 'image', 'definition'].includes(node.type)) url = node.url;
    else if (['linkReference', 'imageReference'].includes(node.type)) url = definitions.get(node.identifier);
    if (typeof url === 'string') {
      const decoded = decodeLink(url);
      links.push(decoded);
      if (['image', 'imageReference'].includes(node.type)) images.push(decoded);
    }
  }
  return { links: [...new Set(links)], images: [...new Set(images)], hasHtml, hasH1 };
}

export function articleLinks(body) {
  return inspectMarkdown(body).links;
}
export const extractMarkdownImages = (body) => inspectMarkdown(body).images;

/** 發布前整體關聯檢查；草稿可有未完成欄位，但不接受壞網址、危險內容或不存在的關聯。 */
export function checkContent(content, { root = process.cwd(), now = publicationNow() } = {}) {
  const errors = [...content.errors];
  const warnings = [];
  const articles = new Map();
  const titles = new Map();
  const jobs = new Set();
  const authors = new Set(content.authors.map((entry) => entry.id));
  const topics = new Map(content.topics.map((entry) => [entry.id, entry]));
  const productFile = path.join(root, 'src/data/products.ts');
  const productIds = new Set(existsSync(productFile) ? [...readFileSync(productFile, 'utf8').matchAll(/\bid:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]) : []);
  for (const entry of content.articles) {
    const slug = contentSlug(entry);
    if (articles.has(slug)) errors.push(`${entry.id}：重複文章網址 ${slug}`);
    articles.set(slug, entry);
    const title = normalizedText(entry.data.title);
    if (titles.has(title)) errors.push(`${entry.id}：與 ${titles.get(title)} 標題重複，請先確認既有題目`);
    titles.set(title, entry.id);
    if (entry.data.writerJobId) {
      if (jobs.has(entry.data.writerJobId)) errors.push(`${entry.id}：重複 Writer jobId`);
      jobs.add(entry.data.writerJobId);
    }
  }
  const publicTopics = new Set(content.topics.filter((topic) => topic.data.status === 'active' && content.articles.some((entry) =>
    isPublicFrontmatter(entry.data, now) && (entry.data.topics.includes(topic.id) || topic.data.articles.includes(contentSlug(entry)) ||
      topic.data.sections.some((section) => section.articles.includes(contentSlug(entry))))
  )).map((topic) => topic.id));
  for (const entry of content.articles) {
    const { data, body } = entry;
    const isPublic = isPublicFrontmatter(data, now);
    if (!authors.has(data.author)) errors.push(`${entry.id}：作者不存在 ${data.author}`);
    for (const topic of data.topics) if (!topics.has(topic)) errors.push(`${entry.id}：專題不存在 ${topic}`);
    for (const related of data.relatedArticles) {
      if (!articles.has(related)) errors.push(`${entry.id}：延伸閱讀不存在 ${related}`);
      else if (isPublic && !isPublicFrontmatter(articles.get(related).data, now)) warnings.push(`${entry.id}：延伸閱讀 ${related} 尚未公開，前台會略過`);
    }
    for (const product of data.relatedProducts) if (!productIds.has(product)) errors.push(`${entry.id}：商品不存在 ${product}`);
    const markdown = inspectMarkdown(body);
    if (markdown.hasHtml) errors.push(`${entry.id}：正文只接受 Markdown，不接受 HTML 標籤或不安全網址`);
    if (markdown.hasH1) errors.push(`${entry.id}：正文不另放 h1，標題由文章版型產生`);
    for (const image of markdown.images) if (!isSafeLocalImage(image)) errors.push(`${entry.id}：正文圖片必須使用 public/content、images 或 covers 的本地圖片路徑，不接受外部網址、query 或其他目錄：${image}`);
    if (isPublic && !body.trim()) errors.push(`${entry.id}：公開文章不能是空白正文`);
    if (['published', 'scheduled'].includes(data.status) && !data.draft && !data.references.length) errors.push(`${entry.id}：發布或排程文章必須列出可點閱的資料來源`);
    if (!data.coverImage) warnings.push(`${entry.id}：尚無封面，可在編輯階段補齊`);
    if (data.coverImage) assertAsset(root, data.coverImage, errors, entry.id);
    for (let href of markdown.links) {
      const protocolProbe = href.replace(/[\u0000-\u0020\u007f]/g, '');
      if ((/^[a-z][a-z0-9+.-]*:/i.test(protocolProbe) && !/^(?:https?|mailto|tel):/i.test(protocolProbe)) || href.includes('\\')) { errors.push(`${entry.id}：不安全連結 ${href}`); continue; }
      if (href.startsWith('//')) { errors.push(`${entry.id}：外部來源請填完整 https 網址`); continue; }
      if (/^https?:\/\//i.test(href)) {
        let parsed;
        try { parsed = new URL(href); }
        catch { errors.push(`${entry.id}：外連網址格式錯誤 ${href}`); continue; }
        const site = new URL(process.env.PUBLIC_SITE_URL || 'https://3jwellness.com');
        if (parsed.hostname.replace(/^www\./, '') !== site.hostname.replace(/^www\./, '')) continue;
        href = parsed.pathname;
      }
      if (/^(?:#|mailto:|tel:)/i.test(href)) continue;
      let pathname;
      try { pathname = decodeURIComponent(href.split(/[?#]/)[0]); }
      catch { errors.push(`${entry.id}：網址編碼錯誤 ${href}`); continue; }
      if (pathname.split('/').includes('..')) { errors.push(`${entry.id}：連結不得跳離內容路徑 ${href}`); continue; }
      if (/^\/(?:content|images|covers)\//.test(pathname)) { assertAsset(root, pathname, errors, entry.id); continue; }
      const article = pathname.match(/^\/articles\/([^/]+)\/?$/);
      if (article) {
        const target = articles.get(article[1]);
        if (!target) errors.push(`${entry.id}：站內文章不存在 ${href}`);
        else if (isPublic && !isPublicFrontmatter(target.data, now)) errors.push(`${entry.id}：公開文章不能連到未發布文章 ${href}`);
      }
      const topic = pathname.match(/^\/topics\/([^/]+)\/?$/);
      if (topic && !topics.has(topic[1])) errors.push(`${entry.id}：站內專題不存在 ${href}`);
      else if (topic && isPublic && !publicTopics.has(topic[1])) errors.push(`${entry.id}：站內專題未公開或沒有公開文章 ${href}`);
      const author = pathname.match(/^\/authors\/([^/]+)\/?$/);
      if (author && !authors.has(author[1])) errors.push(`${entry.id}：站內作者不存在 ${href}`);
    }
  }
  for (const topic of content.topics) {
    for (const slug of [...topic.data.articles, ...topic.data.sections.flatMap((section) => section.articles)])
      if (!articles.has(slug)) errors.push(`${topic.id}：專題成員文章不存在 ${slug}`);
    if (topic.data.coverImage) assertAsset(root, topic.data.coverImage, errors, topic.id);
  }
  for (const author of content.authors) if (author.data.avatar) assertAsset(root, author.data.avatar, errors, author.id);
  return { errors, warnings };
}
