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
  let state=o.state0?JSON.parse(JSON.stringify(o.state0)):{posTitle:'Позитив',negTitle:'Негатив',tab:'x',period:'09.10–15.10.2026',start:'2026-10-09',end:'2026-10-15',
    positive:tableRows.map((r,i)=>({platform:r[0],num:String(r[1]),date:r[2],dept:r[3]||'',doctor:'',text:head(r[4])})),negative:[]};
  const bodies=[]; const invoke=(cmd,args)=>{ const b=JSON.parse(args.body); calls.push(b.action); bodies.push(b);
    if(b.action==='state') return Promise.resolve(JSON.stringify({ok:true,version:3,state}));
    if(b.action==='refs') return Promise.resolve(JSON.stringify({ok:true,version:(o.v||3),refs:{departments:[],exceptions:[],staff:[],categories:['ГКБ 24','Хирургия','Приёмное отделение','Терапия']}}));
    if(b.action==='add'){ const refs={}; let n=tableRows.filter(r=>r[0]==='Сайт').length; (b.negative||[]).forEach((x,i)=>{ const n=state.negative.length+1; state.negative.push({n,platform:x.platform,date:x.date,text:head(x.text),answer:head(x.answer)}); refs[x.id]='Негатив · блок '+n; }); (b.positive||[]).forEach(p=>{ const k=Math.max(0,...tableRows.filter(r=>r[0]===p.platform).map(r=>+r[1]))+1; refs[p.id]='Позитив · '+p.platform+' №'+k; tableRows.push([p.platform,k,p.date,p.dept,p.text]); state.positive.push({platform:p.platform,num:String(k),date:p.date,dept:p.dept,doctor:'',text:head(p.text)}); }); calls.push({add:b.positive.map(p=>p.id+':'+p.dept)}); return Promise.resolve(JSON.stringify({ok:true,version:(o.v||3),refs,state})); }
    if(b.action==='export'){ if(o.exportFail) return Promise.resolve(JSON.stringify({ok:false,error:'нет доступа к файлу'})); return Promise.resolve(JSON.stringify({ok:true,version:(o.v||3),files:[{name:'Позитив.xlsx',data:'AA=='},{name:'Негатив.docx',data:'AA=='}]})); }
    if(b.action==='newweek'){ const e=new Date(state.end+'T00:00:00Z'); const a=new Date(e.getTime()+864e5), z=new Date(e.getTime()+7*864e5); const f=d=>d.toISOString().slice(0,10), dm=d=>f(d).slice(8,10)+'.'+f(d).slice(5,7);
      if(b.expect!==dm(a)+'–'+dm(z)) return Promise.resolve(JSON.stringify({ok:false,error:'Отчёт уже сменился'}));
      state=Object.assign({},state,{start:f(a),end:f(z),period:dm(a)+'–'+dm(z)+'.'+z.getUTCFullYear(),positive:[],negative:[]}); tableRows=[]; return Promise.resolve(JSON.stringify({ok:true,version:(o.v||3),period:state.period,state})); }
    if(b.action==='numbers'||b.action==='answers') return Promise.resolve(JSON.stringify({ok:true,version:(o.v||3)}));
    return Promise.resolve(JSON.stringify({ok:true,version:(o.v||3)}));
  };
  const db={collection:c=>({doc:id=>({get:()=>Promise.resolve(c==='settings'&&id==='google'?{exists:true,data:()=>({url:'u',token:'t'.repeat(40),paired:true})}:{exists:false}),
    set:d=>{ if(c==='settings'&&id==='report') lastMsg+=JSON.stringify(d)+'\n'; return Promise.resolve(); }, update:d=>{ if(c==='registry'){ reg[id]=Object.assign(reg[id]||{},d);} return Promise.resolve(); }})})};
  let domReady=null, lastMsg=''; const saved=[];
  const RD=Date; class FD extends RD{constructor(...a){ if(a.length) super(...a); else super(today);} static now(){return new RD(today).getTime();}}
  const win={__OTV_APP:true,addEventListener(){},__TAURI__:{core:{invoke},event:{listen(){}}},claude:{use:n=>Promise.resolve(n==='downloads'?{save:f=>{saved.push(f.filename);return Promise.resolve();}}:db)},
    __otvAll:n=>n==='registry'?reg:n==='mail'?mail:n==='answers'?(o.answers||{}):{}, __otvLog:m=>{}, __otvSrcHealth:()=>o.health||[], setTimeout, clearTimeout, console};
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
 const ansN={'ya-neg':{answer:'Здравствуйте.\n\nНам очень жаль.\n\nРазберёмся.',status:'pending'}};
 all&=await run('13. негатив с пустыми строками: в Google уходит без пустых строк, ответ целиком', tbl, regN, mail, {}, {inspect:(B)=>{
   const a=B.find(b=>b.action==='add'); if(!a||!a.negative||!a.negative.length) return 'нет негатива';
   const x=a.negative[0]; if(/\n\s*\n/.test(x.text)||/\n\s*\n/.test(x.answer)) return 'пустые строки остались';
   if(!/Разберёмся/.test(x.answer)) return 'ответ обрезан: '+x.answer; }, answers:ansN});
 const st13={posTitle:'Позитив',negTitle:'Негатив',tab:'x',period:'09.10–15.10.2026',start:'2026-10-09',end:'2026-10-15',positive:[],negative:[{n:1,platform:'Яндекс',date:'15.10.2026',text:'ОТНОШЕНИЕ ПРОСТО ЖЕСТЬ! Выгнали ночью на улицу. Мата не хватит.',answer:'Здравствуйте.'}]};
 all&=await run('14. в «Негативе» ответ обрезан: программа сама дописывает его целиком', [], {'ya-neg':R('Яндекс','2026-10-15','','Злой',negT,{rating:1,report:'negative',reportRef:'Негатив · блок 1'})}, {}, {}, {state0:st13, answers:ansN, inspect:(B)=>{
   const a=B.find(b=>b.action==='answers'); if(!a) return 'ответ не обновлён'; if(!/Разберёмся/.test(a.items[0].answer)||/\n\s*\n/.test(a.items[0].answer)) return 'плохой ответ'; if(B.some(b=>b.action==='add'&&b.negative&&b.negative.length)) return 'внесён второй раз'; }});
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
 console.log(all?'ALL OK':'SOME FAILED');
})();
