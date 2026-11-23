import type { APIRoute } from 'astro';
import { IS_PRODUCTION } from '../lib/env';
import { u } from '../lib/url';

export const GET: APIRoute = ({ site }) =>
  new Response(
    IS_PRODUCTION
      ? `User-agent: *\nAllow: /\n\nSitemap: ${new URL(u('/sitemap-index.xml'), site).href}\n`
      : '# 非正式建置：全站不收錄。正式部署以 PUBLIC_SITE_STAGE=production 建置。\nUser-agent: *\nDisallow: /\n',
    { headers: { 'content-type': 'text/plain; charset=utf-8' } },
  );
