import { activeDelta, canComplete, scrollDepth, SCROLL_MILESTONES } from './reading-core.mjs';

/** No framework hydration. Base.astro owns shop_click to avoid duplicate conversion events. */
const article = document.querySelector<HTMLElement>('[data-reading-article]');
if (article) {
  const body = article.querySelector<HTMLElement>('[data-article-body]');
  const end = article.querySelector<HTMLElement>('[data-reading-end]');
  if (body && end) {
    const meta = { article_slug: article.dataset.articleSlug || '', content_category: article.dataset.articleCategory || '' };
    const readingMinutes = Number(article.dataset.readingMinutes) || 1;
    const track = (event: string, params: Record<string, unknown> = {}) => {
      const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
      if (gtag) gtag('event', event, { ...meta, ...params });
    };
    let lastActivity = Date.now();
    let lastTick = Date.now();
    let activeMs = 0;
    let segmentMs = 0;
    let maxDepth = 0;
    let reachedEnd = false;
    let interacted = false;
    let completed = false;
    let suspended = false;
    let raf = 0;
    let timer: number | undefined;
    const milestones = new Set<number>();
    const check = () => {
      if (!completed && canComplete({ maxDepth, activeMs, readingMinutes, reachedEnd, interacted })) {
        completed = true;
        track('read_complete', { engaged_time_sec: Math.round(activeMs / 1000) });
      }
    };
    const tick = () => {
      const now = Date.now();
      const delta = suspended ? 0 : activeDelta({ now, lastTick, lastActivity, visible: document.visibilityState === 'visible', focused: document.hasFocus() });
      lastTick = now;
      activeMs += delta;
      segmentMs += delta;
      check();
    };
    const measure = () => {
      raf = 0;
      if (document.visibilityState !== 'visible') return;
      const rect = body.getBoundingClientRect();
      const depth = scrollDepth({ viewportBottom: window.scrollY + window.innerHeight, contentTop: rect.top + window.scrollY, contentHeight: rect.height });
      maxDepth = Math.max(maxDepth, depth);
      reachedEnd ||= end.getBoundingClientRect().top <= window.innerHeight;
      for (const milestone of SCROLL_MILESTONES) {
        if (depth >= milestone && !milestones.has(milestone)) {
          milestones.add(milestone);
          track('scroll_depth', { percent_scrolled: milestone });
        }
      }
      check();
    };
    const activity = (event: Event) => {
      lastActivity = Date.now();
      if (event.isTrusted && event.type !== 'pointermove') interacted = true;
      if (!raf) raf = requestAnimationFrame(measure);
    };
    const flush = () => {
      tick();
      if (segmentMs <= 0) return;
      track('engaged_view', { engaged_time_sec: Math.round(segmentMs / 1000), max_scroll_percent: Math.round(maxDepth), read_completed: completed, transport_type: 'beacon' });
      segmentMs = 0;
    };
    const stopTimer = () => { if (timer !== undefined) window.clearInterval(timer); timer = undefined; };
    const startTimer = () => { if (timer === undefined) timer = window.setInterval(tick, 1000); };
    const visibility = () => {
      if (document.visibilityState === 'hidden') { flush(); suspended = true; stopTimer(); }
      else { suspended = false; lastTick = lastActivity = Date.now(); startTimer(); }
    };
    const blur = () => { flush(); suspended = true; stopTimer(); };
    const focus = () => { suspended = false; lastTick = lastActivity = Date.now(); startTimer(); };
    const hide = () => { flush(); suspended = true; stopTimer(); if (raf) cancelAnimationFrame(raf); raf = 0; };
    const show = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      activeMs = segmentMs = maxDepth = 0;
      completed = interacted = reachedEnd = false;
      milestones.clear();
      focus();
      track('content_view');
      measure();
    };
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!target) return;
      if (target.matches('[data-related-article]') || target.closest('[data-related-articles]')) {
        const url = new URL(target.href, location.href);
        if (url.origin === location.origin) track('select_content', { target_path: url.pathname });
      }
      if (target.closest('[data-reference-list]')) {
        const url = new URL(target.href, location.href);
        if (['https:', 'http:'].includes(url.protocol)) track('reference_click', { link_domain: url.hostname });
      }
    };
    const events = ['scroll', 'keydown', 'pointermove', 'pointerdown', 'wheel', 'touchstart'];
    for (const event of events) window.addEventListener(event, activity, { passive: true });
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    document.addEventListener('click', click);
    if (document.visibilityState === 'visible' && document.hasFocus()) startTimer();
    // Astro static navigation unloads this document. Explicit cleanup also supports future swaps.
    document.addEventListener('astro:before-swap', () => {
      hide();
      stopTimer();
      for (const event of events) window.removeEventListener(event, activity);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
      document.removeEventListener('click', click);
    }, { once: true });
    track('content_view');
    measure();
  }
}
