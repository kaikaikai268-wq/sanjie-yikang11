import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { publicationNow, parseTaipeiDate } from '../../src/lib/content-core.mjs';

function iso(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(parseTaipeiDate(value).getTime())) throw new Error(`${label} 必須是帶時區的 ISO 時間。`);
  return new Date(value).toISOString();
}
export function createBuildManifest(input) {
  const site = new URL(input.site);
  if (!['https:', 'http:'].includes(site.protocol) || site.username || site.password || site.search || site.hash || site.pathname !== '/') throw new Error('Build manifest site 必須是不含帳密、query 或子路徑的 http/https 站台網址。');
  const basePath = input.basePath || '';
  if (typeof basePath !== 'string' || (basePath && !/^\/(?:[a-zA-Z0-9_-]+\/?)+$/.test(basePath)) || basePath.endsWith('/')) throw new Error('Build manifest basePath 必須是無結尾斜線的安全站內子路徑。');
  if (!['production', 'preview'].includes(input.stage)) throw new Error('Build manifest stage 必須是 production 或 preview。');
  // Explicit whitelist: never spread env, content inventories, credentials or caller metadata.
  const result = { schemaVersion: 1, builtAt: iso(input.builtAt, 'builtAt'), publicationTime: iso(input.publicationTime, 'publicationTime'), stage: input.stage, basePath, site: site.origin };
  if (input.commit !== undefined) {
    if (typeof input.commit !== 'string' || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/i.test(input.commit)) throw new Error('Build manifest commit 必須是完整 Git SHA。');
    result.commit = input.commit.toLowerCase();
  }
  return result;
}
export function validateBuildManifest(input) {
  if (!input || input.schemaVersion !== 1) throw new Error('找不到受支援的 build manifest schemaVersion。');
  return createBuildManifest(input);
}
function currentCommit(root) {
  if (/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/i.test(process.env.GITHUB_SHA || '')) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['-c', `safe.directory=${root.replace(/\\/g, '/')}`, 'rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return undefined; }
}
export async function writeBuildManifest({ root = process.cwd(), dist = path.join(root, 'dist') } = {}) {
  if (!process.env.CONTENT_BUILD_TIME) throw new Error('產生 build manifest 前必須固定 CONTENT_BUILD_TIME；請透過 pnpm build／scripts/build.mjs 建置。');
  const manifest = createBuildManifest({
    builtAt: new Date().toISOString(), publicationTime: new Date(publicationNow()).toISOString(),
    stage: process.env.PUBLIC_SITE_STAGE === 'production' ? 'production' : 'preview',
    basePath: (process.env.PUBLIC_BASE_PATH || '').replace(/\/$/, ''), site: process.env.PUBLIC_SITE_URL || 'https://3jwellness.com', commit: currentCommit(root),
  });
  await mkdir(dist, { recursive: true });
  await writeFile(path.join(dist, 'build-info.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}
