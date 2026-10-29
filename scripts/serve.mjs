import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative, extname, sep } from 'node:path';
import { rootDirectory, renderPage, routes } from './site.mjs';

const isDist = process.argv.includes('--dist');
const root = resolve(fileURLToPath(rootDirectory), isDist ? 'dist' : '.');
const port = Number(process.env.PORT || (isDist ? 4173 : 5173));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    let pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
    const route = pathname.slice(1);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!isDist && routes.includes(route)) {
      res.setHeader('Content-Type', mime['.html']);
      res.end(req.method === 'HEAD' ? undefined : renderPage(route, '', await readFile(resolve(root, 'index.html'), 'utf8'))); return;
    }
    const path = resolve(root, '.' + pathname);
    const rel = relative(root, path);
    if (rel.startsWith('..') || rel.includes(`${sep}.`) || rel.startsWith('.') || (!isDist && !['src', 'public'].includes(rel.split(sep)[0]))) {
      res.writeHead(404).end('Not found'); return;
    }
    const info = await stat(path);
    if (info.isDirectory() && !pathname.endsWith('/')) { res.writeHead(301, { Location: pathname + '/' }).end(); return; }
    const file = info.isDirectory() ? resolve(path, 'index.html') : path;
    const content = await readFile(file);
    res.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>找不到頁面｜字間</title><h1>這裡還沒有文字。</h1><a href="/">回到字間</a></html>');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`字間 ${isDist ? 'production preview' : 'local development'} → http://127.0.0.1:${port}`));
