// One publication instant for validation, media, Astro, feeds and the search index.
import { spawnSync } from 'node:child_process';
import { publicationNow } from '../src/lib/content-core.mjs';

process.env.CONTENT_BUILD_TIME ??= new Date().toISOString();
publicationNow(); // Reject malformed overrides before starting a partial build.
process.env.ASTRO_TELEMETRY_DISABLED = '1';
const flags = new Set(process.argv.slice(2));
for (const flag of flags) if (!['--verify', '--check-only'].includes(flag)) throw new Error(`未知建置選項：${flag}`);
function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(['scripts/content.mjs', 'check']);
run(['scripts/prepare-media.mjs']);
if (flags.has('--verify') || flags.has('--check-only')) run(['node_modules/astro/bin/astro.mjs', 'check']);
if (!flags.has('--check-only')) {
  run(['node_modules/astro/bin/astro.mjs', 'build']);
  run(['scripts/postbuild.mjs']);
  run(['scripts/release-check.mjs']);
  if (flags.has('--verify')) run(['--test', 'test/**/*.test.mjs']);
}
