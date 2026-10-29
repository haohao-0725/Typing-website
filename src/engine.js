const segmenter = new Intl.Segmenter('zh-Hant', { granularity: 'grapheme' });
export const chars = value => [...segmenter.segment(String(value).normalize('NFC'))].map(s => s.segment);

// A single edit should not make all following characters wrong. Align committed text
// using edit distance, counting substitutions, insertions and missing characters separately.
export function compareText(expected, actual, { partial = false } = {}) {
  const a = chars(expected), b = chars(actual);
  const rows = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        rows[i - 1][j] + 1, rows[i][j - 1] + 1);
    }
  }
  let i = a.length, j = b.length;
  if (partial) {
    // At timeout, the untouched suffix is not a mistake. Prefer a longer prefix on ties.
    i = Math.min(b.length, a.length);
    for (let k = 0; k <= a.length; k++) if (rows[k][j] <= rows[i][j]) i = k;
  }
  const operations = [];
  while (i || j) {
    if (i && j && rows[i][j] === rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      operations.push({ type: a[i - 1] === b[j - 1] ? 'correct' : 'substitution', expected: a[--i], actual: b[--j] });
    } else if (i && rows[i][j] === rows[i - 1][j] + 1) {
      operations.push({ type: 'missing', expected: a[--i], actual: '' });
    } else {
      operations.push({ type: 'extra', expected: '', actual: b[--j] });
    }
  }
  operations.reverse();
  const correct = operations.filter(op => op.type === 'correct').length;
  return { correct, errors: operations.length - correct, total: operations.length,
    typed: b.length, operations };
}

export function summarize(records, elapsedSeconds, language) {
  const total = records.reduce((n, r) => n + r.comparison.total, 0);
  const correct = records.reduce((n, r) => n + r.comparison.correct, 0);
  const errors = total - correct;
  const typed = records.reduce((n, r) => n + r.comparison.typed, 0);
  const minutes = Math.max(elapsedSeconds, 0.001) / 60;
  return { correct, errors, total, typed,
    accuracy: total ? Math.round(correct / total * 1000) / 10 : 0,
    speed: Math.round((correct / (language === 'en' ? 5 : 1)) / minutes * 10) / 10,
    grossSpeed: Math.round((typed / (language === 'en' ? 5 : 1)) / minutes * 10) / 10 };
}

export function splitSentences(text, language) {
  return [...new Intl.Segmenter(language === 'zh' ? 'zh-Hant' : 'en', { granularity: 'sentence' }).segment(text)]
    .map(s => s.segment.trim()).filter(Boolean);
}

export function shuffled(values, random = Math.random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const WORD_PREVIEW_COUNT = 5;

export class WordQueue {
  constructor(values, random = Math.random) {
    this.values = [...new Set(values)];
    if (this.values.length < WORD_PREVIEW_COUNT) throw new Error('Word bank requires at least 5 unique entries');
    this.random = random; this.bag = [];
    this.queue = Array.from({ length: WORD_PREVIEW_COUNT }, () => this.next());
  }
  next() {
    if (!this.bag.length) this.bag = shuffled(this.values, this.random);
    return this.bag.pop();
  }
  advance() { this.queue.shift(); this.queue.push(this.next()); }
}

export const remainingMilliseconds = (deadline, now) => Math.max(0, deadline - now);

export function validateMinutes(value) {
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 60 ? minutes : null;
}
