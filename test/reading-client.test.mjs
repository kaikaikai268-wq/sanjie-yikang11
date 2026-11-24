import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import * as rules from '../src/lib/reading-core.mjs';

// Small event/clock harness exercises the actual client lifecycle without a browser dependency.
const source = (await readFile(new URL('../src/lib/reading-client.ts', import.meta.url), 'utf8')).replace(/^import[^\n]+\n/, '');
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(name, handler) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(handler); },
    removeEventListener(name, handler) { listeners.get(name)?.delete(handler); },
    dispatch(name, event = {}) { for (const handler of [...(listeners.get(name) || [])]) handler({ type: name, ...event }); },
  };
}
function harness({ analytics = true } = {}) {
  const state = { time: 100_000, visible: true, focused: true, scrollY: 0 };
  const events = [];
  const timers = new Map();
  const frames = new Map();
  let id = 0;
  const article = {
    dataset: { articleSlug: 'qa-article', articleCategory: '健康生活', readingMinutes: '1' },
    querySelector(selector) {
      return selector === '[data-article-body]'
        ? { getBoundingClientRect: () => ({ top: 100 - state.scrollY, height: 1000 }) }
        : { getBoundingClientRect: () => ({ top: 1500 - state.scrollY }) };
    },
  };
  const document = {
    ...eventTarget(),
    querySelector: () => article,
    get visibilityState() { return state.visible ? 'visible' : 'hidden'; },
    hasFocus: () => state.focused,
  };
  const window = {
    ...eventTarget(),
    innerHeight: 600,
    get scrollY() { return state.scrollY; },
    setInterval(callback) { const timer = ++id; timers.set(timer, callback); return timer; },
    clearInterval(timer) { timers.delete(timer); },
    ...(analytics ? { gtag: (...values) => events.push(values) } : {}),
  };
  class Element {}
  const context = {
    ...rules, document, window, Element,
    Date: class extends Date { static now() { return state.time; } },
    location: { href: 'https://3jwellness.com/articles/qa-article/', origin: 'https://3jwellness.com' }, URL,
    requestAnimationFrame(callback) { const frame = ++id; frames.set(frame, callback); return frame; },
    cancelAnimationFrame(frame) { frames.delete(frame); },
  };
  vm.runInNewContext(javascript, context);
  const frame = () => { for (const [key, callback] of [...frames]) { frames.delete(key); callback(); } };
  return {
    state, events, timers, document, window, frame,
    advance(seconds) { for (let second = 0; second < seconds; second++) { state.time += 1000; for (const callback of [...timers.values()]) callback(); } },
    bottom() { state.scrollY = 900; window.dispatch('scroll', { isTrusted: true }); frame(); },
    relatedClick() {
      const anchor = new Element();
      Object.assign(anchor, { href: 'https://3jwellness.com/articles/next/?private=value', closest: (selector) => selector === 'a[href]' ? anchor : null, matches: (selector) => selector === '[data-related-article]' });
      document.dispatch('click', { target: anchor });
    },
  };
}
const sent = (state, name) => state.events.filter((event) => event[1] === name);

test('actual client stops timers while hidden and never double-reports an engagement segment', () => {
  const state = harness();
  state.advance(5);
  state.state.visible = false;
  state.document.dispatch('visibilitychange');
  assert.equal(state.timers.size, 0);
  assert.equal(sent(state, 'engaged_view').length, 1);
  assert.equal(sent(state, 'engaged_view')[0][2].engaged_time_sec, 5);
  state.advance(120);
  state.window.dispatch('pagehide');
  assert.equal(sent(state, 'engaged_view').length, 1);
  state.state.visible = true;
  state.document.dispatch('visibilitychange');
  state.advance(3);
  state.window.dispatch('blur');
  assert.equal(sent(state, 'engaged_view')[1][2].engaged_time_sec, 3);
});
test('actual client requires active reading and resets on bfcache restore', () => {
  const state = harness();
  state.bottom();
  state.advance(1);
  assert.equal(sent(state, 'read_complete').length, 0);
  state.advance(29);
  assert.equal(sent(state, 'read_complete').length, 1);
  state.window.dispatch('pagehide');
  state.window.dispatch('pageshow', { persisted: true });
  assert.equal(sent(state, 'content_view').length, 2);
  state.advance(30);
  // At the restored bottom position, no fresh trusted interaction => no second completion.
  assert.equal(sent(state, 'read_complete').length, 1);
});
test('related articles outside the article element are tracked without URL query values', () => {
  const state = harness();
  state.relatedClick();
  const params = sent(state, 'select_content')[0][2];
  assert.equal(params.target_path, '/articles/next/');
  assert.equal(JSON.stringify(params).includes('private'), false);
});
test('preview without gtag is inert and swapping pages cleans up timers and listeners', () => {
  const state = harness({ analytics: false });
  state.bottom();
  state.advance(30);
  assert.deepEqual(state.events, []);
  state.document.dispatch('astro:before-swap');
  assert.equal(state.timers.size, 0);
  state.window.dispatch('focus');
  assert.equal(state.timers.size, 0);
});
