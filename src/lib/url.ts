// 站內網址一律經過 u()：網站可能掛在子路徑（GitHub Pages 專案站 /sanjie-yikang11/），
// 也可能在根網域（3jwellness.com）。子路徑由建置時的 PUBLIC_BASE_PATH 決定，見 astro.config.mjs。
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const u = (path: string) => `${BASE}${path}`;
