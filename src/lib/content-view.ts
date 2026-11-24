import { u } from './url';
import { absolute } from './seo';
import media from '../data/content-images.json';
export { contentTypeLabel, displayDate, readingMinutes } from './content-format.mjs';

export const ARTICLE_PAGE_SIZE = 12;
export function contentAsset(path: string): string {
  const optimized = (media as Record<string, { src: string }>)[path]?.src ?? path;
  return optimized.startsWith('/') ? u(optimized) : optimized;
}

export function listSchema(title: string, path: string, items: { title: string; path: string }[], site: URL | undefined) {
  const home = absolute(u('/'), site);
  return {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: title,
    url: absolute(u(path), site), inLanguage: 'zh-Hant-TW',
    isPartOf: { '@id': `${home}#website` }, publisher: { '@id': `${home}#organization` },
    mainEntity: { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.title, url: absolute(u(item.path), site) })) },
  };
}

export function breadcrumbSchema(items: { label: string; path: string }[], site: URL | undefined) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.label, item: absolute(u(item.path), site) })) };
}
