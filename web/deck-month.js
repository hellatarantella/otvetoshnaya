/* «Ответошная» — презентация месяца «Онлайн-обращения» по утверждённому образцу «сентябрь 2026» (8 слайдов):
   титул · отделения · врачи топ-10 · за что благодарят · негатив · месяц в цифрах · динамика года · закрывающий.
   Данные — те же строки, что в недельных отчётах (сохранённые недели + текущий отчёт), цифры считает код со сверкой.
   Отнесение отзыва к месяцу: по дате поступления (решение 20.10) или по дате размещения — переключатель в программе. */
(function () {
  "use strict";
  var DK = function () { return window.__otvDeck; };
  function s(x) { return x == null ? "" : String(x); }
  function norm(x) { return s(x).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/g, " ").trim(); }

  /* месяцы 2026 до программы: из утверждённой презентации «сентябрь 2026» (сводная таблица, все каналы) */
  var SEED = { year: 2026, pos: [164, 221, 210, 210, 121, 127, 124, 109, 193], neg: [13, 20, 56, 72, 23, 17, 16, 18, 13],
    platYtd: { "ПроДокторов": 669, "Яндекс": 340, "Сайт": 312, "ДокТу": 105, "Google": 24, "НаПоправку": 17, "2ГИС": 7 } };
  var MON_SHORT = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
  var MON_NOM = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  var MON_PREP = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];
  var MON_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  var MON_DAT = ["январю", "февралю", "марту", "апрелю", "маю", "июню", "июлю", "августу", "сентябрю", "октябрю", "ноябрю", "декабрю"];
  function iso(d) { d = s(d).trim(); var m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(d); if (m) return m[3] + "-" + m[2] + "-" + m[1]; m = /^(\d{4}-\d{2}-\d{2})/.exec(d); return m ? m[1] : ""; }
  function msk(isoTs) { var t = Date.parse(isoTs); if (isNaN(t)) return ""; return new Date(t + 3 * 3600e3).toISOString().slice(0, 10); }
  function clamp(d, a, b) { return !d ? a : d < a ? a : d > b ? b : d; }
  function ymAdd(ym, k) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + k; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + "-" + ("0" + (m + 1)).slice(-2); }

  /* ---------- строки отчётов: каждая с датой размещения и датой поступления ---------- */
  function allRows(snaps) {
    var weeks = Object.keys(snaps || {}).map(function (k) { return snaps[k]; });
    var st = window.__otvReports && window.__otvReports.state && window.__otvReports.state();
    if (st && st.start && !(snaps || {})[st.start]) weeks.push({ start: st.start, end: st.end, positive: st.positive || [], negative: st.negative || [] });
    // дата поступления — из реестра программы (по тексту отзыва); нет в реестре — дата размещения в пределах недели отчёта
    var reg = (window.__otvAll && window.__otvAll("registry")) || {}, arr = {};
    Object.keys(reg).forEach(function (id) { var r = reg[id] || {}, k = norm(r.fullText || r.text).slice(0, 60); if (k && r.arrivedAt && !arr[k]) arr[k] = msk(r.arrivedAt); });
    var out = [], seen = {};
    weeks.forEach(function (w) {
      var add = function (r, tone) {
        var text = s(r.full || r.text).trim(); if (!text && !s(r.platform).trim()) return;
        if (tone === "neg" && r.empty) return;
        // повтор — тот же отзыв в двух недельных отчётах: совпадают площадка, дата и ВЕСЬ текст (не только начало)
        var placed = iso(r.date), k = norm(text).slice(0, 60), key = tone + "|" + DK().platKey(r.platform) + "|" + placed + "|" + norm(text);
        if (seen[key]) return; seen[key] = 1;
        var a = arr[k] || "";
        out.push({ tone: tone, platform: DK().platKey(r.platform), placed: placed || w.start, arrived: a && a >= w.start && a <= addDays(w.end, 1) ? a : clamp(placed, w.start, w.end), dept: s(r.dept).trim(), doctor: s(r.doctor).trim(), text: text, week: w.start });
      };
      (w.positive || []).forEach(function (r) { if (s(r.text || r.full).trim()) add(r, "pos"); });
      (w.negative || []).forEach(function (b) { if (!b.empty && (s(b.platform).trim() || s(b.text || b.full).trim())) add(b, "neg"); });
    });
    return out;
  }
  function addDays(isoD, n) { var d = new Date(isoD + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function monthOf(r, mode) { return (mode === "placed" ? r.placed : r.arrived).slice(0, 7); }

  function list(snaps) {
    var rows = allRows(snaps), ms = {};
    rows.forEach(function (r) { ms[r.arrived.slice(0, 7)] = 1; ms[r.placed.slice(0, 7)] = 1; });
    // по умолчанию — последний закончившийся месяц (презентацию месяца делают в начале следующего)
    var today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10), out = Object.keys(ms).filter(function (x) { return /^\d{4}-\d{2}$/.test(x); }).sort().reverse().map(function (ym) {
      var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1, last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), end = ym + "-" + ("0" + last).slice(-2);
      return { key: "m" + ym, label: DK().MON1[m] + " " + y + (end >= today ? " (месяц ещё идёт)" : ""), data: { ym: ym, start: ym + "-01", end: end, rows: rows }, done: end < today };
    });
    var d0 = out.filter(function (x) { return x.done; })[0]; if (d0) d0.def = true;
    return out;
  }

  /* ---------- темы благодарностей и негатива (по уникальным текстам, обобщённо) ---------- */
  var THEMES = [
    ["Профессионализм, «золотые руки»", /профессионал|золот\S* рук|мастерск|мастерств|грамотн|опытн|высококласс|блестящ/i],
    ["Внимание, чуткость, забота", /внимательн|чутк|забот|доброжелат|человечн|отзывчив|доброт|душевн|тепл/i],
    ["Объяснил, успокоил, снял страх", /объясн|рассказал|успоко|страх|волнени|поддерж|спокойств|тревог/i],
    ["Медсёстры и вся команда", /медсестр|медсёстр|медбрат|персонал|коллектив|команд|санитар|младш\S* медиц/i],
    ["Скорость и организация", /быстр|оперативн|организ|без очеред|вовремя|чётк|четк|в тот же день|сразу/i],
    ["Условия: чистота, палаты, питание", /чист|палат|питани|кормят|кормили|еда\b|вкусн|комфорт|уют/i],
    ["Результат: вылечили, без боли", /без боли|вылечил|помог|результат|выздоров|восстановл|прошл\S* (успешно|отлично|хорошо)|на поправку/i]
  ];
  var PHRASES = [["«рекомендую»", /рекоменд/i], ["«врач от Бога»", /от бога/i], ["«золотые руки»", /золот\S* рук/i]];
  var NEG_THEMES = [
    ["Отношение отдельных сотрудников", "грубость, нежелание объяснять и отвечать на вопросы", /груб|хам|нагруб|невнимат|равнодуш|безразлич|не объясн|игнор|не отвеча|пренебреж|отношени/i],
    ["Запись и ожидание", "сложности с записью к специалистам, долгое ожидание", /запис|ожидан|ждал|ждать|очеред|дозвон|долго/i],
    ["Сестринский уход", "уход в отделении, выдача лекарств, гигиена", /медсестр|медсёстр|уход|санитар|гигиен|лекарств|капельниц|укол/i],
    ["Организация и условия", "порядок в отделении, бытовые условия", /организац|бардак|грязн|холодн|палат|питани|еда\b|условия|душ\b|туалет/i],
    ["Информирование и документы", "выписки, справки, сведения о лечении", /документ|выписк|справк|не сообщ|информац|не предупред|анализ/i],
    ["Исход лечения", "жалобы на результат лечения", /не помог|ухудш|осложнен|умер|скончал|исход|результат лечени|навредил/i]
  ];
  var THANKS = /спасибо|благодар|золот\S* рук|профессионал/i;

  /* ---------- модель месяца ---------- */
  function build(data, snaps, opt) {
    opt = opt || {};
    var dk = DK(), person = opt.person || function () { return null; }, photoOf = opt.photoOf || function () { return null; }, pick = opt.pick || {};
    var mode = pick.mode === "arrival" ? "arrival" : "placed", ym = data.ym, y = +ym.slice(0, 4), mi = +ym.slice(5, 7) - 1;
    var rows = (data.rows || []).filter(function (r) { return monthOf(r, mode) === ym; });
    var P = rows.filter(function (r) { return r.tone === "pos"; }), N = rows.filter(function (r) { return r.tone === "neg"; });
    var pos = P.length, neg = N.length, checks = [], need = [], choices = [];
    var modeOpts = [{ key: "placed", label: "по дате в строке отчёта, с 1-го по последнее число (решение 03.11)" }, { key: "arrival", label: "по дате поступления в программу" }];
    choices.push({ kind: "choice", field: "mode", options: modeOpts, current: mode, text: "Как относить отзыв к месяцу" });
    checks.push({ bad: false, text: "Позитивных " + pos + ", негативных " + neg + " — " + (mode === "placed" ? "по дате в строке отчёта" : "по дате поступления") + ", из недельных отчётов программы" });

    // площадки
    var byP = {}, negP = {};
    P.forEach(function (r) { byP[r.platform] = (byP[r.platform] || 0) + 1; }); N.forEach(function (r) { negP[r.platform] = (negP[r.platform] || 0) + 1; });
    var sumP = Object.keys(byP).reduce(function (a, k) { return a + byP[k]; }, 0);
    checks.push({ bad: sumP !== pos, text: "Площадки в сумме: " + sumP + " из " + pos + " позитивных" });

    // прошлый месяц: до программы — из утверждённой сводки, дальше — по отчётам программы
    var prevYm = ymAdd(ym, -1), prev = monthTotals(prevYm, data.rows, mode);
    // год по месяцам
    var months = [];
    for (var k = 0; k <= mi; k++) { var ymk = y + "-" + ("0" + (k + 1)).slice(-2), t = k === mi ? { pos: pos, neg: neg, from: "этот месяц" } : monthTotals(ymk, data.rows, mode); months.push({ label: MON_SHORT[k], pos: t ? t.pos : 0, neg: t ? t.neg : 0, cur: k === mi, none: !t }); }
    var ytdPos = months.reduce(function (a, m) { return a + m.pos; }, 0), ytdNeg = months.reduce(function (a, m) { return a + m.neg; }, 0);
    var platYtd = {};
    if (y === SEED.year) Object.keys(SEED.platYtd).forEach(function (pk) { platYtd[pk] = SEED.platYtd[pk]; });
    (data.rows || []).forEach(function (r) { var m = monthOf(r, mode); if (r.tone === "pos" && m.slice(0, 4) === String(y) && m <= ym && !(y === SEED.year && +m.slice(5, 7) <= SEED.pos.length)) platYtd[r.platform] = (platYtd[r.platform] || 0) + 1; });
    if (months.some(function (m) { return m.none; })) checks.push({ bad: true, text: "Нет данных за месяцы: " + months.filter(function (m) { return m.none; }).map(function (m) { return m.label; }).join(", ") + " — на слайде «Динамика» будут нули" });

    // отделения
    var byD = {}, general = 0;
    P.forEach(function (r) { if (!r.dept || /^ГКБ\s*24$/i.test(r.dept)) general++; else { var nm = dk.slideDept(r.dept); byD[nm] = (byD[nm] || 0) + 1; } });
    var dl = Object.keys(byD).map(function (k2) { return { name: k2, n: byD[k2] }; }).sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name, "ru"); });
    var dsum = dl.reduce(function (a, d) { return a + d.n; }, 0) + general;
    checks.push({ bad: dsum !== pos, text: "Отделения в сумме: " + dsum + " из " + pos + " (о больнице в целом " + general + ")" });
    var levels = []; dl.forEach(function (d) { if (levels.indexOf(d.n) < 0) levels.push(d.n); });
    var top = levels.slice(0, 3), cards = dl.filter(function (d) { return top.indexOf(d.n) >= 0; }).slice(0, 4);
    cards.forEach(function (c) { c.place = top.indexOf(c.n) + 1; });
    var restD = dl.filter(function (d) { return cards.indexOf(d) < 0; });

    // врачи: строка отчёта с врачом — благодарность
    // 12.11: врач не найден или таких двое — вы выбираете в «Нужно ваше решение» (раньше выгрузка просто блокировалась)
    var docFix = pick.docFix || {}, docNeed = {};
    var personFix = function (tok) { var f = docFix[tok]; if (f === "-") return "skip"; var p0 = person(f || tok); return p0 && !p0.ambiguous ? p0 : (f ? person(tok) : p0); };
    var askDoc = function (tok, p0) { if (docNeed[tok]) return; docNeed[tok] = 1; var R0 = window.__otvReports, opts = p0 && p0.ambiguous ? p0.ambiguous : (R0 && R0.similar ? R0.similar(tok) : []);
      need.push({ kind: "doctor", tok: tok, options: opts, text: p0 && p0.ambiguous ? "Графа «Врач»: «" + tok + "» — в «Списке врачей» таких несколько. Кто это?" : "Графа «Врач»: «" + tok + "» — нет в «Списке врачей»" + (opts.length ? ". Похожие:" : ". Похожих нет") }); };
    var docs = {}, unresolved = [];
    P.forEach(function (r) {
      var toks = s(r.doctor).split(/\s*[,;]\s*/).filter(function (x) { return x && x !== "—" && x !== "-"; });
      toks.forEach(function (tok) {
        var p = personFix(tok); if (p === "skip") return; if (!p || p.ambiguous) { askDoc(tok, p); return; }
        var d = docs[p.short] = docs[p.short] || { p: p, n: 0, rows: [] }; d.n++; d.rows.push({ r: r, multi: toks.length > 1 });
      });
    });
    if (unresolved.length) checks.push({ bad: true, text: "Нет в «Списке врачей» или неоднозначно: " + unresolved.join("; ") });
    var dlist = Object.keys(docs).map(function (k3) { return docs[k3]; }).sort(function (a, b) { return b.n - a.n || a.p.sur.localeCompare(b.p.sur, "ru"); });
    var goldPick = pick.gold || {}, band = dk.BAND ? dk.BAND.card4 : [45, 85, 65], used = {}, top3 = [];
    dlist.forEach(function (d) { if (top3.length < 3 && goldPick[d.p.short] !== "rest") top3.push(d); });
    top3.forEach(function (d, i) {
      d.place = i + 1;
      if (!photoOf(d.p.fio, "face")) need.push({ kind: "photo", who: d.p.fio, short: d.p.short, dept: d.p.cat, text: "Нужно фото: " + d.p.fio + " (" + (d.p.cat || "") + ") — загрузите или уберите из золотых карточек месяца" });
      var stems = [d.p.sur, d.p.name].filter(Boolean).map(function (x) { return x.toLowerCase().replace(/ё/g, "е").slice(0, Math.max(4, x.length - 2)); });
      var qs = [];
      d.rows.forEach(function (x) { dk.quotes(x.r.text).forEach(function (q) { var low = q.toLowerCase().replace(/ё/g, "е"); if (x.multi && !stems.some(function (st) { return low.indexOf(st) >= 0; })) return; if (!used[q] && qs.indexOf(q) < 0) qs.push(q); }); });
      var opts = qs.filter(function (q) { return dk.okQuote(q, band); }), q0 = (pick.quote || {})[d.p.short];
      var own = (pick.own || []).indexOf(s(q0)) >= 0;
      if (q0 && !(dk.okQuote(q0, band) && (own || dk.praise(q0)))) q0 = "";
      if (!q0) { q0 = opts.filter(function (q) { return Math.abs(q.length - band[2]) <= 30; })[0] || opts[0] || ""; if (opts.length) need.push({ kind: "quote", short: d.p.short, options: opts, current: q0, band: band, text: "Цитата для карточки месяца " + d.p.short + ": выберите или впишите, " + band[0] + "–" + band[1] + " знаков" }); }
      used[q0] = 1; d.quote = q0;
      choices.push({ kind: "quote", short: d.p.short, options: opts, current: q0, band: band, text: "Цитата для карточки " + d.p.short + " (" + band[0] + "–" + band[1] + " знаков)" });
    });
    var others = dlist.filter(function (d) { return top3.indexOf(d) < 0; }).slice(0, 7);

    // темы благодарностей — по уникальным текстам; по разбору модели, если отзыв уже разобран, иначе по ключевым словам
    var uniq = {}; P.forEach(function (r) { var k4 = norm(r.text).slice(0, 120); if (k4) uniq[k4] = r.text; });
    var texts = Object.keys(uniq).map(function (k5) { return uniq[k5]; }), nU = texts.length || 1;
    var themes = THEMES.map(function (t) { var c = texts.filter(function (x) { var a = aiOf({ text: x }); return a ? a.pos.indexOf(t[0]) >= 0 : t[1].test(x); }).length; return { name: t[0], n: c, pct: Math.round(c * 100 / nU) }; }).sort(function (a, b) { return b.pct - a.pct; });
    var phrases = PHRASES.map(function (p) { return { name: p[0], n: texts.filter(function (x) { return p[1].test(x); }).length }; });
    // негатив — обобщённые темы, без имён и подробностей
    var negT = NEG_THEMES.map(function (t) { return { name: t[0], desc: t[1], n: N.filter(function (r) { var a = aiOf(r); return a ? a.neg.indexOf(t[0]) >= 0 : t[2].test(r.text); }).length, red: t[0] === "Исход лечения" }; })
      .filter(function (t) { return t.n > 0; }).sort(function (a, b) { return (a.red - b.red) || (b.n - a.n); }).slice(0, 4);
    var negThanks = N.filter(function (r) { return THANKS.test(r.text); }).length;

    var monNom = MON_NOM[mi], MonNom = dk.MON1[mi];
    var D = {
      month: { label: MonNom + " " + y, nom: monNom, prep: MON_PREP[mi], gen: MON_GEN[mi], y: y },
      photos: { cover: photoOf("Обложка месяца", "mcover"), end: photoOf("Закрывающий слайд месяца", "mend") },
      depts: { cards: cards, rest: restD, general: general },
      doctors: { top: top3.map(function (d) { return { short: d.p.short, sur: d.p.sur, name: (d.p.name + " " + d.p.pat).trim(), dept: dk.slideDept(d.p.cat || ""), n: d.n, quote: d.quote, photo: photoOf(d.p.fio, "face"), place: d.place }; }),
        rest: others.map(function (d, i) { return { place: top3.length + i + 1, short: d.p.short, dept: dk.deptLow(d.p.cat || ""), n: d.n }; }) },
      themes: { list: themes, phrases: phrases, unique: texts.length },
      negative: { n: neg, byPlat: Object.keys(negP).sort(function (a, b) { return negP[b] - negP[a]; }).map(function (k6) { return { key: k6, n: negP[k6] }; }), themes: negT, thanks: negThanks },
      kpi: { total: pos + neg, pos: pos, neg: neg, sharePos: pos + neg ? Math.round(pos * 100 / (pos + neg)) : 100, prev: prev, prevName: MON_DAT[(mi + 11) % 12], byP: byP, negP: negP },
      dyn: { months: months, ytdPos: ytdPos, ytdNeg: ytdNeg, platYtd: platYtd, y: y }
    };
    D.notes = {
      mdepts: "Позитивные отзывы за " + monNom + " по отделениям (графа «Отделение» недельных отчётов): " + (pos - general) + " с отделением и " + general + " о больнице в целом, всего " + pos + ".",
      mdoctors: "Число позитивных отзывов " + monNom + ", в которых упомянут врач (по строкам недельных отчётов). Имена, отделения — по «Списку врачей». Цитаты сокращены без изменения смысла.",
      mthemes: "Темы определены по ключевым словам в " + texts.length + " уникальных позитивных отзывах (без дублей одного текста на разных площадках). Проценты ориентировочные.",
      mnegative: "Негатив за " + monNom + ": " + neg + ". Темы обобщены, без имён и подробностей.",
      mkpi: MonNom + " " + y + ": " + (pos + neg) + " онлайн-обращений — " + pos + " позитивных и " + neg + " негативных" + (prev ? ". " + dk.MON1[(mi + 11) % 12] + ": " + prev.pos + " позитивных и " + prev.neg + " негативных" + (prev.seed ? " (сводная таблица, все каналы)" : "") : "") + ".",
      mdyn: "По месяцам " + y + " года" + (y === SEED.year ? ": январь–сентябрь по сводной таблице (все каналы), дальше — по недельным отчётам программы" : "") + "."
    };
    if (prev && prev.seed) checks.push({ bad: false, text: "Прошлый месяц (" + dk.MON1[(mi + 11) % 12] + "): " + prev.pos + " позитивных, " + prev.neg + " негативных — по утверждённой сводке (все каналы, включая ТДМ-чат и канцелярию)" });
    checks.push({ bad: false, text: "Благодарностей врачам: " + dlist.reduce(function (a, d) { return a + d.n; }, 0) + " (" + dlist.length + " " + dk.plural(dlist.length, "сотрудник", "сотрудника", "сотрудников") + ")" });
    return { D: D, checks: checks, need: need, choices: choices, numbers: { pos: pos, neg: neg, byPlatform: byP }, doctors: dlist.map(function (d) { return { short: d.p.short, fio: d.p.fio, dept: d.p.cat, n: d.n }; }) };
  }
  function monthTotals(ym, rows, mode) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7);
    if (y === SEED.year && m <= SEED.pos.length) return { pos: SEED.pos[m - 1], neg: SEED.neg[m - 1], seed: true };
    var R = (rows || []).filter(function (r) { return monthOf(r, mode) === ym; });
    if (!R.length) return null;
    return { pos: R.filter(function (r) { return r.tone === "pos"; }).length, neg: R.filter(function (r) { return r.tone === "neg"; }).length };
  }

  /* ---------- слайды (вёрстка утверждённой презентации «сентябрь 2026», шрифт Cera Round) ---------- */
  function slidesHtml(D) {
    var dk = DK(), C = dk.C, B = dk.B, SEC = dk.SEC, nb = dk.nb, esc = dk.esc, A = dk.A, frame = dk.frame;
    var foot = "", out = [];
    var n0 = 0, num = function () { return ++n0; };
    // 1. титул
    out.push('<section id="mcover" style="background:' + C.navy + '">' + dk.photo(D.photos.cover, "position:absolute;top:0px;left:0px;width:1920px;height:1080px", "") +
      '<img src="' + A("logoWhite") + '" alt="Логотип «24+ Московская больница»" style="position:absolute;top:46px;left:80px;width:366px;height:61px;object-fit:contain">' +
      '<div style="position:absolute;top:152px;left:0px;width:1920px;height:2px;background:#ffffff33"></div>' +
      '<div data-shape="ellipse" style="position:absolute;top:150px;left:1000px;width:900px;height:900px;border-radius:50%;background:#ffffff;opacity:0.14"></div>' +
      '<img src="' + A("icon") + '" alt="Иконка «24+ Московская больница»" style="position:absolute;top:319px;left:1169px;width:562px;height:560px;border-radius:66px;object-fit:contain;box-shadow:0 24px 48px #0b121c66">' +
      '<img src="' + A("heart") + '" alt="Значок с сердцем" style="position:absolute;top:228px;left:1622px;width:168px;height:174px;object-fit:contain">' +
      '<h1 style="position:absolute;top:356px;left:80px;width:1000px;font-size:88px;' + B + 'line-height:1.12;white-space:nowrap;color:#ffffff">Онлайн-обращения</h1>' +
      '<div style="position:absolute;top:480px;left:80px;width:1000px;display:flex;flex-direction:row;align-items:start"><p style="font-size:52px;' + B + 'line-height:1.15;white-space:nowrap;color:#ffffff;background:' + C.red + ';padding:10px 30px;border-radius:18px">' + esc(D.month.label) + '</p></div>' +
      '<p style="position:absolute;top:628px;left:80px;width:900px;font-size:42px;' + B + 'color:#ffffff">ГБУЗ «ГКБ №&#160;24 ДЗМ»</p></section>'); num();
    // 2. отделения
    var dp = D.depts, maxN = Math.max.apply(null, dp.rest.map(function (d) { return d.n; }).concat([1])), unit = Math.min(30, 330 / maxN);
    var nr = dp.rest.length, perCol = Math.ceil(nr / 2), fsz = perCol > 14 ? 22 : perCol > 10 ? 24 : 28, gp = perCol > 14 ? 4 : perCol > 10 ? 6 : 12;
    var row = function (d) { var col = d.n >= 8 ? C.mid : d.n >= 3 ? C.bar2 : C.pale; return '<div style="display:grid;grid-template-columns:minmax(0px, 1fr) auto;gap:16px;align-items:center"><p style="font-size:' + fsz + 'px;color:' + C.ink + '">' + nb(d.name).replace(/ (\d)/g, "&#160;$1") + '</p><div style="display:flex;flex-direction:row;align-items:center;gap:14px;width:' + Math.round(330 * Math.min(1, maxN * unit / 330) + 70) + 'px"><div style="width:' + Math.max(12, Math.round(d.n * unit)) + 'px;height:' + (fsz + 2) + 'px;flex:none;background:' + col + ';border-radius:8px"></div><p style="font-size:' + fsz + 'px;' + B + 'line-height:1;color:' + C.blue + '">' + d.n + '</p></div></div>'; };
    // читаем слева направо: левая колонка сверху вниз по убыванию, потом правая
    var leftN = dp.general ? Math.floor(nr / 2) : Math.ceil(nr / 2), L = dp.rest.slice(0, leftN), R = dp.rest.slice(leftN);
    var pill = dp.general ? '<div style="align-self:start;display:flex;flex-direction:row;align-items:center;gap:20px;background:' + C.blue + ';border-radius:14px;padding:8px 22px"><p style="font-size:40px;' + B + 'line-height:1.1;color:#FFFFFF;white-space:nowrap">' + dp.general + '</p><p style="font-size:26px;' + B + 'color:#FFFFFF">о&#160;больнице в&#160;целом</p></div>' : '';
    out.push('<section id="mdepts" style="' + SEC + 'padding:216px 80px 104px 80px;display:flex;flex-direction:column;gap:36px">' + frame("mdepts", "Отделения: благодарности за " + D.month.nom, num(), foot) +
      '<div style="display:grid;grid-template-columns:repeat(' + Math.max(1, dp.cards.length) + ', minmax(0px, 1fr));gap:24px">' + dp.cards.map(function (c) {
        return '<div style="display:flex;flex-direction:column;gap:14px;background:' + C.gold + ';border:3px solid ' + C.goldB + ';border-radius:24px;padding:30px 36px">' +
          '<div style="display:flex;flex-direction:row;align-items:center;justify-content:space-between"><div style="width:64px;height:64px;flex:none;display:flex;align-items:center;justify-content:center;background:' + C.goldD + ';border-radius:50%"><p style="font-size:32px;' + B + 'color:#FFFFFF">' + c.place + '</p></div>' +
          '<p style="font-size:88px;' + B + 'line-height:1;color:' + C.goldT + ';white-space:nowrap">' + c.n + '</p></div>' +
          '<p style="font-size:32px;' + B + 'line-height:1.2;color:' + C.ink + '">' + nb(c.name).replace(/ (\d)/g, "&#160;$1") + '</p></div>';
      }).join("") + '</div>' +
      '<div style="flex:1;min-height:0;display:grid;grid-template-columns:minmax(0px, 1fr) minmax(0px, 1fr);gap:56px">' +
      '<div style="display:flex;flex-direction:column;gap:' + gp + 'px">' + L.map(row).join("") + pill + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:' + gp + 'px">' + R.map(row).join("") + '</div></div></section>');
    // 3. врачи
    var dc = D.doctors;
    var docCard = function (c) {
      return '<div style="display:flex;flex-direction:column;gap:18px;background:' + C.gold + ';border:3px solid ' + C.goldB + ';border-radius:24px;padding:28px 32px">' +
        '<div style="display:grid;grid-template-columns:176px minmax(0px, 1fr);gap:24px;align-items:center"><div style="position:relative;width:176px;height:176px">' +
        dk.photo(c.photo, "width:176px;height:176px;border-radius:50%;border:5px solid " + C.goldB, "Фото: " + c.short) +
        '<div style="position:absolute;right:0px;bottom:0px;width:52px;height:52px;display:flex;align-items:center;justify-content:center;background:' + C.goldD + ';border:3px solid ' + C.gold + ';border-radius:50%"><p style="font-size:26px;' + B + 'color:#FFFFFF">' + c.place + '</p></div></div>' +
        '<div style="display:flex;flex-direction:column;gap:4px"><p data-eqh="mdept" style="font-size:24px;' + B + 'color:' + C.goldT + '">' + nb(c.dept) + '</p><p data-fitw="msur" style="max-width:100%;white-space:nowrap;font-size:34px;' + B + 'line-height:1.15;color:' + C.ink + '">' + esc(c.sur) + '</p><p style="font-size:24px;line-height:1.3;color:' + C.ink + '">' + esc(c.name) + '</p></div></div>' +
        '<div style="display:flex;flex-direction:row;align-items:baseline;gap:14px"><p style="position:relative;top:0.05em;font-size:64px;' + B + 'line-height:1;color:' + C.goldT + ';white-space:nowrap">' + c.n + '</p><p style="font-size:26px;' + B + 'color:' + C.goldT + '">' + esc(dk.pw(c.n, dk.W_THX)) + '</p></div>' +
        (c.quote ? '<p style="font-size:24px;font-style:italic;line-height:1.4;color:' + C.blue + '">«' + nb(c.quote) + '»</p>' : '') + '</div>';
    };
    var docRow = function (r, last) {
      return '<div style="display:grid;grid-template-columns:48px auto minmax(0px, 1fr);gap:20px;align-items:center;' + (last ? '' : 'border-bottom:2px solid ' + C.ice + ';') + 'padding:12px 0px"><div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:' + C.blue + ';border-radius:50%"><p style="font-size:24px;' + B + 'color:#FFFFFF">' + r.place + '</p></div>' +
        '<p style="font-size:28px;line-height:1.25;color:' + C.ink + '"><b style="' + B + '">' + dk.nbName(r.short) + '</b> · <span style="color:' + C.grey + '">' + nb(r.dept).replace(/ (\d)/g, "&#160;$1") + '</span></p><p style="font-size:32px;' + B + 'color:' + C.blue + ';padding:0px 0px 0px 8px">' + r.n + '</p></div>';
    };
    var dl1 = dc.rest.slice(0, Math.ceil(dc.rest.length / 2)), dl2 = dc.rest.slice(dl1.length);
    out.push('<section id="mdoctors" style="' + SEC + 'padding:208px 80px 104px 80px;display:flex;flex-direction:column;gap:28px">' + frame("mdoctors", "Врачи " + D.month.gen + ": топ-" + (dc.top.length + dc.rest.length) + " по благодарностям", num(), foot) +
      '<div style="display:grid;grid-template-columns:repeat(' + Math.max(1, dc.top.length) + ', minmax(0px, 1fr));gap:24px">' + dc.top.map(docCard).join("") + '</div>' +
      (dc.rest.length ? '<div style="display:grid;grid-template-columns:minmax(0px, 1fr) minmax(0px, 1fr);gap:48px"><div style="display:flex;flex-direction:column">' + dl1.map(function (r, i) { return docRow(r, i === dl1.length - 1); }).join("") + '</div><div style="display:flex;flex-direction:column">' + dl2.map(function (r, i) { return docRow(r, i === dl2.length - 1); }).join("") + '</div></div>' : '') + '</section>');
    // 4. за что благодарят
    var th = D.themes;
    out.push('<section id="mthemes" style="' + SEC + 'padding:216px 80px 104px 80px;display:flex;flex-direction:row;gap:48px">' + frame("mthemes", "За что благодарят пациенты", num(), foot) +
      '<div style="flex:1;display:flex;flex-direction:column;gap:22px">' + th.list.map(function (t, i) {
        var col = i < 2 ? C.blue : i < 4 ? C.mid : C.bar2;
        return '<div style="display:grid;grid-template-columns:64px 500px minmax(0px, 1fr) 100px;gap:24px;align-items:center"><div style="width:64px;height:64px;display:flex;align-items:center;justify-content:center;background:' + C.blue + ';border-radius:50%"><p style="font-size:28px;' + B + 'color:#FFFFFF">' + (i + 1) + '</p></div>' +
          '<p style="font-size:28px;' + B + 'color:' + C.ink + ';white-space:nowrap">' + nb(t.name) + '</p><div style="display:flex;flex-direction:row;height:36px;background:' + C.ice + ';border-radius:10px"><div style="width:' + Math.round(t.pct * 5.16) + 'px;height:36px;flex:none;background:' + col + ';border-radius:10px"></div></div>' +
          '<p style="font-size:32px;' + B + 'color:' + C.blue + ';text-align:right">' + t.pct + '%</p></div>';
      }).join("") + '<div style="flex:1"></div><p style="font-size:24px;line-height:1.4;color:' + C.grey + '">' + nb("Доля от позитивных отзывов за " + D.month.nom + "; в одном отзыве может быть несколько тем") + '</p></div>' +
      '<div style="width:460px;flex:none;display:flex;flex-direction:column;gap:20px;background:' + C.blue + ';border-radius:24px;padding:40px 44px"><p style="align-self:start;font-size:26px;' + B + 'color:#FFFFFF;background:' + C.red + ';padding:10px 28px;border-radius:12px">Чаще всего пишут</p>' +
      '<div style="flex:1;display:flex;flex-direction:column;justify-content:space-evenly">' + th.phrases.map(function (p) { return '<div style="display:flex;flex-direction:column;gap:4px"><p style="font-size:88px;' + B + 'line-height:1;color:#FFFFFF">' + p.n + '</p><p style="font-size:32px;' + B + 'color:#FFFFFF">' + esc(p.name) + '</p></div>'; }).join("") + '</div>' +
      '<p style="font-size:24px;line-height:1.4;color:' + C.pale + '">отзывов, где встречается фраза</p></div></section>');
    // 5. негатив
    var ng = D.negative, PN = { "Сайт": "Сайт больницы", "Яндекс": "Яндекс Карты" };
    out.push('<section id="mnegative" style="' + SEC + 'padding:216px 80px 104px 80px;display:flex;flex-direction:row;gap:32px">' + frame("mnegative", "Негативные отзывы: о чём пишут", num(), foot) +
      '<div style="width:520px;flex:none;display:flex;flex-direction:column;gap:16px;background:' + C.pink + ';border-radius:24px;padding:44px 48px"><p style="font-size:160px;' + B + 'line-height:1;color:' + C.red + ';white-space:nowrap">' + ng.n + '</p>' +
      '<p style="font-size:32px;' + B + 'line-height:1.3;color:' + C.ink + '">' + esc(dk.pw(ng.n, dk.W_NEG)) + ' за ' + esc(D.month.nom) + '</p><div style="flex:1"></div><div style="height:2px;background:#F5C2C7"></div>' +
      ng.byPlat.map(function (p) { return '<div style="display:grid;grid-template-columns:minmax(0px, 1fr) 60px;gap:14px;align-items:center"><p style="font-size:28px;color:' + C.ink + '">' + esc(PN[p.key] || p.key) + '</p><p style="font-size:30px;' + B + 'color:' + C.red + ';text-align:right">' + p.n + '</p></div>'; }).join("") + '</div>' +
      '<div style="flex:1;display:flex;flex-direction:column;gap:20px">' + (ng.themes.length ? ng.themes.map(function (t) {
        return '<div style="display:grid;grid-template-columns:80px minmax(0px, 1fr);gap:32px;align-items:center;background:' + (t.red ? C.pink : C.ice) + ';border-radius:20px;padding:30px 36px"><div style="width:80px;height:80px;display:flex;align-items:center;justify-content:center;background:' + (t.red ? C.red : C.blue) + ';border-radius:50%"><p style="font-size:38px;' + B + 'color:#FFFFFF">' + t.n + '</p></div>' +
          '<div style="display:flex;flex-direction:column;gap:6px"><p style="font-size:32px;' + B + 'color:' + (t.red ? C.red : C.ink) + '">' + nb(t.name) + '</p><p style="font-size:28px;line-height:1.35;color:' + (t.red ? C.ink : C.grey) + '">' + nb(t.desc) + '</p></div></div>';
      }).join("") : '<p style="font-size:32px;' + B + 'color:' + C.blue + '">Негативных отзывов за месяц нет</p>') +
      '<div style="flex:1"></div>' + (ng.thanks ? '<p style="font-size:28px;' + B + 'line-height:1.4;color:' + C.blue + '">' + nb("В " + ng.thanks + " " + dk.plural(ng.thanks, "негативном отзыве", "негативных отзывах", "негативных отзывах") + " пациенты отдельно благодарят врачей") + '</p>' : '') + '</div></section>');
    // 6. месяц в цифрах
    var kp = D.kpi, pv = kp.prev, vs = function (a, b) { if (!b && b !== 0 || !pv) return ""; var p = dk.pct(a, b); return p === 0 ? "как в " + MON_PREP[(MON_DAT.indexOf(kp.prevName) + 12) % 12] : dk.signed(p) + " к " + kp.prevName; };
    var plats = ["ПроДокторов", "Яндекс", "Сайт", "ДокТу"].map(function (k7) { return { keys: [k7], pos: kp.byP[k7] || 0, neg: kp.negP[k7] || 0 }; });
    var small = ["Google", "НаПоправку", "2ГИС"], sp = { keys: small, pos: 0, neg: 0 }; small.forEach(function (k8) { sp.pos += kp.byP[k8] || 0; sp.neg += kp.negP[k8] || 0; }); plats.push(sp);
    Object.keys(kp.byP).forEach(function (k9) { if (["ПроДокторов", "Яндекс", "Сайт", "ДокТу"].concat(small).indexOf(k9) < 0) plats.push({ keys: [k9], pos: kp.byP[k9], neg: kp.negP[k9] || 0 }); });
    var pmax = Math.max.apply(null, plats.map(function (p) { return p.pos; }).concat([1]));
    out.push('<section id="mkpi" style="' + SEC + 'padding:216px 80px 104px 80px;display:flex;flex-direction:column;gap:32px">' + frame("mkpi", dk.MON1[MON_NOM.indexOf(D.month.nom)] + " в цифрах", num(), foot) +
      '<div style="display:grid;grid-template-columns:repeat(3, minmax(0px, 1fr));gap:24px">' +
      '<div style="display:flex;flex-direction:column;gap:10px;background:' + C.blue + ';border-radius:24px;padding:36px 44px"><p style="font-size:110px;' + B + 'line-height:1;color:#FFFFFF;white-space:nowrap">' + kp.total + '</p><p style="font-size:30px;' + B + 'line-height:1.3;color:#FFFFFF">онлайн-' + dk.plural(kp.total, "обращение", "обращения", "обращений") + ' за месяц</p>' + (pv ? '<p style="align-self:start;font-size:26px;' + B + 'color:' + C.blue + ';background:#FFFFFF;padding:6px 18px;border-radius:10px;white-space:nowrap">' + vs(kp.total, pv.pos + pv.neg) + '</p>' : '') + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:10px;background:' + C.ice + ';border-radius:24px;padding:36px 44px"><div style="display:flex;flex-direction:row;align-items:baseline;gap:20px"><p style="font-size:110px;' + B + 'line-height:1;color:' + C.blue + ';white-space:nowrap">' + kp.pos + '</p><p style="font-size:34px;' + B + 'color:' + C.mid + ';white-space:nowrap">' + kp.sharePos + '%</p></div><p style="font-size:30px;' + B + 'line-height:1.3;color:' + C.ink + '">' + esc(dk.pw(kp.pos, dk.W_POS)) + '</p>' + (pv ? '<p style="align-self:start;font-size:26px;' + B + 'color:#FFFFFF;background:' + C.blue + ';padding:6px 18px;border-radius:10px;white-space:nowrap">' + vs(kp.pos, pv.pos) + '</p>' : '') + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:10px;background:' + C.pink + ';border-radius:24px;padding:36px 44px"><div style="display:flex;flex-direction:row;align-items:baseline;gap:20px"><p style="font-size:110px;' + B + 'line-height:1;color:' + C.red + ';white-space:nowrap">' + kp.neg + '</p><p style="font-size:34px;' + B + 'color:' + C.red + ';white-space:nowrap">' + (100 - kp.sharePos) + '%</p></div><p style="font-size:30px;' + B + 'line-height:1.3;color:' + C.ink + '">' + esc(dk.pw(kp.neg, dk.W_NEG)) + '</p>' + (pv ? '<p style="align-self:start;font-size:26px;' + B + 'color:#FFFFFF;background:' + C.red + ';padding:6px 18px;border-radius:10px;white-space:nowrap">' + vs(kp.neg, pv.neg) + '</p>' : '') + '</div></div>' +
      '<div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;background:' + C.ice + ';border-radius:24px;padding:32px 44px">' +
      '<div style="display:grid;grid-template-columns:360px minmax(0px, 1fr) 150px;gap:24px;padding:0px 0px 8px 0px"><p style="font-size:24px;' + B + 'color:' + C.grey + '">Площадка</p><p style="font-size:24px;' + B + 'color:' + C.grey + '">Позитивные</p><p style="font-size:24px;' + B + 'color:' + C.grey + ';text-align:right">Негативные</p></div>' +
      plats.map(function (p, i) {
        var logos = p.keys.map(function (k10) { return k10 === "Сайт" ? '<div style="display:flex;flex-direction:row;align-items:center;gap:14px">' + dk.platLogo(k10, "Логотип сайта «24+»") + '<p style="font-size:30px;' + B + 'color:' + C.blue + ';white-space:nowrap">Сайт больницы</p></div>' : dk.platLogo(k10); }).join("");
        var col = p.pos === pmax ? C.blue : p.pos >= pmax * 0.25 ? C.mid : C.bar2;   // самая крупная площадка — тёмная, как в образце
        return '<div style="display:grid;grid-template-columns:360px minmax(0px, 1fr) 150px;gap:24px;align-items:center;border-top:2px solid #DCE4EF;padding:10px 0px 4px 0px"><div style="display:flex;flex-direction:row;align-items:center;gap:20px;height:48px">' + logos + '</div>' +
          '<div style="display:flex;flex-direction:row;align-items:center;gap:16px"><div style="width:' + Math.max(8, Math.round(p.pos / pmax * 880)) + 'px;height:32px;flex:none;background:' + col + ';border-radius:8px"></div><p style="font-size:30px;' + B + 'color:' + C.blue + ';white-space:nowrap">' + p.pos + '</p></div>' +
          '<p style="font-size:30px;' + B + 'color:' + (p.neg ? C.red : C.mute) + ';text-align:right">' + (p.neg || "—") + '</p></div>';
      }).join("") + '</div></section>');
    // 7. динамика года
    var dy = D.dyn, mmax = Math.max.apply(null, dy.months.map(function (m) { return Math.max(m.pos, m.neg); }).concat([1])), hk = 400 / mmax;
    var platOrder = ["ПроДокторов", "Яндекс", "Сайт", "ДокТу", "Google", "НаПоправку", "2ГИС"].concat(Object.keys(dy.platYtd).filter(function (k11) { return ["ПроДокторов", "Яндекс", "Сайт", "ДокТу", "Google", "НаПоправку", "2ГИС"].indexOf(k11) < 0; }));
    out.push('<section id="mdyn" style="' + SEC + 'padding:208px 80px 104px 80px;display:flex;flex-direction:column;gap:22px">' + frame("mdyn", "Динамика онлайн-обращений в " + dy.y + " году", num(), foot) +
      '<div style="display:flex;flex-direction:row;align-items:center;gap:40px">' + [["Позитивные", C.bar], ["Негативные", C.red]].map(function (l) { return '<div style="display:flex;flex-direction:row;align-items:center;gap:12px"><div style="width:28px;height:28px;background:' + l[1] + ';border-radius:6px"></div><p style="font-size:26px;color:' + C.grey + '">' + l[0] + '</p></div>'; }).join("") +
      '<div style="flex:1"></div><p style="font-size:26px;color:' + C.grey + '">С начала года: <b style="' + B + 'color:' + C.blue + '">' + fmt(dy.ytdPos) + '</b> ' + dk.plural(dy.ytdPos, "позитивный", "позитивных", "позитивных") + ' · <b style="' + B + 'color:' + C.red + '">' + fmt(dy.ytdNeg) + '</b> ' + dk.plural(dy.ytdNeg, "негативный", "негативных", "негативных") + '</p></div>' +
      '<div style="display:flex;flex-direction:column"><div style="display:flex;flex-direction:row;align-items:end;height:460px;border-bottom:2px solid ' + C.line + '">' + dy.months.map(function (m) {
        return '<div style="flex:1;display:flex;flex-direction:row;align-items:end;justify-content:center;gap:8px"><div style="display:flex;flex-direction:column;align-items:center;gap:8px"><p style="font-size:' + (m.cur ? 30 : 26) + 'px;' + B + 'color:' + C.blue + '">' + m.pos + '</p><div style="width:72px;height:' + Math.max(2, Math.round(m.pos * hk)) + 'px;background:' + (m.cur ? C.blue : C.bar) + ';border-radius:10px 10px 0px 0px"></div></div>' +
          '<div style="display:flex;flex-direction:column;align-items:center;gap:8px"><p style="font-size:24px;' + B + 'color:' + C.red + '">' + m.neg + '</p><div style="width:40px;height:' + Math.max(2, Math.round(m.neg * hk)) + 'px;background:' + C.red + ';border-radius:8px 8px 0px 0px"></div></div></div>';
      }).join("") + '</div><div style="display:flex;flex-direction:row;padding:12px 0px 0px 0px">' + dy.months.map(function (m) { return '<p style="flex:1;font-size:26px;' + (m.cur ? B : "") + 'text-align:center;color:' + (m.cur ? C.blue : C.grey) + '">' + m.label + '</p>'; }).join("") + '</div></div>' +
      '<p style="font-size:24px;' + B + 'color:' + C.grey + '">Позитивные отзывы с начала года по площадкам</p>' +
      '<div style="display:grid;grid-template-columns:repeat(' + platOrder.length + ', minmax(0px, 1fr));gap:16px">' + platOrder.map(function (k12) {
        var v = dy.platYtd[k12] || 0;
        if (k12 === "Сайт") return '<div style="display:flex;flex-direction:row;align-items:center;justify-content:center;gap:12px;background:#FFFFFF;border:2px solid #DCE4EF;border-radius:18px;padding:16px 12px">' + dk.platLogo(k12, "Логотип сайта «24+»") + '<div style="display:flex;flex-direction:column;gap:6px"><p style="font-size:24px;' + B + 'color:' + C.grey + '">Сайт</p><p style="font-size:36px;' + B + 'line-height:1;color:' + C.blue + '">' + fmt(v) + '</p></div></div>';
        return '<div style="display:flex;flex-direction:column;align-items:center;gap:8px;background:#FFFFFF;border:2px solid #DCE4EF;border-radius:18px;padding:16px 12px">' + dk.platLogo(k12) + '<p style="font-size:36px;' + B + 'line-height:1;color:' + C.blue + '">' + fmt(v) + '</p></div>';
      }).join("") + '</div></section>');
    // 8. закрывающий
    out.push('<section id="mend" style="background:' + C.navy + '">' + dk.photo(D.photos.end, "position:absolute;left:0px;top:0px;width:1920px;height:1080px", "Коридор больницы") +
      '<div data-shape="ellipse" style="position:absolute;top:90px;left:510px;width:900px;height:900px;border-radius:50%;background:#ffffff;opacity:0.14"></div>' +
      '<img src="' + A("icon") + '" alt="Иконка «24+ Московская больница»" style="position:absolute;top:259px;left:679px;width:562px;height:560px;border-radius:66px;object-fit:contain;box-shadow:0 24px 48px #0b121c66">' +
      '<img src="' + A("heart") + '" alt="Значок с сердцем" style="position:absolute;top:168px;left:1132px;width:168px;height:174px;object-fit:contain"></section>');
    return out;
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }   // 1 479

  // разбор модели по тексту отзыва (реестр программы); одна копия на версию реестра
  var aiIdx = { v: -1, m: {} };
  function low2(t) { return s(t).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/g, " ").trim().slice(0, 80); }
  function aiOf(r) {
    var v = window.__otvVer ? window.__otvVer("registry") : 0;
    if (aiIdx.v !== v) {
      var reg = ((window.__otvAllRO || window.__otvAll) && (window.__otvAllRO || window.__otvAll)("registry")) || {}, m = {};
      Object.keys(reg).forEach(function (id) { var x = reg[id]; if (x && x.ai) { var k = low2(x.fullText || x.text); if (k) m[k] = x.ai; } });
      aiIdx = { v: v, m: m };
    }
    return aiIdx.m[low2(r && r.text)] || null;
  }
  window.__otvDeckMonth = { aiOf: aiOf, build: build, slidesHtml: slidesHtml, list: list, allRows: allRows, SEED: SEED, THEMES: THEMES, NEG_THEMES: NEG_THEMES, monthTotals: monthTotals, MON_SHORT: MON_SHORT, MON_NOM: MON_NOM };
  // вкладка «Презентации → Месяц» — та же основа, что у недели
  function start() {
    if (!window.__otvMakeDeckUi || !window.__otvDeck) return;
    window.__otvDeckUiM = window.__otvMakeDeckUi({
      tab: "deckm", selLabel: "Месяц", empty: "Нет данных: месячная презентация строится из недельных отчётов программы. Подключите Google во вкладке «Отчёты».",
      reviewTitle: "Пересмотреть выбор: способ подсчёта, цитаты, фото", resetText: "Сбросить все решения этого месяца",
      pickId: function (cur) { return "m" + cur.data.ym; },
      list: list, build: build, slides: slidesHtml,
      photos: function (D) {
        var out = [];
        (D.doctors.top || []).forEach(function (c) { var d = (window.__otvDeckUiM._state().res.doctors || []).filter(function (x) { return x.short === c.short; })[0]; out.push(["Фото: " + c.short, d ? d.fio : c.short, "face"]); });
        out.push(["Обложка месяца", "Обложка месяца", "mcover"], ["Закрывающий слайд месяца", "Закрывающий слайд месяца", "mend"]);
        return out;
      },
      fileName: function (d) { var m = +d.ym.slice(5, 7) - 1; return "Онлайн-обращения " + MON_NOM[m] + " " + d.ym.slice(0, 4); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
