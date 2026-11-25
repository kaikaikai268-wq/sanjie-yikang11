import type { APIRoute, GetStaticPaths } from 'astro';
import { articleSlug, getPublishedArticles, type ArticleEntry } from '../../lib/content';
import { plainText } from '../../lib/feed.mjs';
import { absolute } from '../../lib/seo';
import { u } from '../../lib/url';
export const getStaticPaths: GetStaticPaths = async () => (await getPublishedArticles()).map((entry) => ({ params: { slug: articleSlug(entry) }, props: { entry } }));
export const GET: APIRoute = ({ props, site }) => {
  const { entry } = props as { entry: ArticleEntry };
  const text = [entry.data.title, entry.data.description, absolute(u(`/articles/${articleSlug(entry)}/`), site), plainText(entry.body ?? ''), '參考來源', ...entry.data.references.map((ref) => `${ref.title}: ${ref.url}`)].join('\n\n');
  return new Response(text + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
