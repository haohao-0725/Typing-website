import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {words} from '../src/words.js';
import {analyzeSessions,recordKey,characterKey,demoSessions} from '../src/analytics.js';
import {translate,translateMarkup} from '../src/i18n.js';
import {renderPage,routes,routeContext} from '../scripts/site.mjs';

test('both word banks contain 5000 unique, well-formed words with attributable provenance',async()=>{
 for(const language of ['zh','en']){assert.equal(words[language].length,5000);assert.equal(new Set(words[language]).size,5000);assert.ok(words[language].every(w=>!w.includes('\uFFFD')&&!/\s/.test(w)));}
 assert.ok(words.zh.every(w=>/^[\p{Script=Han}]{2,4}$/u.test(w)));assert.ok(words.en.every(w=>/^[a-z]{2,14}$/.test(w)));
 const manifest=JSON.parse(await readFile(new URL('../public/word-sources.json',import.meta.url)));
 assert.equal(manifest.license,'CC BY-SA 4.0');assert.equal(manifest.counts.zh,5000);assert.equal(manifest.counts.en,5000);
 assert.equal(manifest.previousUniqueCounts.zh,298);assert.equal(manifest.previousUniqueCounts.en,371);
});
test('character heatmap assigns substitutions to the expected key and additions to their output key',()=>{
 const result=analyzeSessions([{language:'en',records:[{expected:'cat',actual:'cst'},{expected:'dog',actual:'dogx'},{expected:'time',actual:'tie'}]}]);
 assert.deepEqual(result.keys.KeyA,{attempts:1,errors:1,presses:0});
 assert.equal(result.keys.KeyS.errors,0);assert.equal(result.keys.KeyX.errors,1);assert.equal(result.keys.KeyM.errors,1);
 assert.ok(result.pairs.some(p=>p.pair[0]==='a'&&p.pair[1]==='s'));
 assert.equal(characterKey('中'),null);assert.equal(characterKey('A'),'KeyA');assert.equal(characterKey('!'),'Digit1');
});
test('physical heatmap uses answer-level denominators and excludes legacy or partial traces',()=>{
 const records=[{expected:'時間',actual:'時問',keyUsage:{KeyG:3},keyUsageVersion:1},{expected:'世界',actual:'世界',keyUsage:{KeyG:2},keyUsageVersion:1},{expected:'朋友',actual:'朋有'},{expected:'生活',actual:'生',partial:true,keyUsage:{KeyG:9},keyUsageVersion:1}];
 const result=analyzeSessions([{language:'zh',records}],{language:'zh',source:'physical'});
 assert.deepEqual(result.keys.KeyG,{attempts:2,errors:1,presses:5});assert.equal(result.legacy,1);assert.equal(result.recordCount,3);
 const text=analyzeSessions([{language:'zh',records}],{language:'zh',source:'characters'});assert.equal(text.keys.KeyG.attempts,0);assert.ok(text.unmapped>0);
});
test('key collection is scoped, aggregates counts, includes IME positions, and omits shortcuts and submission keys',()=>{
 const counts={};const context={language:'zh',mode:'words',phase:'running'};
 recordKey(counts,{code:'KeyG',isComposing:true},context);recordKey(counts,{code:'KeyG'},context);
 recordKey(counts,{code:'KeyV',ctrlKey:true},context);recordKey(counts,{code:'Enter'},context);recordKey(counts,{code:'Unidentified'},context);
 recordKey(counts,{code:'KeyA'},{...context,phase:'finished'});recordKey(counts,{code:'KeyA'},{...context,expired:true});
 assert.deepEqual(counts,{KeyG:2});
 recordKey(counts,{code:'Space'},{...context,language:'en'});assert.equal(counts.Space,undefined);
 recordKey(counts,{code:'Space',isComposing:true},context);assert.equal(counts.Space,1);
});
test('empty and malformed analytics cannot invent key observations or rates',()=>{
 assert.equal(analyzeSessions([]).recordCount,0);
 const result=analyzeSessions([{language:'en',records:[{expected:'a',actual:'s',keyUsage:{KeyA:NaN,KeyS:-1,KeyX:Infinity},keyUsageVersion:1}]}],{source:'physical'});
 assert.equal(result.legacy,1);assert.equal(result.keys.KeyA.attempts,0);
 for(const lang of ['zh','en']) for(const source of ['physical','characters']) {
  const result=analyzeSessions(demoSessions(lang),{language:lang,source});
  for(const value of Object.values(result.keys)) assert.ok(value.errors>=0 && value.errors<=value.attempts);
 }
});
test('interface language is independent of practice language, with correct static translations and routes',async()=>{
 assert.equal(translate('{count} 個錯誤','en',{count:3}),'3 errors');
 const template=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const englishTemplate=translateMarkup(template,'en');
 assert.ok(englishTemplate.includes('Close analysis'));assert.ok(!englishTemplate.includes('本次未完成的紀錄會清除。'));
 assert.ok(!englishTemplate.includes('先準確'));
 for(const route of routes){const context=routeContext(route);const html=renderPage(route,'https://example.com/typing/');
  assert.ok(!html.includes('{{'));assert.ok(html.includes(`data-ui="${context.ui}"`));
  if(context.ui==='en'){assert.ok(html.includes('Interface language'));assert.ok(html.includes('Practice language'));assert.ok(html.includes('Keyboard heatmap'));assert.ok(html.includes('5,000')||html.includes('10 passages'));}
  const schema=html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1];assert.equal(JSON.parse(schema)['@type'],'WebApplication');
 }
});
