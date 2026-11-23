// 設計規範用測試釘住（design-tokens）：
//   1. 最小字級 18px，無例外；字級只走 var(--text-*) 或 clamp() 下限 ≥ 18px
//   2. 顏色只能用 oklch() 或 token；hex／rgb／hsl 只允許出現在 @supports not (color: oklch(...)) 的 fallback 區塊
//   3. 不寫 inline style（樣式集中在 src/styles，改版才找得到）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(fileURLToPath(import.meta.url), '..', '..', 'src');
const MIN_REM = 1.125;

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'assets') yield* walk(p); }
    else if (/\.(astro|css|ts|mjs)$/.test(e.name)) yield p;
  }
}
const files = async () => { const out = []; for await (const f of walk(SRC)) out.push(f); return out; };
const rel = (f) => path.relative(SRC, f);

function toRem(v) {
  const s = v.trim();
  let m = s.match(/^([\d.]+)rem$/); if (m) return Number(m[1]);
  m = s.match(/^([\d.]+)px$/); if (m) return Number(m[1]) / 16;
  return null;
}

// 去掉 fallback 區塊（大括號配對），剩下的才檢查顏色
function stripFallback(css) {
  let out = css, i;
  while ((i = out.indexOf('@supports not (color: oklch')) !== -1) {
    let depth = 0, j = out.indexOf('{', i);
    for (; j < out.length; j++) { if (out[j] === '{') depth++; else if (out[j] === '}' && --depth === 0) break; }
    out = out.slice(0, i) + out.slice(j + 1);
  }
  return out;
}

test('最小字級 18px，無例外', async () => {
  const bad = [];
  for (const f of await files()) {
    const src = await readFile(f, 'utf-8');
    for (const m of src.matchAll(/font-size:\s*([^;}\n]+)/g)) {
      const v = m[1].trim();
      if (/^var\(--text-(xs|sm|base|lg|xl|2xl|3xl)\)$/.test(v)) continue;
      const clamp = v.match(/^clamp\(\s*([^,]+),/);
      const probe = clamp ? clamp[1].trim() : v;
      if (/^var\(--text-/.test(probe)) continue;
      const rem = toRem(probe);
      if (rem === null) bad.push(`${rel(f)}：看不懂的字級 ${v}`);
      else if (rem < MIN_REM) bad.push(`${rel(f)}：${v}＝${rem * 16}px`);
    }
  }
  assert.deepEqual(bad, []);
});

test('tokens.css 的字級 token 全部 ≥ 18px', async () => {
  const css = await readFile(path.join(SRC, 'styles', 'tokens.css'), 'utf-8');
  for (const m of css.matchAll(/--text-(\w+):\s*([\d.]+rem)/g)) assert.ok(toRem(m[2]) >= MIN_REM, `--text-${m[1]} = ${m[2]}`);
});

test('顏色只用 oklch() 或 token（hex 僅限 fallback 區塊）', async () => {
  const bad = [];
  for (const f of await files()) {
    const src = stripFallback(await readFile(f, 'utf-8'));
    // 程式碼裡的網址片段（例如 %E5）不算；只抓 CSS 顏色語法
    for (const m of src.matchAll(/(?<![\w%&/])#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(/g)) {
      const line = src.slice(0, m.index).split('\n').length;
      bad.push(`${rel(f)}:${line} ${m[0]}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('不寫 inline style', async () => {
  const bad = [];
  for (const f of await files()) if (f.endsWith('.astro') && /\sstyle=/.test(await readFile(f, 'utf-8'))) bad.push(rel(f));
  assert.deepEqual(bad, []);
});
