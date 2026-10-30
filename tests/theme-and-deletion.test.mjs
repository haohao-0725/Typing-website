import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {saveSession,loadSessions,deleteSession} from '../src/storage.js';

const session=id=>({id,date:'2026-10-30T02:00:00Z',language:'en',mode:'words',speed:40,elapsed:60,accuracy:90,minutes:1,correct:200,errors:20,typed:220,total:220,records:[]});
test('deleting one session preserves other tests, ordering and stored results',()=>{
 let value=null;
 const storage={getItem:()=>value,setItem:(_key,v)=>{value=v;}};
 for(const id of ['a','b','c'])saveSession(session(id),storage);
 assert.equal(deleteSession('b',storage),true);
 assert.deepEqual(loadSessions(storage),[session('c'),session('a')]);
 const snapshot=value;
 assert.equal(deleteSession('missing',storage),false);assert.equal(value,snapshot);
 assert.equal(deleteSession('a',storage),true);assert.equal(deleteSession('c',storage),true);
 assert.deepEqual(loadSessions(storage),[]);
});
test('failed reads or writes cannot erase the remaining history',()=>{
 let writes=0;
 assert.equal(deleteSession('a',{getItem:()=>{throw Error('blocked');},setItem:()=>writes++}),false);
 assert.equal(deleteSession('a',{getItem:()=>'{broken',setItem:()=>writes++}),false);
 assert.equal(writes,0);
 assert.equal(deleteSession('a',{getItem:()=>JSON.stringify([session('a')]),setItem:()=>{throw Error('full');}}),false);
});

const themeCode=await readFile(new URL('../src/theme.js',import.meta.url),'utf8');
function themeFixture({saved=null,dark=false,blocked=false}={}){
 const ready=[],events={},attributes={};let value=saved;
 const button={dataset:{darkLabel:'Switch to dark mode',lightLabel:'Switch to light mode'},setAttribute:(k,v)=>attributes[k]=v,addEventListener:(type,fn)=>events[type]=fn};
 const media={matches:dark,addEventListener:(_type,fn)=>{events.system=fn;}};
 const document={documentElement:{dataset:{},style:{}},getElementById:()=>button,addEventListener:(_type,fn)=>ready.push(fn)};
 const context={document,window:{matchMedia:()=>media}};
 Object.defineProperty(context,'localStorage',{get(){if(blocked)throw Error('SecurityError');return {getItem:()=>value,setItem:(_k,v)=>{value=v;}};}});
 vm.runInNewContext(themeCode,context);
 return {document,media,button,attributes,events,boot:()=>ready.forEach(fn=>fn()),saved:()=>value};
}
test('theme applies before DOM ready, persists explicit choice, and ignores later system changes',()=>{
 const f=themeFixture({dark:true});
 assert.equal(f.document.documentElement.dataset.theme,'dark');
 f.boot();assert.equal(f.attributes['aria-pressed'],'true');
 f.events.click();assert.equal(f.document.documentElement.dataset.theme,'light');assert.equal(f.saved(),'light');
 f.media.matches=true;f.events.system();assert.equal(f.document.documentElement.dataset.theme,'light');
 assert.equal(themeFixture({saved:f.saved(),dark:true}).document.documentElement.dataset.theme,'light');
});
test('theme follows system before a selection and works when browser storage is blocked',()=>{
 const f=themeFixture({saved:'invalid'});f.boot();f.media.matches=true;f.events.system();
 assert.equal(f.document.documentElement.dataset.theme,'dark');
 const blocked=themeFixture({blocked:true});blocked.boot();blocked.events.click();
 assert.equal(blocked.document.documentElement.dataset.theme,'dark');
 assert.equal(blocked.document.documentElement.style.colorScheme,'dark');
 assert.equal(blocked.button.title,'Switch to light mode');
});
