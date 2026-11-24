import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { fragmentId } from '../src/lib/article-navigation-core.mjs';

const source = readFileSync(new URL('../src/lib/article-navigation.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function run(document) {
  vm.runInNewContext(javascript, { document, exports: {}, require: (name) => {
    assert.equal(name, './article-navigation-core.mjs');
    return { fragmentId };
  } });
}

test('TOC操作轉移到正確段落焦點，修飾鍵與非文章目標保持原生行為', () => {
  let click;
  const focused = [];
  const heading = { focus: (options) => focused.push(options), tabIndex: undefined };
  const link = { addEventListener: (_, fn) => { click = fn; }, getAttribute: () => '#%E6%AE%B5%E8%90%BD' };
  const article = { querySelectorAll: (selector) => selector.startsWith('.article-toc') ? [link] : [], contains: (node) => node === heading };
  run({ querySelector: () => article, getElementById: (id) => id === '段落' ? heading : null });
  click({ button: 0, ctrlKey: true });
  assert.equal(focused.length, 0);
  click({ button: 0 });
  assert.equal(heading.tabIndex, -1);
  assert.equal(focused.length, 1);
  assert.equal(focused[0].preventScroll, true, '焦點變更不搶走原生錨點捲動');
});

test('表格及程式碼保留原節點並加入具名鍵盤捲動區，不重複包裝', () => {
  const regions = [];
  const makeElement = (tagName, caption = '') => ({
    tagName, parentElement: null, querySelector: () => caption ? { textContent: caption } : null,
    before(region) { regions.push(region); },
  });
  const table = makeElement('TABLE', '營養成分比較');
  const code = makeElement('PRE');
  const article = { querySelectorAll: (selector) => selector.startsWith('.article-toc') ? [] : [table, code] };
  const document = { querySelector: () => article, createElement: () => {
    const region = { attributes: {}, className: '', setAttribute(name, value) { this.attributes[name] = value; }, append(element) { this.child = element; element.parentElement = this; } };
    region.classList = { contains: (value) => region.className === value };
    return region;
  } };
  run(document);
  assert.equal(regions.length, 2);
  assert.equal(regions[0].child, table, '保留table元素與語意');
  assert.equal(regions[0].tabIndex, 0);
  assert.equal(regions[0].attributes.role, 'region');
  assert.match(regions[0].attributes['aria-label'], /營養成分比較/);
  assert.match(regions[1].attributes['aria-label'], /程式碼/);
  run(document);
  assert.equal(regions.length, 2);
});
