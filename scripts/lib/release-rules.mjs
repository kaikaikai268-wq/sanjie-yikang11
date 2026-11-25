const unxml = (value) => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
export function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) result[match[1].toLowerCase()] = unxml(match[2] ?? match[3] ?? match[4]);
  return result;
}
export function htmlFacts(html, { production = false } = {}) {
  const errors = [];
  const clean = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const h1Count = [...clean.matchAll(/<h1(?:\s|>)/gi)].length;
  if (h1Count !== 1) errors.push(`h1 數量應為 1，實際為 ${h1Count}`);
  const metas = [...html.matchAll(/<meta\b(?:[^"'>]|"[^"]*"|'[^']*')*>/gi)].map((match) => attributes(match[0]));
  const links = [...html.matchAll(/<link\b(?:[^"'>]|"[^"]*"|'[^']*')*>/gi)].map((match) => attributes(match[0]));
  const canonicals = links.filter((link) => link.rel === 'canonical');
  if (canonicals.length !== 1) errors.push('必須有且只有一個 canonical');
  const canonical = canonicals[0]?.href;
  try { if (!['http:', 'https:'].includes(new URL(canonical).protocol)) errors.push('canonical 必須是 http/https 絕對網址'); }
  catch { errors.push('canonical 不是合法絕對網址'); }
  const descriptions = metas.filter((meta) => meta.name === 'description');
  if (descriptions.length !== 1 || !descriptions[0].content?.trim()) errors.push('必須有且只有一個非空 description');
  const structured = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (attributes(match[1]).type !== 'application/ld+json') continue;
    try { const value = JSON.parse(match[2]); if (!value || typeof value !== 'object') throw new Error(); structured.push(value); }
    catch { errors.push('JSON-LD 無法解析為 JSON 物件'); }
  }
  if (!structured.length) errors.push('缺少可解析的 JSON-LD');
  if (production) {
    const publicMetadata = JSON.stringify([canonical, metas.filter((meta) => /^(?:og:|twitter:)/.test(meta.property || meta.name || '')), structured]);
    if (/https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::|\/|"|$)/i.test(publicMetadata)) errors.push('正式 metadata 不得引用 localhost');
  }
  return { errors, canonical, noindex: metas.some((meta) => meta.name?.toLowerCase() === 'robots' && /(?:^|[\s,])noindex(?:$|[\s,])/i.test(meta.content || '')), isArticle: metas.some((meta) => meta.property === 'og:type' && meta.content === 'article'), structured };
}
export function sitemapUrls(text) { return [...text.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map((match) => unxml(match[1].trim())); }
export function articlePaths(values, { site, basePath }) {
  const result = [];
  for (const value of values) {
    let url;
    try { url = new URL(unxml(value), site); } catch { continue; }
    if (url.origin !== new URL(site).origin) continue;
    const escaped = basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`^${escaped}/articles/[^/]+/$`).test(url.pathname)) result.push(decodeURIComponent(url.pathname));
  }
  return result;
}
export function textUrls(text) { return [...text.matchAll(/https?:\/\/[^\s)<>"']+/g)].map((match) => match[0]); }
export function comparePaths(expected, actual, label) {
  const want = new Set(expected), got = new Set(actual);
  const missing = [...want].filter((route) => !got.has(route));
  const extra = [...got].filter((route) => !want.has(route));
  return [...(missing.length ? [`${label} 缺少：${missing.join('、')}`] : []), ...(extra.length ? [`${label} 含非公開或未預期文章：${extra.join('、')}`] : [])];
}
