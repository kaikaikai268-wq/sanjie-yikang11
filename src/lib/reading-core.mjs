/** Reading rules adapted from Evidence Today's active-time + scroll completion model.
 * Pure functions keep hidden-tab time and a quick jump to the bottom out of completion counts.
 */
export const SCROLL_MILESTONES = [25, 50, 75, 90];
export const IDLE_TIMEOUT_MS = 30_000;
export function readingTimeGate(minutes) {
  const value = Number(minutes);
  return Math.min(240, Math.max(20, Number.isFinite(value) ? Math.floor(value * 30) : 20));
}
export function scrollDepth({ viewportBottom, contentTop, contentHeight }) {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return 0;
  return Math.min(100, Math.max(0, (viewportBottom - contentTop) / contentHeight * 100));
}
export function activeDelta({ now, lastTick, lastActivity, visible, focused }) {
  if (!visible || !focused || now - lastActivity > IDLE_TIMEOUT_MS) return 0;
  return Math.min(2_000, Math.max(0, now - lastTick));
}
export function canComplete({ maxDepth, activeMs, readingMinutes, reachedEnd, interacted }) {
  return interacted && reachedEnd && maxDepth >= 90 && activeMs >= readingTimeGate(readingMinutes) * 1000;
}
