import test from 'node:test';
import assert from 'node:assert/strict';
import { fragmentId } from '../src/lib/article-navigation-core.mjs';

test('目錄支援原始或編碼中文錨點，不改變段落名稱', () => {
  assert.equal(fragmentId('#營養補給'), '營養補給');
  assert.equal(fragmentId('#%E7%87%9F%E9%A4%8A%E8%A3%9C%E7%B5%A6'), '營養補給');
  assert.equal(fragmentId('#section-2'), 'section-2');
});

test('非頁內與損壞錨點不攔截原生導航，也不拋 URIError', () => {
  for (const value of [null, '', '#', '/articles/other/#section', 'https://example.com/#section', '#%broken']) assert.equal(fragmentId(value), null);
});
