import { mkdir, cp, writeFile, rm, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';
import { rootDirectory, routes, renderPage, siteConfig } from './site.mjs';

const root = fileURLToPath(rootDirectory);
const output = resolve(root, 'dist');
// This build only replaces the dedicated, verified dist folder inside this project.
if (relative(root, output) !== 'dist') throw new Error('Unsafe build output');
const configuredUrl = process.env.SITE_URL || siteConfig.url || '';
let siteUrl = '';
if (configuredUrl) {
  const parsed = new URL(configuredUrl);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('SITE_URL must be a public HTTPS URL without credentials, query or fragment');
  }
  siteUrl = parsed.href.endsWith('/') ? parsed.href : parsed.href + '/';
}
await rm(output, { force: true, recursive: true });
await mkdir(output, { recursive: true });
for (const route of routes) {
  const folder = resolve(output, route);
  await mkdir(folder, { recursive: true });
  await writeFile(resolve(folder, 'index.html'), renderPage(route, siteUrl));
}
await Promise.all([cp(resolve(root, 'src'), resolve(output, 'src'), { recursive: true }),
  cp(resolve(root, 'public'), resolve(output, 'public'), { recursive: true }),
  writeFile(resolve(output, '.nojekyll'), ''),
  writeFile(resolve(output, '404.html'), '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>找不到這個頁面｜字間</title><body style="font-family:sans-serif;background:#f6f5f0;color:#292e28;margin:10vw"><h1>這裡還沒有文字。</h1><p>請檢查網址，或用瀏覽器返回上一頁繼續練習。</p></body></html>')]);
const robotContent = siteUrl ? `User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n` : 'User-agent: *\nAllow: /\n';
// Search Console HTML-file verification must be at the property root, not /public/.
for (const filename of (await readdir(resolve(root, 'public'))).filter(name=>/^google[a-f0-9]{1,64}\.html$/.test(name))) {
  await cp(resolve(root, 'public', filename), resolve(output, filename));
}
await writeFile(resolve(output, 'robots.txt'), robotContent);
if (siteUrl) {
  await writeFile(resolve(output, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    routes.filter(route=>route && route!=='en-ui/').map(route => `<url><loc>${new URL(route, siteUrl).href.replace(/&/g, '&amp;')}</loc></url>`).join('') + '</urlset>\n');
}
console.log(`Built ${routes.length} static pages → ${output}`);
console.log(siteUrl ? `Canonical URLs and sitemap use ${siteUrl}` : 'Local build: set SITE_URL to the final public URL when preparing deployment.');
