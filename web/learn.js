/* «Ответошная» — обучение на ваших правках.
   В каждой карточке ответа хранится черновик программы и ваш итоговый текст. Программа сравнивает их по всей «Базе ответов»:
   фраза, которую вы убираете регулярно (не меньше двух раз и чаще, чем оставляете), становится правилом —
   шаблоны перестают её предлагать, встроенная модель получает её в списке «не писать», а в «Базе ответов» правило видно
   и его можно отменить. */
(function () {
  "use strict";
  var SIGN = /^С уважением, администрация 24 Московской больницы\.?$/i;
  function s(x) { return x == null ? "" : String(x); }
  function norm(x) { return s(x).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/g, " ").trim(); }
  // предложения ответа без приветствия и подписи
  function sents(t) {
    var out = [];
    s(t).replace(/\r/g, "").split("\n").map(function (l) { return l.trim(); }).filter(function (l) { return l && !/^Здравствуйте/i.test(l) && !SIGN.test(l); }).forEach(function (l) {
      (l.match(/[^.!?]+[.!?]*/g) || []).forEach(function (x) { x = x.trim(); if (norm(x).split(" ").length >= 3) out.push(x); });
    });
    return out;
  }
  function sim(a, b) {
    var A = {}, B = {}, n = 0, u = 0, k;
    norm(a).split(" ").forEach(function (w) { if (w.length > 2) A[w.slice(0, 6)] = 1; });
    norm(b).split(" ").forEach(function (w) { if (w.length > 2) B[w.slice(0, 6)] = 1; });
    for (k in A) { u++; if (B[k]) n++; } for (k in B) if (!A[k]) u++;
    return u ? n / u : 0;
  }
  var cache = { key: "", rules: [] }, disabled = {};
  function compute() {
    var kb = (window.__otvAll && window.__otvAll("kb")) || {}, ids = Object.keys(kb);
    var key = ids.length + "|" + ids.map(function (i) { return s(kb[i].updatedAt); }).sort().slice(-1)[0];
    if (cache.key === key) return cache.rules;
    var stat = {};
    ids.forEach(function (id) {
      var e = kb[id]; if (!e || !s(e.draft).trim() || !s(e.answer).trim() || e.kind === "appeal") return;
      var A = sents(e.answer);
      sents(e.draft).forEach(function (d) {
        var k = norm(d); if (!k) return;
        var st = stat[k] = stat[k] || { phrase: d.replace(/[.!?]+$/, ""), removed: 0, kept: 0 };
        if (A.some(function (a) { return norm(a) === k || sim(a, d) > 0.75; })) st.kept++; else st.removed++;
      });
    });
    var rules = Object.keys(stat).map(function (k) { return Object.assign({ key: k }, stat[k]); })
      .filter(function (r) { return r.removed >= 2 && r.removed / (r.removed + r.kept) >= 0.6; })
      .sort(function (a, b) { return b.removed - a.removed; });
    cache = { key: key, rules: rules };
    return rules;
  }
  function active() { return compute().filter(function (r) { return !disabled[r.key]; }); }
  // сколько изученных правил нарушает текст (для шаблонов: такие варианты уходят вниз)
  function hits(text) { var n = norm(text); return active().filter(function (r) { return n.indexOf(r.key) >= 0; }); }
  window.__otvLearn = {
    rules: function () { return compute().map(function (r) { return Object.assign({ off: !!disabled[r.key] }, r); }); },
    active: active,
    penalty: function (text) { return hits(text).length * 5; },
    hits: hits,
    setDisabled: function (key, off) {
      if (off) disabled[key] = 1; else delete disabled[key];
      return window.claude.use("db").then(function (db) { return db.collection("settings").doc("learn").set({ disabled: Object.keys(disabled), at: new Date().toISOString() }); });
    }
  };
  if (window.claude && window.claude.use) window.claude.use("db").then(function (db) {
    if (!db) return;
    db.collection("settings").onSnapshot(function (sn) { sn.docs.forEach(function (x) { if (x.id === "learn") { disabled = {}; ((x.data() || {}).disabled || []).forEach(function (k) { disabled[k] = 1; }); } }); }, function () {});
  }).catch(function () {});
})();
