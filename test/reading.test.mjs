import test from 'node:test';
import assert from 'node:assert/strict';
import { activeDelta, canComplete, readingTimeGate, scrollDepth } from '../src/lib/reading-core.mjs';

test('hidden, blurred and idle intervals do not accumulate reading time', () => {
  const interval = { now: 100_000, lastTick: 99_000, lastActivity: 99_000, visible: true, focused: true };
  assert.equal(activeDelta(interval), 1000);
  assert.equal(activeDelta({ ...interval, visible: false }), 0);
  assert.equal(activeDelta({ ...interval, focused: false }), 0);
  assert.equal(activeDelta({ ...interval, lastActivity: 0 }), 0);
  assert.equal(activeDelta({ ...interval, lastTick: 0 }), 2000);
});
test('jumping to bottom and a short untouched page cannot count as completed', () => {
  const viewed = { maxDepth: 100, activeMs: 60_000, readingMinutes: 1, reachedEnd: true, interacted: true };
  assert.equal(canComplete(viewed), true);
  assert.equal(canComplete({ ...viewed, activeMs: 1000 }), false);
  assert.equal(canComplete({ ...viewed, interacted: false }), false);
  assert.equal(canComplete({ ...viewed, reachedEnd: false }), false);
  assert.equal(canComplete({ ...viewed, maxDepth: 75 }), false);
});
test('reading thresholds and geometry stay bounded', () => {
  assert.equal(readingTimeGate(0), 20);
  assert.equal(readingTimeGate(100), 240);
  assert.equal(readingTimeGate(NaN), 20);
  assert.equal(scrollDepth({ viewportBottom: 900, contentTop: 500, contentHeight: 1000 }), 40);
  assert.equal(scrollDepth({ viewportBottom: 900, contentTop: 500, contentHeight: 0 }), 0);
});
