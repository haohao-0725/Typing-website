import { chars, compareText } from './engine.js';
import { phoneticData } from './phonetic-data.js';

export const phoneticDataVersion = phoneticData.version;

export function compareHomophones(expected, actual, { partial = false } = {}) {
  let best = compareText(expected, actual, { partial });
  if (!best.errors || !Object.hasOwn(phoneticData.words, expected.normalize('NFC'))) return best;
  const outputReadings = chars(actual).map(c => phoneticData.characters[c] || []);
  // Test each complete word reading separately, rather than mixing pronunciations
  // from unrelated readings of its constituent characters (e.g. 銀行 / 行走).
  for (const reading of phoneticData.words[expected.normalize('NFC')]) {
    const comparison = compareText(expected, actual, { partial,
      equivalent: (_a, _b, i, j) => outputReadings[j].includes(reading[i]) });
    if (comparison.errors < best.errors || (comparison.errors === best.errors && comparison.correct > best.correct)) best = comparison;
  }
  return best;
}
