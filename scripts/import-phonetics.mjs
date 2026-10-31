// Maintainer-only import. Runtime and CI use the committed, compact snapshot.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { words } from '../src/words.js';

const revision = '18e2060dd5d0b511753ad79a8fe0d112e944f1af';
const base = `https://raw.githubusercontent.com/openvanilla/McBopomofo/${revision}/`;
const sha256 = text => createHash('sha256').update(text).digest('hex');
const files = ['Source/Data/BPMFBase.txt', 'Source/Data/BPMFMappings.txt', 'LICENSE.txt'];
const sources = await Promise.all(files.map(async path => {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`Download failed: ${path}: ${response.status}`);
  const text = await response.text();
  return { path, text, sha256: sha256(text) };
}));
const han = /^\p{Script=Han}$/u;
const syllable = /^[ㄅ-ㄩ]+[ˊˇˋ˙]?$/u;
const characters = new Map(), phrases = new Map();
for (const line of sources[0].text.split(/\r?\n/)) {
  const [character, reading] = line.trim().split(/\s+/);
  if (!han.test(character) || !syllable.test(reading)) continue;
  if (!characters.has(character)) characters.set(character, new Set());
  characters.get(character).add(reading);
}
const bank = new Set(words.zh);
for (const line of sources[1].text.split(/\r?\n/)) {
  const [word, ...readings] = line.trim().split(/\s+/);
  if (!bank.has(word)) continue;
  if ([...word].length !== readings.length || !readings.every(r => syllable.test(r))) throw new Error(`Invalid phrase: ${line}`);
  if (!phrases.has(word)) phrases.set(word, new Set());
  phrases.get(word).add(readings.join(' '));
}
const dictionaryCount = phrases.size;
const overridesText = (await readFile(new URL('../data/phonetic-overrides.json', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const overrides = JSON.parse(overridesText);
for (const [word, readings] of Object.entries(overrides)) {
  if (!bank.has(word) || !readings.length || readings.some(r => r.split(' ').length !== [...word].length || !r.split(' ').every(s => syllable.test(s)))) {
    throw new Error(`Invalid editorial reading: ${word}`);
  }
  phrases.set(word, new Set(readings));
}
for (const word of bank) {
  if (!phrases.has(word)) throw new Error(`Missing phrase reading; review data/phonetic-overrides.json: ${word}`);
  if ([...word].some(c => !characters.has(c))) throw new Error(`Missing character: ${word}`);
}
// Numbered syllables reduce download size; tone marks are retained in the table.
const syllables = [...new Set([...characters.values()].flatMap(r => [...r]).concat([...phrases.values()].flatMap(r => [...r].flatMap(s => s.split(' ')))))].sort();
const ids = new Map(syllables.map((value, index) => [value, index]));
const characterReadings = Object.fromEntries([...characters].sort(([a], [b]) => a < b ? -1 : 1).map(([c, r]) => [c, [...r].map(s => ids.get(s)).sort((a,b) => a-b)]));
const wordReadings = Object.fromEntries(words.zh.map(word => [word, [...phrases.get(word)].sort().map(r => r.split(' ').map(s => ids.get(s)))]));
const version = `mcbopomofo-${revision.slice(0, 12)}-${sha256(overridesText).slice(0, 12)}`;
const output = '// Generated phonetic DATA. Prompt selection/editorial additions: CC BY-SA 4.0.\n' +
  '// Underlying McBopomofo readings: MIT; phrase origins libtabe: BSD.\n' +
  '// See public/phonetic-sources.json and public/licenses/mcbopomofo-notice.txt.\n' +
  `export const phoneticData = ${JSON.stringify({ version, syllables, characters: characterReadings, words: wordReadings })};\n`;
await mkdir(new URL('../public/licenses/', import.meta.url), { recursive: true });
await writeFile(new URL('../src/phonetic-data.js', import.meta.url), output);
await writeFile(new URL('../public/licenses/mcbopomofo-notice.txt', import.meta.url),
  `McBopomofo pronunciation data\nSource: https://github.com/openvanilla/McBopomofo/tree/${revision}/Source/Data\n\n` +
  'BPMFBase.txt: Han character readings. BPMFMappings.txt: readings for the 5,000 Chinese prompts.\n' +
  'Converted to numbered syllable tables, deduplicated, and supplemented with editorial prompt readings.\n' +
  'Compiled prompt selection and editorial additions: CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/\n' +
  'The prompt selection uses the existing word bank; see public/word-sources.json for its source notices.\n' +
  'The upstream Data/README.md identifies the phrase mappings as derived from libtabe tsi.src (BSD).\n' +
  'See libtabe-notice.txt for the retained upstream notices.\n\n' + sources[2].text);
await writeFile(new URL('../public/phonetic-sources.json', import.meta.url), JSON.stringify({
  version, revision, repository: 'https://github.com/openvanilla/McBopomofo',
  license: 'CC BY-SA 4.0 (compiled prompt selection and editorial additions)',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  licenses: ['CC BY-SA 4.0 (prompt selection and editorial additions)', 'MIT (McBopomofo)', 'BSD (libtabe phrase origins)'],
  promptSources: 'public/word-sources.json',
  notices: ['public/licenses/mcbopomofo-notice.txt', 'public/licenses/libtabe-notice.txt'],
  sources: sources.map(({path, sha256}) => ({url: base + path, sha256})),
  editorialReadings: { path: 'data/phonetic-overrides.json', sha256: sha256(overridesText), count: Object.keys(overrides).length },
  counts: { characters: characters.size, words: bank.size, dictionaryWords: dictionaryCount, syllables: syllables.length },
  generatedDataSha256: sha256(output),
  changes: 'Han-only character mappings; complete reading sequences for existing Chinese word prompts; tone marks retained; numbered syllable IDs; editorial readings override missing or reviewed prompts. No runtime API calls.'
}, null, 2) + '\n');
console.log(`Phonetic snapshot: ${characters.size} characters, ${phrases.size} prompts (${dictionaryCount} upstream), ${Buffer.byteLength(output)} bytes`);
