// Презентация недели: один отзыв — один раз во всей презентации, цитаты законченные и одного объёма, короткие названия отделений.
// Данные выдуманные.
global.window = {}; global.document = undefined;
require("../web/deck.js"); require("../web/deck-data.js");
const D = window.__otvDeck;
let fails = 0; const ok = (c, m, x) => { console.log((c ? "OK  " : "FAIL") + " " + m + (c || x === undefined ? "" : " " + JSON.stringify(x))); if (!c) fails++; };
const staff = { "Белкина": ["Белкина", "Анна", "Петровна", "Хирургия"], "Соколов": ["Соколов", "Иван", "Ильич", "Урология"], "Лисина": ["Лисина", "Ольга", "Юрьевна", "Терапия"], "Громов": ["Громов", "Пётр", "Сергеевич", "Кардиология"] };
const person = t => { const s = staff[t.split(/\s/)[0]]; return s ? { fio: s.slice(0, 3).join(" "), short: s[0] + " " + s[1][0] + "." + s[2][0] + ".", sur: s[0], name: s[1], pat: s[2], pos: "Врач-хирург", cat: s[3] } : null; };
const R = (pl, d, dep, doc, t) => ({ platform: pl, date: d, dept: dep, doctor: doc, text: t, full: t });
const week = { start: "2026-10-23", end: "2026-10-29", positive: [
  R("ПроДокторов", "23.10.2026", "Хирургия", "Белкина", "Анна Петровна провела сложную операцию бережно и мастерски, восстановление прошло легко и без боли. Я с удовольствием её рекомендую."),
  R("Сайт", "24.10.2026", "Хирургия", "Белкина", "Благодарю доктора Белкину за чуткость, терпение и подробные объяснения перед операцией. Спасибо!"),
  R("Яндекс", "24.10.2026", "Урология", "Соколов", "Иван Ильич всё подробно объяснил и вселил уверенность и спокойствие перед операцией. Рекомендую."),
  R("ПроДокторов", "25.10.2026", "Терапия", "Лисина", "Ольга Юрьевна внимательный и грамотный врач, подобрала лечение, которое помогло с первых дней."),
  R("ПроДокторов", "25.10.2026", "Кардиология", "Громов", "Пётр Сергеевич чуткий и опытный кардиолог, после его лечения я снова могу спокойно гулять с внуками."),
  R("Яндекс", "26.10.2026", "Отделение реанимации №2 для кардиологических больных", "—", "Большое спасибо сотрудникам реанимации за заботу и внимательное отношение к пациентам.")], negative: [] };
const hist = D.history([]);
// «Отзыв недели» — отзыв о Громове; голоса подтверждены раньше и среди них Громов (как случилось со Степановым 27.10)
const rv = D.build(week, hist, { person, photoOf: () => ({ src: "x" }), pick: {} });
const keyG = rv.need.filter(n => n.kind === "review")[0].options.filter(o => o.short === "Громов П.С.")[0].key;
const res = D.build(week, hist, { person, photoOf: () => ({ src: "x" }), pick: { review: keyG, voices: [{ short: "Громов П.С.", quote: "Пётр Сергеевич чуткий и опытный кардиолог, после его лечения я снова могу спокойно гулять с внуками" }, { short: "Соколов И.И.", quote: "Иван Ильич всё подробно объяснил и вселил уверенность и спокойствие перед операцией" }] } });
const all = [res.D.review.quote].concat(res.D.review.voices.map(v => v.quote), res.D.heroes.cards.map(c => c.quote)).filter(Boolean);
const rowOf = q => week.positive.findIndex(r => r.full.indexOf(q.slice(0, 30)) >= 0);
const rows = all.map(rowOf);
ok(new Set(rows).size === rows.length, "один отзыв — один раз во всей презентации", { all, rows });
ok(!res.D.review.voices.some(v => v.short === "Громов П.С."), "в «трёх голосах» нет врача «Отзыва недели», даже если голоса подтверждали раньше", res.D.review.voices);
ok(res.need.some(n => n.kind === "voices" && /подтвердите заново/.test(n.text)), "программа просит подтвердить голоса заново");
const q = D.quotes(week.positive[0].full);
ok(q.indexOf("Я с удовольствием её рекомендую") < 0 && q.length > 0, "обрывок «Я с удовольствием её рекомендую» не предлагается", q);
ok(!D.quotes("Хочу выразить огромную благодарность Ивановой Анне Сергеевне. Анна Сергеевна внимательный и чуткий врач, всё подробно объяснила.")[0].startsWith("Хочу"), "благодарность без содержания не идёт первой");
const card = res.D.heroes.cards[0];
ok(card && card.quote && card.quote.length >= 40, "цитата карточки законченная", card);
const lens = res.D.review.voices.map(v => v.quote.length);
ok(lens.length >= 2 && Math.max.apply(null, lens) - Math.min.apply(null, lens) <= 60 && Math.max.apply(null, lens) <= 100, "голоса примерно одного объёма", lens);
ok(res.D.where.one.concat(res.D.where.gold.map(g => ({ name: g.names.join(",") }))).some(x => /ОРИТ №2/.test(x.name)), "«Отделение реанимации №2 для кардиологических больных» на слайде — «ОРИТ №2»", res.D.where);
console.log(fails ? "SOME FAILED" : "ALL OK");
