/** XML and plain-text output escaping shared by RSS and AI-readable endpoints. */
export const xml = (value) => String(value ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
export function plainText(markdown = '') {
  return markdown.replace(/```[\s\S]*?```/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]*>/g, '').replace(/^[ \t]*#{1,6}\s+/gm, '')
    .replace(/[*_`]/g, '').replace(/\n{3,}/g, '\n\n').trim();
}
