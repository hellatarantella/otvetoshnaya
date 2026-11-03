/* «Ответошная» — база ответов (только в программе).
   Каждая ситуация и ответ на неё запоминаются: согласованные и опубликованные ответы на отзывы,
   обжалования, письма с сайта, тексты «Спасибо» и «Ответ на вопрос». База лежит в зашифрованном
   файле программы, по ней можно искать готовые ответы, а на шаге 5 по ней учится модель. */
(function () {
  "use strict";
  if (!window.__OTV_APP) return;
  var db = null, rows = [], query = "", kindF = "all";
  var KINDS = { review: "Отзыв", appeal: "Обжалование", question: "Вопрос", mail: "Письмо с сайта", thanks: "Спасибо", ethics: "Этический комитет" };
  function s(v) { return v == null ? "" : String(v); }
  function nowIso() { return new Date().toISOString(); }

  /* ---------- что и как запоминаем ---------- */
  function fromAnswer(id, d) {
    if (!d || (d.status !== "approved" && d.status !== "published")) return null;
    var ans = s(d.answer).trim(); if (!ans) return null;
    return { key: "ans-" + id, data: {
      kind: d.kind === "appeal" ? "appeal" : "review", platform: s(d.platform), page: s(d.page), date: s(d.date),
      situation: s(d.review), answer: ans, draft: s(d.draft || ""), edited: !!d.draft && s(d.draft).trim() !== ans,
      status: s(d.status), note: s(d.note), week: s(d.week), source: "answers/" + id } };
  }
  function fromMail(id, d) {
    if (!d || d.status !== "done") return null;
    var ans = s(d.answer || d.draft).trim(); if (!ans) return null;
    return { key: "mail-" + id, data: {
      kind: d.kind === "question" ? "question" : "mail", platform: "Сайт", page: "Письмо с сайта", date: s(d.date),
      situation: s(d.text), answer: ans, draft: s(d.draft || ""), edited: false, status: "done", note: s(d.note), source: "mail/" + id } };
  }
  function fromDraft(id, d) {
    if (!d) return null;
    var ans = s(d.text).trim(); if (!ans) return null;
    var tab = s(d.tab);
    return { key: "drf-" + id, data: {
      kind: KINDS[tab] ? tab : "thanks", platform: "", page: "", date: s(d.createdAt).slice(0, 10),
      situation: s(d.label), answer: ans, draft: "", edited: false, status: "draft", note: s(d.note), source: "drafts/" + id } };
  }
  // программа сама ищет, на чём учиться: настоящие ответы больницы, которые она видит на площадках при сборе.
  // Берём только написанные хорошо (речевая проверка по Ильяхову не ниже 6 из 10) и не короче 60 знаков
  function fromRegistry(id, d) {
    if (!d) return null;
    var ans = s(d.reply).trim(), sit = s(d.fullText || d.text).trim();
    if (ans.length < 60 || sit.length < 20) return null;
    var SP = window.__otvSpeech; if (SP && SP.audit(ans).score < 6) return null;
    return { key: "site-" + id, data: {
      kind: "review", platform: s(d.platform), page: s(d.page), date: s(d.date || d.placed || "").slice(0, 10),
      situation: sit, answer: ans, draft: "", edited: false, status: "published", note: "ответ больницы с площадки (найден при сборе)", source: "площадка" } };
  }
  var MAP = { answers: fromAnswer, mail: fromMail, drafts: fromDraft, registry: fromRegistry };

  function remember(entry) {
    if (!entry || !db) return Promise.resolve(false);
    var ref = db.collection("kb").doc(entry.key);
    return ref.get().then(function (cur) {
      var prev = cur.exists ? cur.data() : null;
      if (prev && prev.answer === entry.data.answer && prev.situation === entry.data.situation && prev.status === entry.data.status) return false;
      var data = Object.assign({}, entry.data, { updatedAt: nowIso(), createdAt: prev ? prev.createdAt : nowIso() });
      return ref.set(data).then(function () { return true; });
    });
  }

  function scanAll() {
    var jobs = [];
    Object.keys(MAP).forEach(function (coll) {
      var all = window.__otvAll(coll) || {};
      Object.keys(all).forEach(function (id) { var e = MAP[coll](id, all[id]); if (e) jobs.push(e); });
    });
    return jobs.reduce(function (p, e) { return p.then(function () { return remember(e); }); }, Promise.resolve());
  }

  window.addEventListener("otv-write", function (ev) {
    var d = ev.detail || {}; var f = MAP[d.name];
    if (f && d.doc) remember(f(d.id, d.doc));
  });
  window.addEventListener("otv-imported", function () { scanAll(); });

  /* ---------- база обучения ---------- */
  function hash(x) { var h = 0; x = s(x); for (var i = 0; i < x.length; i++) h = (h * 31 + x.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function importTraining(d) {
    if (!d || typeof d !== "object") throw new Error("это не файл базы обучения");
    var jobs = [];
    var cases = (d["разборы_22_10_2026"] && d["разборы_22_10_2026"].items) || d.items || [];
    cases.forEach(function (it) {
      var sit = s(it.review);
      if (s(it.reply).trim()) jobs.push({ key: "train-r-" + hash(sit), data: { kind: "review", platform: s(it.platform), page: s(it.page), date: s(it.date), situation: sit, answer: s(it.reply).trim(), draft: "", edited: true, status: "approved", note: "база обучения: " + s(it.tone), source: "обучение" } });
      if (s(it.appeal).trim()) jobs.push({ key: "train-a-" + hash(sit), data: { kind: "appeal", platform: s(it.platform), page: s(it.page), date: s(it.date), situation: sit, answer: s(it.appeal).trim(), draft: "", edited: true, status: "approved", note: "база обучения: обжалование", source: "обучение" } });
    });
    (d["утверждённые_примеры"] || []).forEach(function (it) {
      var txt = s(it["текст"]).trim(); if (!txt) return;
      jobs.push({ key: "train-e-" + hash(txt), data: { kind: /обжал/i.test(s(it["тип"])) ? "appeal" : "review", platform: s(it["площадка"]), page: "", date: "", situation: s(it["отзыв"] || ""), answer: txt, draft: "", edited: true, status: "approved", note: "база обучения: " + s(it["тип"]) + " · " + s(it["статус"]), source: "обучение" } });
    });
    var rules = d["правила"];
    var saveRules = rules && db ? db.collection("settings").doc("trainRules").set({ rules: rules, at: nowIso() }) : Promise.resolve();
    return saveRules.then(function () { return jobs.reduce(function (p, e) { return p.then(function (n) { return remember(e).then(function (x) { return n + (x ? 1 : 0); }); }); }, Promise.resolve(0)); });
  }
  window.__otvKbImportTraining = function (d) { return importTraining(d); };

  /* ---------- свои ответы: файл (.txt, .docx, .csv) или вставка ---------- */
  // Пары «Отзыв: … / Ответ: …» — с ситуацией; иначе каждый абзац-блок (через пустую строку) — отдельный ответ
  function parseOwn(text) {
    var t = s(text).replace(/\r/g, "").replace(/\u00a0/g, " "), out = [];
    if (/^\s*(Отзыв|Вопрос|Жалоба)\s*[:：]/im.test(t) && /^\s*Ответ\s*[:：]/im.test(t)) {
      var re = /^\s*(?:Отзыв|Вопрос|Жалоба)\s*[:：]\s*([\s\S]*?)^\s*Ответ\s*[:：]\s*([\s\S]*?)(?=^\s*(?:Отзыв|Вопрос|Жалоба)\s*[:：]|(?![\s\S]))/gim, m;
      while ((m = re.exec(t))) { var a = m[2].trim(); if (a.length >= 30) out.push({ situation: m[1].trim(), answer: a }); }
      return out;
    }
    t.split(/\n\s*\n+/).forEach(function (b) { b = b.trim(); if (b.length >= 40) out.push({ situation: "", answer: b }); });
    return out;
  }
  function parseCsv(text) {
    var rows = [], row = [], cur = "", q = false, sep = /;/.test(s(text).split("\n")[0]) ? ";" : ",";
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === sep) { row.push(cur); cur = ""; } else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; } else if (ch !== "\r") cur += ch;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    var head = (rows[0] || []).map(function (h) { return h.toLowerCase(); }), ri = head.findIndex(function (h) { return /отзыв|вопрос|ситуац/.test(h); }), ai = head.findIndex(function (h) { return /ответ/.test(h); });
    if (ai < 0) { ri = rows[0] && rows[0].length > 1 ? 0 : -1; ai = rows[0] && rows[0].length > 1 ? 1 : 0; } else rows = rows.slice(1);
    return rows.map(function (r) { return { situation: ri >= 0 ? s(r[ri]).trim() : "", answer: s(r[ai]).trim() }; }).filter(function (x) { return x.answer.length >= 30; });
  }
  function docxText(buf) {
    if (!window.JSZip) return Promise.reject(new Error("не удалось открыть .docx"));
    return window.JSZip.loadAsync(buf).then(function (z) { var f = z.file("word/document.xml"); if (!f) throw new Error("в файле нет текста Word"); return f.async("string"); }).then(function (x) {
      var d = new DOMParser().parseFromString(x, "application/xml"), W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
      return [].map.call(d.getElementsByTagNameNS(W, "p"), function (p) { return [].map.call(p.getElementsByTagNameNS(W, "t"), function (t) { return t.textContent; }).join(""); }).join("\n");
    });
  }
  function importOwn(items, label) {
    var NEG = window.__otvGen && window.__otvGen.NEG_ANS, jobs = items.map(function (it) {
      var q = /\?/.test(it.situation) && !/спасибо|благодар/i.test(it.situation);
      return { key: "own-" + hash(it.answer), data: { kind: q ? "question" : "review", platform: "", page: "", date: "", situation: it.situation, answer: it.answer, draft: "", edited: true,
        status: "approved", note: "загружено вами" + (label ? ": " + label : "") + (NEG && NEG.test(it.answer) ? " · ответ на жалобу" : ""), source: "загружено" } };
    });
    return jobs.reduce(function (p, e) { return p.then(function (n) { return remember(e).then(function (x) { return n + (x ? 1 : 0); }); }); }, Promise.resolve(0));
  }
  function readOwnFile(f) {
    var nm = s(f.name).toLowerCase();
    if (/\.docx$/.test(nm)) return f.arrayBuffer().then(docxText).then(parseOwn);
    if (/\.csv$/.test(nm)) return f.text().then(parseCsv);
    if (/\.json$/.test(nm)) return f.text().then(function (t) { var d = JSON.parse(t); if (!Array.isArray(d)) throw new Error("ожидался список ответов"); return d.map(function (x) { return typeof x === "string" ? { situation: "", answer: x } : { situation: s(x["отзыв"] || x.review || x.situation), answer: s(x["ответ"] || x.answer || x.reply) }; }).filter(function (x) { return x.answer.length >= 30; }); });
    return f.text().then(parseOwn);
  }
  window.__otvKbOwn = { parse: parseOwn, csv: parseCsv, importOwn: importOwn, readFile: readOwnFile };

  /* ---------- вкладка «База ответов» ---------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function copy(text, btn) {
    var done = function () { var o = btn.textContent; btn.textContent = "Скопировано"; setTimeout(function () { btn.textContent = o; }, 1500); };
    try { navigator.clipboard.writeText(text).then(done, done); } catch (e) { done(); }
  }
  function words(q) { return s(q).toLowerCase().split(/[^a-zа-яё0-9]+/i).filter(function (w) { return w.length > 2; }); }

  function render() {
    var box = document.getElementById("kbBox"); if (!box) return;
    box.textContent = "";
    var top = el("div", "ctl");
    top.append(el("p", "meta", "Здесь копятся все ситуации и ответы: согласованные и опубликованные ответы на отзывы, обжалования, письма, тексты «Спасибо» и ответы на вопросы. По базе можно найти, как отвечали раньше; на шаге 5 по ней учится модель."));
    var inp = el("input"); inp.type = "search"; inp.placeholder = "Поиск: отделение, врач, тема, слово из отзыва…"; inp.value = query;
    inp.className = "kb-search";
    inp.addEventListener("input", function () { query = inp.value; list(); });
    top.append(inp);
    var chips = el("div", "chips kb-kinds");
    [["all", "Все"]].concat(Object.keys(KINDS).map(function (k) { return [k, KINDS[k]]; })).forEach(function (k) {
      var b = el("button", "chip", k[1]); b.type = "button"; b.setAttribute("aria-pressed", String(kindF === k[0]));
      b.addEventListener("click", function () { kindF = k[0]; render(); });
      chips.append(b);
    });
    top.append(chips);
    // база обучения (файл от Claude: правила, согласованные ответы и обжалования) — загружается сюда, в репозиторий не попадает
    var tr = el("input"); tr.type = "file"; tr.accept = ".json,application/json"; tr.hidden = true;
    var trB = el("button", "btn", "Загрузить базу обучения (JSON)"); trB.type = "button";
    var trMsg = el("span", "meta");
    trB.addEventListener("click", function () { tr.click(); });
    tr.addEventListener("change", function () {
      var f = tr.files && tr.files[0]; if (!f) return;
      f.text().then(function (txt) { return importTraining(JSON.parse(txt)); }).then(function (n) { trMsg.textContent = "Добавлено в базу: " + n; }, function (e) { trMsg.textContent = "Не загрузилось: " + (e && e.message || e); });
      tr.value = "";
    });
    var ta = el("div", "actions"); ta.append(trB, tr, trMsg); top.append(ta);
    // свои ответы — генератор и модель учатся на них как на согласованных
    var ow = el("input"); ow.type = "file"; ow.multiple = true; ow.accept = ".txt,.docx,.csv,.json,.md"; ow.hidden = true;
    var owB = el("button", "btn", "Загрузить свои ответы (Word, текст, таблица)"); owB.type = "button";
    var owP = el("button", "btn", "Вставить свои ответы"); owP.type = "button";
    var owMsg = el("span", "meta"); owMsg.id = "kbOwnMsg";
    var owBox = el("div", "kb-own"); owBox.hidden = true;
    var owTa = el("textarea"); owTa.placeholder = "Вставьте ответы. Каждый ответ — через пустую строку.\nМожно парами:\nОтзыв: …\nОтвет: …"; owTa.rows = 8;
    var owGo = el("button", "btn primary", "Добавить в обучение"); owGo.type = "button";
    owBox.append(owTa, owGo);
    var done = function (n, all) { owMsg.textContent = all ? "Добавлено в обучение: " + n + " из " + all + (n < all ? " (остальные уже были)" : "") : "Не нашла ответов: нужен текст от 30 знаков; в Word — по абзацам через пустую строку или парами «Отзыв: / Ответ:»"; };
    var fail = function (e) { owMsg.textContent = "Не загрузилось: " + (e && e.message || e); };
    owB.addEventListener("click", function () { ow.click(); });
    ow.addEventListener("change", function () {
      var fs = [].slice.call(ow.files || []); ow.value = ""; if (!fs.length) return;
      owMsg.textContent = "Читаю…";
      fs.reduce(function (p, f) { return p.then(function (acc) { return readOwnFile(f).then(function (items) { return importOwn(items, f.name).then(function (n) { return [acc[0] + n, acc[1] + items.length]; }); }); }); }, Promise.resolve([0, 0]))
        .then(function (r) { done(r[0], r[1]); }, fail);
    });
    owP.addEventListener("click", function () { owBox.hidden = !owBox.hidden; if (!owBox.hidden) owTa.focus(); });
    owGo.addEventListener("click", function () { var items = parseOwn(owTa.value); owMsg.textContent = "Добавляю…"; importOwn(items, "вставка").then(function (n) { done(n, items.length); if (items.length) owTa.value = ""; }, fail); });
    var oa = el("div", "actions"); oa.append(owB, owP, ow, owMsg); top.append(oa, owBox);
    if (window.__otvImport) {
      var imp = el("button", "btn", "Загрузить архив ответов"); imp.type = "button";
      imp.addEventListener("click", function () { window.__otvImport(); });
      var ia = el("div", "actions"); ia.append(imp); top.append(ia);
    }
    box.append(top);
    box.append(learnBlock());
    if (window.__otvFacts) box.append(window.__otvFacts.block());
    var res = el("div"); res.id = "kbList"; box.append(res);
    list();
  }
  // чему программа научилась на ваших правках — обновляется вместе с базой (раньше рисовался один раз за сеанс)
  var learnOpen = false;
  function learnBlock() {
    var L = window.__otvLearn ? window.__otvLearn.rules() : [];
    var lb = el("details", "card"); lb.id = "kbLearn"; lb.open = learnOpen; lb.addEventListener("toggle", function () { learnOpen = lb.open; }); lb.append(el("summary", null, "Чему программа научилась на ваших правках: " + L.filter(function (r) { return !r.off; }).length));
    if (!L.length) lb.append(el("p", "meta", "Пока нет: правило появляется, когда вы хотя бы дважды убираете одну и ту же фразу, меняете одно слово на другое или дописываете своё предложение."));
    var times = function (n) { return n + " " + (n % 10 === 1 && n % 100 !== 11 ? "раз" : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? "раза" : "раз"); };
    [["remove", "Убираете"], ["replace", "Заменяете"], ["add", "Дописываете сами"]].forEach(function (g) {
      var G = L.filter(function (r) { return r.type === g[0]; }); if (!G.length) return;
      lb.append(el("h4", null, g[1] + ": " + G.length));
      G.forEach(function (r) {
        var row = el("div", "actions"), b = el("button", "link", r.off ? "Вернуть правило" : "Отменить"); b.type = "button";
        b.addEventListener("click", function () { window.__otvLearn.setDisabled(r.key, !r.off).then(render, render); });
        var t = r.type === "remove" ? "Не предлагать «" + r.phrase + "» — вы убрали " + times(r.yes) + (r.no ? ", оставили " + r.no : "")
          : r.type === "replace" ? "Писать «" + r.to + "» вместо «" + r.from + "» — вы заменили " + times(r.yes) + (r.no ? ", оставили " + r.no : "")
          : "Предлагать «" + r.phrase + "» — вы дописали " + times(r.yes);
        row.append(el("span", null, (r.off ? "(отменено) " : "") + t + (r.scope !== "all" ? " · " + r.scopeName : "")), b);
        lb.append(row);
      });
    });
    return lb;
  }
  function refreshLearn() { var old = document.getElementById("kbLearn"); if (old) old.replaceWith(learnBlock()); }

  function list() {
    var res = document.getElementById("kbList"); if (!res) return;
    res.textContent = "";
    var ws = words(query);
    var shown = rows.filter(function (r) { return kindF === "all" || r.kind === kindF; }).map(function (r) {
      if (!ws.length) return { r: r, score: 0 };
      var hay = (s(r.situation) + " " + s(r.answer) + " " + s(r.page) + " " + s(r.platform) + " " + s(r.note)).toLowerCase();
      var sc = ws.reduce(function (a, w) { return a + (hay.indexOf(w) >= 0 ? 1 : 0); }, 0);
      return { r: r, score: sc };
    }).filter(function (x) { return !ws.length || x.score > 0; });
    shown.sort(function (a, b) { return b.score - a.score || s(b.r.updatedAt).localeCompare(s(a.r.updatedAt)); });
    res.append(el("p", "meta", "В базе ситуаций: " + rows.length + (ws.length || kindF !== "all" ? " · найдено: " + shown.length : "")));
    shown.slice(0, 100).forEach(function (x) {
      var r = x.r, card = el("div", "card");
      var head = el("div", "head");
      head.append(el("span", "badge", KINDS[r.kind] || r.kind));
      head.append(el("span", "meta", [r.platform, r.page, r.date].filter(Boolean).join(" · ")));
      if (r.edited) head.append(el("span", "status st-fix", "Исправлено вами"));
      card.append(head);
      if (r.situation) { card.append(el("div", "label", "Ситуация")); card.append(el("div", "rev", r.situation)); }
      card.append(el("div", "label", "Ответ"));
      card.append(el("div", "rev", r.answer));
      var a = el("div", "actions");
      var cp = el("button", "btn", "Скопировать ответ"); cp.type = "button";
      cp.addEventListener("click", function () { copy(r.answer, cp); });
      a.append(cp); card.append(a);
      res.append(card);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    window.claude.use("db").then(function (d) {
      db = d;
      db.collection("kb").onSnapshot(function (snap) {
        rows = snap.docs.map(function (x) { var o = x.data() || {}; o.id = x.id; return o; });
        if (document.getElementById("kbList")) { list(); refreshLearn(); } else render();
      });
      return scanAll();
    }).then(render, render);
  });
})();
