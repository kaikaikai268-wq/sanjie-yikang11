import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { plainSearchExcerpt, localSearchResultUrl } from '../src/lib/search-core.mjs';

test('search excerpts remain plain text without parsing untrusted HTML', () => {
  assert.equal(plainSearchExcerpt('了解 <mark>魚油</mark> &amp; 標示'), '了解 魚油 & 標示');
  assert.equal(plainSearchExcerpt('<img src="https://example.test/tracking">文字<script>alert(1)</script>'), '文字alert(1)');
  assert.equal(plainSearchExcerpt('&lt;img onerror=alert(1)&gt;'), '<img onerror=alert(1)>');
  assert.equal(plainSearchExcerpt('&#x9b5a;&#27833;'), '魚油');
  assert.equal(plainSearchExcerpt('&#x110000;'), '\uFFFD');
});
test('result links retain deployment base and reject executable, credential and external URLs', () => {
  const origin = 'https://3jwellness.com';
  assert.equal(localSearchResultUrl('/sanjie-yikang11/articles/fish-oil/', origin)?.pathname, '/sanjie-yikang11/articles/fish-oil/');
  for (const url of ['javascript:alert(1)', 'https://elsewhere.test/articles/a/', '//elsewhere.test/a', 'https://user:password@3jwellness.com/articles/a/']) assert.equal(localSearchResultUrl(url, origin), null);
});
const source = await readFile(new URL('../src/lib/search-client.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source.replaceAll('import.meta.env.DEV', 'false'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const settle = () => new Promise((resolve) => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; }
class MockNode {
  children = [];
  attributes = {};
  listeners = new Map();
  hidden = false;
  disabled = false;
  text = '';
  append(...children) { this.children.push(...children); }
  replaceChildren() { this.children = []; this.text = ''; }
  get textContent() { return this.text + this.children.map((child) => child.textContent).join(''); }
  set textContent(value) { this.text = String(value); this.children = []; }
  set innerHTML(_) { throw new Error('Search must never insert untrusted HTML'); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(callback); }
  dispatch(name, event = {}) { return (this.listeners.get(name) || []).map((callback) => callback({ preventDefault() {}, ...event })); }
  focus() {}
}
function harness({ count = 13, search = async () => ({ results: [] }), load, initial = '' } = {}) {
  let imports = 0;
  const queries = [];
  const analytics = [];
  const form = new MockNode(), input = new MockNode(), submit = new MockNode(), status = new MockNode(), list = new MockNode(), more = new MockNode();
  const controls = { form, input, '[type="submit"]': submit, '[role="status"]': status, ol: list, '.content-search-more': more };
  const root = { dataset: { indexCount: String(count), indexUrl: '/base/pagefind/pagefind.js' }, querySelector: (selector) => controls[selector] };
  const exports = {};
  vm.runInNewContext(javascript, {
    exports, require: () => ({ plainSearchExcerpt, localSearchResultUrl }),
    document: { querySelector: () => null, createElement: () => new MockNode() },
    location: { search: initial, origin: 'https://3jwellness.com' }, URLSearchParams,
    window: { gtag: (...values) => analytics.push(values) },
  });
  exports.mountContentSearch(root, async (url) => {
    imports++;
    assert.equal(url, '/base/pagefind/pagefind.js');
    if (load) return load();
    return { search: (query) => { queries.push(query); return search(query); } };
  });
  return {
    status, list, more, submit, input, queries, analytics,
    get imports() { return imports; },
    async search(query) { input.value = query; form.dispatch('submit'); await settle(); },
    async loadMore() { await Promise.all(more.dispatch('click')); },
    links: () => list.children.map((row) => row.children[0].children[0]),
  };
}
const hit = (id, extra = {}) => ({ data: async () => ({ url: `/base/articles/${id}/`, meta: { title: `文章${id}` }, excerpt: `內容<mark>${id}</mark>`, ...extra }) });

test('empty index does not import Pagefind or search initial or submitted queries', async () => {
  const state = harness({ count: 0, initial: '?q=sensitive-health-query' });
  assert.equal(state.input.value, 'sensitive-health-query');
  await state.search('健康搜尋詞');
  assert.equal(state.imports, 0);
  assert.equal(state.queries.length, 0);
  assert.equal(state.more.hidden, true);
  assert.equal(state.status.textContent, '目前尚無公開文章，可稍後再試。');
});
test('thirteen results paginate eight plus five, then a zero-result query clears old rows', async () => {
  const state = harness({ search: async (query) => ({ results: query === '有內容' ? Array.from({ length: 13 }, (_, id) => hit(id)) : [] }) });
  await state.search('有內容');
  assert.equal(state.list.children.length, 8);
  assert.equal(state.more.hidden, false);
  await state.loadMore();
  assert.equal(state.list.children.length, 13);
  assert.equal(state.more.hidden, true);
  assert.match(state.status.textContent, /13 筆結果，已顯示 13 筆/);
  await state.search('無結果');
  assert.equal(state.list.children.length, 0);
  assert.equal(state.more.hidden, true);
  assert.match(state.status.textContent, /沒有找到/);
  assert.equal(state.imports, 1);
  assert.deepEqual(state.analytics, []);
});
test('a slow older query cannot replace a newer completed query', async () => {
  const slow = deferred();
  const state = harness({ search: async (query) => query === '舊查詢' ? slow.promise : { results: [hit('new')] } });
  await state.search('舊查詢');
  assert.equal(state.submit.disabled, false);
  await state.search('新查詢');
  assert.equal(state.links()[0].href, 'https://3jwellness.com/base/articles/new/');
  slow.resolve({ results: [hit('old')] });
  await settle();
  assert.equal(state.links()[0].href, 'https://3jwellness.com/base/articles/new/');
  assert.equal(state.list.attributes['aria-busy'], 'false');
});
test('a failed old load-more request cannot overwrite a new query status or busy state', async () => {
  const slowHit = deferred(), nextQuery = deferred();
  const results = [...Array.from({ length: 8 }, (_, id) => hit(id)), { data: () => slowHit.promise }];
  const state = harness({ search: async (query) => query === '舊' ? { results } : nextQuery.promise });
  await state.search('舊');
  const pendingMore = state.loadMore();
  await state.search('新');
  slowHit.reject(new Error('old load more failed'));
  await pendingMore;
  assert.equal(state.status.textContent, '正在搜尋…');
  assert.equal(state.list.attributes['aria-busy'], 'true');
  nextQuery.resolve({ results: [hit('new')] });
  await settle();
  assert.equal(state.links()[0].href, 'https://3jwellness.com/base/articles/new/');
});
test('a hit data failure keeps its page retryable without duplicate rows', async () => {
  let attempts = 0;
  const retryHit = { data: async () => { if (++attempts === 1) throw new Error('temporary'); return hit('last').data(); } };
  const state = harness({ search: async () => ({ results: [...Array.from({ length: 8 }, (_, id) => hit(id)), retryHit] }) });
  await state.search('重試');
  await state.loadMore();
  assert.match(state.status.textContent, /部分結果暫時無法載入/);
  assert.equal(state.list.children.length, 8);
  assert.equal(state.more.disabled, false);
  await state.loadMore();
  assert.equal(state.list.children.length, 9);
  assert.equal(state.more.hidden, true);
});
test('initial hit failure and module load failure can both retry by resubmitting', async () => {
  let attempts = 0;
  const state = harness({ search: async () => ({ results: [{ data: async () => { if (++attempts === 1) throw new Error('fragment unavailable'); return hit('retry').data(); } }] }) });
  await state.search('重試');
  assert.match(state.status.textContent, /搜尋暫時無法使用/);
  await state.search('重試');
  assert.equal(state.list.children.length, 1);
  let loads = 0;
  const brokenModule = harness({ load: async () => { if (++loads === 1) throw new Error('offline'); return { search: async () => ({ results: [hit('loaded')] }) }; } });
  await brokenModule.search('索引');
  assert.match(brokenModule.status.textContent, /搜尋暫時無法使用/);
  await brokenModule.search('索引');
  assert.equal(brokenModule.list.children.length, 1);
  assert.equal(brokenModule.imports, 2);
});
test('actual result rendering rejects external navigation and inserts hostile titles/excerpts as text', async () => {
  const title = '<img src=x onerror=alert(1)>';
  const state = harness({ search: async () => ({ results: [
    hit('safe', { meta: { title }, excerpt: '&lt;script&gt;alert(1)&lt;/script&gt;<img src="https://evil.test/pixel">' }),
    hit('bad', { url: 'https://evil.test/article/' }), hit('missing', { url: undefined }),
  ] }) });
  await state.search('安全');
  assert.equal(state.list.children.length, 1);
  assert.equal(state.links()[0].textContent, title);
  assert.equal(state.list.children[0].children[1].textContent, '<script>alert(1)</script>');
  assert.match(state.status.textContent, /已顯示 1 筆/);
  assert.deepEqual(state.analytics, []);
});
