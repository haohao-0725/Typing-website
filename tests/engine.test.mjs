import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chars, compareText, summarize, WordQueue, splitSentences, remainingMilliseconds, validateMinutes } from '../src/engine.js';
import { words } from '../src/words.js';
import { loadSessions, saveSession, clearSessions } from '../src/storage.js';
import { renderPage, routes } from '../scripts/site.mjs';

test('graphemes count combined accents and emoji once; preserve punctuation width', () => {
  assert.equal(chars('e\u0301👩‍💻中，').length, 4);
  assert.equal(compareText('é', 'e\u0301').correct, 1);
  assert.equal(compareText('，', ',').errors, 1);
});
test('alignment distinguishes substitutions, omissions and additions', () => {
  assert.deepEqual(compareText('春天來了', '春來了').operations.map(x => x.type), ['correct','missing','correct','correct']);
  assert.equal(compareText('keyboard', 'keyxboard').errors, 1);
  assert.equal(compareText('世界', '世果').correct, 1);
  assert.equal(compareText('Hello.', 'hello!').errors, 2);
  assert.equal(compareText('a b', 'ab').errors, 1);
  assert.equal(compareText('abc', '').errors, 3);
});
test('timeout ignores untouched suffix, while explicit submission counts missing text', () => {
  assert.equal(compareText('Hello world.', 'Hello', { partial:true }).errors, 0);
  assert.equal(compareText('Hello world.', 'Hello').errors, 7);
  const partial = compareText('春天來了', '春果', { partial:true });
  assert.equal(partial.correct, 1); assert.equal(partial.errors, 1);
  assert.equal(compareText('abc', '', { partial:true }).total, 0);
});
test('speed and accuracy have consistent Chinese and English units', () => {
  const records = [{ comparison:compareText('abcdefghij', 'abcxefghij') }];
  const zh = summarize(records, 30, 'zh');
  assert.equal(zh.speed, 18); assert.equal(zh.accuracy, 90); assert.equal(zh.errors, 1);
  assert.equal(summarize(records, 30, 'en').speed, 3.6);
  assert.equal(summarize([], 0, 'en').speed, 0);
  assert.equal(summarize([], 0, 'en').accuracy, 0);
});
test('ten-question queue refills across many bank cycles without mutating source', () => {
  for (const bank of Object.values(words)) {
    const original = [...bank]; const queue = new WordQueue(bank, () => .37);
    for (let i = 0; i < bank.length * 3; i++) {
      assert.equal(queue.queue.length, 10); assert.ok(bank.includes(queue.queue[0]));
      const second = queue.queue[1]; queue.advance(); assert.equal(queue.queue[0], second);
    }
    assert.deepEqual(bank, original);
  }
});
test('custom duration is an integer between 1 and 60, deadlines include background time', () => {
  for (const value of [0, -1, 61, 1.5, '', 'abc', Infinity]) assert.equal(validateMinutes(value), null);
  assert.equal(validateMinutes('60'), 60); assert.equal(validateMinutes('1'), 1);
  assert.equal(remainingMilliseconds(60000, 70000), 0);
  assert.equal(remainingMilliseconds(60000, 25000), 35000);
});
test('bundled article texts are real, attributed, punctuated and all sentences fit the input', async () => {
  const articles = JSON.parse(await readFile(new URL('../src/articles.json', import.meta.url)));
  assert.equal(articles.length, 6);
  for (const a of articles) {
    assert.ok(a.text.length > 100); assert.ok(a.revision > 0);
    assert.ok(a.permalink.includes(String(a.revision))); assert.ok(a.history.includes('history'));
    assert.equal(a.license, 'CC BY-SA 4.0'); assert.ok(/[。.!?]/.test(a.text));
    const sentences = splitSentences(a.text, a.language);
    assert.ok(sentences.length > 1); assert.ok(sentences.every(s => chars(s).length <= 600));
    assert.equal(sentences.join('').replace(/\s/g,''), a.text.replace(/\s/g,''));
  }
});
test('history recovers from corrupt, unavailable or full storage and retains last fifty sessions', () => {
  let saved = 'invalid';
  const storage = { getItem:() => saved, setItem:(key, value) => { saved = value; }, removeItem:() => { saved = null; } };
  assert.deepEqual(loadSessions(storage), []);
  saved = '{}'; assert.deepEqual(loadSessions(storage), []);
  for (let i = 0; i < 55; i++) saveSession({ id:String(i), date:'2026-10-29T10:00:00Z', language:'zh', mode:'words', speed:50, accuracy:100, elapsed:60, minutes:1, correct:50, errors:0, typed:50, total:50, records:[] }, storage);
  assert.equal(loadSessions(storage).length, 50); assert.equal(loadSessions(storage)[0].id, '54');
  const blocked = { getItem:() => { throw new Error('blocked'); }, setItem:() => { throw new Error('full'); }, removeItem:() => { throw new Error('blocked'); } };
  assert.deepEqual(loadSessions(blocked), []); assert.equal(saveSession({}, blocked), false);
  assert.equal(clearSessions(blocked), false); assert.equal(clearSessions(storage), true);
  assert.deepEqual(loadSessions(storage), []);
});
test('a blocked localStorage property itself does not break practice', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable:true, get() { throw new Error('SecurityError'); } });
  try { assert.deepEqual(loadSessions(), []); assert.equal(saveSession({}), false); assert.equal(clearSessions(), false); }
  finally { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage; }
});
test('each mode has crawlable static HTML, correct relative assets and deployment metadata', () => {
  for (const route of routes) {
    const html = renderPage(route);
    assert.ok(!html.includes('{{')); assert.ok(html.includes('<h1')); assert.ok(html.includes('<meta name="description"'));
    assert.ok(html.includes(`data-mode="${route.includes('articles') ? 'articles' : 'words'}"`));
    const prefix = route ? '../../' : './';
    assert.ok(html.includes(`href="${prefix}src/style.css"`));
    assert.ok(html.includes(`href="${prefix}en/articles/"`));
    assert.ok(!html.includes('rel="canonical"'));
    const deployed = renderPage(route, 'https://example.com/typing/');
    assert.ok(deployed.includes(`rel="canonical" href="https://example.com/typing/${route || 'zh/words/'}"`));
    assert.ok(!deployed.includes('localhost'));
  }
});
