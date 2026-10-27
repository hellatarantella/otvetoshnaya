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
  var MAP = { answers: fromAnswer, mail: fromMail, drafts: fromDraft };

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
    if (window.__otvImport) {
      var imp = el("button", "btn", "Загрузить архив ответов"); imp.type = "button";
      imp.addEventListener("click", function () { window.__otvImport(); });
      var ia = el("div", "actions"); ia.append(imp); top.append(ia);
    }
    box.append(top);
    // чему программа научилась на ваших правках
    var L = window.__otvLearn ? window.__otvLearn.rules() : [];
    var lb = el("details", "card"); lb.append(el("summary", null, "Чему программа научилась на ваших правках: " + L.filter(function (r) { return !r.off; }).length));
    if (!L.length) lb.append(el("p", "meta", "Пока нет: правило появляется, когда вы убираете одну и ту же фразу из черновика хотя бы дважды."));
    L.forEach(function (r) {
      var row = el("div", "actions"), b = el("button", "link", r.off ? "Вернуть правило" : "Отменить"); b.type = "button";
      b.addEventListener("click", function () { window.__otvLearn.setDisabled(r.key, !r.off).then(render, render); });
      row.append(el("span", null, (r.off ? "(отменено) " : "") + "Не предлагать «" + r.phrase + "» — вы убрали " + r.removed + " раз" + (r.kept ? ", оставили " + r.kept : "")), b);
      lb.append(row);
    });
    box.append(lb);
    var res = el("div"); res.id = "kbList"; box.append(res);
    list();
  }

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
        if (document.getElementById("kbList")) list(); else render();
      });
      return scanAll();
    }).then(render, render);
  });
})();
