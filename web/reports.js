/* «Ответошная» — недельные отчёты в программе (шаг 3).
   Программа сама раскладывает отзывы недели по «Позитиву» и «Негативу» (отделение и врач — по справочнику
   и списку врачей), пересчитывает «Цифры» и пишет в те же Google-файлы через скрипт в вашем Google-аккаунте.
   Спорное не вносится: оно ждёт вашего решения в блоке «Нужна проверка» на вкладке «Отчёты». */
(function () {
  "use strict";
  if (!window.__OTV_APP) return;
  var T = window.__TAURI__, invoke = T && T.core && T.core.invoke;
  if (!invoke) return;
  function s(v) { return v == null ? "" : String(v); }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function nowIso() { return new Date().toISOString(); }
  function norm(t) { return s(t).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/g, " ").trim(); }
  var MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  var NEG_PLAT = { "Сайт": "Сайт больницы" };

  /* ---------- связь со скриптом ---------- */
  var db = null, cfg = null, refs = null, idx = null, st = null, busy = false, line = null, ver = 0;
  var NEED_VER = 4; // версия google/Code.gs, нужная программе
  function ready() { return !!(cfg && cfg.url && cfg.token && cfg.paired); }
  function call(action, extra) {
    if (!cfg || !cfg.url) return Promise.reject(new Error("Google не подключён"));
    // логику отчётов программа шлёт сама: постоянный скрипт в Google её выполняет и никогда не требует обновления
    var body = JSON.stringify(Object.assign({ action: action, token: cfg.token, code: window.__otvGsLib || "" }, extra || {}));
    return invoke("gs_call", { url: cfg.url, body: body }).then(function (txt) {
      var r; try { r = JSON.parse(txt); } catch (e) { throw new Error("скрипт ответил непонятно"); }
      if (r.version) ver = +r.version;
      runner = +(r.runner || 0);
      if (!r.ok) throw new Error(r.error || "ошибка скрипта");
      if (r.state) st = r.state;
      return r;
    });
  }
  function token() {
    var a = new Uint8Array(32); crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join("");
  }
  function saveCfg() { return db ? db.collection("settings").doc("google").set(cfg) : Promise.resolve(); }
  function connect(url) {
    url = s(url).trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) return Promise.reject(new Error("нужна ссылка вида https://script.google.com/macros/s/…/exec"));
    cfg = { url: url, token: (cfg && cfg.url === url && cfg.token) || token(), paired: false };
    return call("pair").then(function () { cfg.paired = true; cfg.pairedAt = nowIso(); return saveCfg(); }).then(function () { return loadRefs(true); });
  }

  /* ---------- справочник: подразделения, исключения, список врачей ---------- */
  function loadRefs(force) {
    if (refs && !force && Date.now() - refs.at < 6 * 3600e3) return Promise.resolve(refs);
    return call("refs").then(function (r) {
      refs = r.refs; refs.at = Date.now(); idx = buildIndex(refs);
      // справочник хранится в программе (только ФИО, должность, подразделение) — ответы подставляют отделение без Google
      if (db) db.collection("settings").doc("refs").set(refs).catch(function () {});
      return refs;
    });
  }
  var runner = 0;
  // старый скрипт без постоянной связи: нужна одна последняя установка, дальше обновлять ничего не надо
  function oldScript() { return ready() && ver > 0 && ver < NEED_VER && !runner; }
  function shortOf(fio) {
    var p = s(fio).trim().split(/\s+/);
    return p[0] + (p[1] ? " " + p[1].charAt(0) + "." : "") + (p[2] ? p[2].charAt(0) + "." : "");
  }
  function yo(x) { return s(x).replace(/ё/g, "е").replace(/Ё/g, "Е"); }
  function stemSur(x) { x = yo(x); var y = x.replace(/(ий|ый|ой|ая|яя|а|я|ь)$/, ""); return y.length >= 4 ? y : x; }
  function stemName(x) { x = yo(x); var y = x.replace(/(ия|ья|ь|й|а|я)$/, ""); return y.length >= 3 ? y : x; }
  function buildIndex(r) {
    var dep = {}, exc = {}, bySur = {};
    (r.departments || []).forEach(function (d) { dep[norm(d[0])] = { cat: d[1], how: d[2], note: d[3] }; });
    (r.exceptions || []).forEach(function (e) { exc[s(e[0]).replace(/\s+/g, "")] = { pos: e[1], cat: e[3], when: e[4] }; });
    var staff = (r.staff || []).map(function (x) {
      var p = s(x[0]).trim().split(/\s+/), o = { fio: x[0], sur: p[0], name: p[1] || "", pat: p[2] || "", pos: x[1], dept: x[2] };
      o.short = shortOf(x[0]);
      o.doctor = /врач|заведующ|главн\S* врач|заместитель главного врача/i.test(o.pos) && !/сестр|брат|санитар|фельдшер|лаборант|регистратор/i.test(o.pos);
      (bySur[o.sur] = bySur[o.sur] || []).push(o);
      return o;
    });
    return { dep: dep, exc: exc, staff: staff, bySur: bySur, cats: (r.categories || []).slice() };
  }
  // категория в отчёте для сотрудника: {cat, sure}
  function catOf(p) {
    var e = idx.exc[p.short.replace(/\s+/g, "")];
    if (e) {
      if (/по месту лечения|или|по отзыву/i.test(e.cat)) return { cat: "", sure: false, why: "«Исключения»: " + e.cat };
      return { cat: e.cat, sure: /всегда/i.test(e.when), why: /всегда/i.test(e.when) ? "" : "«Исключения»: " + e.when };
    }
    var d = idx.dep[norm(p.dept)];
    if (!d) return { cat: "", sure: false, why: "подразделение «" + (p.dept || "не указано") + "» не найдено в справочнике" };
    if (/См\.|исключени/i.test(d.cat)) {
      var pos = s(p.pos).toLowerCase();
      if (/многопрофильн/i.test(p.dept)) {
        if (/хирург/.test(pos)) return { cat: "Хирургия", sure: true };
        if (/гинеколог/.test(pos)) return { cat: "Гинекология", sure: true };
        if (/терапевт|пульмонолог/.test(pos)) return { cat: "Терапия", sure: true };
      }
      if (/платных/i.test(p.dept)) {
        if (/колопроктолог/.test(pos)) return { cat: "КДО", sure: true };
        if (/хирург/.test(pos)) return { cat: "Хирургия", sure: true };
      }
      return { cat: "", sure: false, why: p.dept + ": " + (d.note || "по месту лечения") };
    }
    if (/по месту лечения|уточнить/i.test(d.cat)) return { cat: "", sure: false, why: p.dept + ": по месту лечения" };
    return { cat: d.cat, sure: true };
  }

  /* ---------- кто из врачей упомянут ---------- */
  function pageDoctor(page) {
    var p = s(page).trim(), m = /(?:врача|Врач)\s*:\s*(.+)$/.exec(p);
    if (m) return /^(не указан\S*|нет|—|-)$/i.test(m[1].trim()) ? "" : m[1].trim();   // «Врач: Не указан» с сайта: врача нет
    if (/^[А-ЯЁ][а-яё-]+\s+[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+$/.test(p)) return p;            // ПроДокторов: полное ФИО
    if (/^[А-ЯЁ][а-яё-]+\s+[А-ЯЁ]\.\s?[А-ЯЁ]\.?$/.test(p)) return p;
    return "";
  }
  var SURLIKE = /((ов|ев|ин|ын)(а|у|ым|ой|е|ым)?|(ова|ева|ина|ына)(у|ой|е)?|(ский|ская|цкий|цкая|ского|ской|цкого|цкой))$/;
  var SUF = /^(|а|у|ом|ым|е|ой|ою|ую|ого|ому|ым|ых|ы|и|ий|ая|ей|ев|ов|ин|ина|ину|иной)$/;
  function findPeople(text, pageName) {
    var found = [], seen = {}, open = [];   // open — упоминания, где кандидатов несколько
    function addP(p, how) { if (!p || seen[p.fio]) return; seen[p.fio] = 1; found.push({ p: p, how: how }); }
    function oneOf(list) { // один кандидат, или один врач среди них
      if (list.length === 1) return list[0];
      var d = list.filter(function (x) { return x.doctor; });
      return d.length === 1 ? d[0] : null;
    }
    // со страницы врача
    var pg = pageDoctor(pageName);
    if (pg) {
      var parts = yo(pg).split(/\s+/);
      var cand = idx.staff.filter(function (x) {
        if (yo(x.sur) !== parts[0]) return false;
        if (parts.length >= 3) return yo(x.fio).replace(/\s+/g, " ").toLowerCase() === parts.join(" ").toLowerCase();
        return yo(x.short).replace(/\s+/g, "") === parts.join("");
      });
      if (cand.length === 1) addP(cand[0], "page");
      else if (!cand.length) found.page404 = pg;
    }
    // имена, написанные целиком заглавными («КАРАПЕТЯН ЭЛЕН АРМАНОВНЫ»), приводим к обычному виду
    var ytx = yo(text).replace(/[А-ЯЕ]{2,}(?:-[А-ЯЕ]{2,})?/g, function (w) { return w.split("-").map(function (x) { return x.charAt(0) + x.slice(1).toLowerCase(); }).join("-"); }), words = [], adj = [], re = /[А-ЯЕ][а-яе]+(?:-[А-ЯЕ][а-яе]+)?/g, mm, prevEnd = -1;
    while ((mm = re.exec(ytx))) { adj.push(prevEnd >= 0 && /^\s+$/.test(ytx.slice(prevEnd, mm.index))); words.push(mm[0]); prevEnd = mm.index + mm[0].length; }
    var isPat = function (w) { return /(вич|вн|ичн)[а-я]{0,3}$/.test(w); };
    var NAME_END = /^(|а|я|ы|и|е|у|ю|ой|ей|ем|ом|ий|ия|ию|ии|ией|ья|ье|ью|ьи|ьей)$/;   // «Наталией», «Марией»
    var nameOk = function (w, name) { var st = stemName(name); return w.indexOf(st) === 0 && NAME_END.test(w.slice(st.length)); };
    var patOk = function (w, pat) { var st = yo(pat).replace(/а$/, ""); return w.indexOf(st) === 0 && /^(|а|у|ем|ом|е|ой|ы|и|ою)$/.test(w.slice(st.length)); };
    var byName = function (w1, w2) {
      return idx.staff.filter(function (x) { return x.pat && x.name && patOk(w2, x.pat) && nameOk(w1, x.name); });
    };
    var bySurWord = function (w) {
      var out = [];
      Object.keys(idx.bySur).forEach(function (sur) {
        if (sur.length < 4) return;
        var stem = stemSur(sur);
        if (w.indexOf(stem) === 0 && SUF.test(w.slice(stem.length))) out = out.concat(idx.bySur[sur]);
      });
      return out;
    };
    var used = {};
    for (var i = 0; i < words.length; i++) {
      if (used[i]) continue;
      var w = words[i], nx = adj[i + 1] ? words[i + 1] || "" : "", nx2 = adj[i + 2] ? words[i + 2] || "" : "";
      // «Фамилия Имя Отчество»
      if (nx && isPat(nx2)) {
        var sc = bySurWord(w);
        if (sc.length) {
          var full = sc.filter(function (x) { return x.name && nameOk(nx, x.name) && x.pat && patOk(nx2, x.pat); });
          if (full.length) { var f1 = oneOf(full); if (f1) addP(f1, "full"); else open.push({ label: w + " " + nx + " " + nx2, list: full }); used[i + 1] = used[i + 2] = 1; continue; }
          if (byName(nx, nx2).length) { /* имя-отчество наше, фамилия другая — разберёт шаг «имя и отчество» */ }
          else if (SURLIKE.test(w)) { used[i + 1] = used[i + 2] = 1; open.push({ label: w + " " + nx + " " + nx2 + ": в списке с другим именем", list: sc, weak: true }); continue; }
        }
      }
      // «Имя Отчество»
      if (nx && isPat(nx)) {
        var w0 = adj[i] ? words[i - 1] || "" : "";
        var m = byName(w, nx);
        if (w0 && SURLIKE.test(w0) && !bySurWord(w0).length) m = [];                  // подпись пациента: «Сычева Анастасия Владимировна»
        if (m.length) { var m1 = oneOf(m); if (m1) addP(m1, "name"); else open.push({ label: w + " " + nx, list: m }); }
        used[i + 1] = 1; continue;
      }
      // фамилия
      var list = bySurWord(w);
      if (!list.length) continue;
      var at = ytx.indexOf(w), after = ytx.slice(at + w.length, at + w.length + 8);
      var ini = /^\s*([А-ЯЕ])\.?\s?([А-ЯЕ])(\.|[^а-яе])/.exec(after);
      if (ini) {                                                // «Гаджибалаеву М. А.», «Колпакову МЮ» — сверяем инициалы
        var byIni = list.filter(function (x) { return yo(x.name).charAt(0) === ini[1] && yo(x.pat).charAt(0) === ini[2]; });
        if (!byIni.length) { open.push({ label: w + " " + ini[1] + "." + ini[2] + ". В списке с другими инициалами", list: list, weak: true }); continue; }
        list = byIni;
      } else if (stemSur(list[0].sur).length < 6) { // короткая фамилия может оказаться обычным словом — нужен рядом «врач» или имя
        var near = ytx.slice(Math.max(0, at - 40), at + w.length + 40);
        if (!/врач|доктор|хирург|специалист|гинеколог|уролог|терапевт|невролог|кардиолог|проктолог|эндоскопист|медсестр/i.test(near) && !(nx && list.some(function (x) { return nameOk(nx, x.name); }))) continue;
      }
      var p1 = oneOf(list);
      if (p1) addP(p1, "surname"); else open.push({ label: w, list: list });
    }
    // неясные упоминания: если кто-то из кандидатов уже найден (страница врача, полное ФИО) — неясности нет
    open.forEach(function (o) {
      if (o.list.some(function (x) { return seen[x.fio]; })) return;
      found.ambiguous = (found.ambiguous || []).concat([o.label]);
      var cats = {}; o.list.forEach(function (x) { var c = catOf(x); if (c.cat) cats[c.cat] = 1; });
      if (Object.keys(cats).length === 1) found.hintCat = Object.keys(cats)[0];
    });
    return found;
  }

  /* ---------- отделение по тексту ---------- */
  var DEPT_KW = [
    [/кардиолог/i, "Кардиология"], [/невролог/i, "Неврология"], [/гинеколог|геникол/i, "Гинекология"], [/уролог/i, "Урология"],
    [/гнойн/i, "Гнойная хирургия"], [/хирургическ\S* отделени|отделени\S* хирургии|в хирургии\b|хирургию\b/i, "Хирургия"],
    [/эндоскоп|гастроскоп|колоноскоп/i, "Эндоскопия"], [/рассеянн\S* склероз|\bМОРС/i, "МОРС"], [/диализ/i, "Гемодиализ"],
    [/консультативн|\bКДО\b/i, "КДО"], [/при[её]мн\S* (отделени|поко)|в при[её]мном/i, "Приёмное отделение"],
    [/терапевтическ\S* отделени|отделени\S* терапии|в терапии\b/i, "Терапия"], [/кратковременн|временного пребывания|\bСКП\b/i, "СКП"],
    [/флеболог|варикоз|на венах/i, "Флебология"], [/аллерголог|аллергическ\S* отделени|иммунолог/i, "Аллергология и иммунология"],
    [/\bМРТ\b|\bКТ\b|рентген|томограф/i, "Лучевая диагностика"], [/\bУЗИ\b|ультразвук/i, "Ультразвуковая и функциональная диагностика"],
    [/стомирован/i, "Отделение реабилитации стомированных больных"], [/ранн\S* реабилитац/i, "Отделение ранней медицинской реабилитации"],
    [/физиотерап/i, "Физиотерапевтическое отделение"], [/нефролог/i, "Отделение Нефрологии"], [/малоинвазив/i, "Малоинвазивная хирургия"],
    [/переливани\S* крови/i, "Кабинет переливания крови"], [/проктолог|колопрокт/i, "?Колопроктология"], [/реанимац/i, "?Реанимация"]
  ];
  var STRONG_RE = /эндоскопическ\S* отделени|отделени\S* (лучевой|ультразвук)/i;
  function textDepts(text) {
    var out = [];
    DEPT_KW.forEach(function (k) { if (k[0].test(text) && out.indexOf(k[1]) < 0) out.push(k[1]); });
    return out;
  }

  /* ---------- позитив или негатив (правило 7: по тексту) ---------- */
  var NEGM = /хам|груб|ужасн|кошмар|отвратит|безобраз|не рекоменд|не совету|разочаров|равнодуш|не помог|обман|грязн|не дозвон|бардак|халатн|возмут|позор|жалоб|плохо|долго ждал|никто не|не берут|издевал|наплева|к сожалению|не понравил|недоволь|не довол|отказал|обходите|вымога|не лечат|игнорир|нагруб/i;
  // при высокой оценке жалобой считаем только недовольство больницей, а не рассказ о болезни («к сожалению, дошло до 4-й стадии»)
  var AD_RE = /(промокод|скидк[аиу] \d|акци[яи] до|переходите по ссылке|подписывайтесь|https?:\/\/(?!(www\.)?(gkb24|mos\.ru))|t\.me\/|whatsapp|\+7[\s(-]*9\d\d[\s)-]*\d{3}[\s-]*\d\d[\s-]*\d\d|наш(а|ей|у)? (компани|салон|клиник[аиу] (предлага|приглаша))|предлагаем (услуг|ремонт|достав)|заказывайте|ремонт квартир)/i;   // реклама/спам вместо отзыва
  var NEG_STRONG = /(^|[^а-яё])(хам|нахам)|груб[оыа]|ужасн\S* (отношени|организаци|персонал|сервис|больниц|питани|условия)|отвратит|безобраз|не рекоменд|не совету|разочаров|(^|[^е])равнодуш|бардак|халатн|возмутит|позор|наплева|издевал|обходите|вымога|игнорир|нагруб|недовол|из минусов|минусы:|единственн\S* (минус|недостат|что не понравил)|(^|[^а-яё])не понравил(ось|ся|ась|и)(?![\s:—-]*(ничего|нет[^а-я]|вс[её] понрав))|но есть (минус|недостат)|долго ждал|никто не (подош|объясн|отвеча|приш)|не дозвон|(^|[^а-яё])но вот\s|инцидент|возмутил(ся|ась|о)|без маски|перчатк|столкнул\S* с (гражданин|хамств|грубост|равнодуш|безразлич)/i;   // смешанный: благодарность + жалоба
  var POSM = /спасибо|благодар|рекоменд|отличн|профессионал|внимательн|вежлив|понравил|довол|золот|молодц|лучш|чутк|заботлив/i;

  /* ---------- решение по одному отзыву ---------- */
  function decide(r, mail) {
    var text = s(r.fullText || r.text).trim(), plat = s(r.platform);
    var res = { id: r.id, platform: plat, date: r.date, text: text, tone: "", dept: "", doctor: "—", status: "ok", why: [] };
    // ПРАВИЛО: отзыв Google без текста (только оценка) — в отчёт, в графе текста длинный прочерк «—»; тон по оценке
    if (!text && plat === "Google" && r.rating != null && r.rating !== "" && !isNaN(Number(r.rating))) {
      res.text = "—"; res.tone = Number(r.rating) <= 3 ? "negative" : "positive"; res.dept = "ГКБ 24"; return res;
    }
    if (!text) { res.status = "wait"; res.why.push("текста ещё нет"); return res; }
    // ПРАВИЛО: в отчёт идёт только полный текст. Обрезанный площадкой текст или одна тема письма — на проверку, а не в отчёт
    if (/(^|\s)(Ещё|Читать (далее|полностью)|Посмотреть весь отзыв)\s*$/i.test(text) || (plat === "Google" && /(\.{3,}|…)\s*$/.test(text))) {
      res.status = "check"; res.why.push("текст отзыва обрезан площадкой: откройте отзыв и вставьте полный текст"); return res;
    }
    if (plat === "Сайт" && text.length < 90 && ((mail && norm(text) === norm(mail.subject)) || /^(жалоба|благодарность|обращение|предложение|отзыв|вопрос)\b/i.test(text))) {
      res.status = "check"; res.why.push("прочиталась только тема письма, текста нет: откройте письмо в почте"); return res;
    }
    // тон
    if (plat === "Сайт" && mail) {
      if (mail.kind === "thanks") res.tone = "positive";
      else if (mail.kind === "complaint") res.tone = "negative";
      else if (mail.kind === "question") { res.status = "excluded"; res.why.push("Не отзыв: вопрос"); return res; }
      else { res.tone = "positive"; res.status = "check"; res.why.push("письмо с сайта: не ясно, отзыв это или нет"); }
      if (mail.deleted && res.status === "ok") { res.status = "check"; res.why.push("письмо удалено в почте: вносим в отчёт?"); }
    } else {
      var rt = r.rating == null || r.rating === "" ? null : Number(r.rating), neg = NEGM.test(text), pos = POSM.test(text);
      if (rt != null && !isNaN(rt)) {
        if (rt <= 3) { res.tone = "negative"; if (pos && !neg) { res.status = "check"; res.why.push("оценка " + rt + ", а текст благодарный"); } }
        else if (NEG_STRONG.test(text)) { res.tone = "negative"; res.status = "check"; res.why.push("высокая оценка, но есть недовольство (благодарность с жалобой идёт в негатив)"); }
        else res.tone = "positive";
      } else if (neg && !pos) res.tone = "negative";
      else if (pos && !neg) res.tone = "positive";
      else { res.tone = neg ? "negative" : "positive"; res.status = "check"; res.why.push("тон не ясен"); }
    }
    // ПРАВИЛО (27.10): отзыв с пометкой «Не отвечаем» или похожий на рекламу в «Позитив» сам не идёт — ставим под вопрос
    if (res.tone === "positive") {
      var ans0 = (window.__otvAll && (window.__otvAll("answers") || {})[r.id]) || null;
      if (ans0 && ans0.status === "skip") { res.status = "check"; res.why.push("отмечено «Не отвечаем»: вносить в «Позитив»?"); }
      if (AD_RE.test(text)) { res.status = "check"; res.why.push("похоже на рекламу, а не на отзыв: вносить в «Позитив»?"); }
    }
    // врачи и отделение (для «Негатива» отделение не нужно — там спорное не задерживаем)
    var dw = [];
    var people = findPeople(text, r.page || (mail && mail.page));
    if (plat === "ДокТу" && people.page404 && res.tone === "positive") { res.status = "excluded"; res.why = ["ДокТу: врача нет в списке врачей (правило 17)"]; return res; }
    if (people.page404) { dw.push("врача «" + people.page404 + "» нет в списке врачей"); }
    if (people.ambiguous) { dw.push("не понял, кто из врачей: " + people.ambiguous.slice(0, 3).join(", ")); }
    var docs = people;
    var surCount = {};
    docs.forEach(function (x) { surCount[x.p.sur] = (idx.bySur[x.p.sur] || []).length; });
    res.doctor = docs.length ? docs.map(function (x) { return surCount[x.p.sur] > 1 ? x.p.short : x.p.sur; }).join(", ") : "—";
    var pageDoc = people.filter(function (x) { return x.how === "page"; })[0];
    var cats = [], unsure = [];
    people.forEach(function (x) { var c = catOf(x.p); if (c.cat && c.sure) { if (cats.indexOf(c.cat) < 0) cats.push(c.cat); } else if (c.why) unsure.push(x.p.short + ": " + c.why); });
    var tdep = textDepts(text);
    var fuzzy = tdep.filter(function (d) { return d.charAt(0) === "?"; });
    tdep = tdep.filter(function (d) { return d.charAt(0) !== "?"; });
    if (fuzzy.length) { // «проктология», «реанимация» — уточняем по врачу
      cats.forEach(function (c) { if (/Колопроктология/.test(c) && fuzzy.indexOf("?Колопроктология") >= 0) tdep.push(c); if (/реанимац/i.test(c) && fuzzy.indexOf("?Реанимация") >= 0) tdep.push(c); });
    }
    var dept = "", SUPPORT = /Анестезиология|реанимации|Приёмное|Лучевая|Ультразвуковая|переливания/;
    var mainCats = cats.filter(function (c) { return !SUPPORT.test(c); });
    if (mainCats.length) cats = mainCats;
    var strong = tdep.filter(function (d) { return !/^(Эндоскопия|Лучевая диагностика|Ультразвуковая и функциональная диагностика|Флебология)$/.test(d) || STRONG_RE.test(text); });
    if (pageDoc) {
      var pc = catOf(pageDoc.p);
      if (pc.cat && pc.sure) dept = pc.cat;
      else if (tdep.length === 1) dept = tdep[0];
      else { dw.push("отделение врача: " + (pc.why || "не ясно")); }
    } else if (cats.length === 1) dept = cats[0];   // правило: отделение врача — по списку сотрудников, даже если в тексте названо другое
    else if (cats.length > 1 && strong.filter(function (d) { return cats.indexOf(d) >= 0; }).length === 1) dept = strong.filter(function (d) { return cats.indexOf(d) >= 0; })[0];
    else if (strong.length === 1 && !cats.length) dept = strong[0];
    else if (strong.length > 1 || (strong.length && cats.length)) {
      var main = strong.filter(function (d) { return !SUPPORT.test(d); });
      if (main.length === 1 && (!cats.length || cats.indexOf(main[0]) >= 0)) dept = main[0];
      else { dw.push("отделение: в тексте " + strong.join(", ") + (cats.length ? ", у врачей " + cats.join(", ") : "")); }
    } else if (cats.length > 1) { dw.push("врачи из разных отделений: " + cats.join(", ")); }
    else if (tdep.length === 1) dept = tdep[0];
    else if (fuzzy.length) { dw.push(fuzzy[0] === "?Колопроктология" ? "колопроктология 3 или 7: по отзыву не видно" : "какое отделение реанимации: по отзыву не видно"); }
    else if (unsure.length) { dw.push(unsure[0]); }
    else dept = "ГКБ 24"; // правило 2: о больнице в целом
    if (dept && idx.cats.length && idx.cats.indexOf(dept) < 0) { dw.push("отделения «" + dept + "» нет в «Цифрах»"); }
    res.dept = dept;
    if (dw.length && res.tone === "positive") { res.status = "check"; res.why = res.why.concat(dw); }
    return res;
  }

  /* ---------- что уже в отчётах ---------- */
  function key3(plat, dmy, text) { return s(plat).replace(/^Сайт больницы$/, "Сайт") + "|" + s(dmy) + "|" + norm(text).slice(0, 50); }
  function dmyOf(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s(iso)); return m ? m[3] + "." + m[2] + "." + m[1] : s(iso); }
  function ruDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s(iso)); return m ? (+m[3]) + " " + MONTHS_GEN[+m[2] - 1] + " " + m[1] : s(iso); }
  function inReport() {
    var k = {};
    (st.positive || []).forEach(function (x) { k[key3(x.platform, dkey(x.date), x.text)] = "Позитив · " + x.platform + " №" + x.num; });
    (st.negative || []).forEach(function (x) { k[key3(x.platform, dkey(x.date), x.text)] = "Негатив · блок " + x.n; });
    return k;
  }
  function inPeriod(iso) { return s(iso) >= st.start && s(iso) <= st.end; }
  /* есть ли отзыв в таблицах на самом деле: по площадке, дате и тексту; текст в таблице могли поправить руками */
  function words(t) { var w = {}; norm(t).split(" ").forEach(function (x) { if (x.length > 3) w[x.slice(0, 6)] = 1; }); return w; }
  function sim(a, b) { var A = words(a), B = words(b), n = 0, u = 0, k; for (k in A) { u++; if (B[k]) n++; } for (k in B) if (!A[k]) u++; return u ? n / u : 0; }
  // дата из отчёта в виде 19.10.2026: в «Негативе» она записана словами («19 октября 2026»)
  function dkey(x) {
    x = s(x).trim();
    var m = /^(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i.exec(x);
    if (m) { var k = MONTHS_GEN.indexOf(m[2].toLowerCase().replace(/ё/g, "е")); if (k >= 0) return ("0" + m[1]).slice(-2) + "." + ("0" + (k + 1)).slice(-2) + "." + m[3]; }
    m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(x);
    if (m) return ("0" + m[1]).slice(-2) + "." + ("0" + m[2]).slice(-2) + "." + m[3];
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(x);
    return m ? m[3] + "." + m[2] + "." + m[1] : x;
  }
  function reportRows() {
    var out = [];
    (st.positive || []).forEach(function (x) { out.push({ pl: s(x.platform).replace(/^Сайт больницы$/, "Сайт"), date: dkey(x.date), text: s(x.text), ref: "Позитив · " + x.platform + " №" + x.num }); });
    (st.negative || []).forEach(function (x) { out.push({ pl: s(x.platform).replace(/^Сайт больницы$/, "Сайт"), date: dkey(x.date), text: s(x.text), ref: "Негатив · блок " + x.n }); });
    return out;
  }
  /* одна строка таблицы принадлежит одному отзыву: занятые строки (claimed) второй раз не отдаём.
     В таблице видно только начало текста (120 знаков), поэтому сравниваем начало с началом */
  function findRef(rows, r, claimed) {
    var pl = s(r.platform).replace(/^Сайт больницы$/, "Сайт"), d = dmyOf(r.date), t = s(r.fullText || r.text), nt = norm(t);
    var same = rows.filter(function (x) { return x.pl === pl && !(claimed && claimed[x.ref]); });
    var hit = same.filter(function (x) { return x.date === d && norm(x.text).slice(0, 50) === nt.slice(0, 50); })[0]
      || same.filter(function (x) { return x.date === d && sim(x.text, t.slice(0, 130)) >= 0.5; })[0]
      // текст письма потом дописался полностью, а в таблице стоит его начало (или наоборот)
      || same.filter(function (x) { var nx = norm(x.text); return x.date === d && Math.min(nx.length, nt.length) >= 20 && (nt.indexOf(nx.slice(0, 50)) === 0 || nx.indexOf(nt.slice(0, 50)) === 0); })[0]
      // дату в таблице могли поправить руками: тогда нужно совпадение длинного начала текста
      || (nt.length >= 60 ? same.filter(function (x) { var nx = norm(x.text); return nx.length >= 60 && nx.slice(0, 60) === nt.slice(0, 60); })[0] : null);
    return hit ? hit.ref : "";
  }

  /* ---------- ответ для «Негатива» ----------
     ПРАВИЛО: в отчёте только настоящие данные. Ответ берётся в таком порядке:
     1) ответ больницы, прочитанный на площадке, или ваше письмо из «Отправленных»;
     2) ответ, опубликованный программой;
     3) «Отзыв отправлен на дополнительную проверку», если отзыв обжалован (отмечено в программе);
     иначе «—». Черновики и одобренные, но не опубликованные ответы в отчёт не идут.
     drafts — тексты, которые программа могла записать раньше: их можно стереть */
  function negAnswer(r) {
    var A = window.__otvAll("answers") || {}, a = A[r.id], m = (window.__otvAll("mail") || {})[r.id],
        al = (window.__otvAll("alerts") || {})[r.id] || {}, ap = A[r.id + "-appeal"], drafts = [];
    if (a) drafts.push(s(a.draft), a.status === "published" ? "" : s(a.answer));
    if (m) drafts.push(s(m.draft));
    drafts = drafts.map(function (x) { return x.trim(); }).filter(Boolean);
    var real = s(r.reply || (m && m.reply)).trim();
    if (real) return { text: real, draft: false, drafts: drafts };
    if (a && a.status === "published" && s(a.answer).trim()) return { text: s(a.answer).trim(), draft: false, drafts: drafts };
    if (al.markAppealed || (ap && ap.status === "published")) return { text: "Отзыв отправлен на дополнительную проверку.", draft: false, drafts: drafts };
    return { text: "—", draft: true, drafts: drafts };
  }
  function linkOf(r) {
    var l = s(r.link);
    if (r.platform === "ПроДокторов") {
      var id = s(r.id).replace(/^pdl?-/, "");
      return /Страница больницы/i.test(s(r.page)) ? "https://prodoctorov.ru/moskva/lpu/21011-gorodskaya-klinicheskaya-bolnica-24/otzivi/#" + id : (l || "—");
    }
    return r.platform === "Сайт" ? "—" : (l || "—");
  }  // ссылка принадлежит одному отзыву: если такая же стоит у другого отзыва, она ненадёжна — ставим общую страницу отзывов площадки
  function linkFor(r, reg) {
    var l = linkOf(r); if (!/^https?:/.test(l)) return l;
    var clash = Object.keys(reg).some(function (id) { var o = reg[id]; return o && id !== r.id && o.platform === r.platform && linkOf(o) === l; });
    return clash ? l.split(/[?#]/)[0] : l;
  }


  /* ---------- повторы: один и тот же отзыв пришёл дважды (письмо отправили ещё раз, дополнили, переслали) ---------- */
  function stems(t) { var w = {}, n = 0; norm(t).split(" ").forEach(function (x) { if (x.length > 3 && !w[x.slice(0, 6)]) { w[x.slice(0, 6)] = 1; n++; } }); return { w: w, n: n }; }
  // доля слов более короткого текста, которые есть и в другом: 1 = короткий целиком входит в длинный
  function cover(a, b) { var A = stems(a), B = stems(b), n = 0, k; if (Math.min(A.n, B.n) < 4) return 0; for (k in A.w) if (B.w[k]) n++; return n / Math.min(A.n, B.n); }
  function sameAuthor(a, b) {
    var A = norm(a).split(" ").filter(Boolean), B = norm(b).split(" ").filter(Boolean);
    if (!A.length || !B.length || A[0].length < 3 || A[0] !== B[0] || /^(пациент|аноним|гость|посетител|пользовател|клиент)/.test(A[0])) return false;
    for (var i = 1; i < Math.min(A.length, B.length); i++) if (A[i].charAt(0) !== B[i].charAt(0)) return false;
    return true;
  }
  function sameReview(a, b) {
    if (s(a.platform) !== s(b.platform)) return false;
    var ta = s(a.fullText || a.text), tb = s(b.fullText || b.text), na = norm(ta), nb = norm(tb);
    if (!na || !nb) return false;
    var auth = sameAuthor(a.author, b.author);
    // слово в слово: длинный текст или тот же человек с сайта. Короткое «Спасибо врачам!» могут написать разные люди
    if (na === nb) return na.length >= 60 || (a.platform === "Сайт" && auth);
    if (Math.min(stems(ta).n, stems(tb).n) >= 12 && sim(ta, tb) >= 0.85) return true;
    if (a.platform !== "Сайт") return false;              // у отзыва на площадке свой номер: повтор только при почти том же тексте
    return auth && cover(ta, tb) >= 0.6;
  }

  /* ---------- «Обновить отчёт» ---------- */
  function regUpdate(id, data) {
    return db.collection("registry").doc(id).update(Object.assign({ updatedAt: nowIso() }, data)).catch(function () {});
  }
  function updateReport(opts) {
    opts = opts || {};
    if (!ready()) { if (!opts.auto) setRun("err", "Сначала подключите Google. Кнопка «Подключить Google» выше."); return Promise.resolve(); }
    if (busy) return Promise.resolve();
    busy = true; setRun("", "Читаю отчёты…");
    var W = null, frozen = false, warnSrc = false, added = { pos: 0, neg: 0 }, checks = 0, later = 0, excl = 0, waiting = 0, removedRows = 0, dupList = [], extraRows = [], manualAdded = 0, site = null;
    return loadRefs().then(function () { return call("state"); }).then(function () {
      setRun("", "Сверяю отзывы с таблицами…");
      var reg = window.__otvAll("registry") || {}, mail = window.__otvAll("mail") || {}, have = inReport(), rows = reportRows();
      var pos = [], neg = [], decisions = {}, regWrites = [];
      // неделя считается по дате ПОСТУПЛЕНИЯ: с четверга 15:00 до четверга 15:00. Закрытая неделя не меняется
      W = weekBounds(); frozen = Date.now() >= W.cut;
      var inRep = function (r) { return (r.report === "positive" || r.report === "negative") && !!s(r.reportRef); };
      var inPer = function (r) {
        if (!/^\d{4}-\d{2}-\d{2}/.test(s(r.date))) return false;
        if (r.reportWeek && r.reportWeek !== st.start) return false;             // уже в отчёте другой недели
        var a = arrivedOf(r);
        if (isNaN(a)) {                                                          // записи до правила «по поступлению» (до 20.10.2026): по дате отзыва,
          if (s(r.date) >= st.start && s(r.date) <= st.end) return true;          // а не попавшие ни в один отчёт с прошлой недели переходят в эту
          return !inRep(r) && s(r.date) >= W.floor && s(r.date) < st.start;
        }
        if (a >= W.cut) return false;                                            // пришёл после закрытия: в следующую неделю
        if (a >= W.prevCut) return true;
        return !inRep(r) && s(r.date) >= W.floor;                                // пришёл раньше, но ни в один отчёт не попал: не теряем
      };
      var manualIn = function (r) { return r.source === "manual" && (r.report === "positive" || r.report === "negative"); };
      var autoDup = function (r) { return r.report === "excluded" && r.source !== "manual" && /^Повтор/.test(s(r.reason)); };
      var all = Object.keys(reg).map(function (id) { var r = reg[id]; if (r) r.id = id; return r; }).filter(function (r) { return r && inPer(r); });
      later = Object.keys(reg).filter(function (id) {
        var r = reg[id]; if (!r || inRep(r) || r.report === "excluded" || r.report === "unpublished") return false;
        var a = arrivedOf(r); return isNaN(a) ? s(r.date) > st.end : a >= W.cut;
      }).length;
      // кто участвует в отчёте: всё за неделю, кроме исключённого вами и ещё не опубликованного площадкой.
      // Повторы, которые раньше нашла программа, пересматриваем каждый раз; «В Позитиве»/«В Негативе», отмеченные вами, тоже проверяем по таблице
      var live = all.filter(function (r) {
        if (r.report === "unpublished") return false;
        if (r.report === "excluded") return autoDup(r) && s(r.date) >= st.start;   // повтор из прошлой недели остаётся повтором
        return true;
      });
      // 1. какая строка таблицы чья: сначала точные совпадения, потом похожие; одна строка принадлежит одному отзыву
      var claimed = {}, refOf = {};
      var byLen = live.slice().sort(function (x, y) { return s(y.fullText || y.text).length - s(x.fullText || x.text).length; });
      byLen.forEach(function (r) { var ex = have[key3(r.platform, dmyOf(r.date), r.fullText || r.text)]; if (ex && !claimed[ex]) { claimed[ex] = r.id; refOf[r.id] = ex; } });
      byLen.forEach(function (r) { if (refOf[r.id]) return; var f = findRef(rows, r, claimed); if (f) { claimed[f] = r.id; refOf[r.id] = f; } });
      // 2. понятные повторы: тот же отзыв дважды (тот же человек и тот же текст, или почти слово в слово)
      var parent = {};
      var root = function (id) { while (parent[id] && parent[id] !== id) id = parent[id]; return id; };
      for (var i = 0; i < live.length; i++) for (var j = i + 1; j < live.length; j++) {
        if (sameReview(live[i], live[j])) { var ra = root(live[i].id), rb = root(live[j].id); if (ra !== rb) parent[rb] = ra; }
      }
      // почта сама нашла повтор письма (тот же человек, тот же текст): объединяем без догадок
      var liveIds = {}; live.forEach(function (r) { liveIds[r.id] = 1; });
      live.forEach(function (r) { var m = mail[r.id]; if (m && m.dup && m.dupOf && liveIds[m.dupOf]) { var ra = root(m.dupOf), rb = root(r.id); if (ra !== rb) parent[rb] = ra; } });
      var groups = {};
      live.forEach(function (r) { var k = root(r.id); (groups[k] = groups[k] || []).push(r); });
      var dupOf = {};
      Object.keys(groups).forEach(function (k) {
        var g = groups[k]; if (g.length < 2) return;
        // почта уже знает, какое письмо повтор: оно не может быть основным
        var score = function (r) { return (refOf[r.id] ? 4 : 0) + (manualIn(r) ? 2 : 0) + (autoDup(r) ? 0 : 1) - (mail[r.id] && mail[r.id].dup ? 8 : 0); };
        g.sort(function (x, y) { return (score(y) - score(x)) || (s(y.fullText || y.text).length - s(x.fullText || x.text).length) || (s(x.date + x.time) < s(y.date + y.time) ? -1 : 1); });
        var main = g[0];
        g.slice(1).forEach(function (r) {
          dupOf[r.id] = main;
          if (refOf[r.id]) {
            var lr = s(r.fullText || r.text).length, lm = s(main.fullText || main.text).length;
            if (!refOf[main.id] && lr >= 0.8 * lm) { refOf[main.id] = refOf[r.id]; claimed[refOf[r.id]] = main.id; }   // строка повтора с тем же текстом достаётся основному отзыву
            else extraRows.push(refOf[r.id]);                                                           // в таблице одна и та же строка дважды
            delete refOf[r.id];
          }
        });
      });
      // 3. каждый отзыв недели: в таблице, повтор, ждёт решения или вносится
      live.forEach(function (r) {
        var id = r.id;
        if (dupOf[id]) {
          var m0 = dupOf[id], why = "Повтор отзыва: " + (s(m0.author) || "тот же автор") + ", " + dmyOf(m0.date) + (m0.time ? " " + m0.time : "");
          if (r.report !== "excluded" || s(r.reason) !== why) regWrites.push([id, { report: "excluded", reason: why, reportRef: "", lastRef: s(r.reportRef), dupOf: m0.id }]);
          if (!autoDup(r) || r.reportRef) dupList.push((s(r.author).split(" ")[0] || r.platform) + " " + dmyOf(r.date).slice(0, 5));
          return;
        }
        var ref = refOf[id] || "";
        if (ref) {
          var tone = /^Негатив/.test(ref) ? "negative" : "positive";
          if (r.report !== tone || r.reportRef !== ref || s(r.reason) || r.removedRow || r.reportWeek !== st.start) regWrites.push([id, { report: tone, reportRef: ref, reason: "", removedRow: false, reportWeek: st.start }]);
          return;
        }
        // неделя закрыта (четверг 15:00): в неё больше ничего не вносим, всё новое ждёт следующей недели
        if (frozen) { later++; return; }
        if (manualIn(r)) {
          // вы отметили «В Позитиве» или «В Негативе», а строки в таблице нет: вношу
          var d1 = idx ? decide(r, mail[id]) : null;
          decisions[id] = { id: id, platform: r.platform, date: r.date, text: s(r.fullText || r.text), tone: r.report, dept: s(r.dept) || (d1 && d1.dept) || "ГКБ 24",
            doctor: s(r.doctor) || (d1 && d1.doctor) || "—", status: "ok", why: [], manual: true };
          return;
        }
        if (r.decision && r.decision.forced) { // вы уже решили в «Нужна проверка»
          var f = r.decision;
          decisions[id] = { id: id, platform: r.platform, date: r.date, text: s(r.fullText || r.text), tone: f.tone, dept: f.dept, doctor: f.doctor || "—", status: f.tone === "excluded" ? "excluded" : "ok", why: f.tone === "excluded" ? [f.reason || "Не отзыв"] : [] };
          return;
        }
        if (r.removedRow || ((r.report === "positive" || r.report === "negative") && r.reportRef && r.source !== "manual")) {
          // отзыв был в таблице, а строки больше нет: её удалили. Без вашего решения обратно не вношу
          removedRows++;
          if (window.__otvLog) window.__otvLog("сверка: строки отзыва " + id + " (" + r.platform + " " + dmyOf(r.date) + ") в таблице нет, жду решения");
          decisions[id] = { id: id, platform: r.platform, date: r.date, text: s(r.fullText || r.text), tone: r.report === "negative" ? "negative" : s(r.tone) || "positive",
            dept: s(r.dept), doctor: s(r.doctor) || "—", status: "check", why: ["строку этого отзыва удалили из таблицы: вернуть в отчёт или не вносить?"], removed: true };
          return;
        }
        decisions[id] = decide(r, mail[id]);
      });
      Object.keys(decisions).forEach(function (id) {
        var d = decisions[id], r = reg[id];
        if (d.status === "wait") { waiting++; return; }
        if (d.status === "excluded") { excl++; regWrites.push([id, { report: "excluded", reason: d.why.join("; "), tone: d.tone || "" }]); return; }
        if (d.status === "check") {
          checks++;
          var w0 = { report: "pending", reportRef: "", reason: "Нужна проверка: " + d.why.join("; "), tone: d.tone, suggest: { tone: d.tone, dept: d.dept, doctor: d.doctor } };
          if (d.removed) w0.removedRow = true;
          regWrites.push([id, w0]);
          return;
        }
        if (d.manual) manualAdded++;
        if (d.tone === "positive") pos.push({ id: id, platform: r.platform, date: dmyOf(r.date), dept: d.dept, text: clean(d.text), doctor: d.doctor });
        else {
          var a = negAnswer(r);
          d.draftAnswer = a.draft && a.text !== "—" && r.platform !== "ПроДокторов";
          neg.push({ id: id, platform: NEG_PLAT[r.platform] || r.platform, date: ruDate(r.date), text: clean(d.text), answer: clean(a.text) || "—", link: linkFor(r, reg) });
        }
      });
      // сверка: всё, что собрано за неделю, и где каждый отзыв (по площадкам)
      site = { total: 0, inRep: 0, dup: 0, notReview: 0, excluded: 0, check: 0, adding: 0, unpub: 0, queued: 0, by: {} };
      all.forEach(function (r) {
        var d = decisions[r.id], k;
        if (r.report === "unpublished") return;   // ещё не опубликованные площадкой не считаем и не показываем
        else if (refOf[r.id]) k = "inRep";
        else if (dupOf[r.id] || autoDup(r)) k = "dup";
        else if (d && d.status === "ok") k = "adding";
        else if (d && (d.status === "check" || d.status === "wait")) k = "check";
        else if ((d && d.status === "excluded" && /вопрос/i.test(d.why.join(" "))) || (!d && r.report === "excluded" && /вопрос/i.test(s(r.reason)))) k = "notReview";
        else if (!d && r.report === "pending" && /^Нужна проверка/.test(s(r.reason))) k = "check";
        else if (!d && frozen && !refOf[r.id] && r.report !== "excluded") k = "queued";
        else k = "excluded";
        site.total++; site[k]++;
        var b0 = site.by[r.platform] = site.by[r.platform] || { total: 0, inRep: 0 };
        b0.total++; if (k === "inRep") b0.inRep++;
      });
      var write = (pos.length || neg.length) ? (setRun("", "Вношу в «Позитив» и «Негатив»…"), call("add", { positive: pos, negative: neg })) : call("numbers", { mode: "color" });
      return write.then(function (res) {
        var refsOut = (res && res.refs) || {};
        Object.keys(refsOut).forEach(function (id) {
          var d = decisions[id], isNeg = /^Негатив/.test(refsOut[id]);
          isNeg ? added.neg++ : added.pos++;
          if (site && reg[id]) { site.adding--; site.inRep++; var b1 = site.by[reg[id].platform]; if (b1) b1.inRep++; }
          if (isNeg) { var nb0 = neg.filter(function (x) { return x.id === id; })[0]; if (nb0) regWrites.push([id, { negWritten: nb0.answer }]); }
          regWrites.push([id, { report: isNeg ? "negative" : "positive", reportRef: refsOut[id], reportWeek: st.start, tone: d.tone, dept: d.dept, doctor: d.doctor, removedRow: false,
            reason: isNeg && d.draftAnswer ? "Ответ в «Негативе»: проект, сверить после отправки" : "", suggest: null }]);
        });
        return syncCells(reg, refOf);
      }).then(function () {
        return regWrites.reduce(function (p, w) { return p.then(function () { return regUpdate(w[0], w[1]); }); }, Promise.resolve());
      });
    }).then(function () {
      var parts = [];
      parts.push(added.pos || added.neg ? "+" + added.pos + " в «Позитив», +" + added.neg + " в «Негатив»" : "новых отзывов нет");
      if (dupList.length) parts.push("повторы не вношу: " + dupList.join(", "));
      if (checks) parts.push("нужна проверка: " + checks);
      if (excl) parts.push("исключено: " + excl);
      if (waiting) parts.push("ждут текста письма: " + waiting);
      if (site && site.total) {
        var rest = [];
        if (site.dup) rest.push("повторы " + site.dup);
        if (site.notReview) rest.push("вопросы, не отзывы " + site.notReview);
        if (site.excluded) rest.push("исключены " + site.excluded);
        if (site.queued) rest.push("ждут следующей недели " + site.queued);
        if (site.check) rest.push("ждут вашего решения в «Нужна проверка» " + site.check);
        if (site.adding > 0) rest.push("не записались в Google " + site.adding);
        var byp = Object.keys(site.by).map(function (k) { return k + " " + site.by[k].inRep + "/" + site.by[k].total; }).join(", ");
        parts.push("собрано за неделю " + site.total + ", в отчёте " + site.inRep + (rest.length ? " (" + rest.join(", ") + ")" : "") + ". По площадкам, в отчёте/собрано: " + byp);
      }
      var msg = "Отчёт " + s(st.period) + ": " + parts.join(" · ");
      if (extraRows.length) msg += ". ⚠ В таблице один и тот же отзыв стоит дважды, удалите лишние строки: " + extraRows.join("; ");
      if (removedRows) msg += ". Из таблицы удалены строки отзывов: " + removedRows + ". Решите в «Нужна проверка», вернуть их или нет";
      // отзывы, пришедшие после закрытия недели, программа помнит и внесёт сама, когда вы начнёте новый отчёт
      if (frozen) msg = "Неделя " + st.period + " закрыта в четверг в 15:00, в неё больше ничего не вносится. " + msg;
      if (later) msg += ". Пришли после закрытия недели (" + dmyOf(st.end).slice(0, 5) + " 15:00): " + later + ", внесу их, когда начнёте новый отчёт";
      // полнота: какие источники не прочитаны — отчёт может быть неполным
      var hl = window.__otvSrcHealth ? window.__otvSrcHealth() : [];
      var badSrc = hl.filter(function (h) { return !h.ok || !h.okAt || Date.now() - Date.parse(h.okAt) > 12 * 3600e3; });
      if (badSrc.length) { msg = "⚠ Отчёт может быть неполным: не прочитаны " + badSrc.map(function (h) { return h.name + (h.needLogin ? " (нужен вход)" : "") + (h.okAt ? ", последний раз " + new Date(h.okAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : ""); }).join("; ") + ". Войдите и нажмите «Собрать отзывы». " + msg; warnSrc = true; }
      var warn = checks || extraRows.length || removedRows || (site && site.adding > 0) || warnSrc;
      setRun(warn ? "warn" : "ok", msg);
      saveLast(msg);
      // всё, что требует вашего действия, видно на любой вкладке
      if (window.__otvBar && (warn || !opts.auto)) window.__otvBar.show(msg.split(" · По площадкам")[0].slice(0, 400), warn ? "warn" : "ok", [["Закрыть", window.__otvBar.hide]]);
      render();
    }).catch(function (e) {
      var em = String(e && e.message || e);
      if (window.__otvLog) window.__otvLog("отчёт не обновился: " + em.slice(0, 300));
      setRun("err", "Отчёт не обновился: " + em);
      saveLast("⚠ Отчёт не обновился: " + em);
      if (window.__otvBar) window.__otvBar.show("⚠ Отчёт не обновился: " + em.slice(0, 300), "err", [["Повторить", function () { window.__otvBar.hide(); updateReport(); }], ["Закрыть", window.__otvBar.hide]]);
    }).then(function () { busy = false; render(); });
  }
  // текст для Google: без пустых строк (Google не даёт вставить пустой абзац) и без лишних пробелов в концах строк
  function clean(t) { return s(t).replace(/\r/g, "").split("\n").map(function (x) { return x.replace(/\s+$/, ""); }).filter(function (x) { return x.trim(); }).join("\n").trim(); }
  /* ---------- сверка уже записанных строк с программой ----------
     Отчёт должен совпадать с программой: полный текст отзыва, одобренный ответ (или «—»), своя ссылка.
     Расхождения правятся сами при каждом «Обновить отчёт». Ваши ручные правки в документе не трогаем:
     текст меняем, только если в отчёте стоит его обрезанное начало; ответ стираем, только если там стоит черновик генератора */
  function cut(t) { return norm(s(t).replace(/(\.{3,}|…)\s*$/, "")); }
  function truncatedOf(rowText, full) {
    var a = cut(rowText), b = norm(clean(full));
    return a.length >= 20 && b.length > a.length + 3 && b.indexOf(a.slice(0, Math.max(20, a.length - 5))) === 0;
  }
  // текст ответа без приветствия: «Здравствуйте, Борис!» и «Здравствуйте.» — один и тот же черновик
  function body(t) { return norm(clean(t).replace(/^\s*(Добрый день|Здравствуйте)[^.!\n]{0,40}[.!]?\s*/i, "")).slice(0, 100); }
  // все тексты, которые писал генератор (по всем отзывам и письмам): так черновик узнаётся, даже если его потом переписали
  function genBodies() {
    var out = {}, A = window.__otvAll("answers") || {}, M = window.__otvAll("mail") || {};
    Object.keys(A).forEach(function (k) { var a = A[k] || {}; [a.draft, a.status === "published" ? "" : a.answer].forEach(function (t) { var b = body(t); if (b.length > 30) out[b] = 1; }); });
    Object.keys(M).forEach(function (k) { var b = body((M[k] || {}).draft); if (b.length > 30) out[b] = 1; });
    return out;
  }
  // блок или строка отчёта принадлежит этому отзыву, только если совпадают площадка и текст. Номер блока не доказательство: блоки сдвигаются
  function sameRow(rowPl, rowText, r) {
    var pl = s(rowPl).replace(/^Сайт больницы$/, "Сайт"), a = norm(s(rowText).replace(/(\.{3,}|…)\s*$/, "")), b = norm(s(r.fullText || r.text));
    if (pl !== s(r.platform).replace(/^Сайт больницы$/, "Сайт") || a.length < 15 || b.length < 15) return false;
    var k = Math.min(60, a.length, b.length);
    return a.slice(0, k) === b.slice(0, k) || sim(a.slice(0, 200), b.slice(0, 200)) >= 0.6;
  }
  /* ---------- сверка уже записанных строк с программой ----------
     ПРАВИЛО: отчёт = настоящие данные. Ответ и ссылка в «Негативе» всегда такие, как в программе (настоящий ответ или «—», ссылка этого отзыва);
     обрезанный текст дописывается. Правится только строка, текст которой совпадает с текстом этого отзыва */
  function syncCells(reg, refOf) {
    if (ver < 4 && !runner) return Promise.resolve();
    var items = [], pos = {}, neg = {}, written = {};
    (st.positive || []).forEach(function (x) { pos["Позитив · " + x.platform + " №" + x.num] = x; });
    (st.negative || []).forEach(function (b) { neg["Негатив · блок " + b.n] = b; });
    var L = function (t) { if (window.__otvLog) window.__otvLog("сверка «Негатива»: " + t); };
    var negSeen = {};
    Object.keys(refOf || {}).forEach(function (id) {
      var r = reg[id], ref = refOf[id]; if (!r || !ref) return;
      var full = s(r.fullText || r.text);
      var p = pos[ref];
      if (p) {
        if (!sameRow(p.platform, p.full, r)) return;
        var pit = { kind: "pos", platform: p.platform, num: p.num, key: p.full }, pch = false;
        if (truncatedOf(p.full, full)) { pit.text = clean(full); pch = true; }
        // врач не указан, а в отзыве он назван: вписываем (ручную запись не трогаем)
        if (!s(p.doctor).trim() || /^[—-]$/.test(s(p.doctor).trim())) {
          var dd = decide(Object.assign({}, r, { fullText: full }), (window.__otvAll("mail") || {})[id]);
          if (dd && dd.doctor && dd.doctor !== "—") { pit.doctor = dd.doctor; pch = true; }
        }
        if (pch) items.push(pit);
        return;
      }
      var b = neg[ref]; if (!b) return;
      if (!sameRow(b.platform, b.full, r)) { L("блок " + b.n + " (" + b.platform + "): текст не совпал с отзывом " + id + ", не трогаю"); return; }
      negSeen[b.n] = 1;
      var it = { kind: "neg", n: b.n, key: b.full }, ch = false;
      if (truncatedOf(b.full, full)) { it.text = clean(full); ch = true; }
      var want = clean(negAnswer(r).text) || "—";
      if (norm(b.fullAnswer) !== norm(want)) { it.answer = want; ch = true; written[id] = want; }
      var lk = linkFor(r, reg);
      if (s(b.link).trim() !== lk) { it.link = lk; ch = true; }
      var src = s(r.reply).trim() ? "ответ с площадки/из почты (реестр)" : s(((window.__otvAll("mail") || {})[id] || {}).reply).trim() ? "ответ из почты (письмо)" : want === "—" ? "настоящего ответа нет" : "ответ программы/обжалование";
      L("блок " + b.n + " (" + b.platform + ", отзыв " + id + "): " + src + (ch ? ", исправляю" : ", без изменений"));
      if (ch) items.push(it);
    });
    (st.negative || []).forEach(function (b) { if (!negSeen[b.n]) L("блок " + b.n + " (" + b.platform + "): отзыв в программе не найден"); });
    if (!items.length) return Promise.resolve();
    return call("patch", { items: items }).then(function () {
      return Object.keys(written).reduce(function (p, id) { return p.then(function () { return regUpdate(id, { negWritten: written[id] }); }); }, Promise.resolve());
    });
  }
  // границы недели по поступлению: закрытие в четверг (последний день отчёта) в 15:00 по Москве
  function weekBounds() {
    var cut = Date.parse(st.end + "T15:00:00+03:00");
    var f = new Date(Date.parse(st.start + "T12:00:00+03:00") - 7 * 864e5).toISOString().slice(0, 10);
    return { cut: cut, prevCut: cut - 7 * 864e5, floor: f };
  }
  function arrivedOf(r) { return r && r.arrivedAt ? Date.parse(r.arrivedAt) : NaN; }
  function todayIso() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }

  /* ---------- скачать и начать новую неделю ---------- */
  function b64Blob(b64) {
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u]);
  }
  function saveFiles() {
    return Promise.all([call("export"), window.claude.use("downloads")]).then(function (r) {
      var files = r[0].files || [], dl = r[1];
      if (files.length !== 2) throw new Error("Google не отдал файлы");
      return files.reduce(function (p, f) { return p.then(function (names) { return dl.save({ filename: f.name, data: b64Blob(f.data) }).then(function () { return names.concat([f.name]); }); }); }, Promise.resolve([]));
    });
  }
  function download() {
    if (!ready()) { setDl("err", "Сначала подключите Google."); return; }
    setDl("", "Сохраняю в «Загрузки»…");
    saveFiles().then(function (n) { setDl("ok", "Сохранено в «Загрузки»: " + n.join(", ")); }, function (e) { setDl("err", "Не сохранилось: " + (e && e.message || e)); });
  }
  function newWeek() {
    if (!ready()) { setRun("err", "Сначала подключите Google."); return; }
    if (ready() && ver > 0 && ver < 3 && !runner) { setRun("err", "Сначала обновите скрипт в Google. Шаги выше."); render(); return; }
    if (busy) return;
    busy = true; setRun("", "Сохраняю старые отчёты в «Загрузки»…");
    var expect = "";
    call("state").then(function () {
      var e = new Date(st.end + "T00:00:00"), a = new Date(e); a.setDate(a.getDate() + 1); var b = new Date(e); b.setDate(b.getDate() + 7);
      var p2 = function (n) { return ("0" + n).slice(-2); };
      expect = p2(a.getDate()) + "." + p2(a.getMonth() + 1) + "–" + p2(b.getDate()) + "." + p2(b.getMonth() + 1);
      if (todayIso() < a.getFullYear() + "-" + p2(a.getMonth() + 1) + "-" + p2(a.getDate())) throw new Error("неделя " + st.period + " ещё не закончилась. Новый отчёт можно начать с пятницы");
      // всё, что стоит в отчёте закрываемой недели, помечаем этой неделей: после очистки таблицы оно не «пропадёт» и не внесётся второй раз
      var reg = window.__otvAll("registry") || {}, old = st.start, marks = [];
      Object.keys(reg).forEach(function (id) { var r = reg[id]; if (r && (r.report === "positive" || r.report === "negative") && s(r.reportRef) && !r.reportWeek) marks.push(id); });
      return marks.reduce(function (p, id) { return p.then(function () { return regUpdate(id, { reportWeek: old }); }); }, Promise.resolve()).then(saveFiles);
    }).then(function (names) {
      setRun("", "Старые отчёты в «Загрузках». Готовлю новую неделю " + expect + "…");
      return call("newweek", { saved: true, expect: expect }).then(function (r) { return { names: names, r: r }; });
    }).then(function (x) {
      busy = false;
      setRun("ok", "Начат отчёт за " + x.r.period + ". Старые файлы в «Загрузках»: " + x.names.join(", "));
      return updateReport();
    }).catch(function (e) {
      // Google мог сменить неделю, но не успеть ответить (или вторая попытка видит «Отчёт уже сменился»):
      // перечитываем отчёты и, если неделя уже новая, сразу вносим в неё данные — без ожидания следующего обновления
      var msg = (e && e.message || e) + "";
      if (!expect) { busy = false; setRun("err", "Новый отчёт не начат: " + msg); return; }
      return call("state").then(function () {
        busy = false;
        if (st && s(st.period).indexOf(expect) === 0) {
          if (window.__otvLog) window.__otvLog("новая неделя: Google ответил «" + msg + "», но отчёт уже за " + st.period + " — вношу данные");
          setRun("ok", "Начат отчёт за " + st.period + ". Вношу данные…");
          return updateReport();
        }
        setRun("err", "Новый отчёт не начат: " + msg);
      }, function () { busy = false; setRun("err", "Новый отчёт не начат: " + msg); });
    });
  }

  /* ---------- вкладка «Отчёты» ---------- */
  var runMsg = null, dlMsg = null, last = null;
  function setRun(cls, text) { runMsg = text ? { cls: cls, text: text } : null; paintMsgs(); }
  function setDl(cls, text) { dlMsg = text ? { cls: cls, text: text } : null; paintMsgs(); }
  var runEl = null, dlEl = null;
  function paintMsgs() {
    var a = runEl, b = dlEl;
    if (a) { a.hidden = !runMsg; if (runMsg) { a.className = "ctl-st " + runMsg.cls; a.textContent = runMsg.text; } }
    if (b) { b.hidden = !dlMsg; if (dlMsg) { b.className = "ctl-st " + dlMsg.cls; b.textContent = dlMsg.text; } }
  }
  function saveLast(msg) { last = { at: nowIso(), msg: msg }; if (db) db.collection("settings").doc("report").set(last).catch(function () {}); }

  function render() {
    var ctl = $("ckCtl"); if (!ctl) return;
    if (!line) {
      line = el("div", "gs-line"); var head = ctl.querySelector(".ctl-p"); if (head) head.after(line); else ctl.prepend(line);
      runEl = el("p", "ctl-st"); dlEl = el("p", "ctl-st"); runEl.hidden = dlEl.hidden = true;
      var acts = ctl.querySelector(".actions"); if (acts) acts.after(runEl, dlEl); else ctl.append(runEl, dlEl);
    }
    line.textContent = "";
    if (st && st.period) $("ckPeriod").textContent = "Текущий отчёт: " + st.period;
    if (ready()) {
      var p = el("p", "gs-ok");
      p.append("Google подключён" + (st ? " · «" + st.posTitle + "» · «" + st.negTitle + "»" : ""));
      var off = el("button", "link gs-off", "Отключить"); off.type = "button";
      off.addEventListener("click", function () {
        if (off.dataset.armed !== "1") { off.dataset.armed = "1"; off.textContent = "Точно отключить?"; setTimeout(function () { off.dataset.armed = ""; off.textContent = "Отключить"; }, 4000); return; }
        cfg = null; st = null; refs = null; if (db) db.collection("settings").doc("google").delete().catch(function () {}); render();
      });
      p.append(" ", off); line.append(p);
      if (oldScript()) line.append(updateBox());
      if (last && last.msg && !runMsg) { var l = el("p", "ctl-last", "Последнее обновление отчёта: " + new Date(last.at).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) + "\n" + last.msg); line.append(l); }
    } else line.append(setupBox());
    renderChecks();
    paintMsgs();
  }
  function copyBtn() {
    var cp = el("button", "btn", "Скопировать скрипт"); cp.type = "button";
    cp.addEventListener("click", function () {
      var done = function () { cp.textContent = "Скопировано"; setTimeout(function () { cp.textContent = "Скопировать скрипт"; }, 2000); };
      try { navigator.clipboard.writeText(window.__otvGsCode || "").then(done, done); } catch (e) { done(); }
    });
    return cp;
  }
  function updateBox() {
    var box = el("div", "gs-setup gs-upd");
    box.append(el("p", null, "Обновите скрипт в Google. Один раз, 2 минуты. Без этого «Негатив» на новой неделе не очистится."));
    var ol = el("ol");
    ["Нажмите «Скопировать скрипт».",
     "Откройте ваш проект на script.google.com. Удалите всё в окне, вставьте скопированное, сохраните (⌘S).",
     "«Развернуть» → «Управление развертываниями» → карандаш → «Версия»: «Новая версия» → «Развернуть». Ссылка остаётся прежней.",
     "Вернитесь сюда и нажмите «Обновить отчёт»."].forEach(function (t) { ol.append(el("li", null, t)); });
    box.append(ol, copyBtn());
    return box;
  }
  function setupBox() {
    var box = el("div", "gs-setup");
    box.append(el("p", null, "Чтобы программа сама вела «Позитив», «Негатив» и «Цифры», один раз подключите Google (5 минут)."));
    var det = el("details", "gs-how"); det.append(el("summary", null, "Как подключить"));
    var ol = el("ol");
    ["Нажмите «Скопировать скрипт» ниже.",
     "Откройте script.google.com под рабочим Google-аккаунтом → «Создать проект». Удалите всё в окне, вставьте скопированное, сохраните.",
     "«Развернуть» → «Новое развертывание» → шестерёнка → «Веб-приложение». «Запуск от имени»: Я. «У кого есть доступ»: Все. → «Развернуть».",
     "Google попросит разрешение: «Предоставить доступ» → ваш аккаунт → «Дополнительные настройки» → «Перейти к проекту» → «Разрешить».",
     "Скопируйте «URL веб-приложения» и вставьте сюда, нажмите «Подключить»."].forEach(function (t) { ol.append(el("li", null, t)); });
    det.append(ol, copyBtn());
    var row = el("div", "gs-row"), inp = el("input"); inp.type = "url"; inp.placeholder = "https://script.google.com/macros/s/…/exec";
    var go = el("button", "btn primary pawbtn", "Подключить"); go.type = "button";
    var msg = el("p", "ctl-st"); msg.hidden = true;
    go.addEventListener("click", function () {
      go.disabled = true; msg.hidden = false; msg.className = "ctl-st"; msg.textContent = "Подключаю…";
      connect(inp.value).then(function () { render(); return updateReport(); }, function (e) {
        go.disabled = false; msg.className = "ctl-st err"; msg.textContent = "Не подключилось: " + (e && e.message || e);
      });
    });
    row.append(inp, go);
    box.append(det, row, msg);
    return box;
  }

  /* ---------- «Нужна проверка»: вы решаете, программа вносит ---------- */
  function renderChecks() {
    var host = $("ckCheck");
    if (!host) { host = el("div"); host.id = "ckCheck"; var sum = $("ckSum"); if (sum) sum.parentNode.insertBefore(host, sum); else return; }
    host.textContent = "";
    if (!ready() || !st) return;
    var reg = window.__otvAll("registry") || {};
    var list = Object.keys(reg).map(function (id) { var r = reg[id]; r.id = id; return r; }).filter(function (r) {
      return r.report === "pending" && /^Нужна проверка/.test(s(r.reason)) && r.source !== "manual" && s(r.date) >= st.start && s(r.date) <= st.end;
    });
    if (!list.length) return;
    host.className = "ck-check";
    host.append(el("h2", null, "Нужна проверка · " + list.length));
    list.forEach(function (r) { host.append(checkCard(r)); });
  }
  function checkCard(r) {
    var sug = r.suggest || {}, c = el("div", "card ck-card");
    var hd = el("div", "head");
    hd.append(el("span", "badge " + ({ "ПроДокторов": "pf-pd", "Яндекс": "pf-ya", "2ГИС": "pf-gis", "Google": "pf-go", "ДокТу": "pf-dt", "Сайт": "pf-site", "НаПоправку": "pf-np" }[r.platform] || "pf-go"), r.platform));
    hd.append(el("span", "meta", [dmyOf(r.date), s(r.page), r.rating != null && r.rating !== "" ? "★" + r.rating : ""].filter(Boolean).join(" · ")));
    c.append(hd);
    c.append(el("p", "ck-why", s(r.reason).replace(/^Нужна проверка:\s*/, "")));
    var rv = el("blockquote", "review clamp"); rv.textContent = s(r.fullText || r.text); c.append(rv);
    rv.addEventListener("click", function () { rv.classList.toggle("clamp"); });
    var tone = sug.tone || "positive";
    var seg = el("div", "ck-seg");
    var opts = [["positive", "Позитив"], ["negative", "Негатив"], ["excluded", "Не вносить"]];
    var reason = el("input"); reason.type = "text"; reason.placeholder = "Причина: например, не отзыв, а вопрос"; reason.className = "ck-in";
    var dept = el("select", "ck-in"), doc = el("input"); doc.type = "text"; doc.className = "ck-in"; doc.placeholder = "Врач: фамилии через запятую, пусто, если врача нет"; doc.value = s(sug.doctor && sug.doctor !== "—" ? sug.doctor : "");
    var cats = (idx && idx.cats.length ? idx.cats : ["ГКБ 24"]).slice();
    if (cats.indexOf("ГКБ 24") < 0) cats.unshift("ГКБ 24");
    var o0 = el("option", null, "Отделение…"); o0.value = ""; dept.append(o0);
    cats.forEach(function (x) { var o = el("option", null, x); o.value = x; if (x === sug.dept) o.selected = true; dept.append(o); });
    function sync() {
      seg.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === tone)); });
      dept.hidden = doc.hidden = tone !== "positive"; reason.hidden = tone !== "excluded";
    }
    opts.forEach(function (o) {
      var b = el("button", "chip", o[1]); b.type = "button"; b.dataset.v = o[0];
      b.addEventListener("click", function () { tone = o[0]; sync(); });
      seg.append(b);
    });
    var go = el("button", "btn primary pawbtn", "Внести"); go.type = "button";
    var msg = el("p", "ctl-st"); msg.hidden = true;
    go.addEventListener("click", function () {
      if (tone === "positive" && !dept.value) { dept.focus(); return; }
      if (tone === "excluded" && !reason.value.trim()) { reason.focus(); return; }
      go.disabled = true;
      var decision = { forced: true, tone: tone, dept: dept.value, doctor: doc.value.trim() || "—", reason: reason.value.trim() };
      db.collection("registry").doc(r.id).update({ decision: decision, reason: tone === "excluded" ? reason.value.trim() : "Нужна проверка: решено, вношу" })
        .then(function () { return updateReport(); })
        .catch(function (e) { go.disabled = false; msg.hidden = false; msg.className = "ctl-st err"; msg.textContent = "Не вышло: " + (e && e.message || e); });
    });
    var row = el("div", "ck-row"); row.append(seg, dept, doc, reason, go);
    c.append(row, msg);
    sync();
    return c;
  }

  /* ---------- кнопки вкладки «Отчёты» в программе ведёт этот модуль ---------- */
  window.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!b) return;
    if (b.id === "collectBtn") { e.preventDefault(); e.stopImmediatePropagation(); updateReport(); }
    else if (b.id === "dlBtn") { e.preventDefault(); e.stopImmediatePropagation(); download(); }
    else if (b.id === "newWeekBtn") {
      e.preventDefault(); e.stopImmediatePropagation();
      if (b.dataset.armed === "1") { b.dataset.armed = ""; b.classList.remove("armed"); b.textContent = "Начать новый отчёт"; newWeek(); return; }
      b.dataset.armed = "1"; b.classList.add("armed"); b.textContent = "Старые отчёты сохранятся в «Загрузки». Начать новую неделю?";
      setTimeout(function () { b.dataset.armed = ""; b.classList.remove("armed"); b.textContent = "Начать новый отчёт"; }, 6000);
    }
  }, true);
  // после «Собрать отзывы» отчёт обновляется сам
  window.addEventListener("otv-collected", function () { if (ready()) updateReport({ auto: true }); });
  window.addEventListener("otv-write", function (ev) { var d = ev.detail || {}; if (d.name === "registry") renderChecksSoon(); });
  var rcT = null;
  function renderChecksSoon() { clearTimeout(rcT); rcT = setTimeout(renderChecks, 300); }
  window.__otvReports = { update: updateReport, newWeek: newWeek, decide: function (r, m) { return idx ? decide(r, m) : null; }, state: function () { return st; }, ready: ready, _setRefs: function (r) { refs = r; idx = buildIndex(r); },
    // для ответов: кто упомянут и из какого отделения (без запросов в Google)
    strongNeg: function (t) { return NEG_STRONG.test(String(t || "")); },
    people: function (text, page) { return idx ? findPeople(text, page) : []; }, catOf: function (p) { return idx ? catOf(p) : {}; }, textDepts: function (t) { return textDepts(t); } };

  document.addEventListener("DOMContentLoaded", function () {
    window.claude.use("db").then(function (d) {
      db = d;
      return Promise.all([db.collection("settings").doc("google").get(), db.collection("settings").doc("report").get(), db.collection("settings").doc("refs").get()]);
    }).then(function (r) {
      if (r[0] && r[0].exists) cfg = r[0].data();
      if (r[1] && r[1].exists) last = r[1].data();
      if (r[2] && r[2].exists) { try { refs = r[2].data(); idx = buildIndex(refs); } catch (e) { refs = null; } }
      render();
      // при запуске программы отчёт сразу сверяется
      if (ready()) return updateReport({ auto: true });
    }).catch(function (e) { if (ready()) setRun("err", "Google не ответил: " + (e && e.message || e)); render(); });
  });
})();
