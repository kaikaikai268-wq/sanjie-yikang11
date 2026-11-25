import { load, JSON_SCHEMA } from 'js-yaml';

/**
 * 共用原始 frontmatter parser。JSON_SCHEMA 不把未加引號的 YAML 日期預先轉成 UTC Date，
 * 讓後續 schema 能區分台北日期字串與明確帶 Z／offset 的時間字串。
 */
export function parseRawDocument(raw) {
  const match = raw.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error('缺少 YAML frontmatter');
  return { data: load(match[1], { schema: JSON_SCHEMA }), body: match[2].trim() };
}
