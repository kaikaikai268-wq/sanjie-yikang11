#!/usr/bin/env node
// 商品目錄現況（從 src/data/products.ts 讀，不寫進文件）：分類、品牌、圖片檔是否齊全。
//   pnpm catalog
import { readFile, readdir } from 'node:fs/promises';

const src = await readFile(new URL('../src/data/products.ts', import.meta.url), 'utf-8');
const imgs = new Set((await readdir(new URL('../src/assets/products/', import.meta.url))).map((f) => f.replace(/\.\w+$/, '')));
const rows = [...src.matchAll(/\{ id: '([^']+)', name: '([^']+)', brand: '([^']+)', category: '([^']+)'/g)].map((m) => ({ id: m[1], name: m[2], brand: m[3], category: m[4] }));

const by = (k) => rows.reduce((a, r) => ((a[r[k]] = (a[r[k]] ?? 0) + 1), a), {});
console.log(`商品 ${rows.length} 項`);
console.log('分類', by('category'));
console.log('品牌', by('brand'));
for (const r of rows) console.log(`  ${imgs.has(r.id) ? '圖 ✓' : '圖 ✗'}  /products/${r.id}/  ${r.name}（${r.category}）`);
