import { readFile } from 'node:fs/promises';
import { glob } from 'astro/loaders';
import { parseRawDocument } from './markdown-document.mjs';

const PARSER_VERSION_KEY = '3j-frontmatter-parser';
const PARSER_VERSION = 'json-schema-taipei-date-v1';

/**
 * 保留 Astro glob 的 Markdown 渲染、digest cache、監看及刪檔語意。
 * 僅在 schema parseData 前，以 CLI 共用 parser 讀回原始 YAML，避免日期字面量先被轉成 UTC。
 */
export function taipeiMarkdownGlob(options) {
  const loader = glob(options);
  return {
    ...loader,
    name: '3j-taipei-markdown-glob',
    async load(context) {
      // 原有 digest 不隨 parser 實作改變；只做一次資料遷移，否則舊 UTC Date 會被快取保留。
      if (context.meta.get(PARSER_VERSION_KEY) !== PARSER_VERSION) context.store.clear();
      await loader.load({
        ...context,
        parseData: async (entry) => {
          if (!entry.filePath) throw new Error('三傑 Markdown loader 缺少原始檔案路徑');
          const raw = await readFile(entry.filePath, 'utf8');
          const { data } = parseRawDocument(raw);
          return context.parseData({ ...entry, data });
        },
      });
      context.meta.set(PARSER_VERSION_KEY, PARSER_VERSION);
    },
  };
}
