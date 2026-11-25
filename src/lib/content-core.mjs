// APPI visibility.mjs 的單一公開判斷模式，適配三傑：送審稿不產生公開預覽。
export function parseTaipeiDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value !== 'string' || !value.trim()) return new Date(NaN);
  let raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) raw += 'T00:00:00+08:00';
  else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(raw)) raw = raw.replace(' ', 'T') + '+08:00';
  else if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(raw)) return new Date(NaN);
  const date = new Date(raw);
  // Date.parse 會把 2/30 校正成 3/2；內容日期不能默默改日。
  const day = raw.slice(0, 10);
  const check = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(check.getTime()) || check.toISOString().slice(0, 10) !== day) return new Date(NaN);
  return date;
}

/** 一次建置固定同一個時點，避免排程稿在媒體處理與路由生成之間跨過發布時間。 */
export function publicationNow() {
  const configured = process.env.CONTENT_BUILD_TIME;
  if (configured === undefined) return Date.now();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(configured))
    throw new Error('CONTENT_BUILD_TIME 必須是帶時區的合法 ISO 日期時間');
  const time = parseTaipeiDate(configured).getTime();
  if (!Number.isFinite(time)) throw new Error('CONTENT_BUILD_TIME 必須是帶時區的合法 ISO 日期時間');
  return time;
}

export function isPublicFrontmatter(data, now = publicationNow()) {
  if (!data || data.draft === true || data.draft === 'true') return false;
  if (!['published', 'scheduled'].includes(data.status)) return false;
  const at = parseTaipeiDate(data.publishDate).getTime();
  const current = now instanceof Date ? now.getTime() : now;
  return Number.isFinite(at) && Number.isFinite(current) && at <= current;
}

export const contentSlug = (entry) => entry.data?.slug || entry.id;
export const normalizedText = (text) => String(text).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

export function rankRelated(source, candidates, limit = 3) {
  const slug = contentSlug(source);
  const explicit = source.data.relatedArticles ?? [];
  const topics = new Set(source.data.topics ?? []);
  const tags = new Set((source.data.tags ?? []).map((tag) => tag.toLowerCase()));
  return candidates.filter((entry) => contentSlug(entry) !== slug).map((entry) => {
    const manual = explicit.indexOf(contentSlug(entry));
    const topicScore = (entry.data.topics ?? []).filter((id) => topics.has(id)).length * 3;
    const tagScore = (entry.data.tags ?? []).filter((tag) => tags.has(tag.toLowerCase())).length;
    return { entry, score: manual >= 0 ? 1000 - manual : topicScore + tagScore };
  }).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score ||
    parseTaipeiDate(b.entry.data.publishDate).getTime() - parseTaipeiDate(a.entry.data.publishDate).getTime()
  ).slice(0, limit).map(({ entry }) => entry);
}

export function isSafeLocalImage(value) {
  return typeof value === 'string' && /^\/(?:content|images|covers)\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpe?g|avif)$/i.test(value) &&
    !value.includes('..') && !value.includes('//');
}
