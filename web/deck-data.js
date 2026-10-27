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

  // отделение в подписи: в золотых карточках как в отчёте, в списках — коротко и со строчной
  var SHORT_DEPT = { "Ранняя реабилитация": "реабилитация", "Аллергология и иммунология": "аллергология", "Межокружное отделение рассеянного склероза": "МОРС" };
  function deptLow(d) { d = s(d); if (SHORT_DEPT[d]) return SHORT_DEPT[d]; return /^[А-ЯЁ0-9]{2,}/.test(d) ? d : d.charAt(0).toLowerCase() + d.slice(1); }
  // должность из «Списка врачей» коротко: «врач-колопроктолог» → «колопроктолог», «заведующий отделением» → «зав. <отделение>»
  function roleOf(p, dept) {
    var pos = s(p && p.pos).toLowerCase().trim(), d = s(dept);
    if (/^заведующ/.test(pos)) return deptShortAbbr(d) ? "зав. " + deptShortAbbr(d) : "зав. отделением, " + deptLow(d);
    var x = pos.replace(/^врач[- ]?/, "").replace(/^-/, "").trim();
    if (!x || x.split(/[- ]/).some(function (w) { return stem(w) === stem(d); })) return deptLow(d);
    return x + (d ? ", " + (/^[А-ЯЁ]{2,}$/.test(d) ? d : deptLow(d)) : "");
  }
  function deptShortAbbr(d) { return /^[А-ЯЁ]{2,}$/.test(d) ? d : SHORT_DEPT[d] && /^[А-ЯЁ]{2,}$/.test(SHORT_DEPT[d]) ? SHORT_DEPT[d] : ""; }
  function stem(x) { return s(x).toLowerCase().replace(/ё/g, "е").slice(0, 6); }

  /* ---------- предложения цитат: программа предлагает, вы выбираете или правите ---------- */
  var GOOD = /золот|сердц|ангел|спас(ла|ли|ибо вам за жизнь)|надежд|профессионал|внимательн|чутк|забот|лучш|рекоменд|от души|низкий поклон|вселил|спокойств|уверенност|легк|без боли|доброт|умниц|человечн|грамотн|опытн|благодарн/i;
  function quotes(text, avoid) {
    var t = s(text).replace(/\s+/g, " ").trim(); if (!t) return [];
    var parts = t.split(/(?<=[.!?…])\s+(?=[А-ЯЁA-Z«"])/);
    var out = [];
    parts.forEach(function (x, i) {
      x = x.trim().replace(/^[«"„]+|[»"“]+$/g, "").replace(/\s*[!]+$/, "").replace(/\.$/, "");
      if (x.length < 25 || x.length > 170) return;
      if (/\d{3,}|http|@/.test(x)) return;
      if (avoid && avoid.some(function (a) { return a && x.indexOf(a) >= 0; })) return;
      var sc = (x.match(new RegExp(GOOD.source, "gi")) || []).length * 3 - Math.abs(x.length - 70) / 30 - i * 0.2 - (x.length > 120 ? 4 : 0);   // длинные — только если коротких нет
      if (/^(спасибо|благодарю|огромное спасибо|большое спасибо)[.!,]*$/i.test(x)) sc -= 10;
      out.push({ text: x, score: sc });
    });
    return out.sort(function (a, b) { return b.score - a.score; }).map(function (q) { return q.text; });
  }

  // цитаты о самом враче: в общем отзыве о нескольких врачах — только фразы, где назван он, а не коллега
  function nameStems(p) { return [p.sur, p.name, p.pat].filter(Boolean).map(function (x) { return x.toLowerCase().replace(/ё/g, "е").slice(0, Math.max(4, x.length - 2)); }); }
  function quotesAbout(d, all) {
    var mine = nameStems(d.p), others = [];
    all.forEach(function (o) { if (o !== d) others = others.concat([o.p.sur.toLowerCase().replace(/ё/g, "е").slice(0, Math.max(4, o.p.sur.length - 2))]); });
    var out = [];
    d.rows.forEach(function (r) {
      var multi = s(r.doctor).split(/\s*[,;]\s*/).filter(Boolean).length > 1;
      quotes(s(r.full || r.text)).forEach(function (q) {
        var low = q.toLowerCase().replace(/ё/g, "е");
        if (others.some(function (x) { return low.indexOf(x) >= 0; }) && !mine.some(function (x) { return low.indexOf(x) >= 0; })) return;
        if (multi && !mine.some(function (x) { return low.indexOf(x) >= 0; })) return;
        if (out.indexOf(q) < 0) out.push(q);
      });
    });
    return out;
  }
  /* ---------- модель презентации ---------- */
  // week: снимок отчёта недели {start, end, positive:[{platform, date, dept, doctor, full|text}], negative:[{platform, ...}]}
  // hist: история недель (с этой неделей); person: врач из графы отчёта → «Список врачей»; photos: библиотека; pick: решения пользователя
  function build(week, hist, opt) {
    opt = opt || {};
    var dk = DK(), person = opt.person || function () { return null; }, photoOf = opt.photoOf || function () { return null; }, pick = opt.pick || {};
    var checks = [], need = [];
    var P = filledPos(week), N = filledNeg(week), pos = P.length, neg = N.length;
    // история: эта неделя последней, по снимку
    var H = hist.filter(function (w) { return w.start < week.start; }).concat([{ start: week.start, pos: pos, neg: neg }]);
    var year = +week.start.slice(0, 4), Y = H.filter(function (w) { return +w.start.slice(0, 4) === year; });
    var prev = H.length > 1 ? H[H.length - 2] : null;
    var sumY = Y.reduce(function (a, w) { return a + w.pos; }, 0), negY = Y.reduce(function (a, w) { return a + w.neg; }, 0);
    var avgExact = sumY / Y.length, avg = Math.floor(avgExact);
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
        vsPrev: prev ? dk.signed(dk.pct(pos, prev.pos)) + " к прошлой неделе" : "первая неделя", vsAvg: dk.signed(dk.pct(pos, avgExact)) + " к средней неделе " + year,
        neg: neg, negLine: negLine, share: share, shareLine: "в среднем за год " + shareY + "%", bars: bars, platforms: tiles } };
    var numbers = { pos: pos, neg: neg, prevPos: prev && prev.pos, prevNeg: prev && prev.neg, avg: avgExact, place: place, weeks: Y.length, share: share, shareY: shareY, byPlatform: byP, negByPlatform: negP };

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

    // золотые карточки: больше одной благодарности и есть фото; без фото — просим фото или переносим в строку ниже (решает пользователь)
    var goldPick = pick.gold || {};
    var gold = list.filter(function (d) { return d.n >= 2 && goldPick[d.p.short] !== "rest"; }).slice(0, 4);
    gold.forEach(function (d) {
      var ph = photoOf(d.p.fio, "face");
      d.quotes = quotesAbout(d, list);
      if (!ph) need.push({ kind: "photo", who: d.p.fio, short: d.p.short, dept: d.dept, text: "Нужно фото: " + d.p.fio + " (" + d.dept + ") — загрузите или уберите из золотых карточек" });
      var q = (pick.quote || {})[d.p.short];
      if (!q) need.push({ kind: "quote", short: d.p.short, options: d.quotes, text: "Цитата для карточки " + d.p.short + ": выберите или впишите" });
    });
    var rest = list.filter(function (d) { return gold.indexOf(d) < 0; });
    D.heroes = { cards: gold.map(function (d) {
      // в карточке — короткая цитата: при 3–4 карточках до 80 знаков, при 1–2 до 110
      var lim = gold.length >= 3 ? 80 : 110, qs = d.quotes || [];
      return { photo: photoOf(d.p.fio, "face"), short: d.p.short, dept: d.dept, sur: d.p.sur, name: d.p.name + " " + d.p.pat, n: d.n, quote: (pick.quote || {})[d.p.short] || qs.filter(function (q) { return q.length <= lim; })[0] || "", where: whereLine(d.plat, d.n) };
    }), restTitle: restTitle(rest), rest: rest.map(function (d) { return { short: d.p.short, dept: deptLow(d.dept), n: d.n }; }) };

    // отзыв недели: предлагаем самые тёплые отзывы о врачах с фото; выбирает пользователь
    var cand = P.map(function (r, i) {
      var txt = s(r.full || r.text), toks = s(r.doctor).split(/\s*[,;]\s*/).filter(function (x) { return x && x !== "—"; });
      var p = toks.length === 1 ? person(toks[0]) : null; if (p && p.ambiguous) p = null;
      var q = quotes(txt);
      return { i: i, key: s(r.platform) + "|" + s(r.date) + "|" + txt.slice(0, 40), row: r, p: p, quotes: q, score: (q.length ? 5 : 0) + Math.min(txt.length, 900) / 150 + (txt.match(new RegExp(GOOD.source, "gi")) || []).length };
    }).filter(function (c) { return c.p && c.quotes.length; }).sort(function (a, b) { return b.score - a.score; });
    var rv = pick.review ? cand.filter(function (c) { return c.key === pick.review; })[0] : null;
    if (!rv) need.push({ kind: "review", options: cand.slice(0, 6).map(function (c) { return { key: c.key, short: c.p.short, platform: platKey(c.row.platform), date: c.row.date, quote: c.quotes[0], text: s(c.row.full || c.row.text) }; }), text: "Отзыв недели: выберите из предложенных" });
    var r0 = rv || cand[0];
    if (r0) {
      var rd = docs[r0.p.short] ? docs[r0.p.short].dept : r0.p.cat;
      var rph = photoOf(r0.p.fio, "tall");
      if (!rph) need.push({ kind: "photo", who: r0.p.fio, short: r0.p.short, dept: rd, tall: true, text: "Нужно фото для «Отзыва недели»: " + r0.p.fio + " (вертикальное, во весь рост слайда)" });
      var rp = pick.reviewText || {};
      D.review = { photo: rph, short: r0.p.short, quote: rp.quote || r0.quotes[0], lineBefore: rp.before != null ? rp.before : "Благодарность врачу: ", lineName: rp.name || (r0.p.sur + " " + r0.p.name + " " + r0.p.pat), lineAfter: rp.after != null ? rp.after : ", " + roleOf(r0.p, rd),
        platforms: [platKey(r0.row.platform)], date: dateHuman(r0.row.date), voicesTitle: "", voices: [] };
      // ещё три голоса: другие врачи, по одной цитате
      var used = {}; used[r0.p.short] = 1;
      var vp = pick.voices || [];
      // как в утверждённом образце: голоса — врачи не из золотых карточек (если таких мало, добираем из всех)
      var goldSet = {}; gold.forEach(function (d) { goldSet[d.p.short] = 1; });
      var vc = cand.filter(function (c) { return c.key !== r0.key && !goldSet[c.p.short]; }).concat(cand.filter(function (c) { return c.key !== r0.key && goldSet[c.p.short]; }));
      var voices = vp.length ? vp : vc.filter(function (c) { if (used[c.p.short]) return false; used[c.p.short] = 1; return true; }).slice(0, 3).map(function (c) { return { short: c.p.short, quote: c.quotes.filter(function (q) { return q.length <= 110; })[0] || c.quotes[0], key: c.key }; });   // в карточке голоса — короткая фраза
      D.review.voices = voices.map(function (v) { var dd = docs[v.short]; return { short: v.short, quote: v.quote, role: dd ? roleOf(dd.p, dd.dept) : "" }; });
      D.review.voicesTitle = voices.length === 3 ? "И ещё три голоса недели" : voices.length === 2 ? "И ещё два голоса недели" : voices.length === 1 ? "И ещё один голос недели" : "";
      if (!vp.length && voices.length) need.push({ kind: "voices", options: cand.filter(function (c) { return c.key !== r0.key; }).slice(0, 10).map(function (c) { return { key: c.key, short: c.p.short, quote: c.quotes[0], quotes: c.quotes }; }), text: "Три голоса недели: подтвердите или замените" });
    } else { D.skip.review = true; checks.push({ bad: false, text: "Отзывов о врачах с цитатой нет: слайд «Отзыв недели» пропущен" }); }

    // отделения: строки отчёта по графе «Отделение»; «ГКБ 24» — о больнице в целом
    var byD = {}, general = 0;
    P.forEach(function (r) { var d = s(r.dept).trim(); if (!d || /^ГКБ\s*24$/i.test(d)) general++; else byD[d] = (byD[d] || 0) + 1; });
    var dl = Object.keys(byD).map(function (k) { return { name: k, n: byD[k] }; }).sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name, "ru"); });
    var levels = []; dl.forEach(function (d) { if (levels.indexOf(d.n) < 0) levels.push(d.n); });
    var goldN = levels.filter(function (n) { return n >= 2; }).slice(0, 3);
    var deptSum = dl.reduce(function (a, d) { return a + d.n; }, 0) + general;
    checks.push({ bad: deptSum !== pos, text: "Отделения в сумме: " + deptSum + " из " + pos + " (из них о больнице в целом " + general + ")" });
    D.where = { gold: goldN.map(function (n, i) { return { place: i + 1, n: n, names: dl.filter(function (d) { return d.n === n; }).map(function (d) { return d.name; }) }; }),
      one: dl.filter(function (d) { return goldN.indexOf(d.n) < 0; }).map(function (d) { return { name: d.name, n: d.n }; }), general: general,
      photos: [] };
    // фото на слайде «Отделения» — лучших отделений недели (по местам); подойдёт фото отделения или врачей этого отделения.
    // Фото хранится по названию отделения и в следующие недели подставляется само
    var w0 = D.where, wide = w0.gold.length >= 3 || w0.one.length > 5 || w0.one.some(function (x) { return x.name.length > 26; });
    var slotsN = wide ? 2 : 3, slots = dl.slice(0, slotsN).map(function (d) { return d.name; });
    while (slots.length < slotsN) slots.push(slots.indexOf("ГКБ 24") < 0 ? "ГКБ 24" : "ГКБ 24 (" + (slots.length + 1) + ")");
    w0.wide = wide; w0.slots = slots;
    w0.photos = slots.map(function (nm, i) {
      return photoOf(nm, "dept", i);   // только фото, загруженное для этого отделения: иначе программа просит его
    });
    slots.forEach(function (nm, i) {
      if (w0.photos[i]) return;
      var dd = dl.filter(function (d) { return d.name === nm; })[0], docsIn = list.filter(function (d) { return d.dept === nm; }).map(function (d) { return d.p.short; });
      need.push({ kind: "photo", who: nm, slot: "dept", text: /^ГКБ 24/.test(nm) ? "Фото больницы для слайда «Отделения» (ячейка " + (i + 1) + ")" :
        "Фото для слайда «Отделения»: " + nm + (dd ? " (" + (i + 1) + "-е по благодарностям, " + dd.n + ")" : "") + " — фото отделения или врачей отделения" + (docsIn.length ? " (" + docsIn.slice(0, 3).join(", ") + ")" : "") + ". Сохранится для следующих недель" });
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
    return { D: D, checks: checks, need: need, numbers: numbers, doctors: list.map(function (d) { return { short: d.p.short, fio: d.p.fio, dept: d.dept, n: d.n, gold: gold.indexOf(d) >= 0, hasPhoto: !!photoOf(d.p.fio, "face") }; }) };
  }
  function restTitle(rest) {
    if (!rest.length) return "";
    var ns = rest.map(function (d) { return d.n; }), all1 = ns.every(function (n) { return n === 1; }), dk = DK();
    return (all1 ? "Ещё по одной: " : "Ещё благодарности: ") + rest.length + " " + dk.plural(rest.length, "сотрудник", "сотрудника", "сотрудников");
  }
  function dateHuman(d) { d = s(d); var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d) || /^(\d{2})\.(\d{2})\.(\d{4})/.exec(d); if (!m) return d; var day = m[1].length === 4 ? +m[3] : +m[1], mon = m[1].length === 4 ? +m[2] : +m[2]; return day + " " + DK().MON[mon - 1]; }
  function notesOf(D, n) {
    return {
      week: "Неделя " + D.foot + " (по дате поступления, отчётность закрыта в четверг в 15:00): " + n.pos + " позитивных и " + n.neg + " негативных. Средняя неделя года: " + n.avg.toFixed(1).replace(".", ",") + ". Место: " + n.place + " из " + n.weeks + ". Доля позитива за год " + n.shareY + "%, на этой неделе " + n.share + "%.",
      heroes: "Благодарности врачам по строкам недельного отчёта. Имена, должности и отделения — по «Списку врачей». Цитаты сокращены без изменения смысла.",
      where: "Позитивные отзывы недели по отделениям (по графе «Отделение» отчёта).",
      year: "Позитивные и негативные отзывы по недельным отчётам " + D.year.year + " года."
    };
  }

  window.__otvDeck = window.__otvDeck || {};
  Object.assign(window.__otvDeck, { build: build, history: history, quotes: quotes, platKey: platKey, roleOf: roleOf, deptLow: deptLow, whereLine: whereLine, countPos: countPos, countNeg: countNeg, SEED_2026: SEED_2026 });
})();
