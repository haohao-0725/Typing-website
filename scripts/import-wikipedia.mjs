// Run explicitly to refresh the reviewed, bundled article excerpts. Never runs in visitors' browsers.
import { writeFile } from 'node:fs/promises';

const selection = { zh: ['茶', '自行車', '圖書館'], en: ['Coffee', 'Bicycle', 'Library'] };
const articles = [];
for (const [language, titles] of Object.entries(selection)) {
  for (const title of titles) {
    const endpoint = new URL(`https://${language}.wikipedia.org/w/api.php`);
    endpoint.search = new URLSearchParams({ action: 'query', prop: 'extracts|revisions',
      exintro: '1', explaintext: '1', rvprop: 'ids', titles: title, redirects: '1',
      format: 'json', formatversion: '2', ...(language === 'zh' ? { variant: 'zh-tw' } : {}) });
    const response = await fetch(endpoint, {
      headers: { 'User-Agent': 'ZiJianTypingLocal/0.1 (local educational typing practice)' },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`${title}: HTTP ${response.status}`);
    const result = await response.json();
    const page = result.query?.pages?.[0];
    if (!page?.extract || !page.revisions?.[0]?.revid) throw new Error(`${title}: missing content`);
    const paragraphs = page.extract.split(/\n+/).map(p => p.trim()).filter(p => p.length > 50);
    const text = paragraphs.slice(0, 2).join(' ').replace(/\s+/g, ' ').normalize('NFC');
    articles.push({ id: `${language}-${page.pageid}`, language, title: page.title,
      text, revision: page.revisions[0].revid,
      source: `https://${language}.wikipedia.org/${language === 'zh' ? 'zh-tw' : 'wiki'}/${encodeURIComponent(page.title)}`,
      permalink: `https://${language}.wikipedia.org/w/index.php?oldid=${page.revisions[0].revid}${language === 'zh' ? '&variant=zh-tw' : ''}`,
      history: `https://${language}.wikipedia.org/w/index.php?title=${encodeURIComponent(page.title)}&action=history`,
      authors: 'Wikipedia contributors', license: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
      retrieved: new Date().toISOString().slice(0, 10),
      changes: '節錄導言前兩段，移除註腳與換行、合併空白；中文採臺灣繁體轉換。' });
    console.log(`${language} / ${page.title}: ${[...text].length} characters, revision ${page.revisions[0].revid}`);
  }
}
await writeFile(new URL('../src/articles.json', import.meta.url), JSON.stringify(articles, null, 2) + '\n');
