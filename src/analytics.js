import { recordComparison } from './scoring.js';

export const keyboardRows = [
 [['Backquote','`'],...Array.from({length:9},(_,i)=>[`Digit${i+1}`,`${i+1}`]),['Digit0','0'],['Minus','-'],['Equal','='],['Backspace','⌫',2]],
 [['Tab','Tab',1.5],...('QWERTYUIOP'.split('').map(c=>['Key'+c,c])),['BracketLeft','['],['BracketRight',']'],['Backslash','\\',1.5]],
 [['CapsLock','Caps',1.8],...('ASDFGHJKL'.split('').map(c=>['Key'+c,c])),['Semicolon',';'],['Quote',"'"],['Enter','Enter',2.2]],
 [['ShiftLeft','Shift',2.3],...('ZXCVBNM'.split('').map(c=>['Key'+c,c])),['Comma',','],['Period','.'],['Slash','/'],['ShiftRight','Shift',2.7]],
 [['Space','Space',7]],
];
export const keyCodes = new Set(keyboardRows.flat().map(k=>k[0]));
const punctuation = {'`':'Backquote','~':'Backquote','-':'Minus','_':'Minus','=':'Equal','+':'Equal','[':'BracketLeft','{':'BracketLeft',']':'BracketRight','}':'BracketRight','\\':'Backslash','|':'Backslash',';':'Semicolon',':':'Semicolon',"'":'Quote','"':'Quote',',':'Comma','<':'Comma','.':'Period','>':'Period','/':'Slash','?':'Slash',' ':'Space'};
'!@#$%^&*()'.split('').forEach((c,i)=>{punctuation[c]='Digit'+((i+1)%10);});
export function characterKey(character) {
 if (/^[a-z]$/i.test(character)) return 'Key'+character.toUpperCase();
 if (/^\d$/.test(character)) return 'Digit'+character;
 return punctuation[character] || null;
}
export function recordKey(usage, event, {language,mode,phase,expired=false}) {
 if (!['ready','running'].includes(phase) || expired || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
 const code=event.code;
 if (!keyCodes.has(code) || ['Tab','Enter'].includes(code)) return;
 if (code==='Space' && language==='en' && mode==='words' && !event.isComposing) return;
 usage[code]=Math.min(10000,(usage[code] || 0)+1);
}
export function analyzeSessions(sessions,{language='en',source='characters'}={}) {
 const keys=Object.fromEntries([...keyCodes].map(code=>[code,{attempts:0,errors:0,presses:0}]));
 const pairs=new Map();
 let recordCount=0,sessionCount=0,unmapped=0,legacy=0;
 for(const session of sessions.filter(s=>s.language===language)) {
  if (!Array.isArray(session.records)) continue;
  sessionCount++;
  for(const record of session.records) {
   if(source==='physical' && record.partial) continue;
   if(typeof record.expected!=='string'||typeof record.actual!=='string'||record.expected.length>1200||record.actual.length>1200) continue;
   recordCount++;
   const comparison=recordComparison(record,session);
   for(const operation of comparison.operations) {
    if(operation.type!=='correct') {
     const pair=JSON.stringify([operation.expected,operation.actual]);
     pairs.set(pair,(pairs.get(pair)||0)+1);
    }
    if(source!=='characters') continue;
    const code=characterKey(operation.expected || operation.actual);
    if(!code){unmapped++;continue;}
    keys[code].attempts++;
    if(operation.type!=='correct') keys[code].errors++;
   }
   if(source==='physical') {
    const usage=record.keyUsage;
    const entries=record.keyUsageVersion===1 && usage && typeof usage==='object' ? Object.entries(usage).filter(([code,count])=>keyCodes.has(code)&&Number.isInteger(count)&&count>0&&count<=10000) : [];
    if(!entries.length){legacy++;continue;}
    for(const [code,count] of entries){keys[code].attempts++;keys[code].presses+=count;if(comparison.errors)keys[code].errors++;}
   }
  }
 }
 return {keys,recordCount,sessionCount,unmapped,legacy,source,language,
  pairs:[...pairs.entries()].map(([pair,count])=>({pair:JSON.parse(pair),count})).sort((a,b)=>b.count-a.count).slice(0,5)};
}
export function demoSessions(language) {
 const entries=language==='en' ? [['garden','gardsn',{KeyG:1,KeyA:1,KeyR:1,KeyD:1,KeyS:1,KeyN:1}],['time','tine',{KeyT:1,KeyI:1,KeyN:1,KeyE:1}],['people','people',{KeyP:2,KeyE:2,KeyO:1,KeyL:1}],['water','wster',{KeyW:1,KeyS:1,KeyT:1,KeyE:1,KeyR:1}],['river','river',{KeyR:2,KeyI:1,KeyV:1,KeyE:1}],['home','hone',{KeyH:1,KeyO:1,KeyN:1,KeyE:1}]] : [['時間','時問',{KeyG:1,KeyJ:2,KeyA:1,KeyF:1}],['世界','世界',{KeyG:2,KeyJ:1,KeyP:1}],['朋友','朋有',{KeyQ:1,KeyU:1,KeyJ:1,KeyI:1}],['生活','生活',{KeyG:1,KeyJ:2,KeyZ:1}],['工作','公作',{KeyE:1,KeyJ:1,KeyI:1}],['風景','風景',{KeyZ:1,KeyJ:1,KeyD:1}]];
 return [{language,records:entries.map(([expected,actual,keyUsage])=>({expected,actual,keyUsage,keyUsageVersion:1,partial:false}))}];
}
