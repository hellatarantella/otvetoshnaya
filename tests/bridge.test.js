// Стык «окно площадки → программа»: всё, что вернул сборщик (письма, ответы, диагностика и любое новое поле), доходит до программы целиком
const fs=require('fs'),path=require('path'),vm=require('vm');
const rs=fs.readFileSync(path.join(__dirname,'..','src-tauri','src','lib.rs'),'utf8');
const a=rs.indexOf('let bridge = format!('), b=rs.indexOf('r#"',a)+3, e=rs.indexOf('"#,',b);
let tpl=rs.slice(b,e).replace(/\{\{/g,'\u0001').replace(/\}\}/g,'\u0002');
const fill={id:'"mail"',prefix:'"https://owa.mos.ru/"',wait:'0',debug:'false',reuse:'false',
  script:'Promise.resolve({items:[{id:"site-1"}],seen:1,diag:{sent:3},answered:["site-1"],replies:{"site-1":"Здравствуйте! Ответ."},future:42})'};
tpl=tpl.replace(/\{(\w+)(?::\?)?\}/g,(m,k)=>fill[k]!=null?fill[k]:m).replace(/\u0001/g,'{').replace(/\u0002/g,'}');
let got=null; const win={location:{href:'https://owa.mos.ru/owa/x'},document:{createElement:()=>({}),body:{prepend(){}}},
  __TAURI_INTERNALS__:{invoke:(c,a)=>{ got=JSON.parse(a.payload); return Promise.resolve(); }},setTimeout:(f)=>f(),Promise,JSON,String};
win.window=win; win.top=win; vm.createContext(win); vm.runInContext(tpl,win);
setTimeout(()=>{ let ok=true; const chk=(c,m)=>{ console.log((c?'OK  ':'FAIL')+' '+m); ok=ok&&c; };
  chk(got&&got.ok&&Array.isArray(got.items)&&got.items.length===1,'письма дошли');
  chk(got&&got.replies&&got.replies['site-1']==='Здравствуйте! Ответ.','ответы из «Отправленных» дошли до программы');
  chk(got&&got.answered&&got.diag&&got.seen===1,'отвеченные и диагностика дошли');
  chk(got&&got.future===42,'любое новое поле сборщика доходит без правки обёртки');
  console.log(ok?'ALL OK':'SOME FAILED'); },50);
