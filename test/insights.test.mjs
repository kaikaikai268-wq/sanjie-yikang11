import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSnapshot } from '../scripts/lib/insight-rules.mjs';
import { analysisPeriod, main } from '../scripts/insights.mjs';

const base = () => ({ schemaVersion: 1, period: { start: '2026-10-01', end: '2026-10-28' }, gscRows: [], landingRows: [], eventRows: [] });
test('search suggestions carry actual evidence and do not diagnose a cause', () => {
  const snapshot = base();
  snapshot.gscRows = [{ page: '/articles/a/', query: '魚油標示', impressions: 100, clicks: 0, ctr: 0, position: 9 }];
  const report = analyzeSnapshot(snapshot);
  assert.equal(report.recommendations[0].type, 'review_search_snippet');
  assert.equal(report.recommendations[0].evidence.impressions, 100);
  assert.equal(report.summary.searchClicks, 0);
});
test('one search query on multiple pages prompts topic review, not blind new content', () => {
  const snapshot = base();
  snapshot.gscRows = ['a', 'b'].map((id) => ({ page: `/articles/${id}/`, query: '益生菌', impressions: 10, clicks: 1, ctr: 0.1, position: 8 }));
  assert.equal(analyzeSnapshot(snapshot).recommendations[0].type, 'review_topic_overlap');
});
test('event and landing totals remain separate without fabricated conversion rates', () => {
  const snapshot = base();
  snapshot.landingRows = [{ page: '/articles/a/', sessions: 5, users: 4 }];
  snapshot.eventRows = [{ page: '/articles/a/', eventName: 'shop_click', eventCount: 9 }];
  const report = analyzeSnapshot(snapshot);
  assert.equal(report.summary.articleLandingSessions, 5);
  assert.equal(report.summary.events.shop_click, 9);
  assert.equal('conversionRate' in report.summary, false);
  assert.throws(() => analyzeSnapshot({}), /格式不符/);
});
test('date window follows Taipei day across UTC midnight and includes requested days', () => {
  assert.deepEqual(analysisPeriod(28, new Date('2026-11-23T17:00:00Z')), { start: '2026-10-25', end: '2026-11-21' });
});
test('malformed offline data is rejected rather than silently converted to zero', () => {
  const row = { page: '/articles/a/', query: '魚油', impressions: 100, clicks: 0, ctr: 0, position: 9 };
  for (const bad of [{ impressions: '100' }, { clicks: -1 }, { ctr: 2 }, { ctr: 0.5 }, { position: null }, { page: 'javascript:alert(1)' }]) {
    const snapshot = base();
    snapshot.gscRows = [{ ...row, ...bad }];
    assert.throws(() => analyzeSnapshot(snapshot), /分析快照/);
  }
  assert.throws(() => analyzeSnapshot({ ...base(), period: { start: '2026-02-30', end: '2026-03-01' } }), /日期/);
  assert.throws(() => analyzeSnapshot({ ...base(), eventRows: [{ page: '/articles/a/', eventName: '__proto__', eventCount: 1 }] }), /事件/);
});
test('unavailable sources remain null and are distinguished from successful zero traffic', () => {
  const report = analyzeSnapshot({ ...base(), errors: [{ source: 'gsc', message: 'permission denied' }] });
  assert.equal(report.summary.searchImpressions, null);
  assert.equal(report.availability.gsc, 'unavailable');
  assert.equal(report.summary.articleLandingSessions, 0);
  assert.throws(() => analyzeSnapshot({ ...base(), landingRows: [{ page: '/articles/a/', sessions: 3, users: 2 }], errors: [{ source: 'ga4_landings', message: 'failed' }] }), /同時宣告失敗/);
});
test('unknown CLI options cannot pass credentials and errors do not echo their values', async () => {
  await assert.rejects(main(['--token', 'sensitive-placeholder']), (error) => /不支援/.test(error.message) && !error.message.includes('sensitive-placeholder'));
  await assert.rejects(main(['--days', '28', '--days', '7']), /重複/);
});
