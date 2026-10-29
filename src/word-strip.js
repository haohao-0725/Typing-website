import { chars, WORD_PREVIEW_COUNT } from './engine.js';
import { translate } from './i18n.js';

const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

// Shared by the static page and the live controller. The active word is always
// the second cell; only the most recently submitted result is shown to its left.
export function renderWordStrip(upcoming, previous = null, ui = 'zh') {
  const t=(message,params={})=>translate(message,ui,params);
  if (upcoming.length !== WORD_PREVIEW_COUNT) throw new Error('Expected five pending words');
  const status = previous ? previous.comparison.errors ? 'is-wrong' : 'is-correct' : 'is-empty';
  const statusText = t(previous ? previous.comparison.errors ? '× 錯誤' : '✓ 正確' : '上一題');
  const previousTitle = previous ? t('題目：{expected}｜輸入：{actual}',{expected:previous.expected,actual:previous.actual}) : t('完成第一題後顯示結果');
  const prior = `<li class="word-previous ${status}" title="${escapeHtml(previousTitle)}"><span class="word-label">${statusText}</span><strong>${previous ? escapeHtml(previous.expected) : '—'}</strong></li>`;
  const pending = upcoming.map((word, i) => `<li class="${i === 0 ? 'word-current' : 'word-upcoming'}${chars(word).length > 2 ? ' word-long' : ''}"${i === 0 ? ' aria-current="step"' : ''}><span class="word-label">${i === 0 ? t('目前') : String(i).padStart(2,'0')}</span><strong>${escapeHtml(word)}</strong></li>`).join('');
  return `<div class="word-stage" role="region" aria-label="${t('單字題列：上一題、目前題目與後續四題')}" tabindex="0"><ol class="word-queue">${prior}${pending}</ol></div>`;
}
