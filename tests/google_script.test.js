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

// 5. правка уже записанных блоков: ответ, ссылка, текст; чужая строка (ключ не совпал) не трогается
try { vm.runInContext('addNegative([{id:"p1",platform:"Яндекс",date:"23 октября 2026",text:"Первый отзыв про замену хирурга без консультации.",answer:"Черновик невпопад",link:"https://y/AAA"},{id:"p2",platform:"Яндекс",date:"23 октября 2026",text:"Второй отзыв, совсем другой.",answer:"Мой ответ",link:"https://y/AAA"}],{})',ctx); } catch(e){ chk(false,'подготовка: '+e.message); }
let nb=vm.runInContext('readNegative(negTable(DocumentApp.openById("x")))',ctx), i1=nb.find(b=>/Первый/.test(b.text)), i2=nb.find(b=>/Второй/.test(b.text));
let pn; try { pn=vm.runInContext('patch('+JSON.stringify([{kind:'neg',n:i1.n,key:i1.text,answer:'—',link:'https://y/'},{kind:'neg',n:i2.n,key:'НЕ ТОТ ТЕКСТ',answer:'—'},{kind:'neg',n:i2.n,key:i2.text,text:'Второй отзыв, совсем другой. Дочитан до конца.'}])+')',ctx); } catch(e){ chk(false,'patch: '+e.message); }
nb=vm.runInContext('readNegative(negTable(DocumentApp.openById("x")))',ctx); i1=nb.find(b=>/Первый/.test(b.text)); i2=nb.find(b=>/Второй/.test(b.text));
chk(pn===2,'исправлено ровно 2 блока: '+pn);
chk(i1.answer==='—'&&i1.link==='https://y/','черновик стёрт, ссылка заменена');
chk(i2.answer==='Мой ответ'&&/Дочитан/.test(i2.text),'чужой ключ не тронул ответ, текст дописан');

// 6. «Позитив»: обрезанный текст строки дописывается по номеру и ключу, чужая строка не трогается
{ const grid=[['1','18.10.2026','ПроДокторов','Гинекология','Начало длинного отзыва о докторе','Дан ответ',''],['2','18.10.2026','ПроДокторов','Урология','Другой отзыв','Дан ответ','']];
  const sh={ getName:()=>'16–22 октября подробный', getLastRow:()=>2+grid.length, getRange:(r,c,nr,nc)=> nr ? { getDisplayValues:()=>grid.slice(r-3,r-3+nr).map(x=>x.slice(c-1,c-1+nc)) } : { setValue:v=>{ grid[r-3][c-1]=v; } } };
  const c2=Object.assign({},ctx,{ SpreadsheetApp:{openById:()=>({getSheets:()=>[sh],getName:()=>posTitle})} }); vm.createContext(c2); vm.runInContext(code,c2);
  const n=vm.runInContext('patch('+JSON.stringify([{kind:'pos',platform:'ПроДокторов',num:'1',key:'Начало длинного отзыва о докторе',text:'Начало длинного отзыва о докторе и его конец.'},{kind:'pos',platform:'ПроДокторов',num:'2',key:'Не та строка',text:'Подмена'}])+')',c2);
  chk(n===1&&/и его конец/.test(grid[0][4])&&grid[1][4]==='Другой отзыв','«Позитив»: дописана нужная строка, чужая не тронута'); }
console.log(ok?'ALL OK':'SOME FAILED');
