import { getCollection, type CollectionEntry } from 'astro:content';
import { contentSlug, isPublicFrontmatter, rankRelated } from './content-core.mjs';

export type ArticleEntry = CollectionEntry<'articles'>;
export type AuthorEntry = CollectionEntry<'authors'>;
export type TopicEntry = CollectionEntry<'topics'>;
export const articleSlug = (entry: ArticleEntry): string => contentSlug(entry);

export async function getPublishedArticles(): Promise<ArticleEntry[]> {
  return (await getCollection('articles')).filter((entry) => isPublicFrontmatter(entry.data))
    .sort((a, b) => b.data.publishDate!.getTime() - a.data.publishDate!.getTime());
}
export async function getAuthors(): Promise<AuthorEntry[]> { return getCollection('authors'); }
export async function getAuthor(id: string): Promise<AuthorEntry | undefined> {
  return (await getAuthors()).find((entry) => entry.id === id);
}
export async function getPublishedTopics(): Promise<TopicEntry[]> {
  const articles = await getPublishedArticles();
  return (await getCollection('topics')).filter((topic) => topic.data.status === 'active' && articlesForTopic(topic, articles).length > 0);
}
export function articlesForTopic(topic: TopicEntry, articles: ArticleEntry[]): ArticleEntry[] {
  const selected = new Set([...topic.data.articles, ...topic.data.sections.flatMap((section) => section.articles)]);
  return articles.filter((entry) => selected.has(articleSlug(entry)) || entry.data.topics.includes(topic.id));
}
export async function relatedArticles(article: ArticleEntry, all?: ArticleEntry[], limit = 3): Promise<ArticleEntry[]> {
  return rankRelated(article, all ?? await getPublishedArticles(), limit);
}
