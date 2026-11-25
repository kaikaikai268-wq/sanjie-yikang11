import type { APIRoute } from 'astro';
import { SITE } from '../data/site';
import { articleSlug, getPublishedArticles, getAuthor } from '../lib/content';
import { absolute } from '../lib/seo';
import { u } from '../lib/url';
import { xml } from '../lib/feed.mjs';

export const GET: APIRoute = async ({ site }) => {
  const articles = await getPublishedArticles();
  const items = await Promise.all(articles.map(async (entry) => {
    const url = absolute(u(`/articles/${articleSlug(entry)}/`), site);
    const author = await getAuthor(entry.data.author);
    return `<item><title>${xml(entry.data.title)}</title><link>${xml(url)}</link><guid isPermaLink="true">${xml(url)}</guid><description>${xml(entry.data.description)}</description><pubDate>${entry.data.publishDate!.toUTCString()}</pubDate><dc:creator>${xml(author?.data.name ?? SITE.name)}</dc:creator><category>${xml(entry.data.category)}</category></item>`;
  }));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>${xml(SITE.name)}</title><link>${xml(absolute(u('/articles/'), site))}</link><description>三傑益康的健康生活與營養內容</description><language>zh-TW</language><atom:link href="${xml(absolute(u('/rss.xml'), site))}" rel="self" type="application/rss+xml"/>${items.join('')}</channel></rss>`, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
