#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { googleAuth, client } from './lib/google.mjs';
import { analyzeSnapshot } from './lib/insight-rules.mjs';

function argument(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} 需要一個值。`);
  return value;
}
/** Use Taipei calendar days, and leave three complete days for GSC processing. */
export function analysisPeriod(days, now = new Date()) {
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const end = new Date(`${local}T00:00:00+08:00`);
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const date = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
  return { start: date(start), end: date(end) };
}
async function collect(days) {
  const origin = new URL(process.env.PUBLIC_SITE_URL || 'https://3jwellness.com');
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) throw new Error('PUBLIC_SITE_URL 必須是不含帳密的 http/https 網址。');
  const base = (process.env.PUBLIC_BASE_PATH || '').replace(/\/$/, '');
  const articlePath = `${base}/articles/`;
  const site = process.env.GSC_SITE || 'sc-domain:3jwellness.com';
  const property = process.env.GA_PROPERTY || '565563726';
  if (!/^\d+$/.test(property)) throw new Error('GA_PROPERTY 必須是數字資源 ID。');
  const { token } = await googleAuth();
  const api = client(token);
  const period = analysisPeriod(days);
  const snapshot = { schemaVersion: 1, collectedAt: new Date().toISOString(), period, sources: { gscSite: site, gaProperty: property, origin: origin.origin, articlePath }, gscRows: [], landingRows: [], eventRows: [], errors: [] };
  const requireSuccess = (response, label) => {
    if (response.status >= 400 || response.error) throw new Error(`${label} 查詢失敗（HTTP ${response.status}），請確認資源與唯讀權限。`);
    return response;
  };
  const dateRanges = [{ startDate: period.start, endDate: period.end }];
  const requests = [
    ['gsc', async () => {
      const response = requireSuccess(await api(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
        startDate: period.start, endDate: period.end, dimensions: ['page', 'query'], rowLimit: 1000,
        dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains', expression: `${origin.origin}${articlePath}` }] }],
      }), 'GSC');
      snapshot.gscRows = (response.rows || []).map((row) => ({ page: row.keys[0], query: row.keys[1], impressions: row.impressions, clicks: row.clicks, ctr: row.ctr, position: row.position }));
    }],
    ['ga4_landings', async () => {
      const response = requireSuccess(await api(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, {
        dateRanges, dimensions: [{ name: 'landingPage' }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        dimensionFilter: { andGroup: { expressions: [
          { filter: { fieldName: 'landingPage', stringFilter: { matchType: 'BEGINS_WITH', value: articlePath } } },
          { filter: { fieldName: 'hostName', stringFilter: { matchType: 'EXACT', value: origin.hostname } } },
        ] } }, limit: 1000,
      }), 'GA4 到達頁');
      snapshot.landingRows = (response.rows || []).map((row) => ({ page: row.dimensionValues[0].value.split('?')[0], sessions: Number(row.metricValues[0].value), users: Number(row.metricValues[1].value) }));
    }],
    ['ga4_events', async () => {
      const response = requireSuccess(await api(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, {
        dateRanges, dimensions: [{ name: 'pagePath' }, { name: 'eventName' }], metrics: [{ name: 'eventCount' }],
        dimensionFilter: { andGroup: { expressions: [
          { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: articlePath } } },
          { filter: { fieldName: 'eventName', inListFilter: { values: ['content_view', 'read_complete', 'engaged_view', 'select_content', 'reference_click', 'shop_click'] } } },
          { filter: { fieldName: 'hostName', stringFilter: { matchType: 'EXACT', value: origin.hostname } } },
        ] } }, limit: 1000,
      }), 'GA4 內容事件');
      snapshot.eventRows = (response.rows || []).map((row) => ({ page: row.dimensionValues[0].value, eventName: row.dimensionValues[1].value, eventCount: Number(row.metricValues[0].value) }));
    }],
  ];
  const results = await Promise.allSettled(requests.map(([, run]) => run()));
  results.forEach((result, index) => { if (result.status === 'rejected') snapshot.errors.push({ source: requests[index][0], message: result.reason.message }); });
  if (results.every((result) => result.status === 'rejected')) throw new Error(snapshot.errors.map((error) => error.message).join('\n'));
  return snapshot;
}
export async function main(args = process.argv.slice(2)) {
  const valueOptions = new Set(['--days', '--input', '--output']);
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const option = args[index];
    if (seen.has(option)) throw new Error('指令含重複參數，請參考 --help。');
    seen.add(option);
    if (option === '--help') continue;
    // Never repeat unknown argument values: callers might accidentally supply credentials.
    if (!valueOptions.has(option)) throw new Error('指令含不支援的參數；認證只接受環境變數或 gcloud，請參考 --help。');
    argument(args, option);
    index++;
  }
  if (args.includes('--help')) {
    console.log('pnpm insights [--days 28] [--input snapshot.json] [--output data/analytics/snapshot.json]\n線上查詢只讀 GSC/GA4；--input 離線分析；--output 儲存可再次分析的原始快照。');
    return;
  }
  const days = Number(argument(args, '--days') || 28);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error('--days 必須是 1–365 的整數。');
  const input = argument(args, '--input');
  const output = argument(args, '--output');
  const snapshot = input ? JSON.parse(await readFile(resolve(input), 'utf8')) : await collect(days);
  const report = analyzeSnapshot(snapshot);
  if (output) {
    const file = resolve(output);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(report, null, 2));
  if (snapshot.errors?.length) process.exitCode = 2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(`內容成效分析無法完成：${error.message}\n可使用 --input 讀取既有快照；Google 設定見 docs/analytics-content.md。`); process.exitCode = 1; });
}
