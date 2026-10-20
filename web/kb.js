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
    if (window.__otvImport) {
      var imp = el("button", "btn", "Загрузить архив ответов"); imp.type = "button";
      imp.addEventListener("click", function () { window.__otvImport(); });
      var ia = el("div", "actions"); ia.append(imp); top.append(ia);
    }
    box.append(top);
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
