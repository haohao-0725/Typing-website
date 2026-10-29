// Event-level regression tests for IME ordering and deadlines. This small DOM
// fixture tests the production controller without introducing runtime packages.
import test from 'node:test';
import assert from 'node:assert/strict';

class Element extends EventTarget {
  constructor() {
    super(); this.dataset = {}; this.value = ''; this.textContent = ''; this.innerHTML = '';
    this.disabled = false; this.style = {}; this.hidden = false; this.open = false;
    this.attributes = new Map(); this.classes = new Set();
    this.classList = { add: c => this.classes.add(c), remove: c => this.classes.delete(c),
      toggle: (c, value) => value ? this.classes.add(c) : this.classes.delete(c) };
  }
  setAttribute(key, value) { this.attributes.set(key, value); }
  removeAttribute(key) { this.attributes.delete(key); }
  focus() {} blur() {} select() {}
  showModal() { this.open = true; } close() { this.open = false; }
}

let run = 0;
async function fixture(callback, options = {}) {
  const original = Object.fromEntries(['document', 'window', 'localStorage', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'].map(k => [k, globalThis[k]]));
  const originalNow = Date.now;
  const elements = new Map();
  const get = selector => { if (!elements.has(selector)) elements.set(selector, new Element()); return elements.get(selector); };
  const duration = [1, 3, 5].map(n => { const el = new Element(); el.dataset.minutes = String(n); return el; });
  const custom = get('#custom-button'); custom.id = 'custom-button';
  const links = [new Element(), new Element()];
  const groups = { '[data-dialog]':[], '[data-close]':[], 'dialog':[], '.segmented a':links,
    '.duration-options button':[...duration, custom], '[data-minutes]':duration };
  const documentFixture = new EventTarget();
  documentFixture.body = { dataset:{language:options.language || 'zh', mode:'words', ui:options.ui || 'zh'} };
  documentFixture.querySelector = get;
  documentFixture.getElementById = id => get('#' + id);
  documentFixture.querySelectorAll = selector => groups[selector] || [];
  let now = 1000000, saved = null;
  const intervals = new Set(), timeouts = new Set();
  globalThis.document = documentFixture; globalThis.window = new EventTarget();
  globalThis.localStorage = { getItem:() => saved, setItem:(_key, value) => { saved = value; }, removeItem:() => { saved = null; } };
  globalThis.setInterval = fn => { intervals.add(fn); return fn; };
  globalThis.clearInterval = fn => intervals.delete(fn);
  globalThis.setTimeout = fn => { timeouts.add(fn); return fn; };
  globalThis.clearTimeout = fn => timeouts.delete(fn);
  Date.now = () => now;
  const fire = (selector, type, values = {}) => {
    const event = new Event(type, { cancelable:true }); Object.assign(event, values); get(selector).dispatchEvent(event); return event;
  };
  try {
    await import(`../src/main.js?fixture=${++run}`);
    await callback({ get, fire, duration,
      word:() => get('#prompt-area').innerHTML.match(/<li class="word-current[^>]*>[\s\S]*?<strong>([^<]+)<\/strong>/)[1],
      type:value => { get('#typing-input').value = value; fire('#typing-input', 'input'); },
      enter:() => fire('#typing-input', 'keydown', {key:'Enter', keyCode:13, isComposing:false}),
      advance:ms => { now += ms; for (const fn of [...intervals]) fn(); },
      flushTimeouts:() => { for (const fn of [...timeouts]) fn(); timeouts.clear(); },
      saved:() => JSON.parse(saved || '[]'),
    });
  } finally { Date.now = originalNow; Object.assign(globalThis, original); }
}

test('start button only focuses; composition Enter does not submit; confirmed text submits once', async () => {
  await fixture(({ get, fire, word, type, enter, advance, flushTimeouts, saved }) => {
    fire('#start-button', 'click'); advance(5000);
    assert.equal(get('#timer').innerHTML, '03<span>:</span>00');
    const expected = word();
    fire('#typing-input', 'compositionstart'); type('ㄕ');
    fire('#typing-input', 'keydown', { key:'Enter', keyCode:229, isComposing:true });
    assert.equal(word(), expected); assert.equal(get('#live-correct').textContent, 0);
    get('#typing-input').value = expected; fire('#typing-input', 'compositionend');
    enter(); assert.equal(word(), expected); // Safari same-key event guard
    flushTimeouts(); enter();
    assert.equal(get('#typing-input').value, '');
    advance(2000); fire('#start-button', 'click');
    assert.equal(saved().length, 1); assert.equal(saved()[0].records.length, 1);
    assert.equal(saved()[0].records[0].actual, expected); assert.equal(saved()[0].accuracy, 100);
  });
});

test('deadline during composition counts the previously committed snapshot and saves once', async () => {
  await fixture(({ get, fire, word, type, advance, saved }) => {
    const expected = word(); type(expected[0]);
    fire('#typing-input', 'compositionstart'); type(expected[0] + 'ㄓ');
    advance(180001);
    assert.equal(get('#results-dialog').open, true); assert.equal(get('#typing-input').disabled, true);
    assert.equal(saved()[0].elapsed, 180); assert.equal(saved()[0].records[0].actual, expected[0]);
    assert.equal(saved()[0].records[0].partial, true); assert.equal(saved()[0].errors, 0);
    get('#typing-input').value = expected; fire('#typing-input', 'compositionend');
    advance(5000); assert.equal(saved().length, 1); assert.equal(saved()[0].typed, 1);
  });
});

test('late input cannot enter the result even when a timer callback is delayed', async () => {
  await fixture(({ fire, word, type, get, saved }) => {
    const expected = word(); type(expected[0]);
    // An inactive tab can delay interval callbacks; the input event checks the deadline too.
    const currentNow = Date.now; Date.now = () => currentNow() + 180500;
    try { type(expected); } finally { Date.now = currentNow; }
    assert.equal(get('#results-dialog').open, true);
    assert.equal(saved()[0].records[0].actual, expected[0]); assert.equal(saved()[0].typed, 1);
    fire('#start-button', 'click'); assert.equal(get('#typing-input').disabled, false);
  });
});

test('paste and drop are blocked before scoring begins', async () => {
  await fixture(({ get, fire, saved }) => {
    assert.equal(fire('#typing-input', 'paste').defaultPrevented, true);
    assert.equal(fire('#typing-input', 'drop').defaultPrevented, true);
    assert.equal(fire('#typing-input', 'beforeinput', {inputType:'insertFromPaste', data:'some text'}).defaultPrevented, true);
    assert.equal(get('#timer').innerHTML, '03<span>:</span>00'); assert.equal(saved().length, 0);
  });
});

test('after multiple submissions only the latest result is shown, while all records are saved', async () => {
  await fixture(({get,fire,word,type,enter,advance,saved}) => {
    const first = word(); type(first); enter();
    assert.ok(get('#prompt-area').innerHTML.includes('word-previous is-correct'));
    type('錯誤輸入'); enter();
    assert.ok(get('#prompt-area').innerHTML.includes('word-previous is-wrong'));
    assert.equal((get('#prompt-area').innerHTML.match(/<li /g)||[]).length, 6);
    assert.equal(get('#recent-words').innerHTML, '');
    advance(3000); fire('#start-button','click');
    assert.equal(saved()[0].records.length, 2);
    assert.equal(saved()[0].records[0].actual, first);
    fire('#start-button','click');
    assert.ok(get('#prompt-area').innerHTML.includes('word-previous is-empty'));
  });
});

test('recorded keyboard counts survive submission, reset per answer, and coexist with English UI', async () => {
  await fixture(({get,fire,word,type,enter,advance,saved}) => {
    const target=word();
    fire('#typing-input','keydown',{key:'a',code:'KeyA',isComposing:false});
    fire('#typing-input','keydown',{key:'Process',code:'KeyJ',keyCode:229,isComposing:true});
    fire('#typing-input','keydown',{key:'v',code:'KeyV',ctrlKey:true});
    type(target);enter();
    assert.ok(get('#prompt-area').innerHTML.includes('✓ Correct'));
    fire('#typing-input','keydown',{key:'b',code:'KeyB',isComposing:false});type('wrong');enter();
    advance(3000);fire('#start-button','click');
    const records=saved()[0].records;
    assert.deepEqual(records[0].keyUsage,{KeyA:1,KeyJ:1});assert.equal(records[0].keyUsageVersion,1);
    assert.deepEqual(records[1].keyUsage,{KeyB:1});
    assert.equal(get('#save-status').textContent,'Saved in this browser.');
  },{language:'en',ui:'en'});
});
