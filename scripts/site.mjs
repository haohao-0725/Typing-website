import { readFile } from 'node:fs/promises';
import { words } from '../src/words.js';
export const rootDirectory = new URL('../', import.meta.url);
export const routes = ['', 'zh/words/', 'zh/articles/', 'en/words/', 'en/articles/'];
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const articles = JSON.parse(await readFile(new URL('../src/articles.json', import.meta.url), 'utf8'));
const template = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const names = { 'zh/words/': '中文單字', 'zh/articles/': '中文文章', 'en/words/': '英文單字', 'en/articles/': '英文文章' };
const articleName = article => article.id === 'zh-9441' ? '圖書館' : article.title;
export function sourceMarkup(article) {
  return `<div class="source-entry"><h3>${escapeHtml(articleName(article))} <small>／ ${article.language === 'zh' ? '中文' : 'ENGLISH'}</small></h3><p>Wikipedia contributors · CC BY-SA 4.0 · 取得於 ${article.retrieved} · 版本 ${article.revision}</p><div><a href="${escapeHtml(article.source)}" target="_blank" rel="noopener noreferrer">原文 ↗</a><a href="${escapeHtml(article.permalink)}" target="_blank" rel="noopener noreferrer">節錄版本 ↗</a><a href="${escapeHtml(article.history)}" target="_blank" rel="noopener noreferrer">作者與歷史 ↗</a></div></div>`;
}
export function renderPage(route = '', siteUrl = '', sourceTemplate = template) {
  const [language = 'zh', mode = 'words'] = route.split('/').filter(Boolean);
  const root = route ? '../../' : './';
  const name = names[`${language}/${mode}/`];
  const langName = language === 'zh' ? '中文' : '英文';
  const modeName = mode === 'words' ? '單字' : '文章';
  const description = `字間${name}打字測驗：自訂 1–60 分鐘，${mode === 'words' ? '10 題單字預覽，持續補題' : '維基百科文章逐句練習，包含標點符號'}，即時計算速度、正確率並記錄錯字。免註冊，紀錄儲存於瀏覽器。`;
  const localArticles = articles.filter(a => a.language === language);
  const hint = mode === 'words' ? `按 Enter 送出${language === 'en' ? '，也可按空白鍵' : '；中文選字完成後再按一次'}，打錯也能繼續。` : '輸入標示的句子，包含標點；按 Enter 送出並換句。';
  const link = (l, m, text, active) => `<a href="${root}${l}/${m}/"${active ? ' aria-current="page"' : ''}>${text}</a>`;
  let seo = '';
  if (siteUrl) {
    const url = new URL(route || 'zh/words/', siteUrl).href;
    seo = `<link rel="canonical" href="${escapeHtml(url)}"><meta property="og:url" content="${escapeHtml(url)}">`;
  }
  const tokens = {
    root, language, mode, title: `${name}打字測驗・練習速度與正確率｜字間 ZIJIAN`, description, seo,
    practiceTitle: `${langName}打字練習`,
    languageLinks: link('zh', mode, '<span class="lang-icon">中</span> 中文', language === 'zh') + link('en', mode, '<span class="lang-icon">En</span> English', language === 'en'),
    modeLinks: link(language, 'words', '單字練習', mode === 'words') + link(language, 'articles', '文章練習', mode === 'articles'),
    articleHidden: mode === 'words' ? 'hidden' : '',
    articleOptions: localArticles.map(a => `<option value="${a.id}">${escapeHtml(articleName(a))}</option>`).join(''),
    articleSource: `節錄自 Wikipedia · <a href="${escapeHtml(localArticles[0].permalink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(articleName(localArticles[0]))} ↗</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>`,
    initialPrompt: mode === 'words'
      ? `<ol class="word-queue">${words[language].slice(0, 10).map((w, i) => `<li><span>${String(i + 1).padStart(2, '0')}</span><strong>${w}</strong></li>`).join('')}</ol>`
      : `<div class="article-prompts"><p class="active-sentence">${escapeHtml(localArticles[0].text)}</p></div>`,
    inputLabel: mode === 'words' ? '輸入目前的單字' : '輸入目前標示的句子',
    inputPosition: mode === 'words' ? 'WORD 01' : 'SENTENCE 01', hint,
    speedUnit: language === 'zh' ? '字 / 分' : 'WPM',
    modeNote: mode === 'words' ? '送出後自動補上新題目，維持 10 題預覽。錯字會記錄，不會中斷練習。' : '包含大小寫、標點與句內空格。完成一篇後，會接續下一篇文章。',
    seoHeading: `${name}打字測驗，從每天幾分鐘開始。`,
    seoText: mode === 'words' ? `${langName}${modeName}練習適合熟悉鍵盤與輸入法。選擇練習時間，依序輸入預覽的單字，送出後立即補上新題目。測驗結束可以查看打字速度、正確率及每一道題目的正確與錯誤文字，找到下一次練習的方向。` : `${langName}文章練習收錄維基百科的日常知識段落，練習連續輸入、標點與文字節奏。依照標示的句子輸入，按 Enter 換句；測驗結束可以查看速度、正確率與完整錯字紀錄。所有節錄均附上原文來源、版本與授權。`,
    allLinks: Object.entries(names).map(([r, n]) => `<a href="${root}${r}">${n}測驗</a>`).join(''),
    allSources: articles.map(sourceMarkup).join(''),
  };
  return sourceTemplate.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in tokens)) throw new Error(`Unknown template token: ${key}`);
    return tokens[key];
  });
}
