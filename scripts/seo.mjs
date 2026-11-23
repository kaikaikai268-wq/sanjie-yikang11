#!/usr/bin/env node
// 線上現況：GSC 收錄與搜尋成效、GA4 流量與事件。文件不寫現況數字，要看就跑這支，輸出即事實。
//
//   pnpm seo                       # 全部（index + search + ga）
//   pnpm seo index                 # sitemap 狀態 + 逐頁 URL 檢查（收錄與否）
//   pnpm seo search [--days N]     # GSC：頁面、查詢字詞的曝光／點擊／排名
//   pnpm seo ga [--days N]         # GA4：流量管道、到達頁、聯絡點擊（contact_click）、原廠連結點擊（official_click）
//   pnpm seo submit                # 提交（或重新提交）sitemap
//   pnpm seo gsc '<json>'          # 自訂 GSC searchAnalytics.query 本體，原樣輸出 JSON
//   pnpm seo ga4 '<json>'          # 自訂 GA4 runReport 本體，原樣輸出 JSON
//
// 設定（.env 或雲端環境變數）：GSC_SITE、GA_PROPERTY、GOOGLE_SA_EMAIL 或 GOOGLE_SA_KEY_JSON。見 CLAUDE.md「流量資料」。
import { googleAuth, client, period } from './lib/google.mjs';

const args = process.argv.slice(2);
const cmd = args[0] ?? 'all';
const daysArg = args.indexOf('--days');
const DAYS = daysArg >= 0 ? Number(args[daysArg + 1]) : 28;
const want = (s) => cmd === 'all' || cmd === s;

const SITE = process.env.GSC_SITE || 'sc-domain:3jwellness.com';
const PROPERTY = process.env.GA_PROPERTY;
const ORIGIN = process.env.PUBLIC_SITE_URL || 'https://3jwellness.com';

let api, account;
try { ({ token: api, account } = await googleAuth()); api = client(api); }
catch (e) { console.error(e.message); process.exit(1); }

const enc = encodeURIComponent;
const num = (v) => Number(v ?? 0).toLocaleString('en-US');
const pct = (v) => `${(Number(v ?? 0) * 100).toFixed(1)}%`;
const { start, end } = period(DAYS);
const need = (name, v) => { if (!v) { console.error(`缺 ${name}，見 CLAUDE.md「流量資料」。`); process.exit(1); } };

// ── 自訂查詢：給 Claude 做臨時分析，原樣輸出 ──
if (cmd === 'gsc' || cmd === 'ga4') {
  const body = JSON.parse(args[1] ?? '{}');
  if (cmd === 'gsc') {
    need('GSC_SITE', SITE);
    const r = await api(`https://searchconsole.googleapis.com/webmasters/v3/sites/${enc(SITE)}/searchAnalytics/query`, { startDate: start, endDate: end, ...body });
    console.log(JSON.stringify(r, null, 2));
  } else {
    need('GA_PROPERTY', PROPERTY);
    const r = await api(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}:runReport`, { dateRanges: [{ startDate: `${DAYS}daysAgo`, endDate: 'yesterday' }], ...body });
    console.log(JSON.stringify(r, null, 2));
  }
  process.exit(0);
}

console.log(`服務帳號 ${account}　期間 ${start} ~ ${end}（${DAYS} 天，不含今天）`);

if (want('index') || want('search') || cmd === 'submit') {
  need('GSC_SITE', SITE);
  const sites = await api('https://searchconsole.googleapis.com/webmasters/v3/sites');
  const mine = (sites.siteEntry ?? []).find((s) => s.siteUrl === SITE);
  if (!mine) { console.error(`服務帳號看不到 ${SITE}。到 GSC「設定 → 使用者和權限」把 ${account} 加為「完整」使用者。`); process.exit(1); }
  console.log(`GSC ${SITE}　權限 ${mine.permissionLevel}`);
}

if (cmd === 'submit') {
  need('PUBLIC_SITE_URL', ORIGIN);
  const sm = `${ORIGIN.replace(/\/$/, '')}/sitemap-index.xml`;
  const r = await api(`https://searchconsole.googleapis.com/webmasters/v3/sites/${enc(SITE)}/sitemaps/${enc(sm)}`, null, 'PUT');
  console.log(r.status < 300 ? `已提交 ${sm}` : `提交失敗 ${r.status} ${JSON.stringify(r).slice(0, 200)}`);
  process.exit(r.status < 300 ? 0 : 1);
}

if (want('index')) {
  console.log('\n===== sitemap =====');
  const sm = await api(`https://searchconsole.googleapis.com/webmasters/v3/sites/${enc(SITE)}/sitemaps`);
  if (!sm.sitemap?.length) console.log('  還沒提交。跑 `pnpm seo submit`。');
  const urls = [];
  for (const s of sm.sitemap ?? []) {
    console.log(`  ${s.path}　送出 ${(s.lastSubmitted ?? '').slice(0, 10)}　下載 ${(s.lastDownloaded ?? '').slice(0, 10) || '尚未'}　錯誤 ${s.errors ?? 0}　警告 ${s.warnings ?? 0}`);
  }
  // 逐頁檢查：從線上 sitemap 取網址
  if (ORIGIN) {
    try {
      const idx = await (await fetch(`${ORIGIN.replace(/\/$/, '')}/sitemap-index.xml`)).text();
      for (const loc of idx.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        const xml = await (await fetch(loc[1])).text();
        for (const u of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(u[1]);
      }
    } catch (e) { console.log(`  讀不到線上 sitemap：${e.message}`); }
  }
  console.log(`\n===== 逐頁收錄（${urls.length} 頁）=====`);
  for (const u of urls) {
    let d;
    for (let i = 0; i < 3; i++) {   // URL 檢查 API 偶發 500，重試
      d = await api('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { inspectionUrl: u, siteUrl: SITE, languageCode: 'zh-TW' });
      if (!(d.error?.code >= 500)) break;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
    const r = d.inspectionResult?.indexStatusResult;
    console.log(`  ${r?.coverageState ?? d.error?.message ?? '未知'}　${(r?.lastCrawlTime ?? '').slice(0, 10) || '未爬'}　${u}`);
  }
}

if (want('search')) {
  for (const dim of ['page', 'query']) {
    const r = await api(`https://searchconsole.googleapis.com/webmasters/v3/sites/${enc(SITE)}/searchAnalytics/query`, {
      startDate: start, endDate: end, dimensions: [dim], rowLimit: 25,
    });
    console.log(`\n===== GSC 依${dim === 'page' ? '頁面' : '查詢字詞'}（曝光 / 點擊 / CTR / 平均排名）=====`);
    if (!r.rows?.length) console.log('  沒有資料');
    for (const row of r.rows ?? []) console.log(`  ${num(row.impressions).padStart(7)} ${num(row.clicks).padStart(5)} ${pct(row.ctr).padStart(6)} ${row.position.toFixed(1).padStart(5)}  ${row.keys[0]}`);
  }
}

if (want('ga')) {
  need('GA_PROPERTY', PROPERTY);
  const report = async (title, body, fmt) => {
    const r = await api(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}:runReport`, {
      dateRanges: [{ startDate: `${DAYS}daysAgo`, endDate: 'yesterday' }], limit: 25, ...body,
    });
    console.log(`\n===== GA4 ${title} =====`);
    if (r.error) { console.log(`  ${r.error.code} ${r.error.message}`); return; }
    if (!r.rows?.length) { console.log('  沒有資料'); return; }
    for (const row of r.rows) console.log(`  ${fmt(row.dimensionValues.map((d) => d.value), row.metricValues.map((m) => m.value))}`);
  };
  await report('流量管道（工作階段 / 使用者 / 互動率）', {
    dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'engagementRate' }],
  }, ([c], [s, u, e]) => `${num(s).padStart(6)} ${num(u).padStart(6)} ${pct(e).padStart(6)}  ${c}`);
  await report('到達頁（工作階段 / 互動率）', {
    dimensions: [{ name: 'landingPage' }], metrics: [{ name: 'sessions' }, { name: 'engagementRate' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  }, ([p], [s, e]) => `${num(s).padStart(6)} ${pct(e).padStart(6)}  ${p}`);
  await report('聯絡點擊 contact_click（依管道）', {
    dimensions: [{ name: 'customEvent:channel' }], metrics: [{ name: 'eventCount' }],
    dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'contact_click' } } },
  }, ([c], [n]) => `${num(n).padStart(6)}  ${c}`);
  await report('原廠連結點擊 official_click（依商品）', {
    dimensions: [{ name: 'customEvent:product_id' }], metrics: [{ name: 'eventCount' }],
    dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: 'official_click' } } },
  }, ([p], [n]) => `${num(n).padStart(6)}  ${p}`);
}
