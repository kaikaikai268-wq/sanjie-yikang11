/** Pagefind is loaded only on this page, after a search. Queries never enter analytics. */
import { plainSearchExcerpt, localSearchResultUrl } from './search-core.mjs';
interface PagefindData { url: string; meta?: { title?: string }; excerpt?: string; }
interface PagefindHit { data: () => Promise<PagefindData>; }
interface PagefindModule { search: (query: string) => Promise<{ results: PagefindHit[] }>; }

export function mountContentSearch(root: HTMLElement, loadIndex: (url: string) => Promise<PagefindModule> = (url) => import(/* @vite-ignore */ url)) {
  const form = root.querySelector<HTMLFormElement>('form')!;
  const input = root.querySelector<HTMLInputElement>('input')!;
  const submit = root.querySelector<HTMLButtonElement>('[type="submit"]')!;
  const status = root.querySelector<HTMLElement>('[role="status"]')!;
  const list = root.querySelector<HTMLOListElement>('ol')!;
  const more = root.querySelector<HTMLButtonElement>('.content-search-more')!;
  let modulePromise: Promise<PagefindModule> | undefined;
  let results: PagefindHit[] = [];
  let offset = 0;
  let generation = 0;
  let loadingMoreFor: number | null = null;
  const pageSize = 8;
  const indexUrl = root.dataset.indexUrl!;
  const indexCount = Number(root.dataset.indexCount);
  const busy = (value: boolean) => {
    // Keep submit available so a new query can replace a slow, pending search.
    submit.disabled = false;
    more.disabled = value;
    list.setAttribute('aria-busy', String(value));
  };
  async function appendPage(ticket: number) {
    const selected = results.slice(offset, offset + pageSize);
    const data = await Promise.all(selected.map((hit) => hit.data()));
    if (ticket !== generation) return;
    for (const item of data) {
      const url = localSearchResultUrl(item.url, location.origin);
      // The local index may contain only same-site navigation targets.
      if (!url) continue;
      const li = document.createElement('li');
      const heading = document.createElement('h2');
      const link = document.createElement('a');
      link.href = url.href;
      link.textContent = item.meta?.title || '閱讀文章';
      heading.append(link);
      const excerpt = document.createElement('p');
      excerpt.textContent = plainSearchExcerpt(item.excerpt || '');
      li.append(heading, excerpt);
      list.append(li);
    }
    offset += selected.length;
    more.hidden = offset >= results.length;
    status.textContent = results.length && list.children.length
      ? `找到 ${results.length} 筆結果，已顯示 ${list.children.length} 筆。`
      : '沒有找到可顯示的本站內容，請試試其他關鍵字，或瀏覽文章與主題指南。';
  }
  async function search() {
    if (indexCount === 0) {
      status.textContent = '目前尚無公開文章，可稍後再試。';
      list.replaceChildren();
      more.hidden = true;
      return;
    }
    const query = input.value.trim().slice(0, 200);
    if (!query) { input.focus(); return; }
    const ticket = ++generation;
    list.replaceChildren();
    more.hidden = true;
    busy(true);
    status.textContent = '正在搜尋…';
    try {
      modulePromise ??= loadIndex(indexUrl).catch((error) => { modulePromise = undefined; throw error; });
      const pagefind = await modulePromise;
      const response = await pagefind.search(query);
      if (ticket !== generation) return;
      results = response.results;
      offset = 0;
      await appendPage(ticket);
    } catch {
      if (ticket === generation) status.textContent = import.meta.env.DEV
        ? '開發模式尚未載入搜尋索引。請先執行 pnpm build，再用 pnpm preview 測試搜尋。'
        : '搜尋暫時無法使用，請稍後再試，或先瀏覽文章與主題指南。';
    } finally {
      if (ticket === generation) busy(false);
    }
  }
  form.addEventListener('submit', (event) => { event.preventDefault(); void search(); });
  more.addEventListener('click', async () => {
    const ticket = generation;
    if (loadingMoreFor === ticket) return;
    loadingMoreFor = ticket;
    busy(true);
    try { await appendPage(ticket); }
    catch { if (ticket === generation) status.textContent = '部分結果暫時無法載入，請再試一次。'; }
    finally {
      if (loadingMoreFor === ticket) loadingMoreFor = null;
      if (ticket === generation) busy(false);
    }
  });
  const initial = new URLSearchParams(location.search).get('q');
  if (indexCount === 0) status.textContent = '目前尚無公開文章，可稍後再試。';
  else if (initial) { input.value = initial.slice(0, 200); void search(); }
}
const root = document.querySelector<HTMLElement>('[data-content-search]');
if (root) mountContentSearch(root);
