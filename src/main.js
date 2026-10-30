import { words } from './words.js';
import { WordQueue, chars, compareText, summarize, splitSentences, remainingMilliseconds, validateMinutes } from './engine.js';
import { loadSessions, saveSession, clearSessions, deleteSession } from './storage.js';
import { renderWordStrip } from './word-strip.js';
import { translate } from './i18n.js';
import { recordKey } from './analytics.js';
import { initializeAnalysis } from './analysis-ui.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const language = document.body.dataset.language;
const mode = document.body.dataset.mode;
const input = $('#typing-input');
const ui = document.body.dataset.ui || 'zh';
const t = (message, parameters={}) => translate(message, ui, parameters);
let draftKeyUsage = {};
const articleName = article => article.displayTitle || (article.id === 'zh-9441' ? '圖書館' : article.title);
let articleLibrary = [];
let queue, minutes = 3, phase = 'ready', deadline = 0, startedAt = 0;
let records = [], composing = false, committedDraft = '', composingStartValue = '';
let compositionJustEnded = false, interval, toastTimeout, selectedArticle = 0, sentenceIndex = 0;
let sentences = [], previousSentence = '', currentResult = null;
let articleLoading = mode === 'articles';
let pendingDeleteId = null;

function toast(message) {
  $('#toast').textContent = message; $('#toast').hidden = false;
  clearTimeout(toastTimeout); toastTimeout = setTimeout(() => { $('#toast').hidden = true; }, 3500);
}
function openDialog(id) { const dialog = document.getElementById(id); if (!dialog.open) dialog.showModal(); }
function closeDialog(id) { document.getElementById(id).close(); }
function timeLabel(seconds) {
  const value = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
function elapsed() { return phase === 'running' ? Math.min(minutes * 60, (Date.now() - startedAt) / 1000) : 0; }
function target() { return mode === 'words' ? queue.queue[0] : sentences[sentenceIndex] || ''; }

function setLocked(locked) {
  $$('.segmented a, .ui-language a').forEach(a => {
    if (locked) a.setAttribute('aria-disabled', 'true'); else a.removeAttribute('aria-disabled');
  });
  $$('.duration-options button').forEach(b => { b.disabled = locked; });
  $('#article-picker').disabled = locked || articleLoading;
}
function begin() {
  if (phase !== 'ready' || articleLoading) return;
  phase = 'running'; startedAt = Date.now(); deadline = startedAt + minutes * 60000;
  setLocked(true); $('#status-text').textContent = t('測驗中');
  $('#status-dot').classList.add('running'); $('#shuffle-label').textContent = t('重新開始');
  $('#start-button').textContent = t('結束');
  $('#start-note').textContent = '';
  interval = setInterval(tick, 100); tick();
}
function tick() {
  if (phase !== 'running') return;
  const remaining = remainingMilliseconds(deadline, Date.now());
  $('#timer').textContent = timeLabel(remaining / 1000);
  $('#timer').classList.toggle('urgent', remaining <= 10000);
  $('#timer-progress').style.width = `${remaining / (minutes * 60000) * 100}%`;
  if (remaining <= 0) { finish('timeout'); return; }
  updateStats();
}
function makeRecord(actual, partial = false) {
  return { expected: target(), actual: actual.normalize('NFC'), partial, keyUsage: {...draftKeyUsage}, keyUsageVersion: 1,
    comparison: compareText(target(), actual, { partial }),
    elapsed: Math.round(Math.min(minutes * 60, (Date.now() - startedAt) / 1000) * 1000) / 1000,
    ...(mode === 'articles' ? { articleId: articleLibrary[selectedArticle].id, articleTitle: articleName(articleLibrary[selectedArticle]), sentence: sentenceIndex + 1 } : {}) };
}
function currentRecords() {
  const draft = composing ? composingStartValue : committedDraft;
  return phase === 'running' && draft ? [...records, makeRecord(draft, true)] : records;
}
function updateStats() {
  const stats = summarize(currentRecords(), elapsed(), language);
  const hasTyped = stats.total > 0;
  $('#live-speed').textContent = hasTyped && elapsed() >= 1 ? Math.round(stats.speed).toString() : '—';
  $('#live-accuracy').textContent = hasTyped ? stats.accuracy.toFixed(1) : '—';
  $('#live-correct').textContent = stats.correct; $('#live-errors').textContent = stats.errors;
}
function renderWords() {
  $('#prompt-area').innerHTML = renderWordStrip(queue.queue, records.at(-1) || null, ui);
  $('#input-position').textContent = `WORD ${String(records.filter(r => !r.partial).length + 1).padStart(2, '0')}`;
}
function renderArticle() {
  if (!articleLibrary.length) return;
  const current = chars(target());
  const typed = composing ? chars(composingStartValue) : chars(committedDraft);
  const active = current.map((c, i) => `<span class="${i < typed.length ? c === typed[i] ? 'correct' : 'wrong' : i === typed.length ? 'cursor' : ''}">${escapeHtml(c)}</span>`).join('');
  const next = sentences.slice(sentenceIndex + 1, sentenceIndex + 2).join(' ');
  $('#prompt-area').innerHTML = `<div class="article-prompts">${previousSentence ? `<p class="past-sentence">${escapeHtml(previousSentence)}</p>` : ''}<p class="active-sentence">${active}</p>${next ? `<p class="next-sentence">${escapeHtml(next)}</p>` : ''}</div>`;
  const readingArea = $('.article-prompts');
  const cursor = $('.active-sentence .cursor') || $('.active-sentence span:last-child');
  if (cursor && readingArea) {
    const areaBounds = readingArea.getBoundingClientRect();
    const cursorBounds = cursor.getBoundingClientRect();
    if (cursorBounds.bottom > areaBounds.bottom - 25) readingArea.scrollTop += cursorBounds.bottom - areaBounds.bottom + 45;
  }
  $('#input-position').textContent = `SENTENCE ${String(sentenceIndex + 1).padStart(2, '0')}`;
  $('#sentence-counter').textContent = t('{current} / {total} 句',{current:sentenceIndex+1,total:sentences.length});
  const article = articleLibrary[selectedArticle];
  $('#article-picker').value = article.id;
  $('#article-source').innerHTML = `${t('來源：Wikipedia')} · <a href="${escapeHtml(article.permalink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(articleName(article))} ↗</a> · <a href="${article.licenseUrl}" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>`;
}
function loadArticle(index) {
  selectedArticle = index % articleLibrary.length; sentenceIndex = 0; previousSentence = '';
  sentences = splitSentences(articleLibrary[selectedArticle].text, language); renderArticle();
}
function renderRecent() { $('#recent-words').innerHTML = ''; }
function submit() {
  if (composing || compositionJustEnded || input.disabled || articleLoading) return;
  if (phase === 'running' && Date.now() >= deadline) { finish('timeout'); return; }
  if (!input.value.trim()) { $('#input-feedback').textContent = t('請先輸入文字。'); return; }
  if (phase === 'ready') begin();
  if (phase !== 'running') return;
  committedDraft = input.value;
  const record = makeRecord(committedDraft); records.push(record);
  input.value = ''; committedDraft = ''; draftKeyUsage = {};
  if (mode === 'words') { queue.advance(); renderWords(); }
  else {
    previousSentence = target(); sentenceIndex++;
    if (sentenceIndex >= sentences.length) { loadArticle(selectedArticle + 1); toast(t('已接續下一篇文章。')); }
    else renderArticle();
  }
  $('#input-feedback').textContent = record.comparison.errors ? t('已記錄 {count} 個錯誤',{count:record.comparison.errors}) : t('✓ 正確');
  renderRecent(); updateStats(); input.focus();
}
function reset() {
  clearInterval(interval); phase = 'ready'; records = []; currentResult = null;
  composing = false; compositionJustEnded = false; committedDraft = ''; composingStartValue = '';
  input.value = ''; draftKeyUsage = {}; input.disabled = articleLoading;
  queue = new WordQueue(words[language]);
  if (mode === 'words') renderWords(); else if (articleLibrary.length) loadArticle(selectedArticle);
  $('#timer').innerHTML = timeLabel(minutes * 60).replace(':', '<span>:</span>');
  $('#timer').classList.remove('urgent'); $('#timer-progress').style.width = '100%';
  $('#live-speed').textContent = '—'; $('#live-accuracy').textContent = '—';
  $('#live-correct').textContent = '0'; $('#live-errors').textContent = '0';
  $('#status-dot').classList.remove('running'); $('#status-text').textContent = t('尚未開始');
  $('#shuffle-label').textContent = t('換一組');
  $('#start-button').textContent = t('開始');
  $('#start-button').disabled = articleLoading;
  $('#submit-button').disabled = articleLoading;
  $('#start-note').textContent = '';
  $('#input-feedback').textContent = ''; setLocked(false); renderRecent();
}
function finish(reason) {
  if (phase !== 'running') return;
  const seconds = reason === 'timeout' ? minutes * 60 : elapsed();
  const draft = composing ? composingStartValue : committedDraft;
  if (draft) records.push(makeRecord(draft, true));
  // Mark finished before blur, which may itself dispatch compositionend.
  phase = 'finished'; clearInterval(interval); composing = false;
  setLocked(false);
  input.blur(); input.disabled = true; input.value = draft;
  $('#status-dot').classList.remove('running'); $('#status-text').textContent = t('已完成');
  $('#timer').textContent = timeLabel(minutes * 60 - seconds);
  $('#timer-progress').style.width = `${Math.max(0, 1 - seconds / (minutes * 60)) * 100}%`;
  $('#start-button').textContent = t('再練一次');
  $('#start-note').textContent = '';
  const stats = summarize(records, seconds, language);
  $('#live-speed').textContent = Math.round(stats.speed);
  $('#live-accuracy').textContent = stats.accuracy.toFixed(1);
  $('#live-correct').textContent = stats.correct; $('#live-errors').textContent = stats.errors;
  currentResult = { id: crypto.randomUUID(), date: new Date().toISOString(), language, mode, minutes,
    elapsed: Math.round(seconds * 1000) / 1000, reason, ...stats, records: [...records],
    scoringVersion: 1, articleSources: mode === 'articles' ? articleLibrary.filter(a => records.some(r => r.articleId === a.id)) : [] };
  const saved = saveSession(currentResult); updateHistoryCount();
  showResult(currentResult, saved ? t('已儲存在此瀏覽器。') : t('無法儲存，請下載當次結果。'));
}

function recordMarkup(record, index) {
 const comparison=compareText(record.expected,record.actual,{partial:record.partial});
 const typed=comparison.operations.map(op=>`<span class="${op.type}" title="${escapeHtml(t(op.type==='missing'?'漏字':op.type==='extra'?'多打':op.type==='substitution'?'應為 {expected}':'正確',{expected:op.expected}))}">${escapeHtml(op.type==='missing'?(op.expected===' '?'␣':op.expected):(op.actual===' '?'␣':op.actual))}</span>`).join('');
 const status=record.partial?t('未送出的部分輸入'):comparison.errors?t('{count} 個錯誤',{count:comparison.errors}):t('全部正確');
 return `<div class="record"><div class="record-label">${index+1} · ${Number(record.elapsed).toFixed(1)}s${record.articleTitle?' · '+escapeHtml(record.articleTitle):''}<span>${status}</span></div><p><small>${t('題目')}</small>${escapeHtml(record.expected)}</p><p><small>${t('輸入')}</small>${typed}</p></div>`;
}
function showResult(result,message=t('已儲存的測驗紀錄。')) {
 currentResult=result;
 $('#result-overline').textContent=`${t(result.language==='zh'?'中文':'英文')} · ${t(result.mode==='words'?'單字':'文章')} · ${t('{minutes} 分鐘',{minutes:result.minutes})}${result.reason==='manual'?' · '+t('提前結束'):''}`;
 const completed=result.records.filter(r=>!r.partial).length;
 $('#result-summary').innerHTML=`<div class="result-stats"><div><span>${t('速度')}</span><strong>${Number(result.speed).toFixed(1)}<small>${result.language==='zh'?t('字／分'):'WPM'}</small></strong></div><div><span>${t('正確率')}</span><strong>${Number(result.accuracy).toFixed(1)}<small>%</small></strong></div><div><span>${t('時間')}</span><strong>${timeLabel(result.elapsed)}</strong></div></div><div class="result-secondary">${[['正確字元',result.correct],['錯誤字元',result.errors],['完整送出',completed],['總輸入字元',result.typed]].map(([label,value])=>`<span>${t(label)} <b>${Number(value)}</b></span>`).join('')}</div>`;
 $('#save-status').textContent=message;
 $('#retry-button').textContent=t(phase==='running'?'繼續目前練習':'再練一次');
 $('#result-records').innerHTML=result.records.length?`<p class="record-key">${t('綠色：正確；紅色：錯字或多打；刪除線：漏字；␣：空格。')}</p>`+result.records.map(recordMarkup).join(''):`<p class="muted">${t('沒有已確認的輸入。')}</p>`;
 $('.result-details').open=false;openDialog('results-dialog');
 // Timeout can interrupt a stream of Enter/Space presses. Start on a neutral
 // heading rather than a button, so those presses cannot dismiss the result.
 $('#results-title').focus();
}
function updateHistoryCount() { $('#history-count').textContent=loadSessions().length; }
function showHistory() {
 const sessions=loadSessions();
 $('#history-feedback').textContent='';
 $('#clear-history-prompt').hidden=true;$('#clear-history').disabled=!sessions.length;
 $('#history-content').innerHTML=sessions.length?`<div class="history-scroll"><table class="history-table"><thead><tr>${['練習時間','內容','速度','正確率','紀錄'].map(label=>`<th>${t(label)}</th>`).join('')}</tr></thead><tbody>${sessions.map((entry,i)=>`<tr><td>${new Intl.DateTimeFormat(ui==='en'?'en-US':'zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(entry.date))}</td><td>${t(entry.language==='zh'?'中文':'英文')} · ${t(entry.mode==='words'?'單字':'文章')}</td><td>${Number(entry.speed).toFixed(1)} ${entry.language==='zh'?t('字／分'):'WPM'}</td><td>${Number(entry.accuracy).toFixed(1)}%</td><td class="history-actions"><button type="button" data-session="${i}">${t('查看')} ↗</button><button type="button" class="danger" data-delete-session="${escapeHtml(entry.id)}">${t('刪除')}</button></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-journal">${t('尚無練習紀錄。')}</div>`;
 openDialog('history-dialog');
}

// Common dialogs keep native keyboard focus trapping and Escape-to-close behavior.
$$('[data-dialog]').forEach(button => button.addEventListener('click', () => openDialog(button.dataset.dialog)));
$$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target === dialog) {
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  }
}));
$$('.segmented a, .ui-language a').forEach(link => link.addEventListener('click', event => {
  if (phase === 'running') { event.preventDefault(); toast(t('請先結束測驗，再切換設定。')); }
}));
$('#start-button').addEventListener('click', () => {
  if (phase === 'running') { finish(Date.now() >= deadline ? 'timeout' : 'manual'); }
  else { if (phase === 'finished') reset(); input.focus(); $('#input-feedback').textContent = t('輸入後開始計時。'); }
});
$('#submit-button').addEventListener('click', submit);
$('#shuffle-button').addEventListener('click', () => {
  if (phase === 'running') openDialog('restart-dialog');
  else { reset(); input.focus(); }
});
$('#confirm-restart').addEventListener('click', () => { closeDialog('restart-dialog'); reset(); input.focus(); });
$('#retry-button').addEventListener('click', () => { closeDialog('results-dialog'); if (phase !== 'running') reset(); input.focus(); });

input.addEventListener('compositionstart', () => {
  if (phase === 'finished') return;
  composingStartValue = committedDraft; composing = true; begin();
});
input.addEventListener('compositionend', () => {
  composing = false;
  if (phase !== 'running') return;
  if (Date.now() >= deadline) { committedDraft = composingStartValue; finish('timeout'); return; }
  committedDraft = input.value; compositionJustEnded = true;
  // Safari can send Enter after compositionend for the same physical key.
  setTimeout(() => { compositionJustEnded = false; }, 50);
  updateStats(); if (mode === 'articles') renderArticle();
});
input.addEventListener('beforeinput', event => {
  if (['insertFromPaste', 'insertFromDrop'].includes(event.inputType)) { event.preventDefault(); toast(t('不接受貼上或拖入文字。')); return; }
  if (phase === 'running' && Date.now() >= deadline) { event.preventDefault(); finish('timeout'); return; }
  if (event.inputType === 'insertLineBreak' && !composing) { event.preventDefault(); submit(); return; }
  if (event.data || event.inputType === 'insertCompositionText') begin();
});
input.addEventListener('input', () => {
  if (composing || phase === 'finished') return;
  if (phase === 'running' && Date.now() >= deadline) { finish('timeout'); return; }
  if (input.value && phase === 'ready') begin();
  committedDraft = input.value;
  $('#input-feedback').textContent = '';
  if (mode === 'articles') renderArticle(); updateStats();
});
input.addEventListener('keydown', event => {
  recordKey(draftKeyUsage, event, {language, mode, phase, expired: phase === 'running' && Date.now() >= deadline});
  if (event.isComposing || composing || event.keyCode === 229 || compositionJustEnded) return;
  if (event.key === 'Enter' || (event.key === ' ' && language === 'en' && mode === 'words')) {
    event.preventDefault(); submit();
  }
});
for (const type of ['paste', 'drop']) input.addEventListener(type, event => { event.preventDefault(); toast(t('不接受貼上或拖入文字。')); });
document.addEventListener('visibilitychange', () => { if (phase === 'running') tick(); });
window.addEventListener('focus', () => { if (phase === 'running') tick(); });
window.addEventListener('beforeunload', event => { if (phase === 'running') { event.preventDefault(); event.returnValue = ''; } });

$$('[data-minutes]').forEach(button => button.addEventListener('click', () => {
  minutes = Number(button.dataset.minutes);
  $$('.duration-options button').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); });
  reset();
}));
$('#custom-button').addEventListener('click', () => {
  $('#custom-minutes').value = minutes; $('#custom-error').textContent = ''; openDialog('custom-dialog'); $('#custom-minutes').focus(); $('#custom-minutes').select();
});
$('#custom-form').addEventListener('submit', event => {
  event.preventDefault(); const value = validateMinutes($('#custom-minutes').value);
  if (!value) { $('#custom-error').textContent = t('請輸入 1 到 60 的整數分鐘。'); return; }
  minutes = value;
  $$('.duration-options button').forEach(b => { b.classList.toggle('selected', b.id === 'custom-button'); b.setAttribute('aria-pressed', String(b.id === 'custom-button')); });
  $('#custom-button').innerHTML = `${value} <span>${t('分鐘')}</span>`; closeDialog('custom-dialog'); reset();
});
$('#article-picker').addEventListener('change', () => { selectedArticle = articleLibrary.findIndex(a => a.id === $('#article-picker').value); reset(); });
$('#history-button').addEventListener('click', showHistory);
$('#history-content').addEventListener('click', event => {
  const remove = event.target.closest('[data-delete-session]');
  if (remove) {
    const session = loadSessions().find(entry => entry.id === remove.dataset.deleteSession);
    if (!session) return;
    pendingDeleteId = session.id;
    $('#delete-session-summary').textContent = `${new Intl.DateTimeFormat(ui==='en'?'en-US':'zh-TW',{dateStyle:'medium',timeStyle:'short'}).format(new Date(session.date))} · ${t(session.language==='zh'?'中文':'英文')} · ${t(session.mode==='words'?'單字':'文章')} · ${session.speed} ${session.language==='zh'?t('字／分'):'WPM'}`;
    openDialog('delete-session-dialog'); $('#cancel-delete-session').focus();
    return;
  }
  const button = event.target.closest('[data-session]');
  if (button) { const session = loadSessions()[Number(button.dataset.session)]; if (session) { closeDialog('history-dialog'); showResult(session); } }
});
$('#delete-session-dialog').addEventListener('close', () => { pendingDeleteId = null; });
$('#confirm-delete-session').addEventListener('click', () => {
  if (!pendingDeleteId) return;
  const deleted = deleteSession(pendingDeleteId);
  closeDialog('delete-session-dialog'); pendingDeleteId = null;
  if (deleted) {
    updateHistoryCount(); showHistory(); $('#history-title').focus(); $('#history-feedback').textContent=t('已移除此筆紀錄。');
  } else $('#history-feedback').textContent=t('無法移除此筆紀錄。');
});
$('#clear-history').addEventListener('click', () => { $('#clear-history-prompt').hidden = false; $('#cancel-clear').focus(); });
$('#cancel-clear').addEventListener('click', () => { $('#clear-history-prompt').hidden = true; $('#clear-history').focus(); });
$('#confirm-clear').addEventListener('click', () => {
  if (clearSessions()) { updateHistoryCount(); showHistory(); toast(t('練習紀錄已清除。')); }
  else toast(t('無法清除紀錄。'));
});
$('#export-button').addEventListener('click', () => {
  if (!currentResult) return;
  const blob = new Blob([JSON.stringify(currentResult, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = `zijian-${currentResult.language}-${currentResult.mode}-${currentResult.id}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
initializeAnalysis({ui,language});
updateHistoryCount(); reset();

if (mode === 'articles') {
  $('#status-text').textContent = t('載入文章中…');
  try {
    const response = await fetch(new URL('./articles.json', import.meta.url));
    if (!response.ok) throw new Error('Article file missing');
    const data = await response.json();
    articleLibrary = data.filter(a => a.language === language);
    if (!articleLibrary.length) throw new Error('No articles');
    articleLoading = false; reset();
  } catch {
    $('#status-text').textContent = t('文章載入失敗，請重新整理。');
    $('#input-feedback').textContent = '';
    $('#start-note').textContent = '';
  }
}
