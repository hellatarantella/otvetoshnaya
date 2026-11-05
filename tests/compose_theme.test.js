// Середина ответа под тему отзыва (05.11): благодарят команду — чаще «сотрудникам будет приятно»; подробный отзыв —
// «важно и приятно получать такие отзывы»; короткий — «рады, что вам у нас понравилось». Данные выдуманные
global.window = {}; global.document = {}; require('../web/speech.js'); require('../web/compose.js');
const C = window.__otvCompose; let bad = 0;
const t = (ok, name, d) => { console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : ' ' + JSON.stringify(d))); if (!ok) bad++; };
const share = (it, re) => { let n = 0, m = 0; for (let k = 0; k < 25; k++) { const V = C.variants(it, { tone: 'positive', type: 'hospital' }, 30); n += V.length; m += V.filter(v => re.test(v.text)).length; } return m / n; };
const team = { review: 'Огромное спасибо всему коллективу отделения, медсёстры чуткие, вся команда молодцы, спасибо персоналу за терпение и поддержку каждый день.', rating: 5 };
const plain = { review: 'Лечился в отделении неделю, процедуры проходили по графику, результат хороший, выписали вовремя, спасибо.', rating: 5 };
const re = /Сотрудникам будет приятно|поддерживают сотрудников|поддержка для команды/;
const a = share(team, re), b = share(plain, re);
t(a > b * 1.3, 'благодарят команду — фразы о сотрудниках заметно чаще', [a, b]);
const long = { review: 'Спасибо! '.repeat(50), rating: 5 }, short = { review: 'Спасибо, всё отлично!', rating: 5 };
const L1 = share(long, /Важно и приятно получать такие отзывы/), L0 = share({ review: 'Спасибо! '.repeat(35), rating: 5 }, /Важно и приятно получать такие отзывы/) || 0;
t(L1 > 0.05, 'подробный отзыв — «важно и приятно получать такие отзывы»', [L1, L0]);
t(share(short, /Рады, что вам у нас понравилось/) > 0.1, 'короткий — «рады, что вам у нас понравилось»');
console.log(bad ? 'SOME FAILED' : 'ALL OK');
