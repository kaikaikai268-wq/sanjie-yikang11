import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { articleSchema, topicSchema } from '../src/content.schemas.mjs';
import { isPublicFrontmatter, parseTaipeiDate, rankRelated, publicationNow } from '../src/lib/content-core.mjs';
import { checkContent, loadContent, serializeDocument, extractMarkdownImages, inspectMarkdown } from '../scripts/lib/content-files.mjs';
import { importWriter, contentStats } from '../scripts/content.mjs';

const now = Date.parse('2026-11-24T00:00:00+08:00');
const draft = (extra = {}) => articleSchema.parse({ title: '測試資料格式', description: '測試用內容摘要', ...extra });
const ref = { title: '測試資料來源', url: 'https://example.org/source' };

function temporaryContent(fn) {
  const root = mkdtempSync(path.join(os.tmpdir(), '3j-content-test-'));
  try {
    mkdirSync(path.join(root, 'src/content/authors'), { recursive: true });
    mkdirSync(path.join(root, 'src/content/articles'), { recursive: true });
    writeFileSync(path.join(root, 'src/content/authors/3j-editorial.md'), serializeDocument({ name: '測試編輯團隊', bioShort: '測試用署名', isOrganization: true }, ''), 'utf8');
    return fn(root);
  } finally {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('3j-content-test-'));
    rmSync(resolved, { recursive: true, force: true });
  }
}

test('台灣日期在台北午夜發布，無時區日期不隨機器時區改變', () => {
  assert.equal(parseTaipeiDate('2026-11-24').toISOString(), '2026-11-23T16:00:00.000Z');
  assert.equal(parseTaipeiDate('2026-11-24T09:30').toISOString(), '2026-11-24T01:30:00.000Z');
  assert.equal(parseTaipeiDate('2026-11-24T09:30:00Z').toISOString(), '2026-11-24T09:30:00.000Z');
  assert.ok(Number.isNaN(parseTaipeiDate('2026-02-30').getTime()));
  assert.ok(Number.isNaN(parseTaipeiDate('11/24/2026').getTime()));
});

test('未知狀態、送審、草稿、封存、缺日期或未來稿全部不公開', () => {
  for (const status of ['draft', 'review', 'archived', undefined, 'unknown'])
    assert.equal(isPublicFrontmatter({ status, publishDate: '2026-11-23' }, now), false);
  assert.equal(isPublicFrontmatter({ status: 'published', draft: true, publishDate: '2026-11-23' }, now), false);
  assert.equal(isPublicFrontmatter({ status: 'published' }, now), false);
  assert.equal(isPublicFrontmatter({ status: 'published', publishDate: '2026-11-25' }, now), false);
  assert.equal(isPublicFrontmatter({ status: 'scheduled', publishDate: '2026-11-24' }, now), true);
  assert.equal(isPublicFrontmatter({ status: 'published', publishDate: '2026-11-24T00:00:01+08:00' }, now), false);
});

test('建置時鐘固定公開範圍，格式錯誤會失敗，不默默退回現在時間', () => {
  const previous = process.env.CONTENT_BUILD_TIME;
  try {
    process.env.CONTENT_BUILD_TIME = '2026-11-24T00:00:00+08:00';
    assert.equal(publicationNow(), now);
    const entry = { id: 'scheduled', data: draft({ status: 'scheduled', publishDate: '2026-11-24T00:00:01+08:00' }) };
    assert.equal(isPublicFrontmatter(entry.data), false);
    assert.equal(contentStats({ articles: [entry], authors: [], topics: [], errors: [] }).public, 0);
    process.env.CONTENT_BUILD_TIME = '2026-11-24T00:00:01+08:00';
    assert.equal(isPublicFrontmatter(entry.data), true);
    for (const value of ['invalid', '', '2026-11-24', '2026-02-30T00:00:00Z']) {
      process.env.CONTENT_BUILD_TIME = value;
      assert.throws(() => publicationNow(), /CONTENT_BUILD_TIME/);
      assert.throws(() => isPublicFrontmatter(entry.data), /CONTENT_BUILD_TIME/);
    }
    delete process.env.CONTENT_BUILD_TIME;
    const start = Date.now();
    const actual = publicationNow();
    assert.ok(actual >= start && actual <= Date.now());
  } finally {
    if (previous === undefined) delete process.env.CONTENT_BUILD_TIME;
    else process.env.CONTENT_BUILD_TIME = previous;
  }
});

test('共用 schema 預設草稿並阻擋危險來源、路徑與無日期發布', () => {
  assert.equal(draft().status, 'draft');
  for (const extra of [
    { status: 'published' },
    { coverImage: '/content/../secret.png', coverAlt: '測試' },
    { coverImage: '/content/test.webp' },
    { references: [{ title: '錯誤網址', url: 'javascript:alert(1)' }] },
    { tags: ['不合法/標籤'] },
    { slug: '../secret' },
    { publishDate: '2026-02-30' },
  ]) assert.throws(() => draft(extra));
});

test('分類保留中文名稱，但拒絕跨路徑、編碼、query、fragment與控制字', () => {
  assert.equal(draft({ category: '熟齡與家庭照顧' }).category, '熟齡與家庭照顧');
  for (const category of ['.', '..', '健康/生活', '健康\\生活', '健康%2f生活', '健康?生活', '健康#生活', '健康\n生活', '健康\u0000生活'])
    assert.throws(() => draft({ category }), category);
});

test('延伸閱讀優先手動指定，再以共同專題與標籤排序，不硬塞無關內容', () => {
  const entry = (id, data) => ({ id, data: draft(data) });
  const source = entry('source', { topics: ['topic'], tags: ['標籤'], relatedArticles: ['chosen'] });
  const candidates = [source, entry('tag', { tags: ['標籤'] }), entry('topic', { topics: ['topic'] }), entry('chosen', {}), entry('unrelated', {})];
  assert.deepEqual(rankRelated(source, candidates).map((item) => item.id), ['chosen', 'topic', 'tag']);
});

test('發布預檢檢查跨檔關聯、重複網址、來源與草稿內鏈', () => temporaryContent((root) => {
  const base = loadContent(root);
  const entry = (id, extra, body = '正文') => ({ id, data: draft(extra), body });
  const hidden = entry('hidden', { title: '待編輯內容' });
  const visible = entry('visible', { title: '公開測試內容', status: 'published', publishDate: '2026-11-23', references: [ref] }, '[待編輯內容](/articles/hidden/)');
  const result = checkContent({ ...base, articles: [visible, hidden] }, { root, now });
  assert.ok(result.errors.some((error) => error.includes('未發布文章')));
  const duplicate = checkContent({ ...base, articles: [hidden, entry('other', { title: '另一個標題', slug: 'hidden' })] }, { root, now });
  assert.ok(duplicate.errors.some((error) => error.includes('重複文章網址')));
  const unknownAuthor = checkContent({ ...base, articles: [entry('missing', { author: 'missing' })] }, { root, now });
  assert.ok(unknownAuthor.errors.some((error) => error.includes('作者不存在')));
}));

test('Writer dry-run 不寫檔；正式匯入只建草稿、重送冪等、不覆寫改稿', () => temporaryContent((root) => {
  const payload = { schemaVersion: 1, jobId: 'job-001', article: { title: 'Writer 匯入測試', description: '格式測試', slug: 'writer-test', status: 'published', publishDate: '2026-11-23', references: [ref] }, body: '測試正文。' };
  assert.equal(importWriter(payload, { root, dryRun: true }).status, 'valid');
  assert.equal(loadContent(root).articles.length, 0);
  assert.equal(importWriter(payload, { root }).status, 'created');
  const entry = loadContent(root).articles[0];
  assert.equal(entry.data.status, 'draft');
  assert.equal(entry.data.draft, true);
  assert.equal(importWriter(payload, { root }).status, 'unchanged');
  writeFileSync(entry.file, readFileSync(entry.file, 'utf8').replace('測試正文。', '人工修改後的正文。'));
  assert.throws(() => importWriter(payload, { root }), /已存在且內容不同/);
  assert.throws(() => importWriter({ ...payload, jobId: 'another' }, { root }), /文章網址已存在/);
}));

test('Writer 不接收跨目錄 slug 與可執行正文', () => temporaryContent((root) => {
  const payload = { schemaVersion: 1, jobId: 'unsafe', article: { title: '不安全測試', description: '格式測試', slug: 'unsafe' }, body: '<script>alert(1)</script>' };
  assert.throws(() => importWriter(payload, { root }), /HTML/);
  assert.throws(() => importWriter({ ...payload, article: { ...payload.article, slug: '../escape' } }, { root }));
  assert.equal(loadContent(root).articles.length, 0);
}));

test('Markdown 範例、註解與普通 data: 字樣不誤殺，但所有 raw HTML 都被擋下', () => temporaryContent((root) => {
  const content = loadContent(root);
  const run = (body) => checkContent({ ...content, articles: [{ id: 'probe', data: draft(), body }] }, { root, now });
  const safe = [
    '此處 data: 是資料格式的字面說明。',
    '```html\n<script>alert(1)</script>\n# 範例中的標題\n```',
    '~~~html\n<svg onload="alert(1)"></svg>\n~~~',
    '行內程式 `<script>alert(1)</script>` 的說明。',
    '<!-- 編輯備註：<script> 不會執行 -->\n一般正文。',
    '<https://example.org/source>',
    '\\<script> 是跳脫後的字面範例。',
  ];
  for (const body of safe) assert.deepEqual(run(body).errors, [], body);
  for (const body of [
    '<svg><animate onbegin="alert(1)"></animate></svg>',
    '<style>body{display:none}</style>',
    '<meta http-equiv="refresh" content="0;url=https://example.org">',
    '<link rel="stylesheet" href="https://example.org/css">',
    '<base href="https://example.org">',
    '<a href="java&#x73;cript:alert(1)">點擊</a>',
    '<script/src=x>alert(1)</script>',
    '<!--><script>alert(1)</script>-->',
    '``` invalid ```\n<script>alert(1)</script>',
    '- 清單項目\n\n    <script>alert(1)</script>',
  ]) assert.ok(run(body).errors.some((error) => error.includes('HTML')), body);
}));

test('CommonMark AST 提取 inline 與 reference 圖片、略過程式範例，並辨識 Setext h1', () => {
  const body = '![插圖](/content/inline.webp)\n\n![引用圖][cover]\n\n[cover]: /content/reference.webp "圖說"\n\n```md\n![範例](/content/not-real.webp)\n```';
  assert.deepEqual(extractMarkdownImages(body), ['/content/inline.webp', '/content/reference.webp']);
  assert.equal(inspectMarkdown('正文標題\n========').hasH1, true);
  assert.equal(inspectMarkdown('## 正文標題').hasH1, false);
});

test('實際 Markdown 連結阻擋 entity 混淆與危險 protocol，程式碼範例不誤殺', () => temporaryContent((root) => {
  const content = loadContent(root);
  const run = (body) => checkContent({ ...content, articles: [{ id: 'probe', data: draft(), body }] }, { root, now });
  for (const body of [
    '[文字](javascript:alert(1))',
    '[文字](java&#x73;cript:alert(1))',
    '[文字](java&Tab;script&colon;alert(1))',
    '[文字](data:text/html,hello)',
    '[文字](file:///etc/passwd)',
    '[文字][source]\n\n[source]: vbscript:msgbox(1)',
  ]) assert.ok(run(body).errors.some((error) => error.includes('不安全連結')), body);
  assert.deepEqual(run('```md\n[文字](javascript:alert(1))\n```').errors, []);
}));

test('公開文章不能連 inactive／空專題，手選草稿不會進相關閱讀', () => temporaryContent((root) => {
  const content = loadContent(root);
  const article = { id: 'public', data: draft({ title: '公開內容', status: 'published', publishDate: '2026-11-23', references: [ref], relatedArticles: ['hidden'] }), body: '[專題](/topics/empty/)' };
  const hidden = { id: 'hidden', data: draft({ title: '未公開內容' }), body: '草稿' };
  const topic = { id: 'empty', data: topicSchema.parse({ title: '專題測試', description: '專題說明', status: 'active', articles: ['hidden'] }), body: '' };
  const run = () => checkContent({ ...content, articles: [article, hidden], topics: [topic] }, { root, now });
  assert.ok(run().errors.some((error) => error.includes('專題未公開')));
  assert.ok(run().warnings.some((error) => error.includes('前台會略過')));
  assert.deepEqual(rankRelated(article, [article]).map((entry) => entry.id), []);
  topic.data.articles = ['public'];
  assert.deepEqual(run().errors, []);
  topic.data.status = 'inactive';
  assert.ok(run().errors.some((error) => error.includes('專題未公開')));
  article.body = '[草稿](https://3jwellness.com/articles/hidden/)';
  assert.ok(run().errors.some((error) => error.includes('未發布文章')));
}));

test('公開稿拒絕空來源，來源 protocol 與 asset 逃逸在 schema 或預檢阻擋', () => temporaryContent((root) => {
  const content = loadContent(root);
  const article = { id: 'public', data: draft({ status: 'published', publishDate: '2026-11-23' }), body: '測試正文' };
  assert.ok(checkContent({ ...content, articles: [article] }, { root, now }).errors.some((error) => error.includes('資料來源')));
  for (const url of ['', 'file:///secret', 'data:text/plain,test', 'ftp://example.org'])
    assert.throws(() => draft({ references: [{ title: '來源', url }] }));
  for (const coverImage of ['/content/../secret.png', '/content/%2e%2e/secret.png', '/content/\\secret.png', '//example.org/image.png'])
    assert.throws(() => draft({ coverImage, coverAlt: '測試圖片' }));
  const missing = { id: 'missing', data: draft({ coverImage: '/content/missing.webp', coverAlt: '不存在的圖片' }), body: '正文' };
  assert.ok(checkContent({ ...content, articles: [missing] }, { root, now }).errors.some((error) => error.includes('圖片不存在')));
}));

test('正文圖片預檢拒外部與query圖片，不等到媒體處理才失敗', () => temporaryContent((root) => {
  const content = loadContent(root);
  for (const image of ['https://example.org/image.webp', '/content/image.webp?width=800', 'images/relative.webp', '/other/image.webp']) {
    const entry = { id: 'image', data: draft(), body: `![測試圖片](${image})` };
    const result = checkContent({ ...content, articles: [entry] }, { root, now });
    assert.ok(result.errors.some((error) => error.includes('正文圖片必須')), image);
  }
}));

test('圖片 symlink／junction 不能跳出 public，內容目錄不跟隨 symlink', (t) => temporaryContent((root) => {
  const content = loadContent(root);
  const outside = path.join(root, 'outside');
  const publicRoot = path.join(root, 'public/content');
  mkdirSync(outside, { recursive: true });
  mkdirSync(publicRoot, { recursive: true });
  writeFileSync(path.join(outside, 'escape.webp'), 'test');
  writeFileSync(path.join(outside, 'escape.md'), serializeDocument(draft(), '正文'));
  try {
    symlinkSync(outside, path.join(publicRoot, 'linked'), 'junction');
    symlinkSync(outside, path.join(root, 'src/content/articles/linked'), 'junction');
  } catch (error) {
    if (['EPERM', 'EACCES'].includes(error.code)) { t.skip('執行環境未允許建立 symlink／junction'); return; }
    throw error;
  }
  const article = { id: 'escape', data: draft({ coverImage: '/content/linked/escape.webp', coverAlt: '測試圖片' }), body: '正文' };
  assert.ok(checkContent({ ...content, articles: [article] }, { root, now }).errors.some((error) => error.includes('超出 public')));
  assert.ok(loadContent(root).errors.some((error) => error.includes('symbolic link')));
}));
