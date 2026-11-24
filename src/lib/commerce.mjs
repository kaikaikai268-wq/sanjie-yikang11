/** Shopping is hosted elsewhere; never invent a destination when it has not been configured. */
export function shoppingLink(configured, articleSlug) {
  if (!configured?.trim()) return undefined;
  let url;
  try { url = new URL(configured); } catch { throw new Error('PUBLIC_SHOP_URL 必須是完整 HTTPS 網址'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('PUBLIC_SHOP_URL 必須是不含帳密的 HTTPS 網址');
  url.searchParams.set('utm_source', '3jwellness');
  url.searchParams.set('utm_medium', 'content');
  url.searchParams.set('utm_campaign', 'content-library');
  if (articleSlug) url.searchParams.set('utm_content', articleSlug);
  return url.href;
}
