import { readFile } from 'node:fs/promises';
import { words } from '../src/words.js';
import { renderWordStrip } from '../src/word-strip.js';
import { WORD_PREVIEW_COUNT } from '../src/engine.js';
import { translate, translateMarkup } from '../src/i18n.js';
import { appendixMarkup } from './appendix.mjs';
export const rootDirectory = new URL('../', import.meta.url);
export const practiceRoutes = ['zh/words/', 'zh/articles/', 'en/words/', 'en/articles/'];
export const routes = ['', ...practiceRoutes, 'en-ui/', ...practiceRoutes.map(route=>'en-ui/'+route)];
export const siteConfig = JSON.parse(await readFile(new URL('../site.config.json',import.meta.url),'utf8'));
export const escapeHtml = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const articles = JSON.parse(await readFile(new URL('../src/articles.json',import.meta.url),'utf8'));
const template = await readFile(new URL('../index.html',import.meta.url),'utf8');
const articleName = a => a.displayTitle || (a.id==='zh-9441'?'圖書館':a.title);
export function routeContext(route='') {
 if(!routes.includes(route)) throw new Error('Unknown route');
 const ui=route.startsWith('en-ui/')?'en':'zh';
 const content=ui==='en'?route.slice(6):route;
 const [language='zh',mode='words']=content.split('/').filter(Boolean);
 return {ui,language,mode,practiceRoute:language+'/'+mode+'/',uiPrefix:ui==='en'?'en-ui/':'',root:route?'../'.repeat(route.split('/').filter(Boolean).length):'./'};
}
export function sourceMarkup(article,ui='zh') {
 const t=(s,p={})=>translate(s,ui,p);
 return '<div class="source-entry"><h3>'+escapeHtml(articleName(article))+' <small>／ '+(article.language==='zh'?t('中文'):'English')+'</small></h3><p>Wikipedia contributors · CC BY-SA 4.0 · '+escapeHtml(t('取得於 {date} · 版本 {revision}',{date:article.retrieved,revision:article.revision}))+'</p><p>'+escapeHtml(t(article.changes))+'</p><div>'+[['原文',article.source],['節錄版本',article.permalink],['作者與歷史',article.history]].map(([label,url])=>'<a href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">'+t(label)+' ↗</a>').join('')+'</div></div>';
}
export function renderPage(route='',siteUrl='',sourceTemplate=template) {
 const {ui,language,mode,practiceRoute,uiPrefix,root}=routeContext(route);
 const t=(s,p={})=>translate(s,ui,p);
 const langName=t(language==='zh'?'中文':'英文');
 const modeName=t(mode==='words'?'單字':'文章');
 const practiceTitle=ui==='en'?langName+' typing practice':langName+'打字練習';
 const title=ui==='en'?langName+' '+(mode==='words'?'word':'passage')+' typing test | ZIJIAN':langName+modeName+'打字練習與測驗｜字間 ZIJIAN';
 const description=ui==='en'?'Free '+langName.toLowerCase()+' typing practice with 5,000 words, 10 Wikipedia passages, custom timed tests, accuracy results and a keyboard error heatmap. No account required.':'免費'+langName+'打字練習與測驗：5,000 個單字、10 篇維基百科文章，自訂 1–60 分鐘，記錄速度、正確率與鍵盤錯誤熱圖。免註冊，紀錄留在瀏覽器。';
 const localArticles=articles.filter(a=>a.language===language);
 const link=(l,m,text,active)=>'<a href="'+root+uiPrefix+l+'/'+m+'/"'+(active?' aria-current="page"':'')+'>'+text+'</a>';
 let seo='';
 if(siteUrl) {
  const canonical=new URL(uiPrefix+practiceRoute,siteUrl).href;
  seo='<link rel="canonical" href="'+escapeHtml(canonical)+'"><meta property="og:url" content="'+escapeHtml(canonical)+'">';
  for(const [locale,prefix] of [['zh-Hant',''],['en','en-ui/'],['x-default','']]) seo+='<link rel="alternate" hreflang="'+locale+'" href="'+escapeHtml(new URL(prefix+practiceRoute,siteUrl).href)+'">';
  const schema={'@context':'https://schema.org','@type':'WebApplication',name:'字間 ZIJIAN',url:canonical,description,applicationCategory:'EducationalApplication',operatingSystem:'Web browser',isAccessibleForFree:true,inLanguage:['zh-Hant','en']};
  seo+='<script type="application/ld+json">'+JSON.stringify(schema).replace(/</g,'\\u003c')+'</script>';
 }
 const verification=process.env.GOOGLE_SITE_VERIFICATION || siteConfig.googleSiteVerification;
 if(verification) seo+='<meta name="google-site-verification" content="'+escapeHtml(verification)+'">';
 const faq=ui==='en'?[
  ['How is typing speed calculated?','Chinese CPM is correct characters per minute. English WPM uses five correct characters per word. Punctuation and spaces within sentences count.'],
  ['Can I practice Chinese with an English interface?','Yes. Interface language and practice language are independent. Chinese prompts use traditional characters and support IME composition.'],
  ['Where are my results stored?','The last 50 tests and aggregate key counts stay in this browser. They are not uploaded. Clear them in History or download a JSON result.']
 ]:[
  ['打字速度怎麼算？','中文以每分鐘正確字元數（CPM）計算；英文每五個正確字元折算一個標準單字（WPM）。文章標點與句內空格也計分。'],
  ['英文介面可以練中文嗎？','可以。介面語言與練習語言分開切換；中文題目使用繁體字，支援輸入法組字與選字。'],
  ['成績與鍵盤紀錄儲存在哪裡？','最近 50 次測驗與鍵位累計次數只留在目前瀏覽器，不上傳。可在紀錄頁清除，或下載單次 JSON。']
 ];
 const tokens={themeDark:t('切換深色模式'),themeLight:t('切換淺色模式'),root,ui,language,mode,uiPrefix,htmlLang:ui==='en'?'en':'zh-Hant-TW',title,description,seo,practiceTitle,
  bankCount:t(mode==='words'?'共 {count} 詞':'共 {count} 篇',{count:new Intl.NumberFormat(ui==='en'?'en-US':'zh-TW').format(mode==='words'?words[language].length:localArticles.length)}),
  uiLinks:[['zh','繁中',''],['en','EN','en-ui/']].map(([locale,label,prefix])=>'<a href="'+root+prefix+practiceRoute+'"'+(ui===locale?' aria-current="page"':'')+'>'+label+'</a>').join(''),
  languageLinks:link('zh',mode,t('中文'),language==='zh')+link('en',mode,'English',language==='en'),
  modeLinks:link(language,'words',t('單字練習'),mode==='words')+link(language,'articles',t('文章練習'),mode==='articles'),
  articleHidden:mode==='words'?'hidden':'',
  articleOptions:localArticles.map(a=>'<option value="'+a.id+'">'+escapeHtml(articleName(a))+'</option>').join(''),
  articleSource:t('來源：Wikipedia')+' · <a href="'+escapeHtml(localArticles[0].permalink)+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(articleName(localArticles[0]))+' ↗</a> · CC BY-SA 4.0',
  initialPrompt:mode==='words'?renderWordStrip(words[language].slice(0,WORD_PREVIEW_COUNT),null,ui):'<div class="article-prompts"><p class="active-sentence">'+escapeHtml(localArticles[0].text)+'</p></div>',
  inputLabel:t(mode==='words'?'輸入單字':'輸入標示的句子'),inputPosition:mode==='words'?'WORD 01':'SENTENCE 01',
  hint:t(mode==='articles'?'Enter 換句；標點與空格也計分。':language==='zh'?'Enter 送出；中文選字完成後再按一次。':'Enter 或空白鍵送出。'),
  speedUnit:language==='zh'?t('字／分'):'WPM',
  faq:faq.map(([question,answer])=>'<h2>'+question+'</h2><p>'+answer+'</p>').join(''),
  wordSources:'<h3>'+t('單字')+'</h3><p>'+t('中英文各 5,000 個去重詞彙。詞庫資料以 CC BY-SA 4.0 提供，程式碼授權與資料分開管理。')+'</p><p>'+t('保留原始編選詞彙；中文使用 CC-CEDICT 正體詞條，依 wordfreq 詞頻選取；英文由 wordfreq 選取並去重。')+'</p><p><a href="'+root+'public/word-sources.json" target="_blank" rel="noopener noreferrer">'+t('查看完整詞庫來源與授權')+' ↗</a> · <a href="'+root+'public/licenses/cc-cedict-notice.txt" target="_blank" rel="noopener noreferrer">CC-CEDICT</a> · <a href="'+root+'public/licenses/wordfreq-notice.md" target="_blank" rel="noopener noreferrer">wordfreq</a></p>',
  allSources:articles.map(a=>sourceMarkup(a,ui)).join(''),
  appendix:appendixMarkup(ui)
 };
 return translateMarkup(sourceTemplate,ui).replace(/\{\{(\w+)\}\}/g,(_,key)=>{if(!(key in tokens))throw new Error('Unknown template token: '+key);return tokens[key];});
}
