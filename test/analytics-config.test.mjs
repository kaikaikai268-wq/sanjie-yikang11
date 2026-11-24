import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const base = await readFile(new URL('../src/layouts/Base.astro', import.meta.url), 'utf8');
const source = /<script is:inline define:vars=\{\{ GA_ID \}\}>([\s\S]*?)<\/script>/.exec(base)?.[1];
assert.ok(source, 'actual analytics bootstrap must be present');
function configure(referrer) {
  const window = { document: { referrer }, URL, GA_ID: 'G-TEST', location: { origin: 'https://3jwellness.com', pathname: '/articles/example/', search: '?private=secret', hash: '#sensitive' } };
  window.window = window; // Browsers expose window properties as global bindings.
  vm.runInNewContext(source, window);
  return [...window.dataLayer].map((args) => [...args]).find((args) => args[0] === 'config')[2];
}
test('search query and fragment do not reappear in GA location or next-page referrer', () => {
  const config = configure('https://3jwellness.com/search/?q=private-health-query#sensitive');
  assert.equal(config.page_location, 'https://3jwellness.com/articles/example/');
  assert.equal(config.page_referrer, 'https://3jwellness.com/search/');
  assert.ok(!JSON.stringify(config).includes('private'));
});
test('direct or invalid referrers remain empty without preventing analytics bootstrap', () => {
  for (const value of ['', 'not a url', 'data:text/plain,private']) assert.equal(configure(value).page_referrer, '');
});
