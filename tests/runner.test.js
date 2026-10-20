// Постоянный скрипт (Runner.gs): выполняет логику, присланную программой, проверяет ключ, не требует обновлений
const fs=require('fs'),vm=require('vm'),path=require('path');
const runner=fs.readFileSync(path.join(__dirname,'..','google','Runner.gs'),'utf8');
const lib=fs.readFileSync(path.join(__dirname,'..','google','Code.gs'),'utf8');
let ok=true; const chk=(c,m)=>{ console.log((c?'OK  ':'FAIL')+' '+m); ok=ok&&c; };
const props={}; let calls=[];
const ctx={ LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=v;}})},
  ContentService:{MimeType:{JSON:1},createTextOutput:t=>({setMimeType(){return t;}})},
  JSON, String, Error };
vm.createContext(ctx); vm.runInContext(runner,ctx);
const post=b=>JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(b)}}));
const T='k'.repeat(40);
// заменяем действия библиотеки на шпионов, чтобы не трогать Google
const fake='var VERSION=7; function state(){ return {w:"16.10"}; } var ACTIONS={ add:function(r){ calls.push(r.positive.length); return {added:r.positive.length}; } };';
ctx.calls=calls;
let r=post({action:'pair',token:T,code:fake}); chk(r.ok&&r.runner===1&&r.version===7&&r.state.w==='16.10','подключение: ключ запомнен, логика из программы');
r=post({action:'add',token:'x'.repeat(40),code:fake,positive:[1]}); chk(!r.ok&&/Нет доступа/.test(r.error),'чужой ключ отклонён');
r=post({action:'add',token:T,code:fake,positive:[1,2]}); chk(r.ok&&r.added===2&&calls[0]===2,'действие выполнено присланной логикой');
const fake2=fake.replace('VERSION=7','VERSION=8');
r=post({action:'add',token:T,code:fake2,positive:[1]}); chk(r.ok&&r.version===8,'новая версия программы работает без обновления скрипта');
r=post({action:'add',token:T,positive:[1]}); chk(!r.ok&&/Обновите программу/.test(r.error),'без логики: понятная ошибка');
r=post({action:'zzz',token:T,code:fake}); chk(!r.ok&&/Неизвестное/.test(r.error),'неизвестное действие');
// настоящая логика отчётов компилируется внутри постоянного скрипта
const c2={ LockService:ctx.LockService, PropertiesService:ctx.PropertiesService, ContentService:ctx.ContentService,
  DocumentApp:{openById:()=>{throw new Error('no-doc');}}, SpreadsheetApp:{openById:()=>{throw new Error('no-ss');}}, JSON, String };
vm.createContext(c2); vm.runInContext(runner,c2);
r=JSON.parse(c2.doPost({postData:{contents:JSON.stringify({action:'state',token:T,code:lib})}}));
chk(r.runner===1&&/no-/.test(r.error||''),'настоящий Code.gs загружается и доходит до Google ('+(r.error||'')+')');
r=JSON.parse(c2.doPost({postData:{contents:JSON.stringify({action:'nope',token:T,code:lib})}}));
chk(/Неизвестное действие: nope/.test(r.error||''),'в настоящем Code.gs есть ACTIONS, VERSION, state');
// приложение шлёт логику в каждом запросе
const rep=fs.readFileSync(path.join(__dirname,'..','web','reports.js'),'utf8');
chk(/code: window\.__otvGsLib/.test(rep),'программа прикладывает логику к каждому запросу');
const gs=fs.readFileSync(path.join(__dirname,'..','web','gscode.js'),'utf8');
chk(/__otvGsLib = /.test(gs),'сборка кладёт постоянный скрипт и логику');
console.log(ok?'ALL OK':'SOME FAILED');
