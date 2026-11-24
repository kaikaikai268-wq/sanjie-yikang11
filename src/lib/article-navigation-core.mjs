/** Native anchor hashes can contain either encoded or readable Chinese text. */
export function fragmentId(href) {
  if (typeof href !== 'string' || !href.startsWith('#') || href.length < 2) return null;
  try { return decodeURIComponent(href.slice(1)); }
  catch { return null; }
}
