import type { APIRoute } from 'astro';
import { SITE } from '../data/site';
import { articleSlug, getPublishedArticles } from '../lib/content';
import { absolute } from '../lib/seo';
import { u } from '../lib/url';
import { plainText } from '../lib/feed.mjs';
export const GET: APIRoute = async ({ site }) => {
  const articles = await getPublishedArticles();
  const text = [`# ${SITE.name}`, ...articles.map((entry) => [
    `## ${entry.data.title}`, absolute(u(`/articles/${articleSlug(entry)}/`), site), entry.data.description,
    `發布：${entry.data.publishDate!.toISOString()}`, plainText(entry.body ?? ''), '參考來源：', ...entry.data.references.map((ref) => `${ref.title}: ${ref.url}`),
  ].join('\n\n'))].join('\n\n');
  return new Response(text + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
