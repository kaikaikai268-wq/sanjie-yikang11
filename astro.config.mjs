// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import rehypeContent from './scripts/lib/rehype-content.mjs';
import { unified } from '@astrojs/markdown-remark';

// 正式網域。canonical、sitemap、OG 都跟著它；www 也掛同一份內容，canonical 一律指向根網域。
const SITE = process.env.PUBLIC_SITE_URL || 'https://3jwellness.com';

// 子路徑：GitHub Pages 專案站用 /sanjie-yikang11，正式網域不設。站內連結一律經過 src/lib/url.ts 的 u()。
const BASE = process.env.PUBLIC_BASE_PATH || undefined;

export default defineConfig({
  site: SITE,
  base: BASE,
  trailingSlash: 'always',
  build: { format: 'directory' },
  markdown: { processor: unified({ rehypePlugins: [[rehypeContent, { base: BASE || '' }]] }) },
  integrations: [sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/404') })],
});
