import test from 'node:test';
import assert from 'node:assert/strict';
import { shoppingLink } from '../src/lib/commerce.mjs';
test('未設定購物站不產生入口；拒絕危險或含帳密網址', () => {
  assert.equal(shoppingLink(''), undefined);
  for (const url of ['javascript:alert(1)', 'http://shop.example/', 'https://user:secret@shop.example/']) assert.throws(() => shoppingLink(url));
});
test('購物導流保留目標參數並帶文章識別，不含讀者資訊', () => {
  const url = new URL(shoppingLink('https://shop.example/buy?campaign=gift#order', 'probiotic-guide'));
  assert.equal(url.searchParams.get('campaign'), 'gift');
  assert.equal(url.searchParams.get('utm_content'), 'probiotic-guide');
  assert.equal(url.searchParams.get('utm_source'), '3jwellness');
  assert.equal(url.hash, '#order');
});
