// 從統一設計系統同步 token 檔。改 token 請改上游，不要改 src/styles/tokens.css。
// 與 runa.tw、seh.tw 同一套做法，來源同一份檔案。
//   DESIGN_TOKENS_SRC=/path/to/templates/styles.css pnpm sync:tokens
import { readFile, writeFile } from 'node:fs/promises';

const SRC = process.env.DESIGN_TOKENS_SRC
  ?? new URL('../../agent.system-integration-quality-control/templates/styles.css', import.meta.url).pathname;
const DEST = new URL('../src/styles/tokens.css', import.meta.url);
const HEADER = `/* ============================================================
 * 本檔為統一設計系統的副本，請勿直接編輯。
 *
 * 來源：agent.system-integration-quality-control/templates/styles.css
 * 同步：pnpm sync:tokens
 *
 * 品牌色與元件樣式寫在 src/styles/site.css；
 * 需要調整 token 值時改上游來源檔再同步回來。
 * ============================================================ */

`;

let css;
try { css = await readFile(SRC, 'utf-8'); }
catch { console.error(`讀不到上游 ${SRC}（雲端 session 沒有這個 repo 屬正常，tokens.css 已在版控內，不需同步）`); process.exit(1); }
await writeFile(DEST, HEADER + css, 'utf-8');
console.log(`tokens 已同步：${SRC}`);
