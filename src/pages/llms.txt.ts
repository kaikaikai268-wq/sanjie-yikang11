import type { APIRoute } from 'astro';
import { SITE } from '../data/site';
import { articleSlug, getPublishedArticles, getPublishedTopics } from '../lib/content';
import { absolute } from '../lib/seo';
import { u } from '../lib/url';

export const GET: APIRoute = async ({ site }) => {
  const articles = await getPublishedArticles();
  const topics = await getPublishedTopics();
  const link = (path: string) => absolute(u(path), site);
  const text = [`# ${SITE.name}`, '', '> 健康生活與營養資訊。內容與商品關係依各頁揭露，並提供可核對來源。', '', '## 網站資訊',
    `- [編輯原則](${link('/editorial-policy/')})`, `- [關係揭露](${link('/disclosure/')})`, `- [內容團隊](${link('/authors/')})`, `- [RSS](${link('/rss.xml')})`, '',
    '## 主題指南', ...topics.map((entry) => `- [${entry.data.title}](${link(`/topics/${entry.id}/`)}): ${entry.data.description}`), '',
    '## 已發布文章', ...articles.map((entry) => `- [${entry.data.title}](${link(`/articles/${articleSlug(entry)}/`)}): ${entry.data.description}`), ''].join('\n');
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
