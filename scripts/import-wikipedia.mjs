// Run explicitly to refresh the reviewed, bundled article excerpts. Never runs in visitors' browsers.
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const selection = {
  zh: ['茶', '自行車', '圖書館', '咖啡', '月球', '太陽', '海洋', '彩虹', '音樂', '植物'],
  en: ['Coffee', 'Bicycle', 'Library', 'Tea', 'Moon', 'Sun', 'Ocean', 'Rainbow', 'Music', 'Plant'],
};
const appendOnly = process.argv.includes('--append');
const existing = appendOnly ? JSON.parse(await readFile(new URL('../src/articles.json', import.meta.url), 'utf8')) : [];
const cachePath = new URL('../artifacts/wikipedia-import-cache.json', import.meta.url);
await mkdir(new URL('../artifacts/', import.meta.url), {recursive:true});
let importCache = [];
if (appendOnly) {
  try { importCache = JSON.parse(await readFile(cachePath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function curateArticle(article) {
  if (article.language === 'zh' && article.displayTitle === '音樂') {
    const start = article.text.indexOf('音樂的主要元素');
    if (start === -1) throw new Error('音樂: review the excerpt before refreshing');
    article.text = article.text.slice(start);
    article.changes = '節錄導言第二段，省略第一段的詞源與希臘文字；移除註腳與換行、合併空白，採臺灣繁體轉換。';
  }
  if (article.language === 'en' && article.displayTitle === 'Plant') {
    article.text = article.text.replace(/\s*\(\/[^)]*\/\)/u, '');
    article.changes = '節錄導言前兩段，省略首句括號內的國際音標；移除註腳與換行、合併空白。';
  }
  return article;
}
async function fetchArticle(endpoint, title) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(endpoint, {
      headers: { 'User-Agent':'ZiJianTypingLocal/0.1 (local educational typing practice)' },
      signal:AbortSignal.timeout(20000),
    });
    if (response.ok) return response.json();
    if (response.status !== 429 && response.status < 500) throw new Error(`${title}: HTTP ${response.status}`);
    const retryAfter = response.headers.get('retry-after');
    const requestedDelay = retryAfter ? Number.isFinite(Number(retryAfter)) ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now() : 0;
    const wait = Math.max(requestedDelay || 0, 10000 * (attempt + 1));
    await response.text();
    if (attempt === 3) throw new Error(`${title}: HTTP ${response.status}; rerun with --append to resume`);
    console.log(`${title}: HTTP ${response.status}, waiting ${Math.ceil(wait / 1000)} seconds before retry`);
    await delay(wait);
  }
}
const articles = [];
for (const [language, titles] of Object.entries(selection)) {
  for (const title of titles) {
    const cached = [...existing, ...importCache].find(a => a.language === language &&
      (a.displayTitle || (a.id === 'zh-9441' ? '圖書館' : a.title)) === title);
    if (cached) { articles.push(curateArticle({ ...cached, displayTitle: title })); continue; }
    const endpoint = new URL(`https://${language}.wikipedia.org/w/api.php`);
    endpoint.search = new URLSearchParams({ action: 'query', prop: 'extracts|revisions',
      exintro: '1', explaintext: '1', rvprop: 'ids', titles: title, redirects: '1',
      format: 'json', formatversion: '2', ...(language === 'zh' ? { variant: 'zh-tw' } : {}) });
    await delay(1200);
    const result = await fetchArticle(endpoint, title);
    const page = result.query?.pages?.[0];
    if (!page?.extract || !page.revisions?.[0]?.revid) throw new Error(`${title}: missing content`);
    const paragraphs = page.extract.split(/\n+/).map(p => p.trim()).filter(p => p.length > 50);
    const text = paragraphs.slice(0, 2).join(' ').replace(/\s+/g, ' ').normalize('NFC');
    articles.push(curateArticle({ id: `${language}-${page.pageid}`, language, title: page.title, displayTitle: title,
      text, revision: page.revisions[0].revid,
      source: `https://${language}.wikipedia.org/${language === 'zh' ? 'zh-tw' : 'wiki'}/${encodeURIComponent(page.title)}`,
      permalink: `https://${language}.wikipedia.org/w/index.php?oldid=${page.revisions[0].revid}${language === 'zh' ? '&variant=zh-tw' : ''}`,
      history: `https://${language}.wikipedia.org/w/index.php?title=${encodeURIComponent(page.title)}&action=history`,
      authors: 'Wikipedia contributors', license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      retrieved: new Date().toISOString().slice(0, 10),
      changes: '節錄導言前兩段，移除註腳與換行、合併空白；中文採臺灣繁體轉換。' }));
    await writeFile(cachePath, JSON.stringify(articles,null,2) + '\n');
    console.log(`${language} / ${page.title}: ${[...text].length} characters, revision ${page.revisions[0].revid}`);
  }
}
await writeFile(new URL('../src/articles.json', import.meta.url), JSON.stringify(articles, null, 2) + '\n');
