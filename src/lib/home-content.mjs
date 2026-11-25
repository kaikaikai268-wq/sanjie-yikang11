import { contentSlug, isPublicFrontmatter, parseTaipeiDate, publicationNow } from './content-core.mjs';

/**
 * Select only the shared public pool; featured and latest never repeat a slug.
 * @template {{ id: string, data: Record<string, any> }} T
 * @param {T[]} candidates
 * @param {{ featuredLimit?: number, latestLimit?: number, now?: Date | number }} [options]
 */
export function selectHomeContent(candidates, { featuredLimit = 3, latestLimit = 6, now = publicationNow() } = {}) {
  const seen = new Set();
  const articles = candidates.filter((entry) => {
    if (!isPublicFrontmatter(entry.data, now)) return false;
    const slug = contentSlug(entry);
    if (seen.has(slug)) return false;
    seen.add(slug);
    return true;
  }).sort((a, b) => parseTaipeiDate(b.data.publishDate).getTime() - parseTaipeiDate(a.data.publishDate).getTime());
  const featured = [...articles].sort((a, b) => Number(Boolean(b.data.featured)) - Number(Boolean(a.data.featured))).slice(0, Math.max(0, featuredLimit));
  const selected = new Set(featured.map(contentSlug));
  const latest = articles.filter((entry) => !selected.has(contentSlug(entry))).slice(0, Math.max(0, latestLimit));
  /** @type {Map<string, number>} */
  const categoryCounts = new Map();
  for (const entry of articles) categoryCounts.set(entry.data.category, (categoryCounts.get(entry.data.category) ?? 0) + 1);
  const categories = [...categoryCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-TW'));
  return { featured, latest, categories, articles };
}
