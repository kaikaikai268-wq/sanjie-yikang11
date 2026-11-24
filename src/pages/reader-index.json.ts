import type { APIRoute } from 'astro';
import { articleSlug, getPublishedArticles, getAuthor } from '../lib/content';
import { absolute } from '../lib/seo';
import { u } from '../lib/url';
export const GET: APIRoute = async ({ site }) => {
  const articles = await getPublishedArticles();
  const items = await Promise.all(articles.map(async (entry) => ({
    slug: articleSlug(entry), title: entry.data.title, description: entry.data.description,
    url: absolute(u(`/articles/${articleSlug(entry)}/`), site), category: entry.data.category,
    contentType: entry.data.contentType, topics: entry.data.topics, tags: entry.data.tags,
    author: (await getAuthor(entry.data.author))?.data.name, publishedAt: entry.data.publishDate!.toISOString(),
    updatedAt: entry.data.updatedDate?.toISOString(),
  })));
  return new Response(JSON.stringify({ schemaVersion: 1, site: absolute(u('/'), site), items }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
