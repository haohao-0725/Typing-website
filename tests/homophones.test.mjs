import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { compareText } from '../src/engine.js';
import { words } from '../src/words.js';
import { phoneticData } from '../src/phonetic-data.js';
import { compareHomophones, phoneticDataVersion } from '../src/phonetics.js';
import { recordComparison } from '../src/scoring.js';
import { analyzeSessions } from '../src/analytics.js';
import { renderPage, routes, routeContext } from '../scripts/site.mjs';

const session = { language: 'zh', mode: 'words', scoringMode: 'homophone', scoringVersion: 2, phoneticDataVersion };
const record = (expected, actual, options = {}) => ({ expected, actual, ...options, comparison: compareHomophones(expected, actual, options) });

test('homophones are accepted with tones; exact spelling remains the default', () => {
  assert.equal(compareText('地獄', '地域').errors, 1);
  assert.equal(compareHomophones('地獄', '地域').errors, 0);
  assert.equal(compareHomophones('地獄', '抵域').errors, 1);
  assert.equal(compareHomophones('地獄', '地域').operations[1].homophone, true);
  assert.deepEqual(compareHomophones('地獄', '地獄'), compareText('地獄', '地獄'));
});

test('target readings follow the whole word while output characters may have multiple readings', () => {
  assert.equal(compareHomophones('銀行', '銀航').errors, 0);
  assert.equal(compareHomophones('銀行', '銀型').errors, 1);
  assert.equal(compareHomophones('音樂', '因月').errors, 0);
  assert.equal(compareHomophones('音樂', '因勒').errors, 1);
  assert.equal(compareHomophones('快樂', '塊勒').errors, 0);
  assert.equal(compareHomophones('行走', '型走').errors, 0);
  assert.equal(compareHomophones('行走', '航走').errors, 1);
  assert.equal(compareHomophones('平臺', '平台').errors, 0); // editorial reading
});

test('homophone alignment still counts missing, extra, unknown and non-Han characters', () => {
  assert.equal(compareHomophones('地獄', '地域域').errors, 1);
  assert.equal(compareHomophones('音樂', '月').errors, 1);
  assert.equal(compareHomophones('音樂', '因').errors, 1);
  assert.equal(compareHomophones('音樂', '因', { partial: true }).errors, 0);
  assert.equal(compareHomophones('音樂', '因x', { partial: true }).errors, 1);
  assert.equal(compareHomophones('地獄', '', { partial: true }).total, 0);
  for (const actual of ['地ㄩˋ', '地👩‍💻', '地域，']) assert.ok(compareHomophones('地獄', actual).errors > 0);
  assert.equal(compareHomophones('，', ',').errors, 1);
  assert.equal(compareHomophones('abc', 'ABC').errors, 3);
});

test('history preserves original homophone verdicts, scoped to versioned Chinese word sessions', () => {
  const answer = record('地獄', '地域');
  assert.equal(recordComparison(JSON.parse(JSON.stringify(answer)), session).errors, 0);
  assert.equal(recordComparison(answer, { ...session, phoneticDataVersion: 'later-dictionary' }).errors, 0);
  for (const change of [{ mode: 'articles' }, { language: 'en' }, { scoringMode: 'exact' }, { scoringVersion: 1 }]) {
    assert.equal(recordComparison(answer, { ...session, ...change }).errors, 1);
  }
  assert.equal(recordComparison(answer).errors, 1);
  assert.equal(recordComparison({ ...answer, actual: '抵域' }, session).errors, 2);
  assert.equal(recordComparison({ ...answer, comparison: { ...answer.comparison, errors: 99 } }, session).errors, 1);
  const partial = record('音樂', '因', { partial: true });
  assert.equal(recordComparison(partial, session).errors, 0);
});

test('analytics respects the original scoring mode and does not count accepted homophones as errors', () => {
  const answer = { ...record('地獄', '地域'), keyUsage: { KeyJ: 2 }, keyUsageVersion: 1 };
  const phoneticSession = { ...session, records: [answer] };
  const physical = analyzeSessions([phoneticSession], { language: 'zh', source: 'physical' });
  assert.deepEqual(physical.keys.KeyJ, { attempts: 1, errors: 0, presses: 2 });
  assert.equal(physical.pairs.length, 0);
  const mixed = analyzeSessions([phoneticSession, { ...session, scoringMode: 'exact', records: [answer] }], { language: 'zh', source: 'physical' });
  assert.deepEqual(mixed.keys.KeyJ, { attempts: 2, errors: 1, presses: 4 });
  assert.deepEqual(mixed.pairs[0], { pair: ['獄', '域'], count: 1 });
});

test('the option is unchecked and appears only in Chinese word routes, in either interface language', () => {
  for (const route of routes) {
    const { language, mode, ui } = routeContext(route), html = renderPage(route);
    const option = html.match(/<input[^>]+id="homophone-option"[^>]*>/)?.[0];
    if (language === 'zh' && mode === 'words') {
      assert.ok(option); assert.ok(!/\schecked(?:\s|=|>)/.test(option));
      assert.ok(html.includes(ui === 'en' ? 'Accept homophones' : '同音通過'));
      assert.ok(html.includes('aria-describedby="homophone-description"'));
    } else assert.equal(option, undefined);
  }
});

test('the committed pronunciation snapshot covers every prompt and has attributable reproducible sources', async () => {
  assert.deepEqual(Object.keys(phoneticData.words), words.zh);
  for (const word of words.zh) {
    assert.ok(phoneticData.words[word].length > 0, word);
    for (const reading of phoneticData.words[word]) {
      assert.equal(reading.length, [...word].length, word);
      assert.ok(reading.every(id => Number.isInteger(id) && phoneticData.syllables[id]), word);
    }
    for (const c of word) assert.ok(phoneticData.characters[c]?.length, c);
  }
  assert.ok(Object.keys(phoneticData.characters).every(c => /^\p{Script=Han}$/u.test(c)));
  const manifest = JSON.parse(await readFile(new URL('../public/phonetic-sources.json', import.meta.url)));
  assert.equal(manifest.version, phoneticDataVersion);
  const data = (await readFile(new URL('../src/phonetic-data.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  assert.equal(createHash('sha256').update(data).digest('hex'), manifest.generatedDataSha256);
  for (const notice of manifest.notices) assert.ok((await readFile(new URL('../' + notice, import.meta.url), 'utf8')).includes('Copyright'));
});
