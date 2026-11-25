import { SITE, CONTACT } from '../data/site';
import { u } from './url';

export function absolute(path: string, site: URL | undefined): string {
  return new URL(path, site ?? 'https://3jwellness.com').href;
}

// Escape HTML-sensitive characters even in JSON-LD; a title must never close its script element.
export function jsonScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function siteGraph(site: URL | undefined) {
  const home = absolute(u('/'), site);
  return [
    {
      '@type': 'Organization', '@id': `${home}#organization`,
      name: SITE.name, alternateName: SITE.nameEn, url: home,
      logo: { '@type': 'ImageObject', url: absolute(u('/apple-touch-icon.png'), site) },
      sameAs: [CONTACT.facebook.href, CONTACT.instagram.href],
      publishingPrinciples: absolute(u('/editorial-policy/'), site),
    },
    {
      '@type': 'WebSite', '@id': `${home}#website`, name: SITE.name, url: home,
      inLanguage: 'zh-Hant-TW', publisher: { '@id': `${home}#organization` },
    },
  ];
}
