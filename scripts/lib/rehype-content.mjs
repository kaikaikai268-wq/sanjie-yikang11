import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Adapt Markdown links to subpath hosting and apply the build's image manifest. */
export default function rehypeContent({ base = '' } = {}) {
  const prefix = (value) => value?.startsWith('/') && !value.startsWith('//') && !(base && (value === base || value.startsWith(`${base}/`))) ? base + value : value;
  return (tree) => {
    let manifest = {};
    try { manifest = JSON.parse(readFileSync(path.join(process.cwd(), 'src/data/content-images.json'), 'utf8')); }
    catch { /* No public images yet; media:prepare creates the file before a real build. */ }
    const visit = (node) => {
      if (node.type === 'element') {
        const props = node.properties ??= {};
        if (node.tagName === 'a' && typeof props.href === 'string') {
          props.href = prefix(props.href);
          if (/^https?:\/\//i.test(props.href)) props.rel = ['noopener', 'noreferrer'];
        }
        if (node.tagName === 'img' && typeof props.src === 'string') {
          const optimized = manifest[props.src];
          if (optimized) {
            props.src = prefix(optimized.src);
            props.srcSet = optimized.variants.map((variant) => `${prefix(variant.src)} ${variant.width}w`).join(', ');
            props.sizes = '(max-width: 760px) 100vw, 800px';
            props.width = optimized.width;
            props.height = optimized.height;
          } else props.src = prefix(props.src);
          props.loading = 'lazy';
          props.decoding = 'async';
        }
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(tree);
  };
}
