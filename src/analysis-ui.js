import { analyzeSessions, demoSessions, keyboardRows } from './analytics.js';
import { loadSessions } from './storage.js';
const copy={
 zh:{demo:'範例資料',mine:'我的紀錄',viewDemo:'看範例',charNote:'依最終錯字對應 US QWERTY 字元位置；不代表實際按下的鍵。',physicalNote:'以 US QWERTY 位置顯示錯題使用過的鍵；這是關聯，不代表該鍵打錯。',sessions:'測驗',records:'題目',unmapped:'未對應字元',legacy:'無鍵位紀錄',empty:'尚無可用資料。完成測驗後開始累積，或查看範例。',select:'點選鍵位查看次數與比例。',errors:'錯誤',samples:'樣本',noData:'無資料',few:'樣本少於 5 次',count:'錯誤次數',rate:'錯誤比例',questions:'錯題次數',questionRate:'錯題比例',pairs:'文字差異',target:'應輸入 → 實際輸出',times:'次數',methodChars:'錯字與漏字計在應輸入字元的鍵位，多打的字計在輸出字元。分母為該鍵對應的全部已比對字元；大小寫共用同一字母鍵，無法推斷 Shift。中文漢字不反推成注音或倉頡。',methodPhysical:'每題每個鍵位至多算一個樣本，未送出的部分答案不納入。分子為使用該鍵且最終答案有錯的題數，分母為使用該鍵的題數。僅使用新版記錄的 KeyboardEvent.code；舊紀錄與缺少鍵位的裝置不補值。',methodScope:'資料範圍：目前瀏覽器最近 50 次已儲存測驗，依練習語言篩選。未完成測驗不計入。範例與個人資料完全分開，不會存入紀錄。'},
 en:{demo:'DEMO DATA',mine:'My history',viewDemo:'View demo',charNote:'Final text errors mapped to US QWERTY character positions; these are not observed physical key presses.',physicalNote:'US QWERTY positions used in incorrect answers. This shows association, not which key caused the mistake.',sessions:'Tests',records:'Answers',unmapped:'Unmapped characters',legacy:'No key data',empty:'No usable data yet. Finish a test or view the demo.',select:'Select a key to inspect its count and rate.',errors:'Errors',samples:'Samples',noData:'No data',few:'Fewer than 5 samples',count:'Error count',rate:'Error rate',questions:'Incorrect answers',questionRate:'Incorrect-answer rate',pairs:'Text differences',target:'Expected → Output',times:'Count',methodChars:'Substitutions and omissions are assigned to the expected character key; extra characters to the output key. The denominator includes all compared characters for that key. Case shares one letter key; Shift is not inferred. Chinese characters are not reverse-mapped to an IME.',methodPhysical:'Each submitted answer contributes at most one sample per key; partial answers are excluded. The numerator is answers using that key that contain a final error; the denominator is all answers using it. Only recorded KeyboardEvent.code data is used; old records and devices without key data are excluded.',methodScope:'Scope: the last 50 saved tests in this browser, filtered by practice language. Unfinished tests are excluded. Demo data stays separate and is never saved.'}
};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function initializeAnalysis({ui='zh',language='zh',document:doc=globalThis.document}={}) {
 const $=s=>doc.querySelector(s),c=copy[ui],dialog=$('#analysis-dialog');
 if(!dialog) return;
 let demo=false,selected=null,result;
 const controls=['#analysis-language','#analysis-source','#analysis-metric'];
 function detail(){
  const item=selected && result.keys[selected];
  $('#key-detail').textContent=item ? `${selected.replace('Key','')}: ${result.source==='physical'?c.questions:c.errors} ${item.errors} / ${c.samples} ${item.attempts} · ${item.attempts ? (item.errors/item.attempts*100).toFixed(1)+'%' : c.noData}${item.attempts>0&&item.attempts<5?' · '+c.few:''}` : c.select;
  $('#keyboard-map').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.code===selected)));
 }
 function render(){
  const lang=$('#analysis-language').value,source=$('#analysis-source').value,metric=$('#analysis-metric').value;
  result=analyzeSessions(demo?demoSessions(lang):loadSessions(),{language:lang,source});
  $('#analysis-metric').querySelector('option[value="count"]').textContent=source==='physical'?c.questions:c.count;
  $('#analysis-metric').querySelector('option[value="rate"]').textContent=source==='physical'?c.questionRate:c.rate;
  $('#analysis-demo').textContent=demo?c.mine:c.viewDemo;
  $('#analysis-note').textContent=(demo?c.demo+' · ':'')+(source==='physical'?c.physicalNote:c.charNote);
  $('#analysis-note').classList.toggle('demo-note',demo);
  $('#analysis-summary').innerHTML=[[c.sessions,result.sessionCount],[c.records,result.recordCount],[source==='physical'?c.legacy:c.unmapped,source==='physical'?result.legacy:result.unmapped]].map(([label,value])=>`<span>${label} <b>${value}</b></span>`).join('');
  const values=Object.values(result.keys).map(k=>metric==='rate'?(k.attempts?k.errors/k.attempts:0):k.errors);
  const observedMaximum=Math.max(0,...values);
  const maximum=metric==='rate'?1:Math.max(1,observedMaximum);
  $('#keyboard-map').innerHTML=keyboardRows.map(row=>`<div class="keyboard-row">${row.map(([code,label,width=1])=>{
   const item=result.keys[code],value=metric==='rate'?(item.attempts?item.errors/item.attempts:0):item.errors;
   const level=item.attempts ? value===0?0:Math.max(1,Math.ceil(value/maximum*4)) : -1;
   const display=item.attempts?(metric==='rate'?Math.round(value*100)+'%':String(value)):'—';
   const title=`${label}: ${result.source==='physical'?c.questions:c.errors} ${item.errors} / ${c.samples} ${item.attempts}${item.attempts>0&&item.attempts<5?' · '+c.few:''}`;
   return `<button type="button" class="heat-key heat-${level}${item.attempts>0&&item.attempts<5?' low-sample':''}" style="flex:${width}" data-code="${code}" aria-pressed="false" title="${escape(title)}"><span>${escape(label)}</span><small>${display}</small></button>`;
  }).join('')}</div>`).join('');
  const scale=metric==='rate'?'0–100%':`0–${observedMaximum}`;
  $('#heat-legend').innerHTML=`<span>${source==='physical'?(metric==='rate'?c.questionRate:c.questions):(metric==='rate'?c.rate:c.count)} · ${scale}</span><span class="heat-swatches" aria-hidden="true">${[0,1,2,3,4].map(i=>`<i class="heat-${i}"></i>`).join('')}</span><span>${c.noData} —</span>`;
  const usable=Object.values(result.keys).some(k=>k.attempts);
  $('#key-detail').textContent=usable?c.select:c.empty;
  if(usable&&selected) detail();
  $('#analysis-pairs').innerHTML=result.pairs.length?`<h3>${c.pairs}</h3><table class="pair-table"><thead><tr><th>${c.target}</th><th>${c.times}</th></tr></thead><tbody>${result.pairs.map(p=>`<tr><td>${escape(p.pair[0]||'∅')} → ${escape(p.pair[1]||'∅')}</td><td>${p.count}</td></tr>`).join('')}</tbody></table>`:'';
  $('#analysis-method').innerHTML=`<p>${source==='physical'?c.methodPhysical:c.methodChars}</p><p>${c.methodScope}</p><p>${ui==='en'?'Each test follows its original scoring mode. Accepted homophones in Chinese word tests are not counted as errors.':'各次測驗沿用當次判分模式；中文單字開啟「同音通過」時，已接受的同音字不計為錯誤。'}</p>`;
 }
 $('#analysis-button').addEventListener('click',()=>{demo=false;selected=null;$('#analysis-language').value=language;$('#analysis-source').value=language==='zh'?'physical':'characters';render();dialog.showModal();});
 controls.forEach(id=>$(id).addEventListener('change',()=>{selected=null;render();}));
 $('#analysis-demo').addEventListener('click',()=>{demo=!demo;selected=null;render();});
 $('#keyboard-map').addEventListener('click',event=>{const button=event.target.closest('[data-code]');if(button){selected=button.dataset.code;detail();}});
}
