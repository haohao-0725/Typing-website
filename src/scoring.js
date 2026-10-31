import { chars, compareText } from './engine.js';

export const isHomophoneSession = session => session.language === 'zh' && session.mode === 'words'
  && session.scoringMode === 'homophone' && session.scoringVersion === 2;

// Preserve the verdict made by the original dictionary snapshot. History and
// analytics must not silently re-grade accepted homophones as spelling errors.
export function recordComparison(record, session = {}) {
  const saved = record.comparison;
  if (isHomophoneSession(session) && validSnapshot(record, saved)) return saved;
  return compareText(record.expected, record.actual, { partial: record.partial });
}

function validSnapshot(record, saved) {
  if (!saved || !Array.isArray(saved.operations)) return false;
  const expected = chars(record.expected), actual = chars(record.actual);
  if (saved.operations.length > expected.length + actual.length) return false;
  for (const op of saved.operations) {
    if (!op || typeof op.expected !== 'string' || typeof op.actual !== 'string') return false;
    const a = chars(op.expected).length, b = chars(op.actual).length;
    if (op.type === 'correct') {
      if (a !== 1 || b !== 1 || (op.expected !== op.actual && op.homophone !== true)) return false;
    } else if (op.type === 'substitution') {
      if (a !== 1 || b !== 1 || op.expected === op.actual) return false;
    } else if (op.type === 'missing') {
      if (a !== 1 || b !== 0) return false;
    } else if (op.type === 'extra') {
      if (a !== 0 || b !== 1) return false;
    } else return false;
  }
  const attempted = saved.operations.map(op => op.expected).join('');
  const output = saved.operations.map(op => op.actual).join('');
  const correct = saved.operations.filter(op => op.type === 'correct').length;
  return output === actual.join('') && (record.partial ? expected.join('').startsWith(attempted) : attempted === expected.join(''))
    && saved.correct === correct && saved.total === saved.operations.length
    && saved.errors === saved.total - correct && saved.typed === actual.length;
}
