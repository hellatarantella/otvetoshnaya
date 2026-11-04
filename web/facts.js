/* «Ответошная» — справка для ответов на вопросы.
   Факты (телефоны, адреса, порядок, часы, документы) программа собирает сама из ваших согласованных
   и опубликованных ответов на вопросы и письма; вы можете добавить свои, поправить или выключить.
   Ответ на вопрос берёт только подходящие по смыслу факты — ничего не выдумывает. */
(function () {
  "use strict";
  function s(x) { return x == null ? "" : String(x); }
  function norm(t) { return s(t).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9@.]+/g, " ").trim(); }
  var STOP = /^(здравс|спасиб|благод|пожалу|котор|можно|нужно|вопрос|подска|скажит|больни|сайте|через|когда|будет|такие|также|этого|этому|какой|какие|какая|сейчас|очень|письм|напиш|ответ|уважен|админи|москов)/;
  function stems(t) { var o = {}; norm(t).split(" ").forEach(function (w) { if (w.length >= 5 && !STOP.test(w)) o[w.slice(0, 5)] = 1; }); return o; }
  var FACTY = /\d{3}|@|кабинет|корпус|окн[оа]|этаж|по адресу|ул\.|улиц|с \d|до \d|ежедневно|по будням|понедельник|выходн|часы|госуслуг|mos\.ru|направлени|полис|паспорт|СНИЛС|выписк|справк/i;
  var BAD = /[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+(вна|вич|ична)\b|здравствуйте|с уважением|желаем|спасибо за вопрос|благодарим за/i;
  var facts = {}, db = null;

  // из ответа на вопрос — предложения с конкретикой (телефон, адрес, кабинет, порядок, документы)
  function harvest(situation, answer) {
    return (s(answer).replace(/\r/g, "").split(/\n+/).join(" ").match(/[^.!?]+(?:\.(?=\S)[^.!?]*)*[.!?]*/g) || [])
      .map(function (x) { return x.trim(); })
      .filter(function (x) { return x.length >= 30 && x.length <= 320 && FACTY.test(x) && !BAD.test(x); });
  }
  function key(t) { var h = 0; t = norm(t); for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return "f" + (h >>> 0).toString(36); }
  function scan() {
    if (!db || !window.__otvAll) return Promise.resolve(0);
    var kb = (window.__otvAllRO || window.__otvAll)("kb") || {}, add = [];
    Object.keys(kb).forEach(function (k) {
      var e = kb[k]; if (!e) return;
      var q = e.kind === "question" || (e.kind === "mail" && /\?/.test(s(e.situation)));
      if (!q || !(e.status === "approved" || e.status === "published" || e.status === "done")) return;
      harvest(e.situation, e.answer).forEach(function (t) {
        var id = key(t); if (facts[id] || add.some(function (a) { return a.id === id; })) return;
        add.push({ id: id, d: { text: t, topic: Object.keys(stems(e.situation)).slice(0, 12).join(" "), source: "из ответа: " + s(e.situation).slice(0, 80), auto: true, off: false, at: new Date().toISOString() } });
      });
    });
    return add.reduce(function (p, a) { return p.then(function () { facts[a.id] = a.d; return db.collection("facts").doc(a.id).set(a.d); }); }, Promise.resolve()).then(function () { return add.length; });
  }
  // подходящие факты для вопроса: общие слова вопроса с фактом и с вопросом, из которого факт взят
  function forQuestion(q, n) {
    var Q = stems(q), out = [];
    Object.keys(facts).forEach(function (id) {
      var f = facts[id]; if (!f || f.off) return;
      var F = stems(f.text + " " + s(f.topic)), sc = 0;
      for (var k in Q) if (F[k]) sc++;
      if (sc >= 2 || (sc >= 1 && Object.keys(Q).length <= 3)) out.push({ id: id, text: f.text, score: sc + (f.auto ? 0 : 0.5) });
    });
    return out.sort(function (a, b) { return b.score - a.score; }).slice(0, n || 3);
  }
  function phones() {
    var out = [];
    Object.keys(facts).forEach(function (id) { var f = facts[id]; if (!f || f.off) return; (s(f.text).match(/\+?\d[\d\s()\-]{8,}\d/g) || []).forEach(function (p) { out.push(p.replace(/\D/g, "").replace(/^7/, "8")); }); });
    return out;
  }
  function mails() { var out = []; Object.keys(facts).forEach(function (id) { var f = facts[id]; if (f && !f.off) (s(f.text).match(/[\w.+-]+@[\w.-]+\w/g) || []).forEach(function (m) { out.push(m.toLowerCase()); }); }); return out; }
  function save(id, d) { facts[id] = d; return db ? db.collection("facts").doc(id).set(d) : Promise.resolve(); }
  function addOwn(text, topic) { text = s(text).trim(); if (text.length < 10) return Promise.resolve(false); return save(key(text), { text: text, topic: Object.keys(stems(topic + " " + text)).join(" "), source: "добавлено вами", auto: false, off: false, at: new Date().toISOString() }).then(function () { return true; }); }
  function setOff(id, off) { var f = facts[id]; if (!f) return Promise.resolve(); f.off = !!off; return save(id, f); }
  function remove(id) { delete facts[id]; return db ? db.collection("facts").doc(id).delete() : Promise.resolve(); }

  /* ---------- блок в «Базе ответов» ---------- */
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var openState = false;
  function block() {
    var ids = Object.keys(facts), on = ids.filter(function (i) { return !facts[i].off; }).length;
    var d = el("details", "card"); d.id = "kbFacts"; d.open = openState; d.addEventListener("toggle", function () { openState = d.open; });
    d.append(el("summary", null, "Справка для ответов на вопросы: " + on + " " + (on % 10 === 1 && on % 100 !== 11 ? "факт" : (on % 10 >= 2 && on % 10 <= 4 && (on % 100 < 12 || on % 100 > 14)) ? "факта" : "фактов")));
    d.append(el("p", "meta", "Программа сама собирает факты (телефоны, кабинеты, порядок, документы) из ваших ответов на вопросы и берёт в ответ только подходящие. Добавьте свои — например, часы посещения или как получить выписку."));
    var ta = el("textarea"); ta.rows = 2; ta.placeholder = "Факт целиком, как его можно написать пациенту. Например: Выписку можно получить в окне справочной, корпус 1, по будням с 9:00 до 16:00.";
    var tp = el("input"); tp.type = "text"; tp.placeholder = "Тема (необязательно): выписка, посещение, госпитализация…"; tp.className = "kb-search";
    var go = el("button", "btn primary", "Добавить факт"); go.type = "button"; var msg = el("span", "meta");
    go.addEventListener("click", function () { addOwn(ta.value, tp.value).then(function (ok) { msg.textContent = ok ? "Добавлено" : "Слишком коротко"; if (ok) { ta.value = ""; tp.value = ""; refresh(); } }); });
    var a = el("div", "actions"); a.append(go, msg); d.append(ta, tp, a);
    var ul = el("ul", "facts");
    ids.sort(function (x, y) { return (facts[x].auto - facts[y].auto) || s(facts[y].at).localeCompare(s(facts[x].at)); }).slice(0, 200).forEach(function (id) {
      var f = facts[id], li = el("li", f.off ? "off" : null);
      li.append(el("span", "ft", f.text), el("span", "meta", " · " + s(f.source)));
      var b = el("button", "btn", f.off ? "Включить" : "Не использовать"); b.type = "button";
      b.addEventListener("click", function () { setOff(id, !f.off).then(refresh); });
      var x = el("button", "btn", "Удалить"); x.type = "button"; x.addEventListener("click", function () { remove(id).then(refresh); });
      li.append(b, x); ul.append(li);
    });
    d.append(ul);
    return d;
  }
  function refresh() { var o = document.getElementById("kbFacts"); if (o) o.replaceWith(block()); }

  var timer = 0;
  function start() {
    if (!window.claude || !window.claude.use) return;
    window.claude.use("db").then(function (d) {
      db = d;
      db.collection("facts").onSnapshot(function (sn) { facts = {}; sn.docs.forEach(function (x) { facts[x.id] = x.data() || {}; }); refresh(); }, function () {});
      // справка начинается с фактов из справочника программы (почта, Единый контактный центр, МОРС, госпитализация)
      var seed = function () {
        var ref = document.getElementById("ref-style"), t = ref ? ref.textContent : "", part = t.split(/ФАКТЫ ДЛЯ ОТВЕТОВ:/)[1] || "";
        part.split(/\n/).map(function (x) { return x.replace(/^\s*-\s*/, "").trim(); }).filter(function (x) { return x.length > 25; }).forEach(function (x) {
          x.split(/(?<=\.)\s+(?=[А-ЯЁ])/).forEach(function (f) { f = f.trim(); if (f.length < 25) return; var id = key(f); if (facts[id]) return;
            facts[id] = { text: f, topic: Object.keys(stems(f)).join(" "), source: "справочник программы", auto: true, off: false, at: new Date().toISOString() };
            db.collection("facts").doc(id).set(facts[id]).catch(function () {}); });
        });
      };
      setTimeout(seed, 3000);
      var later = function () { clearTimeout(timer); timer = setTimeout(function () { scan().then(function (n) { if (n) refresh(); }); }, 1500); };
      window.addEventListener("otv-write", function (ev) { var n = ev.detail && ev.detail.name; if (n === "kb" || n === "answers" || n === "mail") later(); });
      window.addEventListener("otv-imported", later);
      // «База ответов» меняется и без событий (загрузка, обучение): сверяем счётчик изменений раз в 5 с, без копирования базы
      var v0 = -1; setInterval(function () { var v = window.__otvVer ? window.__otvVer("kb") : 0; if (v !== v0) { v0 = v; later(); } }, 5000);
      later();
    });
  }
  window.__otvFacts = { harvest: harvest, forQuestion: forQuestion, phones: phones, mails: mails, addOwn: addOwn, setOff: setOff, remove: remove, scan: scan, block: block, all: function () { return facts; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
