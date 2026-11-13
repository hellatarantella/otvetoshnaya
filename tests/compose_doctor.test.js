// Ответы на странице врача (06.11): повод из отзыва (помогло лечение, всё объяснили, спокойно на приёме, рекомендует),
// без имени врача, без «передадим», без больницы и отделений (правило страницы врача); варианты разные, без повторов слов
global.window = {}; global.document = {}; require('../web/speech.js'); require('../web/compose.js');
const C = window.__otvCompose; let bad = 0;
const t = (ok, name, d) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : ' ' + JSON.stringify(d).slice(0, 800))); if (!ok) bad++; };
const FORBID = /больниц|передад|стационар|отделени|наш\S* сотрудник|Анн|Викторовн/i;
const cases = [
  ['Спасибо Анне Викторовне за внимательный приём и понятные объяснения. Всё прошло спокойно, без лишних волнений. Впервые пришла к этому врачу.', /понятно объяснили|спокойно и комфортно|не осталось вопросов|внимательное отношение|первое знакомство/],
  ['Отличный хирург, золотые руки! Сделал операцию, восстановилась быстро.', /смогли помочь|довольны лечением|благополучно|прошло хорошо|рекомендаци/],
  ['Врач очень помог моей маме, теперь ей стало легче. Рекомендую.', /смогли помочь|довольны лечением|рекоменд|родном человеке/]];
for (const [r, re] of cases) {
  let n = 0, m = 0, rep = 0, forb = [], texts = new Set();
  for (let k = 0; k < 15; k++) { const V = C.variants({ review: r, rating: 5 }, { tone: 'positive', type: 'doctor' }, 6);
    V.forEach(v => { n++; texts.add(v.text); if (re.test(v.text)) m++; if (C.repeats(v.text)) rep++; if (FORBID.test(v.text)) forb.push(v.text); }); }
  t(m / n >= 0.5, 'повод в ответе: ' + r.slice(0, 40), m / n);
  t(!forb.length && !rep, 'правило страницы врача и без повторов: ' + r.slice(0, 30), [forb.slice(0, 2), rep]);
  t(texts.size >= 12, 'разнообразие: ' + texts.size + ' разных ответов', texts.size);
}
// на странице больницы «впервые» — про больницу можно, на странице врача — нет
const H = C.variants({ review: 'Впервые лежала в этой больнице, всё понравилось.', rating: 5 }, { tone: 'positive', type: 'hospital' }, 10);
t(H.length > 0, 'страница больницы: варианты есть', H.length);
// вопрос не о записи — без «записаться»; о записи — с записью
{ let a = 0, b = 0;
  for (let k = 0; k < 10; k++) { C.variants({ review: 'Можно ли навестить родственника в реанимации?' }, { tone: 'question', type: 'question' }, 5).forEach(v => { if (/запис/i.test(v.text)) a++; });
    C.variants({ review: 'Как записаться на госпитализацию в кардиологию?' }, { tone: 'question', type: 'question' }, 5).forEach(v => { if (/запис/i.test(v.text)) b++; }); }
  console.log((a === 0 && b > 0 ? 'ok   ' : 'FAIL ') + 'вопрос о посещении — без «записаться», о госпитализации — с записью ' + a + '/' + b); if (!(a === 0 && b > 0)) bad++; }
console.log(bad ? 'SOME FAILED' : 'ALL OK');
if (bad) process.exitCode = 1;
