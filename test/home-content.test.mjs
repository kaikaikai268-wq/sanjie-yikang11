import test from 'node:test';
import assert from 'node:assert/strict';
import { selectHomeContent } from '../src/lib/home-content.mjs';

const now = new Date('2026-11-24T12:00:00+08:00');
const entry = (id, extra = {}) => ({ id, data: { title: id, category: '健康生活', status: 'published', publishDate: '2026-11-23', ...extra } });

test('精選優先並依日期補足，最新列表不重複精選', () => {
  const candidates = [entry('old-pick', { featured: true, publishDate: '2026-11-01' }), entry('newest', { publishDate: '2026-11-24' }), entry('third', { publishDate: '2026-11-22' }), entry('fourth', { publishDate: '2026-11-21' })];
  const result = selectHomeContent(candidates, { featuredLimit: 2, latestLimit: 3, now });
  assert.deepEqual(result.featured.map((value) => value.id), ['old-pick', 'newest']);
  assert.deepEqual(result.latest.map((value) => value.id), ['third', 'fourth']);
});

test('共用公開判斷排除草稿與未來稿，slug別名只計一次分類', () => {
  const candidates = [entry('public', { slug: 'same', category: '營養' }), entry('filename-alias', { slug: 'same', category: '營養' }), entry('draft', { status: 'draft', featured: true }), entry('future', { status: 'scheduled', publishDate: '2099-01-01', featured: true }), entry('review', { status: 'review' })];
  const result = selectHomeContent(candidates, { now });
  assert.equal(result.articles.length, 1);
  assert.deepEqual(result.categories, [{ name: '營養', count: 1 }]);
  assert.deepEqual(result.featured.map((value) => value.id), ['public']);
});

test('空內容庫保持空陣列，不填入虛構文章與分類', () => {
  assert.deepEqual(selectHomeContent([], { now }), { featured: [], latest: [], categories: [], articles: [] });
});
