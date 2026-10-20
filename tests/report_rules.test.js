const fs=require('fs'),vm=require('vm');
const T={
 trub:"Внимательный доктор, спасибо.\nВсё понравилось.",
 byk:"Благодарю врачей за заботу и терпение. Операция прошла спокойно, медсёстры всё время помогали и объясняли. Палаты чистые, удобные, кормят хорошо.",
 luc:"Спасибо персоналу больницы за помощь при лечении. Работают слаженно и быстро, анализы сделали в тот же день, всё объяснили.",
 kozL:"Хочу сказать огромное спасибо сотрудникам приёмного отделения. Меня направили на прививку, встретили очень доброжелательно и заботливо. И администраторы, и доктор, и медсёстры в процедурной были внимательны, везде чисто и спокойно. Спасибо за заботу и отдельное спасибо руководству за такую команду специалистов!",
 kozS:"Меня направили на прививку, встретили очень доброжелательно и заботливо. И администраторы, и доктор, и медсёстры в процедурной были внимательны, везде чисто и спокойно. Спасибо за заботу и отдельное спасибо руководству",
 stup:"Лежал в отделении пять дней, всё чисто и светло. Врачи своё дело знают, сделали всё отлично, медсёстры заботливые. Кормят просто, но вкусно. Ставлю пять из пяти.",
 led:"Хочу выразить большую благодарность лечащему врачу за операцию и внимательное наблюдение после неё. Восстановление прошло быстро, доктор всё подробно объяснял и помогал на каждом этапе.",
 pd1:"Пришла на консультацию к хирургу, врач всё подробно объяснил и дал рекомендации перед операцией.",
 other:"Огромное спасибо хирургу за операцию, всё прошло отлично, персонал внимательный, палаты чистые, кормят вкусно, рекомендую всем.",
 other2:"Большое спасибо хирургу и медсёстрам за операцию, всё прошло хорошо, персонал отзывчивый, в палате чисто, еда вкусная, буду рекомендовать знакомым."
};
const head=t=>String(t).replace(/\s+/g,' ').trim().slice(0,120);
function run(name, tableRows, registry, mail, expect, o){
  tableRows=tableRows.map(r=>r.slice()); o=o||{}; const today=(o.today||'2026-10-15T12:00:00')+'+03:00';
  const calls=[]; const reg=JSON.parse(JSON.stringify(registry));
  let state=o.state0?(x=>{ (x.negative||[]).concat(x.positive||[]).forEach(b=>{ if(b.full) b.text=head(b.full); }); return x; })(JSON.parse(JSON.stringify(o.state0))):{posTitle:'Позитив',negTitle:'Негатив',tab:'x',period:'09.10–15.10.2026',start:'2026-10-09',end:'2026-10-15',
    positive:tableRows.map((r,i)=>({platform:r[0],num:String(r[1]),date:r[2],dept:r[3]||'',doctor:'',text:head(r[4]),full:r[4]})),negative:[]};
  const bodies=[]; const invoke=(cmd,args)=>{ const b=JSON.parse(args.body); calls.push(b.action); bodies.push(b);
    if(b.action==='state') return Promise.resolve(JSON.stringify({ok:true,version:3,runner:(o.v?0:1),state}));
    if(b.action==='refs') return Promise.resolve(JSON.stringify({ok:true,version:(o.v||3),runner:(o.v?0:1),refs:{departments:[],exceptions:[],staff:[],categories:['ГКБ 24','Хирургия','Приёмное отделение','Терапия']}}));
    if(b.action==='add'){ const refs={}; let n=tableRows.filter(r=>r[0]==='Сайт').length; (b.negative||[]).forEach((x,i)=>{ const n=state.negative.length+1; state.negative.push({n,platform:x.platform,date:x.date,text:head(x.text),answer:head(x.answer),full:x.text,fullAnswer:x.answer,link:x.link}); refs[x.id]='Негатив · блок '+n; }); (b.positive||[]).forEach(p=>{ const k=Math.max(0,...tableRows.filter(r=>r[0]===p.platform).map(r=>+r[1]))+1; refs[p.id]='Позитив · '+p.platform+' №'+k; tableRows.push([p.platform,k,p.date,p.dept,p.text]); state.positive.push({platform:p.platform,num:String(k),date:p.date,dept:p.dept,doctor:'',text:head(p.text),full:p.text}); }); calls.push({add:b.positive.map(p=>p.id+':'+p.dept)}); return Promise.resolve(JSON.stringify({ok:true,version:(o.v||3),runner:(o.v?0:1),refs,state})); }
    if(b.action==='export'){ if(o.exportFail) return Promise.resolve(JSON.stringify({ok:false,error:'нет доступа к файлу'})); return Promise.resolve(JSON.stringify({ok:true,version:(o.v||3),runner:(o.v?0:1),files:[{name:'Позитив.xlsx',data:'AA=='},{name:'Негатив.docx',data:'AA=='}]})); }
    if(b.action==='newweek'){ const e=new Date(state.end+'T00:00:00Z'); const a=new Date(e.getTime()+864e5), z=new Date(e.getTime()+7*864e5); const f=d=>d.toISOString().slice(0,10), dm=d=>f(d).slice(8,10)+'.'+f(d).slice(5,7);
      if(b.expect!==dm(a)+'–'+dm(z)) return Promise.resolve(JSON.stringify({ok:false,error:'Отчёт уже сменился'}));
      state=Object.assign({},state,{start:f(a),end:f(z),period:dm(a)+'–'+dm(z)+'.'+z.getUTCFullYear(),positive:[],negative:[]}); tableRows=[]; return Promise.resolve(JSON.stringify({ok:true,version:(o.v||3),runner:(o.v?0:1),period:state.period,state})); }
    if(b.action==='patch'){ (b.items||[]).forEach(it=>{ if(it.kind==='neg'){ const x=state.negative.find(q=>q.n===it.n); if(x){ if(it.text!=null)x.full=it.text; if(it.answer!=null)x.fullAnswer=it.answer; if(it.link!=null)x.link=it.link; } } else { const x=state.positive.find(q=>q.platform===it.platform&&q.num===String(it.num)); if(x) x.full=it.text; } }); return Promise.resolve(JSON.stringify({ok:true,version:4,runner:(o.v?0:1),patched:(b.items||[]).length})); }
    if(b.action==='numbers'||b.action==='answers') return Promise.resolve(JSON.stringify({ok:true,version:(o.v||3),runner:(o.v?0:1)}));
    return Promise.resolve(JSON.stringify({ok:true,version:(o.v||3),runner:(o.v?0:1)}));
  };
  const db={collection:c=>({doc:id=>({get:()=>Promise.resolve(c==='settings'&&id==='google'?{exists:true,data:()=>({url:'u',token:'t'.repeat(40),paired:true})}:{exists:false}),
    set:d=>{ if(c==='settings'&&id==='report') lastMsg+=JSON.stringify(d)+'\n'; return Promise.resolve(); }, update:d=>{ if(c==='registry'){ reg[id]=Object.assign(reg[id]||{},d);} return Promise.resolve(); }})})};
  let domReady=null, lastMsg=''; const saved=[];
  const RD=Date; class FD extends RD{constructor(...a){ if(a.length) super(...a); else super(today);} static now(){return new RD(today).getTime();}}
  const win={__OTV_APP:true,addEventListener(){},__TAURI__:{core:{invoke},event:{listen(){}}},claude:{use:n=>Promise.resolve(n==='downloads'?{save:f=>{saved.push(f.filename);return Promise.resolve();}}:db)},
    __otvAll:n=>n==='registry'?reg:n==='mail'?mail:n==='answers'?(o.answers||{}):n==='alerts'?(o.alerts||{}):{}, __otvLog:m=>{}, __otvSrcHealth:()=>o.health||[], setTimeout, clearTimeout, console};
  win.window=win; win.document={addEventListener:(e,f)=>{ if(e==='DOMContentLoaded') domReady=f; },getElementById:()=>null,createElement:()=>({append(){},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},style:{}})}; win.crypto={getRandomValues:a=>a};
  win.Date=FD; win.Blob=class{constructor(p){this.p=p;}}; win.atob=x=>Buffer.from(x,'base64').toString('binary'); win.Uint8Array=Uint8Array; vm.createContext(win); vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..','web','reports.js'),'utf8'),win);
  return Promise.resolve(domReady&&domReady()).then(()=>new Promise(r=>setTimeout(r,50))).then(()=>win.__otvReports.update()).then(()=>o.twice?win.__otvReports.update():0).then(()=>{ if(o.press){ win.__otvReports.newWeek(); return new Promise(r=>setTimeout(r,200)); } }).then(()=>{
    const sortA=a=>a.map(x=>x.slice().sort()); const out={calls:calls.filter(c=>typeof c==='string'), saved, period:state.period, adds:calls.filter(c=>c.add).map(c=>c.add.slice().sort()), reg:Object.fromEntries(Object.entries(reg).map(([k,v])=>[k,v.report+(v.reportRef?' '+v.reportRef:'')+(v.reason?' | '+v.reason.slice(0,60):'')]))};
    let ok=true; if(o.inspect){ const e=o.inspect(bodies,out,reg); if(e){ ok=false; console.log('  FAIL',e); } } for (const [k,v] of Object.entries(expect.reg||{})) if(!String(out.reg[k]).startsWith(v)){ ok=false; console.log('  FAIL',name,k,'got',out.reg[k],'want',v); }
    if (expect.calls && !expect.calls.every(c=>out.calls.includes(c))){ ok=false; console.log('  FAIL calls',out.calls); }
    if (expect.noCalls && expect.noCalls.some(c=>out.calls.includes(c))){ ok=false; console.log('  FAIL unexpected calls',out.calls); }
    if (expect.period && out.period!==expect.period){ ok=false; console.log('  FAIL period',out.period); }
    if (expect.msg && !expect.msg.test(lastMsg)){ ok=false; console.log('  FAIL msg'); }
    if (expect.adds!==undefined && JSON.stringify(out.adds)!==JSON.stringify(expect.adds)){ ok=false; console.log('  FAIL adds',JSON.stringify(out.adds),'want',JSON.stringify(expect.adds)); }
    console.log(ok?'OK  ':'BAD ',name); console.log('     msg:', lastMsg.slice(0,400)); if(!ok) console.log(out); return ok;
  });
}
const R=(plat,date,time,author,text,extra)=>Object.assign({platform:plat,date,time,author,text:text.slice(0,300),fullText:text,source:'auto',report:'pending',reportRef:''},extra||{});
const tbl=[['Сайт',1,'09.10.2026','Терапия',T.trub],['Сайт',2,'10.10.2026','ГКБ 24',T.byk],['Сайт',3,'12.10.2026','ГКБ 24',T.luc],['Сайт',4,'12.10.2026','Приёмное отделение',T.kozL],['Сайт',5,'12.10.2026','ГКБ 24',T.stup],['Сайт',6,'14.10.2026','Хирургия',T.led],['ПроДокторов',1,'09.10.2026','Хирургия',T.pd1]];
const regBase={
 'site-trub':R('Сайт','2026-10-09','08:15','Иванова Анна Петровна',T.trub,{report:'positive',reportRef:'Позитив · Сайт №1'}),
 'site-byk':R('Сайт','2026-10-10','11:26','Смирнова Ольга Ивановна',T.byk,{report:'positive',reportRef:'Позитив · Сайт №2'}),
 'site-luc':R('Сайт','2026-10-12','16:02','Кузнецова Мария Олеговна',T.luc,{report:'positive',reportRef:'Позитив · Сайт №3'}),
 'site-kozL':R('Сайт','2026-10-12','16:12','Попова Елена Сергеевна',T.kozL,{report:'positive',reportRef:'Позитив · Сайт №5'}),
 'site-kozS':R('Сайт','2026-10-12','14:40','Попова Елена Сергеевна',T.kozS,{report:'positive',reportRef:'Позитив · Сайт №4'}),
 'site-stup':R('Сайт','2026-10-12','15:33','Соколов И И',T.stup,{report:'positive',source:'manual'}),
 'site-led1':R('Сайт','2026-10-14','10:05','Морозова Нина Васильевна',T.led,{report:'positive',reportRef:'Позитив · Сайт №5'}),
 'site-led2':R('Сайт','2026-10-14','15:52','Морозова Нина Васильевна',T.led,{report:'positive',reportRef:'Позитив · Сайт №6'}),
 'pd-1':R('ПроДокторов','2026-10-09','','Мария',T.pd1,{report:'positive',reportRef:'Позитив · ПроДокторов №1'}),
};
const mail={'site-kozS':{kind:'thanks'},'site-kozL':{kind:'thanks'},'site-stup':{kind:'thanks'},'site-led1':{kind:'thanks'},'site-led2':{kind:'thanks',deleted:true},'site-trub':{kind:'thanks'},'site-byk':{kind:'thanks'},'site-luc':{kind:'thanks'}};
(async()=>{
 let all=true;
 all&=await run('1. как сейчас у вас: ничего не вносить, повторы убрать, Соколов найден', tbl, regBase, mail, {adds:[], reg:{
  'site-stup':'positive Позитив · Сайт №5','site-kozL':'positive Позитив · Сайт №4','site-kozS':'excluded | Повтор отзыва','site-led2':'excluded | Повтор отзыва','site-led1':'positive Позитив · Сайт №6','site-trub':'positive Позитив · Сайт №1'}});
 all&=await run('2. Соколова нет в таблице: внести (отмечен вручную)', tbl.filter(r=>r[4]!==T.stup), regBase, mail, {adds:[['site-stup:ГКБ 24']], reg:{'site-stup':'positive Позитив · Сайт №7'}});
 all&=await run('3. строку не-повтора удалили: не возвращать, спросить', tbl.filter(r=>r[4]!==T.luc), regBase, mail, {adds:[], reg:{'site-luc':'pending | Нужна проверка: строку этого отзыва удалили'}});
 const reg4=Object.assign({},regBase,{'site-new':R('Сайт','2026-10-15','09:00','Петров Пётр',T.other)}); const mail4=Object.assign({},mail,{'site-new':{kind:'thanks'}});
 all&=await run('4. новое письмо: внести', tbl, reg4, mail4, {adds:[['site-new:ГКБ 24']]});
 const reg5=Object.assign({},regBase,{'site-new2':R('Сайт','2026-10-15','09:30','Иванов Иван',T.other2)}); const mail5=Object.assign({},mail,{'site-new2':{kind:'thanks'}});
 all&=await run('5. то же короткое письмо, но другой человек: не повтор', tbl.concat([['Сайт',7,'15.10.2026','ГКБ 24',T.other]]), Object.assign({},reg5,{'site-new':R('Сайт','2026-10-15','09:00','Петров Пётр',T.other,{report:'positive',reportRef:'Позитив · Сайт №7'})}), Object.assign({},mail5,{'site-new':{kind:'thanks'}}), {adds:[['site-new2:ГКБ 24']]});
 all&=await run('6. оба повтора стоят в таблице двумя строками: предупредить', tbl.concat([['Сайт',7,'12.10.2026','Приёмное отделение',T.kozS]]), regBase, mail, {adds:[], reg:{'site-kozS':'excluded | Повтор отзыва'}});

 // ---- неделя кончилась, новый отчёт не начат ----
 const late={'pd-late':R('ПроДокторов','2026-10-14','','Анна','Очень довольна приёмом, всё объяснили понятно, отнеслись по-человечески, спасибо большое всем сотрудникам больницы.'),
   'site-late':R('Сайт','2026-10-15','17:40','Петров Пётр',T.other2)};
 const nxt={'ya-19':R('Яндекс','2026-10-19','','Олег',T.other), 'site-20':R('Сайт','2026-10-20','08:10','Сидоров Иван','Спасибо всем сотрудникам больницы за внимание и заботу во время лечения, всё было организовано чётко.')};
 const regL=Object.assign({},regBase,late,nxt), mailL=Object.assign({},mail,{'site-late':{kind:'thanks'},'site-20':{kind:'thanks'}});
 all&=await run('7. вторник, неделя 09–15 закрыта (чт 15:00), новый отчёт не начат: в старую ничего не вносить, всё запомнить', tbl, regL, mailL,
   {noCalls:['export','newweek'], period:'09.10–15.10.2026', adds:[], reg:{'pd-late':'pending','site-late':'pending','ya-19':'pending','site-20':'pending'}, msg:/закрыта в четверг в 15:00[\s\S]*внесу их, когда начнёте новый отчёт/}, {today:'2026-10-20T09:05:00'});
 all&=await run('8. «Начать новый отчёт»: старые сохранены, всё запомненное (и опоздавшее с прошлой недели) внесено в новую', tbl, regL, mailL,
   {calls:['export','newweek'], period:'16.10–22.10.2026', adds:[['pd-late:ГКБ 24','site-20:ГКБ 24','site-late:ГКБ 24','ya-19:ГКБ 24']], reg:{'site-trub':'positive Позитив · Сайт №1','pd-1':'positive Позитив · ПроДокторов №1'}},
   {today:'2026-10-20T09:05:00', press:true, inspect:(B,out,reg)=>{ if(reg['site-trub'].reportWeek!=='2026-10-09') return 'строка закрытой недели не помечена неделей'; }});
 all&=await run('9. не удалось сохранить старые отчёты: новую неделю не начинать', tbl, regL, mailL,
   {noCalls:['newweek'], period:'09.10–15.10.2026'}, {today:'2026-10-20T09:05:00', press:true, exportFail:true});
 all&=await run('10. повторное обновление закрытой недели ничего не вносит и не дублирует', tbl, regL, mailL, {adds:[]}, {today:'2026-10-20T09:05:00', twice:true});
 const regC=Object.assign({},regBase,{'site-chk':R('Сайт','2026-10-15','10:00','Сидоров',T.other,{report:'pending',reason:'Нужна проверка: тон не ясен',decision:{forced:true,tone:'positive',dept:'Хирургия',doctor:'—'}})});
 all&=await run('11. решение в «Нужна проверка»: сразу в отчёт с выбранным отделением', tbl, regC, Object.assign({},mail,{'site-chk':{kind:'thanks'}}), {adds:[['site-chk:Хирургия']]});
 const regX=Object.assign({},regBase,{'pd-x':R('ПроДокторов','2026-10-15','','Гость',T.other,{report:'excluded',source:'manual',reason:'не отзыв'})});
 all&=await run('12. исключённый вами отзыв не вносится', tbl, regX, mail, {adds:[], reg:{'pd-x':'excluded'}});

 // ---- «Негатив»: пустые строки и ответы ----
 const negT='ОТНОШЕНИЕ ПРОСТО ЖЕСТЬ!\n\nВыгнали ночью на улицу.\n\n  \nМата не хватит.';
 const regN=Object.assign({},regBase,{'ya-neg':R('Яндекс','2026-10-15','','Злой',negT,{rating:1})});
 const ansN={'ya-neg':{answer:'Здравствуйте.\n\nНам очень жаль.\n\nРазберёмся.',status:'published'}};
 all&=await run('13. негатив с пустыми строками: в Google уходит без пустых строк, ответ целиком', tbl, regN, mail, {}, {inspect:(B)=>{
   const a=B.find(b=>b.action==='add'); if(!a||!a.negative||!a.negative.length) return 'нет негатива';
   const x=a.negative[0]; if(/\n\s*\n/.test(x.text)||/\n\s*\n/.test(x.answer)) return 'пустые строки остались';
   if(!/Разберёмся/.test(x.answer)) return 'ответ обрезан: '+x.answer; }, answers:ansN});
 const st13={posTitle:'Позитив',negTitle:'Негатив',tab:'x',period:'09.10–15.10.2026',start:'2026-10-09',end:'2026-10-15',positive:[],negative:[{n:1,platform:'Яндекс',date:'15.10.2026',text:'ОТНОШЕНИЕ ПРОСТО ЖЕСТЬ! Выгнали ночью на улицу. Мата не хватит.',answer:'Здравствуйте.',full:'ОТНОШЕНИЕ ПРОСТО ЖЕСТЬ!\nВыгнали ночью на улицу.\nМата не хватит.',fullAnswer:'Здравствуйте.',link:''}]};
 all&=await run('14. в «Негативе» ответ обрезан: программа сама дописывает его целиком', [], {'ya-neg':R('Яндекс','2026-10-15','','Злой',negT,{rating:1,report:'negative',reportRef:'Негатив · блок 1'})}, {}, {}, {state0:st13, answers:ansN, inspect:(B)=>{
   const a=B.find(b=>b.action==='patch'); if(!a) return 'ответ не обновлён'; if(!/Разберёмся/.test(a.items[0].answer)||/\n\s*\n/.test(a.items[0].answer)) return 'плохой ответ'; if(B.some(b=>b.action==='add'&&b.negative&&b.negative.length)) return 'внесён второй раз'; }});
 all&=await run('15. скрипт в Google старый: новую неделю не начинать, попросить обновить скрипт', tbl, regL, mailL,
   {noCalls:['export','newweek'], period:'09.10–15.10.2026', adds:[]}, {today:'2026-10-20T09:05:00', press:true, v:2});
 // ---- неделя по поступлению ----
 const W16={posTitle:'Позитив',negTitle:'Негатив',tab:'x',period:'16.10–22.10.2026',start:'2026-10-16',end:'2026-10-22',positive:[],negative:[]};
 const A=(d,t)=>new Date(Date.parse(d+'T'+t+':00+03:00')).toISOString();
 const regA={
  'pd-old13':R('ПроДокторов','2026-10-13','','Ольга','Отзыв написан тринадцатого, а опубликован после модерации только семнадцатого, спасибо хирургам.',{arrivedAt:A('2026-10-17','10:00')}),
  'pd-21':R('ПроДокторов','2026-10-21','','Нина','Спасибо всем сотрудникам больницы за заботу и внимание, всё прошло хорошо и быстро, рекомендую.',{arrivedAt:A('2026-10-21','09:00')}),
  'ya-thu1530':R('Яндекс','2026-10-22','','Пётр','Большое спасибо больнице, всё понравилось, персонал внимательный, рекомендую.',{arrivedAt:A('2026-10-22','15:30')}),
  'pd-was15':R('ПроДокторов','2026-10-15','','Анна','Этот отзыв уже стоял в отчёте прошлой недели и сдан, его нельзя вносить второй раз.',{arrivedAt:A('2026-10-15','11:00'),report:'positive',reportRef:'Позитив · ПроДокторов №7',reportWeek:'2026-10-09'})};
 all&=await run('16. среда: отзыв от 13.10, опубликованный 17.10, идёт в эту неделю; пришедший в четверг после 15:00 ждёт; сданный не повторяется', [], regA, {},
   {adds:[['pd-21:ГКБ 24','pd-old13:ГКБ 24']], reg:{'ya-thu1530':'pending','pd-was15':'positive'}, msg:/после закрытия недели \(22\.10 15:00\): 1/}, {today:'2026-10-21T12:00:00', state0:W16});
 all&=await run('17. четверг 16:00: неделя закрыта, ничего не вносится', [], regA, {}, {adds:[], msg:/закрыта в четверг в 15:00/}, {today:'2026-10-22T16:00:00', state0:W16});
 const regB=Object.assign({},regA,{'pd-21':Object.assign({},regA['pd-21'],{report:'positive',reportRef:'Позитив · ПроДокторов №1',reportWeek:'2026-10-16'}),'pd-old13':Object.assign({},regA['pd-old13'],{report:'positive',reportRef:'Позитив · ПроДокторов №2',reportWeek:'2026-10-16'}),
   'site-1430':R('Сайт','2026-10-22','14:30','Кира','Письмо пришло в четверг в 14:30, но внести не успели до закрытия, оно не должно потеряться.',{arrivedAt:A('2026-10-22','14:30')})});
 all&=await run('18. пятница, новый отчёт: пришедшее после закрытия и не успевшее до него внесены в новую неделю, сданное не повторено', [], regB, {'site-1430':{kind:'thanks'}},
   {calls:['newweek'], period:'23.10–29.10.2026', adds:[['site-1430:ГКБ 24','ya-thu1530:ГКБ 24']]}, {today:'2026-10-23T10:00:00', state0:W16, press:true});
 all&=await run('19. почта не прочитана: отчёт предупреждает, что он неполный', tbl, regBase, mail, {msg:/Отчёт может быть неполным: не прочитаны Почта сайта \(нужен вход\)/}, {health:[{name:'Почта сайта',ok:false,okAt:'2026-10-14T06:00:00Z',needLogin:true},{name:'ПроДокторов',ok:true,okAt:'2026-10-15T08:00:00Z'}]});

 // ---- целостность отчёта: только одобренные ответы, полные тексты, свои ссылки ----
 const W=W16, A2=(d)=>A(d,'10:00');
 const drafty='Здравствуйте. Спасибо за подробный отзыв и тёплые слова о работе хирурга. Обязательно передадим их Татьяне Ильиничне.';
 const regI={'ya-a':R('Яндекс','2026-10-16','','А','Отношение просто жесть, выгнали ночью на улицу, это ужасно и недопустимо.',{rating:1,arrivedAt:A2('2026-10-16'),link:'https://yandex.ru/maps/org/1/reviews?reviews%5BpublicId%5D=AAA&utm_source=review'}),
   'ya-b':R('Яндекс','2026-10-16','','Б','Хирурга заменили без консультации, осмотра перед операцией не было, это плохо.',{rating:2,arrivedAt:A2('2026-10-16'),link:'https://yandex.ru/maps/org/1/reviews?reviews%5BpublicId%5D=AAA&utm_source=review'})};
 all&=await run('20. жалобы без одобренного ответа: в «Негатив» ответ «—», черновик генератора не идёт; одинаковая ссылка у двух отзывов не ставится', [], regI, {}, {}, {today:'2026-10-20T12:00:00', state0:W,
   answers:{'ya-a':{answer:drafty,draft:drafty,status:'pending'}}, inspect:(B)=>{ const a=B.find(b=>b.action==='add'); if(!a||a.negative.length!==2) return 'нет двух блоков';
     if(a.negative.some(x=>x.answer!=='—')) return 'в отчёт ушёл черновик: '+a.negative.map(x=>x.answer).join(' / ');
     if(a.negative.some(x=>/publicId/.test(x.link))) return 'одинаковая ссылка у двух отзывов осталась'; }});
 const longPD='Добрый день! Меня зовут Мария. '+'Очень благодарна доктору за внимание и заботу, всё объяснила и успокоила. '.repeat(25)+'Сама больница чистая и уютная, всем рекомендую.';
 const stI={posTitle:'Позитив',negTitle:'Негатив',tab:'x',period:'16.10–22.10.2026',start:'2026-10-16',end:'2026-10-22',
   positive:[{platform:'ПроДокторов',num:'4',date:'18.10.2026',dept:'Гинекология',doctor:'',text:head(longPD),full:longPD.slice(0,1500)}],
   negative:[{n:1,platform:'Яндекс',date:'16.10.2026',text:head(regI['ya-a'].fullText),answer:head(drafty),full:regI['ya-a'].fullText,fullAnswer:drafty,link:regI['ya-a'].link},
             {n:2,platform:'Яндекс',date:'16.10.2026',text:head(regI['ya-b'].fullText),answer:'Ответили сами',full:regI['ya-b'].fullText,fullAnswer:'Здравствуйте. Ответ, который вписала сама в документ.',link:regI['ya-a'].link}]};
 const regI2={'pd-long':R('ПроДокторов','2026-10-18','','Мария',longPD,{report:'positive',reportRef:'Позитив · ПроДокторов №4',reportWeek:'2026-10-16',arrivedAt:A2('2026-10-18')}),
   'ya-a':Object.assign({},regI['ya-a'],{report:'negative',reportRef:'Негатив · блок 1',reportWeek:'2026-10-16'}),'ya-b':Object.assign({},regI['ya-b'],{report:'negative',reportRef:'Негатив · блок 2',reportWeek:'2026-10-16'})};
 all&=await run('21. уже записанное само исправляется: обрезанный текст дописан, неподтверждённые ответы стёрты, чужая ссылка заменена', [], regI2, {}, {}, {today:'2026-10-20T12:00:00', state0:stI,
   answers:{'ya-a':{answer:drafty,draft:drafty,status:'pending'},'ya-b':{answer:drafty,draft:drafty,status:'pending'}}, inspect:(B)=>{ const p=B.find(b=>b.action==='patch'); if(!p) return 'ничего не исправлено';
     const pos=p.items.find(i=>i.kind==='pos'), n1=p.items.find(i=>i.n===1), n2=p.items.find(i=>i.n===2);
     if(!pos||!/всем рекомендую/.test(pos.text)) return 'обрезанный текст не дописан';
     if(!n1||n1.answer!=='—') return 'черновик в блоке 1 не стёрт';
     if(!n2||n2.answer!=='—') return 'ответ без подтверждения не заменён на «—»';
     if(!n1.link||/publicId/.test(n1.link)||!n2||/publicId/.test(n2.link||'')) return 'общая ссылка не заменена';
     if(B.some(b=>b.action==='add'&&((b.negative||[]).length||(b.positive||[]).length))) return 'внесено второй раз'; }});
 all&=await run('22. опубликованный ответ заменяет черновик в «Негативе»', [], regI2, {}, {}, {today:'2026-10-20T12:00:00', state0:stI,
   answers:{'ya-a':{answer:'Здравствуйте. Одобренный ответ.',draft:drafty,status:'published'}}, inspect:(B)=>{ const p=B.find(b=>b.action==='patch'); const n1=p&&p.items.find(i=>i.n===1); if(!n1||n1.answer!=='Здравствуйте. Одобренный ответ.') return 'одобренный ответ не встал'; }});
 const regTC={'go-cut':R('Google','2026-10-16','','К','Здравствуйте! Лежала в гинекологии у Карапетян. Операцию делали три часа. На третий день уже поехала домой....',{rating:5,arrivedAt:A2('2026-10-16')}),
   'site-subj':R('Сайт','2026-10-19','10:00','Л','Жалоба на действия сотрудников ГКБ № 24',{arrivedAt:A2('2026-10-19')})};
 all&=await run('23. обрезанный отзыв Google и письмо без текста (одна тема) не идут в отчёт, а ждут проверки', [], regTC, {'site-subj':{kind:'complaint',subject:'Жалоба на действия сотрудников ГКБ № 24'}},
   {adds:[], reg:{'go-cut':'pending | Нужна проверка: текст отзыва обрезан','site-subj':'pending | Нужна проверка: прочиталась только тема'}}, {today:'2026-10-20T12:00:00', state0:W});

 // черновик в документе с другим приветствием, а у самого письма черновик уже переписан: всё равно узнаётся и стирается
 const garb='Здравствуйте, Борис! Спасибо за подробный отзыв и тёплые слова о работе хирурга. Обязательно передадим их Татьяне Ильиничне и команде отделения.';
 const stG={posTitle:'Позитив',negTitle:'Негатив',tab:'x',period:'16.10–22.10.2026',start:'2026-10-16',end:'2026-10-22',positive:[],
   negative:[{n:1,platform:'Сайт больницы',date:'20.10.2026',text:'Прошу удалить приём из медкарты',answer:head(garb),full:'Прошу удалить приём из медкарты, врач перепутал пациентов и не исправляет.',fullAnswer:garb,link:'—'},
             {n:2,platform:'Сайт больницы',date:'20.10.2026',text:'Второе письмо',answer:'Мой ответ',full:'Второе письмо с жалобой на ожидание в приёмном отделении.',fullAnswer:'Ответила по почте, пригласили на разбор.',link:'—'},
             {n:3,platform:'Сайт больницы',date:'20.10.2026',text:'Третье письмо',answer:'Наш ответ',full:'Третье письмо, жалоба на грубость на посту.',fullAnswer:'Здравствуйте. Записанный программой ответ, который теперь не одобрен.',link:'—'}]};
 const regG={'site-k':R('Сайт','2026-10-20','19:00','Б','Прошу удалить приём из медкарты, врач перепутал пациентов и не исправляет.',{report:'negative',reportRef:'Негатив · блок 1',reportWeek:'2026-10-16',arrivedAt:A2('2026-10-20')}),
   'site-m':R('Сайт','2026-10-20','19:10','В','Второе письмо с жалобой на ожидание в приёмном отделении.',{report:'negative',reportRef:'Негатив · блок 2',reportWeek:'2026-10-16',arrivedAt:A2('2026-10-20')}),
   'site-w':R('Сайт','2026-10-20','19:20','Г','Третье письмо, жалоба на грубость на посту.',{report:'negative',reportRef:'Негатив · блок 3',reportWeek:'2026-10-16',arrivedAt:A2('2026-10-20'),negWritten:'Здравствуйте. Записанный программой ответ, который теперь не одобрен.'})};
 all&=await run('24. в «Негативе» остаётся только настоящий ответ, остальное стирается', [], regG, {'site-k':{kind:'complaint',status:'todo',draft:''},'site-m':{kind:'complaint',status:'todo'},'site-w':{kind:'complaint',status:'todo'}}, {}, {today:'2026-10-20T22:00:00', state0:stG,
   answers:{'ya-other':{draft:'Здравствуйте. Спасибо за подробный отзыв и тёплые слова о работе хирурга. Обязательно передадим их Татьяне Ильиничне и команде отделения.',status:'pending'}},
   inspect:(B,out,reg)=>{ const p=B.find(b=>b.action==='patch'); if(!p) return 'ничего не исправлено'; const n=k=>p.items.find(i=>i.n===k);
     if(!n(1)||n(1).answer!=='—') return 'черновик с другим приветствием не стёрт'; if(!n(2)||n(2).answer!=='—') return 'неподтверждённый ответ остался'; if(!n(3)||n(3).answer!=='—') return 'записанное программой не стёрто';
     if(reg['site-k'].negWritten!=='—') return 'программа не запомнила, что записала'; }});

 // только настоящие ответы: с площадки, из «Отправленных», опубликованный программой, отметка об обжаловании
 const regR={'ya-r':R('Яндекс','2026-10-17','','А','Плохое отношение в приёмном отделении, ждали три часа без объяснений.',{rating:1,arrivedAt:A2('2026-10-17'),reply:'Здравствуйте. Это ответ больницы, прочитанный на Яндексе.'}),
   'site-r':R('Сайт','2026-10-17','12:00','Б','Жалоба: в отделении нагрубили родственникам при посещении пациента.',{arrivedAt:A2('2026-10-17')}),
   'ya-ok':R('Яндекс','2026-10-17','','В','Хамство медсестры на посту, никто не извинился и не помог.',{rating:1,arrivedAt:A2('2026-10-17')}),
   'ya-ap':R('Яндекс','2026-10-17','','Г','Всё ужасно, больше никогда не приду в эту больницу, кошмар.',{rating:1,arrivedAt:A2('2026-10-17')}),
   'pd-n':R('ПроДокторов','2026-10-17','','Д','Врач не объяснил назначения и был груб, осталась недовольна приёмом.',{rating:2,arrivedAt:A2('2026-10-17')})};
 all&=await run('25. в «Негатив» идут только настоящие ответы', [], regR, {'site-r':{kind:'complaint',status:'done',reply:'Здравствуйте. Это ваш ответ из «Отправленных».',draft:'Черновик письма'}}, {}, {today:'2026-10-20T12:00:00', state0:W,
   answers:{'ya-ok':{answer:'Одобрен, но ещё не опубликован',status:'approved'}}, alerts:{'ya-ap':{markAppealed:true}},
   inspect:(B)=>{ const a=B.find(b=>b.action==='add'); if(!a) return 'нет записи'; const g=id=>(a.negative.find(x=>x.id===id)||{}).answer;
     if(g('ya-r')!=='Здравствуйте. Это ответ больницы, прочитанный на Яндексе.') return 'ответ с площадки не взят: '+g('ya-r');
     if(g('site-r')!=='Здравствуйте. Это ваш ответ из «Отправленных».') return 'ответ из почты не взят: '+g('site-r');
     if(g('ya-ok')!=='—') return 'неопубликованный ответ попал в отчёт';
     if(g('ya-ap')!=='Отзыв отправлен на дополнительную проверку.') return 'обжалование не отмечено';
     if(g('pd-n')!=='—') return 'ПроДокторов без обжалования: '+g('pd-n'); }});

 // номера блоков сдвинулись: в реестре стоит старый номер, программа правит только блок с текстом этого отзыва
 const stS={posTitle:'Позитив',negTitle:'Негатив',tab:'x',period:'16.10–22.10.2026',start:'2026-10-16',end:'2026-10-22',positive:[],
   negative:[{n:1,platform:'Яндекс',date:'16.10.2026',text:'Отношение просто жесть',answer:'—',full:'Отношение просто жесть, выгнали ночью на улицу одного, мата не хватит.',fullAnswer:'—',link:'https://ya/A'},
             {n:2,platform:'ПроДокторов',date:'16.10.2026',text:'Врач нагрубил',answer:'—',full:'Врач нагрубил на приёме и ничего не объяснил про назначения.',fullAnswer:'—',link:'https://pd/2'}]};
 const regS={'ya-A':R('Яндекс','2026-10-16','','А','Отношение просто жесть, выгнали ночью на улицу одного, мата не хватит.',{rating:1,report:'negative',reportRef:'Негатив · блок 2',reportWeek:'2026-10-16',arrivedAt:A2('2026-10-16'),link:'https://ya/A'}),
   'pd-old':R('ПроДокторов','2026-10-12','','С','Прошлая неделя: долго ждала в коридоре, никто не подошёл.',{rating:2,report:'negative',reportRef:'Негатив · блок 1',reportWeek:'2026-10-09',arrivedAt:A2('2026-10-12'),reply:'Ответ на отзыв прошлой недели',link:'https://pd/old'}),
   'pd-2':R('ПроДокторов','2026-10-16','','Б','Врач нагрубил на приёме и ничего не объяснил про назначения.',{rating:2,report:'negative',reportRef:'Негатив · блок 1',reportWeek:'2026-10-16',arrivedAt:A2('2026-10-16'),reply:'Здравствуйте. Настоящий ответ на ПроДокторов.'})};
 all&=await run('26. отзыв прошлой недели с тем же номером блока и перепутанные номера: ответ и ссылка встают только в блок со своим текстом', [], regS, {}, {}, {today:'2026-10-20T22:00:00', state0:stS,
   inspect:(B)=>{ const p=B.find(b=>b.action==='patch'); if(!p) return 'ничего не исправлено'; const n=k=>p.items.find(i=>i.n===k);
     if(n(1)&&n(1).answer&&n(1).answer!=='—') return 'чужой ответ ушёл в блок Яндекса: '+n(1).answer;
     if(!n(2)||n(2).answer!=='Здравствуйте. Настоящий ответ на ПроДокторов.') return 'ответ не встал в свой блок';
     if(n(1)&&n(1).link&&n(1).link!=='https://ya/A') return 'ссылка Яндекса заменена чужой'; }});
 console.log(all?'ALL OK':'SOME FAILED');
})();
