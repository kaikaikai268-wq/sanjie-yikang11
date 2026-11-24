/** Read-only suggestions. Thresholds prioritize review; they never assert a ranking cause. */
const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const EVENT_NAMES = new Set(['content_view', 'read_complete', 'engaged_view', 'select_content', 'reference_click', 'shop_click']);
const SOURCE_NAMES = new Set(['gsc', 'ga4_landings', 'ga4_events']);
function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function finiteNonnegative(value, label, { integer = false, max = Infinity } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) throw new Error(`分析快照 ${label} 必須是合法的非負${integer ? '整數' : '數字'}。`);
}
function page(value, label) {
  if (typeof value !== 'string' || !value || /[\u0000-\u0020\\]/.test(value)) throw new Error(`分析快照 ${label} 必須是文章網址或站內路徑。`);
  if (value.startsWith('/') && !value.startsWith('//')) return;
  let url;
  try { url = new URL(value); } catch { throw new Error(`分析快照 ${label} 不是合法網址。`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(`分析快照 ${label} 只接受不含帳密的 http/https 網址。`);
}
export function validateSnapshot(snapshot) {
  if (!isObject(snapshot) || snapshot.schemaVersion !== 1 || !isObject(snapshot.period) || !validDate(snapshot.period.start) || !validDate(snapshot.period.end) || snapshot.period.start > snapshot.period.end) throw new Error('分析快照格式不符：需要 schemaVersion: 1 與合法、順序正確的 period.start/end 日期。');
  if (snapshot.collectedAt !== undefined && (typeof snapshot.collectedAt !== 'string' || !Number.isFinite(Date.parse(snapshot.collectedAt)))) throw new Error('分析快照 collectedAt 必須是合法時間。');
  for (const field of ['gscRows', 'landingRows', 'eventRows']) {
    if (!Array.isArray(snapshot[field])) throw new Error(`分析快照缺少 ${field} 陣列。`);
    for (const [index, row] of snapshot[field].entries()) if (!isObject(row)) throw new Error(`分析快照 ${field}[${index}] 必須是資料物件。`);
  }
  for (const [index, row] of snapshot.gscRows.entries()) {
    const label = `gscRows[${index}]`;
    page(row.page, `${label}.page`);
    if (typeof row.query !== 'string' || !row.query.trim()) throw new Error(`分析快照 ${label}.query 必須是非空文字。`);
    finiteNonnegative(row.impressions, `${label}.impressions`, { integer: true });
    finiteNonnegative(row.clicks, `${label}.clicks`, { integer: true, max: row.impressions });
    finiteNonnegative(row.ctr, `${label}.ctr`, { max: 1 });
    finiteNonnegative(row.position, `${label}.position`);
    if (row.impressions > 0 && (row.position === 0 || Math.abs(row.ctr - row.clicks / row.impressions) > 0.0001)) throw new Error(`分析快照 ${label} 的曝光、點擊率或排名互相矛盾。`);
  }
  for (const [index, row] of snapshot.landingRows.entries()) {
    page(row.page, `landingRows[${index}].page`);
    finiteNonnegative(row.sessions, `landingRows[${index}].sessions`, { integer: true });
    finiteNonnegative(row.users, `landingRows[${index}].users`, { integer: true });
  }
  for (const [index, row] of snapshot.eventRows.entries()) {
    page(row.page, `eventRows[${index}].page`);
    if (!EVENT_NAMES.has(row.eventName)) throw new Error(`分析快照 eventRows[${index}].eventName 不是受支援的內容事件。`);
    finiteNonnegative(row.eventCount, `eventRows[${index}].eventCount`, { integer: true });
  }
  if (snapshot.sources !== undefined && !isObject(snapshot.sources)) throw new Error('分析快照 sources 必須是物件。');
  if (snapshot.errors !== undefined && (!Array.isArray(snapshot.errors) || snapshot.errors.some((error) => !isObject(error) || !SOURCE_NAMES.has(error.source) || typeof error.message !== 'string'))) throw new Error('分析快照 errors 必須包含合法來源及錯誤說明。');
  const fields = { gsc: 'gscRows', ga4_landings: 'landingRows', ga4_events: 'eventRows' };
  for (const error of snapshot.errors || []) {
    if (snapshot[fields[error.source]].length) throw new Error(`分析快照 ${error.source} 同時宣告失敗與有資料，請先確認來源。`);
  }
  return snapshot;
}
export function analyzeSnapshot(input) {
  const snapshot = validateSnapshot(input);
  const failed = new Set((snapshot.errors || []).map((error) => error.source));
  const recommendations = [];
  const searches = snapshot.gscRows.map((row) => ({
    page: String(row.page || ''), query: String(row.query || ''),
    impressions: number(row.impressions), clicks: number(row.clicks),
    ctr: number(row.ctr), position: number(row.position),
  }));
  for (const row of searches) {
    if (row.impressions >= 30 && row.position > 0 && row.position <= 20 && (row.clicks === 0 || row.ctr < 0.01)) {
      recommendations.push({
        type: 'review_search_snippet', priority: 'high', page: row.page,
        action: '對照實際搜尋問題，檢查標題、描述與開頭是否回答同一件事；先讀正文再決定是否修改。',
        evidence: { source: 'gsc', period: snapshot.period, ...row },
      });
    }
  }
  const queryPages = new Map();
  for (const row of searches.filter((row) => row.query && row.impressions > 0)) {
    const pages = queryPages.get(row.query) || new Map();
    const existing = pages.get(row.page) || { impressions: 0, clicks: 0 };
    pages.set(row.page, { impressions: existing.impressions + row.impressions, clicks: existing.clicks + row.clicks });
    queryPages.set(row.query, pages);
  }
  for (const [query, pages] of queryPages) {
    if (pages.size > 1) recommendations.push({
      type: 'review_topic_overlap', priority: 'normal',
      action: '同一搜尋詞對應多篇文章。先確認各篇是否回答不同問題，再決定補強、互連或合併；不要直接增加同題文章。',
      evidence: { source: 'gsc', period: snapshot.period, query, pages: [...pages].map(([page, values]) => ({ page, ...values })) },
    });
  }
  const eventTotals = {};
  for (const row of snapshot.eventRows) eventTotals[row.eventName] = (eventTotals[row.eventName] || 0) + number(row.eventCount);
  return {
    schemaVersion: 1,
    collectedAt: snapshot.collectedAt,
    period: snapshot.period,
    sources: snapshot.sources || {},
    errors: snapshot.errors || [],
    availability: Object.fromEntries([...SOURCE_NAMES].map((source) => [source, failed.has(source) ? 'unavailable' : 'available'])),
    summary: {
      searchImpressions: failed.has('gsc') ? null : searches.reduce((sum, row) => sum + row.impressions, 0),
      searchClicks: failed.has('gsc') ? null : searches.reduce((sum, row) => sum + row.clicks, 0),
      // Query rows omit anonymized queries; this is explicitly a returned-row subtotal.
      searchScope: 'API 回傳的文章 × 搜尋詞資料小計，可能不含匿名搜尋詞或截斷資料。',
      articleLandingSessions: failed.has('ga4_landings') ? null : snapshot.landingRows.reduce((sum, row) => sum + number(row.sessions), 0),
      events: failed.has('ga4_events') ? null : eventTotals,
    },
    landingPages: snapshot.landingRows,
    contentEvents: snapshot.eventRows,
    recommendations: recommendations.sort((a, b) => (a.priority === 'high' ? 0 : 1) - (b.priority === 'high' ? 0 : 1) || number(b.evidence.impressions) - number(a.evidence.impressions)),
    interpretation: '搜尋、到達工作階段與閱讀／導購事件分開呈現。這些資料不共用同一分母，不能直接相除作為轉換率。尚未接上購物站交易資料時，shop_click 只代表前往購物的點擊。',
  };
}
