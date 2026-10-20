// Code.gs против поддельного Google Docs, который, как настоящий, не даёт вставить пустой текст
const fs=require('fs'),vm=require('vm');
const code=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','google','Code.gs'),'utf8');
function Para(t){ this.t=t; this.link=null; }
Para.prototype.setText=function(t){ if(t==='') throw new Error('Невозможно вставить пустой текстовый элемент.'); this.t=t; return this; };
Para.prototype.clear=function(){ this.t=''; return this; };
Para.prototype.copy=function(){ const p=new Para(this.t); p.link=this.link; return p; };
Para.prototype.asParagraph=function(){ return this; };
Para.prototype.editAsText=function(){ const p=this; return { setLinkUrl(a,b,c){ p.link=(arguments.length===1?a:c)||null; } }; };
function Cell(t){ this.ps=[new Para(t||'')]; }
Cell.prototype.getNumChildren=function(){ return this.ps.length; };
Cell.prototype.removeChild=function(c){ this.ps.splice(this.ps.indexOf(c),1); };
Cell.prototype.getChild=function(i){ return this.ps[i]; };
Cell.prototype.insertParagraph=function(i,p){ if(p.t==='') throw new Error('Невозможно вставить пустой текстовый элемент.'); this.ps.splice(i,0,p); return p; };
Cell.prototype.getText=function(){ return this.ps.map(p=>p.t).join('\n'); };
function Row(a,b){ this.c=[new Cell(a),new Cell(b)]; }
Row.prototype.getCell=function(i){ return this.c[i]; }; Row.prototype.getNumCells=function(){ return 2; };
Row.prototype.copy=function(){ const r=new Row('',''); r.c=this.c.map(c=>{ const n=new Cell(''); n.ps=c.ps.map(p=>p.copy()); return n; }); return r; };
const L=['Площадка','Дата размещения отзыва','Отзыв','Ответ','Ссылка на отзыв'];
function mkTable(blocks){ const rows=[new Row('ГКБ №24','')]; blocks.forEach(b=>L.forEach((l,i)=>rows.push(new Row(l,b[i]||'')))); rows.push(new Row('','')); return {
  rows, getNumRows(){return rows.length;}, getRow(i){return rows[i];}, removeRow(i){rows.splice(i,1);}, insertTableRow(i,r){rows.splice(i,0,r); return r;} }; }
let negTitle='Негатив 2026_87_09.10_15.10', posTitle='Позитив 2026_92_09.10_15.10', header='за период 09.10-15.10.2026';
let table=mkTable([['Яндекс','15 октября 2026','Плохо','Ответ','https://x']]);
const doc={ getName:()=>negTitle, getBody:()=>({ getTables:()=>[table], findText(re){ const m=new RegExp(re).exec(header); if(!m) return null; return { getElement:()=>({asText:()=>({ deleteText(a,b){ header=header.slice(0,a)+header.slice(b+1); }, insertText(a,t){ header=header.slice(0,a)+t+header.slice(a); } })}), getStartOffset:()=>m.index, getEndOffsetInclusive:()=>m.index+m[0].length-1 }; } }), saveAndClose(){} };
const any=new Proxy(function(){},{ get:(t,k)=> k==='getDisplayValues'||k==='getValues'?()=>[]:k==='getLastRow'?()=>3:k==='getName'?()=>'9–15 октября подробный':any, apply:()=>any });
const ss={ getName:()=>posTitle, getSheets:()=>[any], getSheetByName:()=>any };
const ctx={ DocumentApp:{openById:()=>doc}, SpreadsheetApp:{openById:()=>ss, flush(){}, CopyPasteType:{}}, DriveApp:{getFileById:id=>({ setName(n){ if(/Негатив/.test(n)) negTitle=n; else posTitle=n; }, getName:()=>'' })}, Logger:{log(){}} };
vm.createContext(ctx); vm.runInContext(code,ctx);
let ok=true; const chk=(c,m)=>{ console.log((c?'OK  ':'FAIL')+' '+m); ok=ok&&c; };
// 1. новая неделя: «Негатив» очищается, период и название меняются
ctx.Date=class extends Date{ constructor(...a){ if(a.length) super(...a); else super('2026-10-20T10:00:00'); } };
let r; try { r=vm.runInContext('newWeek({saved:true, expect:"16.10–22.10"})',ctx); } catch(e){ chk(false,'новая неделя: '+e.message); }
chk(negTitle==='Негатив 2026_88_16.10_22.10','«Негатив» переименован: '+negTitle);
chk(header==='за период 16.10-22.10.2026','период в шапке «Негатива»: '+header);
const bl=vm.runInContext('readNegative(negTable(DocumentApp.openById("x")))',ctx);
chk(bl.length===1&&bl[0].empty,'в «Негативе» один пустой блок');
// 2. негатив с пустыми строками и ответом
try { vm.runInContext('addNegative([{id:"a",platform:"Яндекс",date:"16 октября 2026",text:"ЖЕСТЬ!\\n\\nВыгнали ночью.\\n  \\nМата не хватит.",answer:"Здравствуйте.\\n\\nНам жаль.\\n\\nРазберёмся.",link:"https://y/1"},{id:"b",platform:"Яндекс",date:"16 октября 2026",text:"Замена хирурга без консультации.",answer:"",link:"https://y/2"}],{})',ctx); chk(true,'негатив с пустыми строками записан'); } catch(e){ chk(false,'негатив: '+e.message); }
const b2=vm.runInContext('readNegative(negTable(DocumentApp.openById("x")))',ctx);
chk(b2.length===2,'два блока'); chk(/Разберёмся/.test(b2[0].answer)&&/Мата/.test(b2[0].text),'текст и ответ целиком');
chk(b2[1].answer==='—','пустой ответ стал «—»'); chk(b2[1].link==='https://y/2','у второго своя ссылка');
// 3. ответ дописывается
try { vm.runInContext('negAnswers([{text:"Замена хирурга без консультации.",answer:"Здравствуйте.\\n\\nПроверим.\\n"}])',ctx); } catch(e){ chk(false,'ответ: '+e.message); }
chk(/Проверим/.test(vm.runInContext('readNegative(negTable(DocumentApp.openById("x")))',ctx)[1].answer),'ответ обновлён');
// 4. ещё одна неделя подряд: блоки снова очищаются
ctx.Date=class extends Date{ constructor(...a){ if(a.length) super(...a); else super('2026-10-27T10:00:00'); } };
try { vm.runInContext('newWeek({saved:true, expect:"23.10–29.10"})',ctx); } catch(e){ chk(false,'вторая неделя: '+e.message); }
const b3=vm.runInContext('readNegative(negTable(DocumentApp.openById("x")))',ctx);
chk(b3.length===1&&b3[0].empty&&negTitle==='Негатив 2026_89_23.10_29.10','вторая неделя: «Негатив» очищен и переименован');
console.log(ok?'ALL OK':'SOME FAILED');
