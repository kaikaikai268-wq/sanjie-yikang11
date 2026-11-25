import { readFile, mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { loadContent, extractMarkdownImages } from './lib/content-files.mjs';
import { isPublicFrontmatter } from '../src/lib/content-core.mjs';

const root = process.cwd();
const content = loadContent(root);
const images = new Set();
const visibleArticles = content.articles.filter((entry) => isPublicFrontmatter(entry.data));
for (const entry of [...visibleArticles, ...content.authors, ...content.topics.filter((entry) => entry.data.status === 'active')]) {
  if (entry.data.coverImage) images.add(entry.data.coverImage);
  if (entry.data.avatar) images.add(entry.data.avatar);
  for (const image of extractMarkdownImages(entry.body)) images.add(image);
}
const outputDir = path.join(root, 'public/media/content');
await mkdir(outputDir, { recursive: true });
const manifest = {};
const generatedNames = new Set();
for (const src of [...images].sort()) {
  const file = path.join(root, 'public', src);
  const input = await readFile(file);
  const metadata = await sharp(input).rotate().metadata();
  const rotated = [5, 6, 7, 8].includes(metadata.orientation ?? 1);
  const width = rotated ? metadata.height : metadata.width;
  const height = rotated ? metadata.width : metadata.height;
  if (!width || !height) throw new Error(`無法讀取圖片尺寸：${src}`);
  const hash = createHash('sha256').update(input).digest('hex').slice(0, 16);
  const variants = [];
  for (const size of [...new Set([400, 800, 1200].map((size) => Math.min(size, width)))]) {
    const name = `${hash}-${size}.webp`;
    generatedNames.add(name);
    await sharp(input).rotate().resize({ width: size, withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(outputDir, name));
    variants.push({ src: `/media/content/${name}`, width: size });
  }
  manifest[src] = { width, height, src: variants.at(-1).src, variants };
}
// Only garbage-collect this generator's own filenames in its resolved output directory.
if (path.resolve(outputDir) !== path.join(path.resolve(root), 'public', 'media', 'content')) throw new Error('圖片輸出目錄超出預期範圍');
for (const name of await readdir(outputDir)) {
  if (/^[a-f0-9]{16}-\d+\.webp$/.test(name) && !generatedNames.has(name)) await unlink(path.join(outputDir, name));
}
await mkdir(path.join(root, 'src/data'), { recursive: true });
await writeFile(path.join(root, 'src/data/content-images.json'), JSON.stringify(manifest, null, 2) + '\n');

// Copy the visually approved PNG; CI may not have CJK fonts. Icons are static checked-in assets.
await mkdir(path.join(root, 'public/og'), { recursive: true });
await writeFile(path.join(root, 'public/og/default.png'), await readFile(path.join(root, 'src/assets/brand/share-card.png')));
console.log(`內容圖片處理完成：${images.size} 個來源；分享圖已準備。`);
