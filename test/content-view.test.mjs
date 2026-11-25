import test from 'node:test';
import assert from 'node:assert/strict';
import { displayDate, readingMinutes, contentTypeLabel } from '../src/lib/content-format.mjs';

test('讀者看到的日期以台北跨日計算', () => {
  assert.equal(displayDate(new Date('2026-11-23T16:00:00Z')), '2026/11/24');
  assert.equal(displayDate(new Date('2026-11-23T15:59:59Z')), '2026/11/23');
  assert.equal(displayDate(), '');
});

test('閱讀時間忽略空白並向上取整，空文不顯示零分鐘', () => {
  assert.equal(readingMinutes(), 1);
  assert.equal(readingMinutes('文'.repeat(400) + ' \n '), 1);
  assert.equal(readingMinutes('文'.repeat(401)), 2);
});

test('新的未識別文章類型保留一般文章名稱', () => {
  assert.equal(contentTypeLabel('guide'), '生活指南');
  assert.equal(contentTypeLabel('future-type'), '健康文章');
});
