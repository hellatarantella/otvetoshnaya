/* Презентация недели: цифры и предложения из тех же данных, что недельный отчёт.
   Источник — снимок отчёта недели («Позитив» по строкам и «Негатив» по блокам) и история недель года.
   Всё считается кодом, с проверкой итогов; тексты программа только предлагает, утверждает пользователь. */
(function () {
  "use strict";
  var DK = function () { return window.__otvDeck; };
  function s(x) { return x == null ? "" : String(x); }

  // недели 2026 года до появления снимков в программе (по недельным отчётам, со 2 января по 22 октября)
  var SEED_2026 = { start: "2026-01-02",
    pos: [23, 31, 40, 54, 48, 54, 57, 61, 55, 36, 51, 45, 58, 31, 52, 49, 53, 28, 29, 26, 31, 25, 41, 21, 26, 26, 30, 24, 31, 29, 25, 29, 25, 29, 28, 43, 30, 48, 51, 37, 40, 23],
    neg: [1, 4, 2, 3, 3, 5, 4, 4, 3, 6, 6, 8, 6, 7, 8, 6, 6, 6, 3, 5, 4, 1, 6, 4, 3, 1, 3, 3, 2, 5, 5, 2, 5, 5, 2, 5, 4, 2, 2, 9, 0, 8] };
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  // история недель: из прошлых снимков программы, а где их нет — из недельных отчётов 2026 года
  function history(snaps) {
    var map = {};
    SEED_2026.pos.forEach(function (p, i) { map[addDays(SEED_2026.start, 7 * i)] = { start: addDays(SEED_2026.start, 7 * i), pos: p, neg: SEED_2026.neg[i], from: "отчёты 2026" }; });
    (snaps || []).forEach(function (w) { if (w && w.start) map[w.start] = { start: w.start, pos: countPos(w), neg: countNeg(w), from: "снимок программы" }; });
    return Object.keys(map).sort().map(function (k) { return map[k]; });
  }
  function filledPos(w) { return (w.positive || []).filter(function (r) { return s(r.text || r.full).trim(); }); }   // пустые строки-заготовки площадок не считаются
  function filledNeg(w) { return (w.negative || []).filter(function (b) { return !b.empty && (s(b.platform).trim() || s(b.text || b.full).trim()); }); }
  function countPos(w) { return filledPos(w).length; }
  function countNeg(w) { return filledNeg(w).length; }

  var PLAT_ORDER = ["ПроДокторов", "Сайт", "Яндекс", "ДокТу", "2ГИС", "Google", "НаПоправку"];
  var PLAT_IN = { "ПроДокторов": "на ПроДокторов", "Сайт": "на сайте больницы", "Яндекс": "на Яндексе", "ДокТу": "на ДокТу", "2ГИС": "в 2ГИС", "Google": "в Google", "НаПоправку": "на НаПоправку" };
  var PLAT_NOM = { "Сайт": "сайт больницы" };
  function platKey(p) { p = s(p).trim(); if (/^сайт/i.test(p) || /24/.test(p) && !/2ГИС/i.test(p)) return "Сайт"; if (/2\s*ГИС|2gis/i.test(p)) return "2ГИС"; if (/яндекс/i.test(p)) return "Яндекс"; if (/продоктор/i.test(p)) return "ПроДокторов"; if (/докту/i.test(p)) return "ДокТу"; if (/google|гугл/i.test(p)) return "Google"; if (/поправ/i.test(p)) return "НаПоправку"; return p; }
  var NUM_WORD = { 3: "три", 4: "четыре", 5: "пять", 6: "шесть", 7: "семь", 8: "восемь", 9: "девять", 10: "десять" };
  function whereLine(byPlat, n) {
    var keys = Object.keys(byPlat).sort(function (a, b) { return byPlat[b] - byPlat[a]; });
    if (keys.length === 1) return (n === 2 ? "обе " : n >= 3 ? "все " + (NUM_WORD[n] || n) + " " : "") + PLAT_IN[keys[0]];
    if (keys.every(function (k) { return byPlat[k] === 1; })) return keys.slice(0, -1).map(function (k) { return PLAT_IN[k]; }).join(", ") + " и " + PLAT_IN[keys[keys.length - 1]];
    return keys.map(function (k) { return byPlat[k] + " " + PLAT_IN[k]; }).join(", ");
  }

  // название отделения на слайде: длинные сокращаем (правило: МОРС, ОРИТ №2, «Отделение …» без слова «Отделение»)
  var SLIDE_DEPT = [
    [/^Отделение реанимации\s*№\s*(\d+).*$/i, "ОРИТ №$1"], [/^Отделение реанимации и интенсивной терапии\s*№\s*(\d+).*$/i, "ОРИТ №$1"],
    [/^Отделение ранней медицинской реабилитации$/i, "Ранняя реабилитация"], [/^Межокружное отделение рассеянного склероза$/i, "МОРС"],
    [/^Отделение реабилитации стомированных больных$/i, "Реабилитация стомированных"], [/^Аллергология и иммунология$/i, "Аллергология"],
    [/^Ультразвуковая и функциональная диагностика$/i, "УЗИ и функциональная диагностика"], [/^Кабинет интервенционной ультрасонографии$/i, "Интервенционное УЗИ"],
    [/^Кабинет переливания крови$/i, "Переливание крови"], [/^Патологоанатомическое отделение$/i, "Патанатомия"], [/^Физиотерапевтическое отделение$/i, "Физиотерапия"], [/^Колопроктология\s*(\d+)$/i, "КПО $1"], [/^Колопроктологическое отделение\s*(?:№\s*)?(\d+)$/i, "КПО $1"], [/^Отделение\s+(.+)$/i, function (m, x) { return x.charAt(0).toUpperCase() + x.slice(1); }]
  ];
  // номер отделения — как в справочнике: «Колопроктология 7» (решение 28.10)
  function slideDept(d) { d = s(d).trim(); for (var i = 0; i < SLIDE_DEPT.length; i++) if (SLIDE_DEPT[i][0].test(d)) return d.replace(SLIDE_DEPT[i][0], SLIDE_DEPT[i][1]); return d; }
  // «зав. кардиологией»: название отделения в творительном падеже; если слово не склоняется по правилу — прежняя подпись
  function instr(d) {
    var ok = true, out = s(d).split(" ").map(function (w) {
      if (/^(и|№\d+|\d+|[А-ЯЁ]{2,})$/.test(w)) return w;
      if (/ия$/.test(w)) return w.replace(/ия$/, "ией"); if (/яя$/.test(w)) return w.replace(/яя$/, "ей"); if (/ая$/.test(w)) return w.replace(/ая$/, "ой"); if (/[кгхнтлр]а$/.test(w)) return w.replace(/а$/, "ой"); if (/ение$/.test(w)) return w + "м"; if (/ое$/.test(w)) return w.replace(/ое$/, "ым");
      ok = false; return w;
    }).join(" ");
    return ok ? out : "";
  }
  // отделение в подписи: в золотых карточках как в отчёте, в списках — коротко и со строчной
  var SHORT_DEPT = { "Ранняя реабилитация": "реабилитация", "Аллергология и иммунология": "аллергология", "Межокружное отделение рассеянного склероза": "МОРС" };
  function deptLow(d) { if (/^Колопроктолог/i.test(s(d).trim())) return s(d).trim().charAt(0).toLowerCase() + s(d).trim().slice(1); d = slideDept(d); if (SHORT_DEPT[d]) return SHORT_DEPT[d]; return /^[А-ЯЁ0-9]{2,}/.test(d) ? d : d.charAt(0).toLowerCase() + d.slice(1); }
  // должность из «Списка врачей» коротко: «врач-колопроктолог» → «колопроктолог», «заведующий отделением» → «зав. <отделение>»
  function roleOf(p, dept) {
    var pos = s(p && p.pos).toLowerCase().trim(), d = s(dept);
    if (/^заведующ/.test(pos)) return deptShortAbbr(d) ? "зав. " + deptShortAbbr(d) : instr(deptLow(d)) ? "зав. " + instr(deptLow(d)) : "зав. отделением, " + deptLow(d);
    var x = pos.replace(/^врач[- ]?/, "").replace(/^-/, "").trim();
    if (!x || x.split(/[- ]/).some(function (w) { return stem(w) === stem(d); })) return deptLow(d);
    return x + (d ? ", " + (/^[А-ЯЁ]{2,}$/.test(d) ? d : deptLow(d)) : "");
  }
  function deptShortAbbr(d) { return /^[А-ЯЁ]{2,}$/.test(d) ? d : SHORT_DEPT[d] && /^[А-ЯЁ]{2,}$/.test(SHORT_DEPT[d]) ? SHORT_DEPT[d] : ""; }
  function stem(x) { return s(x).toLowerCase().replace(/ё/g, "е").slice(0, 6); }

  /* ---------- предложения цитат: программа предлагает, вы выбираете или правите ---------- */
  var GOOD = /золот|сердц|ангел|спас(ла|ли|ибо вам за жизнь)|надежд|профессионал|внимательн|чутк|забот|лучш|рекоменд|от души|низкий поклон|вселил|спокойств|уверенност|легк|без боли|доброт|умниц|человечн|грамотн|опытн|благодарн/i;
  // цитата — законченная содержательная фраза (40–120 знаков, от 6 слов), не обрывок вроде «Я с удовольствием её рекомендую»
  var WEAK_START = /^(я|мы|она|он|её|ее|его|их|это|и|а|но|за|также|ещё|еще|так|вот|тут|там|потом|после)\s/i;   // «За профессионально проведённую…» — обрывок
  var GENERIC = /^(спасибо|благодарю|рекомендую|всем рекомендую|огромное спасибо|большое спасибо|спасибо вам)\b/i;
  // «Хочу выразить огромную благодарность …» — благодарность без содержания: берём, только если других фраз нет
  var THANKS_ONLY = /^(хочу|хотим|хотела?|хотелось бы|выражаю|огромн\S*|большое|искренн\S*|отдельн\S*)\s.*(благодар|спасиб|поблагодарить)/i;
  var SUBST = /золот|сердц|ангел|спасл|надежд|профессионал|внимательн|чутк|забот|лучш|от души|вселил|спокойств|уверенност|легк|без боли|доброт|человечн|грамотн|опытн|подробно|объяснил|мастерск|блестящ|терпелив|тактичн|безупречн|страх|бережн/i;
  function quotes(text, avoid) {
    var t = s(text).replace(/\r/g, "").trim(); if (!t) return [];
    var parts = [];
    t.split(/\n+/).forEach(function (para) { para.replace(/\s+/g, " ").trim().split(/(?<=[.!?…])\s+(?=[А-ЯЁA-Z«"])/).forEach(function (x) { parts.push(x); }); });
    var out = [];
    parts.forEach(function (x, i) {
      x = x.trim().replace(/^[«"„\-–—\s]+|[»"“]+$/g, "").replace(/\s*[!]+$/, "").replace(/[.…]+$/, "").trim();
      var words = x.split(/\s+/).length, good = (x.match(new RegExp(GOOD.source, "gi")) || []).length;
      if (x.length < 40 || x.length > 120 || words < 6) return;
      if (/\d{3,}|http|@|\?/.test(x)) return;
      if (WEAK_START.test(x) && (good < 1 || words < 8)) return;
      if (GENERIC.test(x) && words < 8) return;
      if (!new RegExp(GOOD.source, "i").test(x) && !SUBST.test(x)) return;   // цитата — благодарность или оценка, а не рассказ («Процедура длилась 30 минут»)
      if (avoid && avoid.some(function (a) { return a && x.indexOf(a) >= 0; })) return;
      var subst = (x.match(new RegExp(SUBST.source, "gi")) || []).length;
      var sc = subst * 3 + good - Math.abs(x.length - 75) / 15 - i * 0.1 - (THANKS_ONLY.test(x) && subst === 0 ? 20 : 0);
      out.push({ text: x, score: sc });
    });
    return out.sort(function (a, b) { return b.score - a.score; }).map(function (q) { return q.text; });
  }
  // из нескольких цитат — ближе всего к общему объёму блока (карточки одного вида выглядят одинаково)
  // список уже отсортирован по содержанию: берём лучшую по содержанию фразу нужного объёма (±30 знаков от общего), иначе лучшую подходящую
  // объём цитат одного вида блоков: все карточки (и все голоса) — в одной полосе знаков, чтобы блоки были соразмерны
  var BAND = { card2: [55, 110, 80], card4: [45, 85, 65], voice: [50, 100, 72], review: [40, 110, 75] };
  // цитата — благодарность или оценка врача, а не рассказ о процедуре («Процедура проводилась в реанимации и длилась 30 минут»)
  function praise(q) { return new RegExp(GOOD.source, "i").test(q) || SUBST.test(q); }
  // сохранённый выбор проверяется заново по тем же правилам; свою фразу (вписанную вручную) программа не оценивает по смыслу
  function valid(q, band, own) { return okQuote(q, band) && (own || praise(q)); }
  function first(q) { return s(q).toLowerCase().replace(/ё/g, "е").split(/[\s,]+/)[0]; }
  // разнообразие: цитаты на одном слайде начинаются по-разному (не три «Спасибо…» подряд)
  function nearestVar(list, target, max, usedFirst) {
    var c = (list || []).filter(function (q) { return q.length <= max; }), near = function (q) { return Math.abs(q.length - target) <= 30; }, fresh = function (q) { return !usedFirst || !usedFirst[first(q)]; };
    return c.filter(function (q) { return near(q) && fresh(q); })[0] || c.filter(fresh)[0] || c.filter(near)[0] || c[0] || "";
  }
  function okQuote(q, band) { q = s(q).trim(); var w = q.split(/\s+/).length; return q.length >= band[0] && q.length <= band[1] && w >= 6 && !(WEAK_START.test(q) && w < 8); }
  /* 12.11: «отзывы очень разного объёма в похожих блоках». Цитаты карточек одного вида (и три голоса) подбираются
     так, чтобы разница по длине была не больше EQ знаков: ваши подтверждённые остаются, остальные подстраиваются под них */
  var EQ = 24;
  function equalize(items) {
    var free = items.filter(function (x) { return !x.locked && x.options && x.options.length; });
    if (!free.length) return spreadOf(items);
    var lockL = items.filter(function (x) { return x.locked && x.quote; }).map(function (x) { return x.quote.length; });
    var targets = lockL.length ? [lockL.slice().sort(function (a, b) { return a - b; })[Math.floor(lockL.length / 2)]] : [].concat.apply([], free.map(function (x) { return x.options.map(function (q) { return q.length; }); }));
    var best = null;
    targets.forEach(function (T) {
      var pickQ = free.map(function (x) {
        var o = x.options.slice().sort(function (a, b) { return Math.abs(a.length - T) - Math.abs(b.length - T) || x.options.indexOf(a) - x.options.indexOf(b); });
        return o[0];
      });
      var lens = pickQ.map(function (q) { return q.length; }).concat(lockL), sp = Math.max.apply(null, lens) - Math.min.apply(null, lens);
      var dev = pickQ.reduce(function (a, q, i) { return a + free[i].options.indexOf(q); }, 0);   // при равном разбросе — фразы повыше в списке (лучше по смыслу)
      if (!best || sp < best.sp || (sp === best.sp && dev < best.dev)) best = { sp: sp, dev: dev, q: pickQ };
    });
    free.forEach(function (x, i) { x.quote = best.q[i]; });
    return spreadOf(items);
  }
  function spreadOf(items) { var l = items.filter(function (x) { return x.quote; }).map(function (x) { return x.quote.length; }); return l.length > 1 ? Math.max.apply(null, l) - Math.min.apply(null, l) : 0; }
  function inBand(list, band) { return (list || []).filter(function (q) { return okQuote(q, band); }); }
  function nearest(list, target, max) { var c = (list || []).filter(function (q) { return q.length <= max; }); return c.filter(function (q) { return Math.abs(q.length - target) <= 30; })[0] || c[0] || ""; }

  // цитаты о самом враче: в общем отзыве о нескольких врачах — только фразы, где назван он, а не коллега
  function nameStems(p) { return [p.sur, p.name, p.pat].filter(Boolean).map(function (x) { return x.toLowerCase().replace(/ё/g, "е").slice(0, Math.max(4, x.length - 2)); }); }
  function quotesAbout(d, all, usedRows) {
    var mine = nameStems(d.p), others = [];
    all.forEach(function (o) { if (o !== d) others = others.concat([o.p.sur.toLowerCase().replace(/ё/g, "е").slice(0, Math.max(4, o.p.sur.length - 2))]); });
    var out = [];
    d.rows.forEach(function (r) {
      if (usedRows && usedRows.indexOf(r) >= 0) return;   // отзыв уже есть в другом блоке презентации
      var multi = s(r.doctor).split(/\s*[,;]\s*/).filter(Boolean).length > 1;
      quotes(s(r.full || r.text)).forEach(function (q) {
        var low = q.toLowerCase().replace(/ё/g, "е");
        if (others.some(function (x) { return low.indexOf(x) >= 0; }) && !mine.some(function (x) { return low.indexOf(x) >= 0; })) return;
        if (multi && !mine.some(function (x) { return low.indexOf(x) >= 0; })) return;
        // та же фраза в отзыве, который уже стоит в другом блоке (дубль отзыва на другой площадке) — не предлагаем
        if (usedRows && usedRows.some(function (u) { return norm2(s(u.full || u.text)).indexOf(norm2(q).slice(0, 30)) >= 0; })) return;
        if (!out.some(function (o) { return o.text === q; })) out.push({ text: q, row: r });
      });
    });
    return out;
  }
  function norm2(x) { return s(x).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/g, " ").trim(); }
  /* ---------- модель презентации ---------- */
  // week: снимок отчёта недели {start, end, positive:[{platform, date, dept, doctor, full|text}], negative:[{platform, ...}]}
  // hist: история недель (с этой неделей); person: врач из графы отчёта → «Список врачей»; photos: библиотека; pick: решения пользователя
  /* ---------- пост в канал «Онлайн-обращения: итоги недели» (формат 29.10): цифры — из отчёта недели, со сверкой ---------- */
  var LOC = { "Яндекс": "Яндексе", "Сайт": "сайте больницы", "ПроДокторов": "ПроДокторов", "ДокТу": "ДокТу", "2ГИС": "2ГИС", "Google": "Google", "НаПоправку": "НаПоправку" };
  var SRC = { "Сайт": "сайт больницы" };
  function plural(n, a, b, c) { var m = n % 100, k = n % 10; return m > 10 && m < 15 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; }
  function pct0(a, b) { if (!b) return 0; var v = a * 100 / b; return v < 0 ? -Math.round(-v) : Math.round(v); }
  function postText(foot, P, N, staffN) {
    var pos = P.length, neg = N.length, platKeyOf = function (r) { var k = platKey(r.platform); return k || s(r.platform); };
    var lines = [], gen = 0, byDept = {};
    // в посте — название по справочнику (не укороченное для слайда); принятые сокращения (КДО, СКП, МОРС, ОРИТ №2) — как в постах 29.10
    var postDept = function (d) {
      if (/^Колопроктолог/i.test(d)) return d.charAt(0).toLowerCase() + d.slice(1);
      var sd = slideDept(d), sh = SHORT_DEPT[sd];
      if (/^[А-ЯЁ]{2,}/.test(sd) && !/^КПО/.test(sd)) return sd;
      if (sh && /^[А-ЯЁ]{2,}/.test(sh)) return sh;
      return /^[А-ЯЁ0-9]{2,}/.test(d) ? d : d.charAt(0).toLowerCase() + d.slice(1);
    };
    P.forEach(function (r) { var d = s(r.dept).trim(); if (!d || /^ГКБ\s*24$/i.test(d)) gen++; else { var n = postDept(d); byDept[n] = (byDept[n] || 0) + 1; } });
    lines.push("Онлайн-обращения: итоги недели (" + foot + ")", "Еженедельный срез обратной связи от пациентов 📈", "", "Главные цифры недели:");
    lines.push("🔹 " + pos + " " + plural(pos, "позитивный отзыв", "позитивных отзыва", "позитивных отзывов") + (pos + neg ? " (" + pct0(pos, pos + neg) + "%)" : "") + ".");
    if (neg) {
      var bp = {}; N.forEach(function (r) { var k = platKeyOf(r); bp[k] = (bp[k] || 0) + 1; });
      var ks = Object.keys(bp).sort(function (a, b) { return bp[b] - bp[a] || a.localeCompare(b, "ru"); }), where;
      if (ks.length === 1) where = neg === 1 ? "на " + (LOC[ks[0]] || ks[0]) : (neg === 2 ? "оба на " : "все на ") + (LOC[ks[0]] || ks[0]);
      else if (ks.every(function (k) { return bp[k] === bp[ks[0]]; })) where = "по " + bp[ks[0]] + " на " + ks.map(function (k) { return LOC[k] || k; }).join(", ").replace(/, ([^,]+)$/, " и $1");
      else where = ks.map(function (k) { return bp[k] + " на " + (LOC[k] || k); }).join(", ");
      lines.push("🔹 " + neg + " " + plural(neg, "негативный отзыв", "негативных отзыва", "негативных отзывов") + " (" + where + ").");
    } else lines.push("🔹 Негативных отзывов нет.");
    if (staffN) lines.push("🔹 " + staffN + " " + plural(staffN, "сотруднику", "сотрудникам", "сотрудникам") + " пациенты высказали благодарности.");
    if (gen) lines.push("🔹 " + gen + " " + plural(gen, "отзыв", "отзыва", "отзывов") + " о больнице в целом.");
    var groups = {}; Object.keys(byDept).forEach(function (d) { (groups[byDept[d]] = groups[byDept[d]] || []).push(d); });
    var ns = Object.keys(groups).map(Number).sort(function (a, b) { return b - a; });
    if (ns.length) {
      lines.push("", "Распределение благодарностей по отделениям:");
      ns.forEach(function (n) {
        var names = groups[n].sort(function (a, b) { return a.localeCompare(b, "ru"); }), t = names.join(", ");
        t = t.charAt(0).toUpperCase() + t.slice(1);
        lines.push("🔹 " + t + ": " + (names.length > 1 ? "по " + n + " " + plural(n, "отзыву", "отзыва", "отзывов") : n + " " + plural(n, "отзыв", "отзыва", "отзывов")) + ".");
      });
    }
    var src = {}; P.concat(N).forEach(function (r) { var k = platKeyOf(r); if (k) src[k] = (src[k] || 0) + 1; });
    var sk = Object.keys(src).sort(function (a, b) { return src[b] - src[a] || a.localeCompare(b, "ru"); });
    if (sk.length) lines.push("", "Источники отзывов: " + sk.map(function (k) { return SRC[k] || k; }).join(", ") + ". Полная статистика и график динамики в прикреплённом файле 📊");
    // сверка: отделения + о больнице = позитив
    var sum = Object.keys(byDept).reduce(function (a, d) { return a + byDept[d]; }, 0) + gen;
    return { text: lines.join("\n"), ok: sum === pos, check: "отделения " + (sum - gen) + " + о больнице " + gen + " = " + sum + (sum === pos ? "" : " (в отчёте " + pos + ")") };
  }
  function build(week, hist, opt) {
    opt = opt || {};
    var dk = DK(), person = opt.person || function () { return null; }, photoOf = opt.photoOf || function () { return null; }, pick = opt.pick || {};
    var own = function (q) { return (pick.own || []).indexOf(s(q).trim()) >= 0; }, usedFirst = {};
    var checks = [], need = [];
    var P = filledPos(week), N = filledNeg(week), pos = P.length, neg = N.length;
    // цитаты — только из отчёта этой недели и не из прошлых презентаций (04.11)
    var qk = function (q) { return norm2(q).slice(0, 40); }, prevQ = {};
    var allPicks = ((window.__otvAllRO || window.__otvAll) && (window.__otvAllRO || window.__otvAll)("deckPicks")) || {};
    Object.keys(allPicks).forEach(function (id) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(id) || id === s(week.start)) return;
      var pk = allPicks[id] || {}, put = function (q) { if (s(q).trim()) prevQ[qk(q)] = id; };
      Object.keys(pk.quote || {}).forEach(function (k) { put(pk.quote[k]); });
      if (pk.reviewText) put(pk.reviewText.quote);
      (pk.voices || []).forEach(function (v) { put(v && v.quote); });
    });
    var weekTexts = P.map(function (r) { return " " + norm2(s(r.full || r.text)) + " "; });
    var inWeek = function (q) {   // слова цитаты (своя, сокращённая) — из одного отзыва этой недели
      var w = norm2(q).split(" ").filter(function (x) { return x.length > 3; }); if (!w.length) return false;
      return weekTexts.some(function (t) { return w.filter(function (x) { return t.indexOf(" " + x.slice(0, Math.max(4, x.length - 2))) >= 0; }).length >= Math.ceil(w.length * 0.7); });
    };
    var staleWhy = function (q) { return !inWeek(q) ? "не из отчёта этой недели" : prevQ[qk(q)] ? "уже была в презентации недели " + prevQ[qk(q)].slice(8, 10) + "." + prevQ[qk(q)].slice(5, 7) : ""; };
    var notPrev = function (q) { return !prevQ[qk(q)]; };
    // история: эта неделя последней, по снимку
    var H = hist.filter(function (w) { return w.start < week.start; }).concat([{ start: week.start, pos: pos, neg: neg }]);
    var year = +week.start.slice(0, 4), Y = H.filter(function (w) { return +w.start.slice(0, 4) === year; });
    var prev = H.length > 1 ? H[H.length - 2] : null;
    var sumY = Y.reduce(function (a, w) { return a + w.pos; }, 0), negY = Y.reduce(function (a, w) { return a + w.neg; }, 0);
    // средняя неделя — округлённая по правилам (29.10); сравнение «к средней неделе» — с тем же числом, что на слайде
    var avgExact = sumY / Y.length, avg = Math.round(avgExact);
    var place = 1 + Y.filter(function (w) { return w.pos > pos; }).length;
    var share = pos + neg ? Math.round(pos / (pos + neg) * 100) : 100, shareY = sumY + negY ? Math.round(sumY / (sumY + negY) * 100) : 100;

    // площадки
    var byP = {}; P.forEach(function (r) { var k = platKey(r.platform); byP[k] = (byP[k] || 0) + 1; });
    var tiles = PLAT_ORDER.filter(function (k) { return k !== "НаПоправку" || byP[k]; }).map(function (k) { return { key: k, v: byP[k] || 0 }; });
    var unknownPlat = Object.keys(byP).filter(function (k) { return PLAT_ORDER.indexOf(k) < 0; });
    if (unknownPlat.length) checks.push({ bad: true, text: "Площадки, которых нет в шаблоне: " + unknownPlat.join(", ") });
    var tileSum = tiles.reduce(function (a, t) { return a + t.v; }, 0);
    checks.push({ bad: tileSum !== pos, text: "Площадки в сумме: " + tileSum + " из " + pos + " позитивных" });
    var negP = {}; N.forEach(function (b) { var k = platKey(b.platform); negP[k] = (negP[k] || 0) + 1; });
    var negLine = Object.keys(negP).sort(function (a, b) { return negP[b] - negP[a] || PLAT_ORDER.indexOf(a) - PLAT_ORDER.indexOf(b); }).map(function (k) { return (PLAT_NOM[k] || k) + " " + negP[k]; }).join(", ");
    negLine = (negLine ? negLine + "; " : "") + "на прошлой неделе " + (prev ? prev.neg : "—");

    var bars = H.slice(-8).map(function (w, i, a) { return { v: w.pos, label: dk.dmShort(w.start), cur: i === a.length - 1 }; });
    var foot = dk.human(week.start, week.end);
    var D = { coverLabel: "Неделя: " + dk.dm(week.start) + "–" + dk.dm(week.end) + "." + week.end.slice(0, 4), foot: foot, skip: {}, photos: {},
      week: { title: "Неделя в цифрах: " + share + "% отзывов позитивные", pos: pos, place: dk.ordinal(place) + " место из " + Y.length + " " + dk.plural(Y.length, "недели", "недель", "недель") + " " + year + " года",
        vsPrev: !prev ? "первая неделя" : dk.pct(pos, prev.pos) === 0 ? "как на прошлой неделе" : dk.signed(dk.pct(pos, prev.pos)) + " к прошлой неделе", vsAvg: dk.pct(pos, avg) === 0 ? "на уровне средней недели " + year : dk.signed(dk.pct(pos, avg)) + " к средней неделе " + year,
        neg: neg, negLine: negLine, share: share, shareLine: "в среднем за год " + shareY + "%", bars: bars, platforms: tiles } };
    var numbers = { pos: pos, neg: neg, prevPos: prev && prev.pos, prevNeg: prev && prev.neg, avg: avg, avgExact: avgExact, place: place, weeks: Y.length, share: share, shareY: shareY, byPlatform: byP, negByPlatform: negP };

    // врачи: каждая строка отчёта с врачом — благодарность (одна строка на площадке = одна благодарность)
    var docs = {}, unresolved = [];
    P.forEach(function (r) {
      s(r.doctor).split(/\s*[,;]\s*/).forEach(function (tok) {
        tok = tok.trim(); if (!tok || tok === "—" || tok === "-") return;
        var p = person(tok);
        if (!p || p.ambiguous) { unresolved.push(tok + (p && p.ambiguous ? " (" + p.ambiguous.join(", ") + ")" : "")); return; }
        var d = docs[p.short] = docs[p.short] || { p: p, n: 0, plat: {}, rows: [], depts: {} };
        d.n++; d.plat[platKey(r.platform)] = (d.plat[platKey(r.platform)] || 0) + 1; d.rows.push(r);
        if (s(r.doctor).split(/\s*[,;]\s*/).filter(Boolean).length === 1) d.depts[s(r.dept)] = 1;   // в строке с несколькими врачами отделение по главному
      });
    });
    if (unresolved.length) checks.push({ bad: true, text: "Нет в «Списке врачей» или неоднозначно: " + unresolved.join("; ") + ". Проверьте графу «Врач» в отчёте" });
    var list = Object.keys(docs).map(function (k) { return docs[k]; }).sort(function (a, b) { return b.n - a.n || a.p.sur.localeCompare(b.p.sur, "ru"); });
    // отделение врача — по отчёту (тот же справочник), а если в отчёте «ГКБ 24» — по «Списку врачей»
    list.forEach(function (d) { var rd = Object.keys(d.depts).filter(function (x) { return x && x !== "ГКБ 24"; }); d.dept = d.p.cat || rd[0] || ""; if (rd.length && d.p.cat && rd.indexOf(d.p.cat) < 0) checks.push({ bad: true, text: d.p.short + ": в отчёте «" + rd.join(", ") + "», по «Списку врачей» «" + d.p.cat + "». Исправьте отчёт или список" }); });

    // каждый отзыв в презентации — один раз: сначала «Отзыв недели», затем цитаты золотых карточек и голоса — из других отзывов
    var usedRows = [], vcAll = [], band = BAND.card2;
    var cand = P.map(function (r, i) {
      var txt = s(r.full || r.text), toks = s(r.doctor).split(/\s*[,;]\s*/).filter(function (x) { return x && x !== "—"; });
      var p = toks.length === 1 ? person(toks[0]) : null; if (p && p.ambiguous) p = null;
      var q = quotes(txt).filter(notPrev);
      return { i: i, key: s(r.platform) + "|" + s(r.date) + "|" + txt.slice(0, 40), row: r, p: p, quotes: q, score: (q.length ? 5 : 0) + Math.min(txt.length, 900) / 150 + (txt.match(new RegExp(GOOD.source, "gi")) || []).length };
    }).filter(function (c) { return c.p && c.quotes.length; }).sort(function (a, b) { return b.score - a.score; });
    var rv = pick.review ? cand.filter(function (c) { return c.key === pick.review; })[0] : null;
    if (!rv) need.push({ kind: "review", band: BAND.review, options: cand.slice(0, 6).map(function (c) { var qs = inBand(c.quotes, BAND.review).filter(praise); return { key: c.key, short: c.p.short, platform: platKey(c.row.platform), date: c.row.date, quote: nearest(qs, BAND.review[2], BAND.review[1]) || c.quotes[0], quotes: qs, text: s(c.row.full || c.row.text) }; }), text: "Отзыв недели: выберите отзыв и цитату" });
    // «Отзыв недели» по умолчанию — не единственный отзыв врача из золотых карточек (иначе карточке не из чего взять цитату)
    var gp0 = pick.gold || {}, gold0 = {};
    list.filter(function (d) { return d.n >= 2 && gp0[d.p.short] !== "rest"; }).slice(0, 4).forEach(function (d) { gold0[d.p.short] = d; });
    var distinct = function (d) { var m = {}; d.rows.forEach(function (r) { m[norm2(s(r.full || r.text)).slice(0, 60)] = 1; }); return Object.keys(m).length; };
    var r0 = rv || cand.filter(function (c) { var g = gold0[c.p.short]; return !g || distinct(g) >= 2; })[0] || cand[0], rp = pick.reviewText || {}, rQuote = "";
    if (r0) {
      usedRows.push(r0.row);
      r0.options = inBand(r0.quotes, BAND.review).filter(praise);
      rQuote = rp.quote && valid(rp.quote, BAND.review, own(rp.quote)) && !staleWhy(rp.quote) ? rp.quote : "";
      if (rv && rp.quote && !rQuote) need.push({ kind: "review", options: cand.slice(0, 6).map(function (c) { return { key: c.key, short: c.p.short, platform: platKey(c.row.platform), date: c.row.date, quote: nearest(inBand(c.quotes, BAND.review), BAND.review[2], BAND.review[1]) || c.quotes[0], quotes: inBand(c.quotes, BAND.review).filter(praise), text: s(c.row.full || c.row.text) }; }), current: rv.key, band: BAND.review,
        text: "Отзыв недели: выбранная раньше цитата «" + rp.quote + "» не подходит (" + (staleWhy(rp.quote) ? staleWhy(rp.quote) : !okQuote(rp.quote, BAND.review) ? "нужно " + BAND.review[0] + "–" + BAND.review[1] + " знаков, законченная фраза" : "это не благодарность и не оценка врача") + ") — выберите вариант или впишите свою" });
      rQuote = rQuote || nearest(r0.options, BAND.review[2], BAND.review[1]) || r0.quotes[0];
      usedFirst[first(rQuote)] = 1;
    }
    var inRow = function (q, r) { return q && norm2(s(r.full || r.text)).indexOf(norm2(q).slice(0, 30)) >= 0; };

    // золотые карточки: больше одной благодарности и есть фото; без фото — просим фото или переносим в строку ниже (решает пользователь)
    var goldPick = pick.gold || {};
    var gold = list.filter(function (d) { return d.n >= 2 && goldPick[d.p.short] !== "rest"; }).slice(0, 4);
    band = gold.length >= 3 ? BAND.card4 : BAND.card2; var lim = band[1], target = band[2];
    gold.forEach(function (d) {
      if (!photoOf(d.p.fio, "face")) need.push({ kind: "photo", who: d.p.fio, short: d.p.short, dept: d.dept, text: "Нужно фото: " + d.p.fio + " (" + d.dept + ") — загрузите или уберите из золотых карточек" });
      var qa = quotesAbout(d, list, usedRows).filter(function (x) { return notPrev(x.text); }), q = (pick.quote || {})[d.p.short];
      // 12.11: «пусть программа всегда предлагает вариант» — только из отзывов этой недели (прошлые презентации — нельзя):
      // фраз нужной длины нет — допускаем чуть короче или длиннее, для этой карточки
      var bandD = band; d.bandD = band;
      if (!inBand(qa.map(function (x) { return x.text; }), band).length) { var bw = [Math.max(25, band[0] - 20), band[1] + 30, band[2]]; if (inBand(qa.map(function (x) { return x.text; }), bw).length) { bandD = bw; d.bandD = bw; d.wide = true; } }
      d.usedBefore = usedRows.map(function (r) { return norm2(s(r.full || r.text)); });   // отзывы других блоков — для проверки вписанной цитаты
      var why = "";
      if (q && usedRows.some(function (r) { return inRow(q, r); })) { q = ""; why = " (выбранная раньше цитата — из отзыва, который уже есть в другом блоке)"; }
      if (q && staleWhy(q)) { why = " (выбранная раньше «" + q + "» — " + staleWhy(q) + ")"; q = ""; }
      if (q && !valid(q, bandD, own(q))) { why = " (выбранная раньше «" + q + "» — " + (!okQuote(q, bandD) ? (q.length < bandD[0] ? "слишком короткая или обрывок" : q.length > bandD[1] ? "длиннее других" : "обрывок фразы") : "не благодарность и не оценка врача") + ")"; q = ""; }
      d.quotes = qa.map(function (x) { return x.text; });
      d.options = inBand(d.quotes, bandD);
      if (!q) {
        q = nearestVar(d.options, target, bandD[1], usedFirst);
        need.push({ kind: "quote", short: d.p.short, options: d.options, current: q, band: bandD, used: d.usedBefore, stale: staleWhy, text: "Цитата для карточки " + d.p.short + ": выберите или впишите, " + bandD[0] + "–" + bandD[1] + " знаков" + why + (d.wide ? ". Фраз такой длины в отзывах недели нет — варианты чуть короче или длиннее" : "") });
      }
      d.quote = q; d.locked = !!q && q === (pick.quote || {})[d.p.short]; d.qa = qa; if (q) usedFirst[first(q)] = 1;
      var src = qa.filter(function (x) { return x.text === q; })[0]; d.src = src ? [src.row] : d.rows.filter(function (r) { return inRow(q, r); }); d.src.forEach(function (r) { usedRows.push(r); });
    });
    // карточки одного вида — одного объёма; цитата другой карточки не может прийти из отзыва, уже стоящего в другом блоке
    if (gold.length > 1) {
      var gi = gold.map(function (d) { return { d: d, locked: d.locked, quote: d.quote, options: (d.options || []).filter(function (o) { var src0 = d.qa.filter(function (x) { return x.text === o; })[0]; return !src0 || d.src.indexOf(src0.row) >= 0 || usedRows.indexOf(src0.row) < 0; }) }; });
      var sp0 = equalize(gi);
      gi.forEach(function (x) {
        if (x.quote === x.d.quote) return;
        x.d.src.forEach(function (r) { var k = usedRows.indexOf(r); if (k >= 0) usedRows.splice(k, 1); });
        x.d.quote = x.quote; var s1 = x.d.qa.filter(function (y) { return y.text === x.quote; })[0]; x.d.src = s1 ? [s1.row] : []; x.d.src.forEach(function (r) { usedRows.push(r); });
        need.forEach(function (n) { if (n.kind === "quote" && n.short === x.d.p.short) n.current = x.quote; });
      });
      if (sp0 > EQ) checks.push({ bad: false, text: "Цитаты золотых карточек разного объёма (разница " + sp0 + " знаков): ближе по длине фраз в отзывах нет" });
    }
    var rest = list.filter(function (d) { return gold.indexOf(d) < 0; });
    D.heroes = { cards: gold.map(function (d) {
      return { photo: photoOf(d.p.fio, "face"), short: d.p.short, dept: slideDept(d.dept), sur: d.p.sur, name: d.p.name + " " + d.p.pat, n: d.n, quote: d.quote || "", where: whereLine(d.plat, d.n) };
    }), restTitle: restTitle(rest), rest: rest.map(function (d) { return { short: d.p.short, dept: deptLow(d.dept), n: d.n }; }) };

    if (r0) {
      var rd = docs[r0.p.short] ? docs[r0.p.short].dept : r0.p.cat;
      var rph = photoOf(r0.p.fio, "tall");
      if (!rph) need.push({ kind: "photo", who: r0.p.fio, short: r0.p.short, dept: rd, tall: true, text: "Нужно фото для «Отзыва недели»: " + r0.p.fio + " (вертикальное, во весь рост слайда)" });
      D.review = { photo: rph, short: r0.p.short, quote: rQuote, lineBefore: rp.before != null ? rp.before : "Благодарность врачу: ", lineName: rp.name || (r0.p.sur + " " + r0.p.name + " " + r0.p.pat), lineAfter: rp.after != null ? rp.after : ", " + deptLow(rd),   // подпись: фамилия и отделение, без должности (решение 28.10)
        platforms: [platKey(r0.row.platform)], date: dateHuman(r0.row.date), voicesTitle: "", voices: [] };
      // три голоса: другие врачи (не врач «Отзыва недели»), другие отзывы; как в образце — сначала врачи не из золотых карточек
      var goldSet = {}; gold.forEach(function (d) { goldSet[d.p.short] = 1; });
      var free = function (c) { return c.p.short !== r0.p.short && usedRows.indexOf(c.row) < 0; };
      var vc = cand.filter(function (c) { return free(c) && !goldSet[c.p.short]; }).concat(cand.filter(function (c) { return free(c) && goldSet[c.p.short]; }));
      var vp = (pick.voices || []).filter(function (v) { return v.short !== r0.p.short && !usedRows.some(function (r) { return inRow(v.quote, r); }) && valid(v.quote, BAND.voice, own(v.quote)) && !staleWhy(v.quote); });
      var dropped = (pick.voices || []).length !== vp.length || (!pick.voicesEq && spreadOf(vp) > EQ + 4);   // подтверждённые после 12.11 — ваш выбор, не пересматриваем   // сохранённые голоса сильно разной длины — подбираем заново и просим подтвердить
      var voices = vp.length && !dropped ? vp : [], seen = {};
      voices.forEach(function (v) { seen[v.short] = 1; });
      // сначала цитаты с другим началом, чем у уже стоящих на слайде; не хватает — любые подходящие
      if (!voices.length) [true, false].forEach(function (strict) { vc.forEach(function (c) {
        if (voices.length >= 3 || seen[c.p.short]) return;
        var qs = inBand(c.quotes, BAND.voice), q = strict ? qs.filter(function (x) { return !usedFirst[first(x)]; })[0] && nearestVar(qs, BAND.voice[2], BAND.voice[1], usedFirst) : nearest(qs, BAND.voice[2], BAND.voice[1]);
        if (!q || strict && usedFirst[first(q)]) return; seen[c.p.short] = 1; usedFirst[first(q)] = 1; voices.push({ short: c.p.short, quote: q, key: c.key });
      }); });
      // три голоса — одного объёма: подтверждённые остаются, подобранные программой подстраиваются; не выходит — просим выбрать
      if (voices.length > 1) {
        var vi = voices.map(function (v) { var c = vc.filter(function (x) { return x.key === v.key || !v.key && x.p.short === v.short; })[0]; return { v: v, locked: vp.length && !dropped, quote: v.quote, options: c ? inBand(c.quotes, BAND.voice).filter(function (o) { return !usedRows.some(function (r) { return inRow(o, r); }); }) : [] }; });
        var spv = equalize(vi);
        vi.forEach(function (x) { x.v.quote = x.quote; });
        if (spv > EQ) checks.push({ bad: false, text: "Три голоса недели разного объёма (разница " + spv + " знаков)" + (vp.length && !dropped ? ": так подтвердили вы" : "") });
      }
      // на слайде — в порядке кандидатов (как предложено), а не в порядке подбора
      voices.sort(function (a, b) { var ia = vc.map(function (c) { return c.key; }).indexOf(a.key), ib = vc.map(function (c) { return c.key; }).indexOf(b.key); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
      D.review.voices = voices.map(function (v) { var dd = docs[v.short]; return { short: v.short, quote: v.quote, role: dd ? deptLow(dd.dept) : "" }; });
      D.review.voicesTitle = voices.length === 3 ? "И ещё три голоса недели" : voices.length === 2 ? "И ещё два голоса недели" : voices.length === 1 ? "И ещё один голос недели" : "";
      vcAll = vc.map(function (c) { return { key: c.key, short: c.p.short, quote: nearest(inBand(c.quotes, BAND.voice), BAND.voice[2], BAND.voice[1]) || "", quotes: inBand(c.quotes, BAND.voice) }; }).filter(function (o) { return o.quote; });
      voices.forEach(function (v) { var o = vcAll.filter(function (x) { return x.key === v.key || !v.key && x.short === v.short; })[0]; if (o && o.quotes.indexOf(v.quote) < 0) o.quotes = [v.quote].concat(o.quotes); });
      if ((!vp.length || dropped) && voices.length) need.push({ kind: "voices", band: BAND.voice, options: vcAll.slice(0, 12), current: voices.map(function (v) { return { short: v.short, key: v.key, quote: v.quote }; }), text: dropped && !pick.voicesEq && spreadOf(vp) > EQ + 4 ? "Три голоса недели: выбранные цитаты сильно разного объёма — подобрала близкие по длине, подтвердите" : dropped ? "Три голоса недели: в выбранных был повтор, цитата не того объёма или не благодарность — подтвердите заново" : "Три голоса недели: подтвердите или замените (у каждого — выбор цитаты)" });
    } else { D.skip.review = true; checks.push({ bad: false, text: "Отзывов о врачах с цитатой нет: слайд «Отзыв недели» пропущен" }); }

    // отделения: строки отчёта по графе «Отделение»; «ГКБ 24» — о больнице в целом
    var byD = {}, general = 0;
    P.forEach(function (r) { var d = s(r.dept).trim(); if (!d || /^ГКБ\s*24$/i.test(d)) general++; else byD[d] = (byD[d] || 0) + 1; });
    var dl = Object.keys(byD).map(function (k) { return { name: slideDept(k), raw: k, n: byD[k] }; }).sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name, "ru"); });
    var levels = []; dl.forEach(function (d) { if (levels.indexOf(d.n) < 0) levels.push(d.n); });
    var goldN = levels.filter(function (n) { return n >= 2; }).slice(0, 3);
    var deptSum = dl.reduce(function (a, d) { return a + d.n; }, 0) + general;
    checks.push({ bad: deptSum !== pos, text: "Отделения в сумме: " + deptSum + " из " + pos + " (из них о больнице в целом " + general + ")" });
    D.where = { gold: goldN.map(function (n, i) { return { place: i + 1, n: n, names: dl.filter(function (d) { return d.n === n; }).map(function (d) { return d.name; }) }; }),
      one: dl.filter(function (d) { return goldN.indexOf(d.n) < 0; }).map(function (d) { return { name: d.name, n: d.n }; }), general: general,
      photos: [] };
    // фото на слайде «Отделения» — лучших отделений недели (по местам); подойдёт фото отделения или врачей этого отделения.
    // 12.11: фото — только этой недели (каждую неделю новые, вёрстка та же); прошлонедельные не подставляются
    var w0 = D.where, wide = false;   // всегда утверждённая сетка с тремя фото: не хватает фото — программа просит
    var slotsN = wide ? 2 : 3, slots = dl.slice(0, slotsN).map(function (d) { return d.name; });
    while (slots.length < slotsN) slots.push(slots.indexOf("ГКБ 24") < 0 ? "ГКБ 24" : "ГКБ 24 (" + (slots.length + 1) + ")");
    w0.wide = wide; w0.slots = slots;
    w0.photos = slots.map(function (nm, i) {
      return photoOf(nm, "dept", i);   // только фото, загруженное для этого отделения: иначе программа просит его
    });
    slots.forEach(function (nm, i) {
      if (w0.photos[i]) return;
      var dd = dl.filter(function (d) { return d.name === nm; })[0], docsIn = list.filter(function (d) { return d.dept === nm; }).map(function (d) { return d.p.short; });
      need.push({ kind: "photo", who: nm, slot: "dept", text: /^ГКБ 24/.test(nm) ? "Фото больницы для слайда «Отделения» (ячейка " + (i + 1) + ", каждую неделю — новое)" :
        "Фото для слайда «Отделения»: " + nm + (dd ? " (" + (i + 1) + "-е по благодарностям, " + dd.n + ")" : "") + " — фото отделения или врачей отделения" + (docsIn.length ? " (" + docsIn.slice(0, 3).join(", ") + ")" : "") + ". Каждую неделю — новые фото" });
    });

    // год
    var peakI = 0, lowI = 0; Y.forEach(function (w, i) { if (w.pos > Y[peakI].pos) peakI = i; if (w.pos < Y[lowI].pos) lowI = i; });
    D.year = { year: year, weeks: Y, avg: avg, peakIdx: peakI, lowIdx: lowI };
    D.photos.cover = photoOf("Обложка", "cover"); D.photos.end = photoOf("Закрывающий слайд", "end");
    if (!D.photos.cover) need.push({ kind: "photo", who: "Обложка", slot: "cover", text: "Фото для обложки: загружается один раз, потом можно заменить" });
    if (!D.photos.end) need.push({ kind: "photo", who: "Закрывающий слайд", slot: "end", text: "Фото для закрывающего слайда: загружается один раз, потом можно заменить" });

    // итоговые проверки
    checks.unshift({ bad: false, text: "Позитивных " + pos + ", негативных " + neg + " — по отчёту недели" });
    if (prev) checks.push({ bad: false, text: "Прошлая неделя (" + dk.dm(prev.start) + "): " + prev.pos + " позитивных, " + prev.neg + " негативных" + (prev.from ? " · " + prev.from : "") });
    checks.push({ bad: Y[Y.length - 1].pos !== pos, text: "Динамика года: последняя неделя " + Y[Y.length - 1].pos + " = " + pos });
    var gsum = gold.reduce(function (a, d) { return a + d.n; }, 0) + rest.reduce(function (a, d) { return a + d.n; }, 0);
    checks.push({ bad: false, text: "Благодарностей врачам: " + gsum + " (" + list.length + " " + dk.plural(list.length, "сотрудник", "сотрудника", "сотрудников") + ")" });
    D.notes = notesOf(D, numbers);
    var post = postText(foot, P, N, list.length);
    D.post = post.text; if (!post.ok) checks.push({ bad: true, text: "Пост в канал: не сходится сумма по отделениям — " + post.check });
    // всё, что можно пересмотреть в любой момент (кнопка «Пересмотреть выбор»): варианты и текущий выбор
    var revOpts = function (c) { var qs = inBand(c.quotes, BAND.review).filter(praise); if (c === r0 && rQuote && qs.indexOf(rQuote) < 0) qs = [rQuote].concat(qs); return { key: c.key, short: c.p.short, platform: platKey(c.row.platform), date: c.row.date, quote: c === r0 ? rQuote : nearest(qs, BAND.review[2], BAND.review[1]) || c.quotes[0], quotes: qs, text: s(c.row.full || c.row.text) }; };
    var choices = [];
    if (r0) choices.push({ kind: "review", band: BAND.review, options: cand.slice(0, 8).map(revOpts), current: r0.key, text: "Отзыв недели и его цитата (" + BAND.review[0] + "–" + BAND.review[1] + " знаков)" });
    gold.forEach(function (d) { choices.push({ kind: "quote", short: d.p.short, options: d.options || [], band: d.bandD || band, current: d.quote, used: d.usedBefore || [], stale: staleWhy, text: "Цитата для карточки " + d.p.short + " (" + band[0] + "–" + band[1] + " знаков)" }); });
    if (D.review && D.review.voices.length) choices.push({ kind: "voices", band: BAND.voice, options: (vcAll || []).slice(0, 12), current: voices.map(function (v) { return { short: v.short, key: v.key, quote: v.quote }; }), text: "Три голоса недели: врач и цитата (" + BAND.voice[0] + "–" + BAND.voice[1] + " знаков)" });
    return { choices: choices, D: D, checks: checks, need: need, numbers: numbers, doctors: list.map(function (d) { return { short: d.p.short, fio: d.p.fio, dept: d.dept, n: d.n, gold: gold.indexOf(d) >= 0, hasPhoto: !!photoOf(d.p.fio, "face") }; }) };
  }
  function restTitle(rest) {
    if (!rest.length) return "";
    var ns = rest.map(function (d) { return d.n; }), all1 = ns.every(function (n) { return n === 1; }), dk = DK();
    return (all1 ? "Ещё по одной: " : "Ещё благодарности: ") + rest.length + " " + dk.plural(rest.length, "сотрудник", "сотрудника", "сотрудников");
  }
  function dateHuman(d) { d = s(d); var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d) || /^(\d{2})\.(\d{2})\.(\d{4})/.exec(d); if (!m) return d; var day = m[1].length === 4 ? +m[3] : +m[1], mon = m[1].length === 4 ? +m[2] : +m[2]; return day + " " + DK().MON[mon - 1]; }
  function notesOf(D, n) {
    return {
      week: "Неделя " + D.foot + " (по дате поступления, отчётность закрыта в четверг в 15:00): " + n.pos + " позитивных и " + n.neg + " негативных. Средняя неделя года: " + n.avg + " (точно " + n.avgExact.toFixed(1).replace(".", ",") + "). К средней неделе — от " + n.avg + ". Место: " + n.place + " из " + n.weeks + ". Доля позитива за год " + n.shareY + "%, на этой неделе " + n.share + "%.",
      heroes: "Благодарности врачам по строкам недельного отчёта. Имена, должности и отделения — по «Списку врачей». Цитаты сокращены без изменения смысла.",
      where: "Позитивные отзывы недели по отделениям (по графе «Отделение» отчёта).",
      year: "Позитивные и негативные отзывы по недельным отчётам " + D.year.year + " года."
    };
  }

  window.__otvDeck = window.__otvDeck || {};
  Object.assign(window.__otvDeck, { okQuote: okQuote, instr: instr, slideDept: slideDept, praise: praise, BAND: BAND, build: build, history: history, quotes: quotes, platKey: platKey, roleOf: roleOf, deptLow: deptLow, whereLine: whereLine, countPos: countPos, countNeg: countNeg, SEED_2026: SEED_2026 });
})();
