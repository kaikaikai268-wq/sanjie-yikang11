// 圖片以檔名（不含副檔名）查找，交給 astro:assets 轉 webp 與多尺寸。
import type { ImageMetadata } from 'astro';

const load = (mods: Record<string, { default: ImageMetadata }>) =>
  Object.fromEntries(Object.entries(mods).map(([p, m]) => [p.split('/').pop()!.replace(/\.\w+$/, ''), m.default]));

// Old site/products folders are retained locally as demo source, never imported into public builds.
const PRODUCT_IMAGES = load(import.meta.glob<{ default: ImageMetadata }>('../assets/published-products/*.{jpg,png}', { eager: true }));
const SITE_IMAGES = load(import.meta.glob<{ default: ImageMetadata }>('../assets/published-site/*.{jpg,png}', { eager: true }));

function pick(set: Record<string, ImageMetadata>, key: string, dir: string): ImageMetadata {
  const img = set[key];
  if (!img) throw new Error(`缺圖片：src/assets/${dir}/${key}.(jpg|png)`);
  return img;
}

export const productImage = (id: string) => pick(PRODUCT_IMAGES, id, 'published-products');
export const siteImage = (key: string) => pick(SITE_IMAGES, key, 'published-site');
