import { fragmentId } from './article-navigation-core.mjs';

const article = document.querySelector<HTMLElement>('[data-reading-article]');
if (article) {
  // Preserve native hash/history/scroll behavior; move keyboard focus to the destination.
  article.querySelectorAll<HTMLAnchorElement>('.article-toc a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const id = fragmentId(link.getAttribute('href'));
      const target = id ? document.getElementById(id) : null;
      if (!target || !article.contains(target)) return;
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
    });
  });

  // Keep table semantics inside a named, keyboard-scrollable container.
  article.querySelectorAll<HTMLElement>('.article-body table, .article-body pre').forEach((element) => {
    if (element.parentElement?.classList.contains('article-scrollbox')) return;
    const region = document.createElement('div');
    region.className = 'article-scrollbox';
    region.tabIndex = 0;
    region.setAttribute('role', 'region');
    const caption = element.querySelector('caption')?.textContent?.trim();
    region.setAttribute('aria-label', caption ? `${caption}，可左右捲動` : element.tagName === 'TABLE' ? '表格，可左右捲動' : '程式碼，可左右捲動');
    element.before(region);
    region.append(element);
  });
}
