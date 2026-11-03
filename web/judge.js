/* «Ответошная» — судья: какой из вариантов ответа вы, скорее всего, выберете.
   Признаки варианта: речь по Ильяхову, закрыты ли жалоба и вопрос, длина как у вас, похожесть на ваши ответы на похожие
   отзывы, доля ваших фраз, ваше любимое начало, выученные правила правок, повторы. Веса признаков учатся на ваших выборах
   в «Проверке вслепую» и в карточках (оставили / пролистали): что вы выбираете — то и поднимается. */
(function () {
  "use strict";
  function s(x) { return x == null ? "" : String(x); }
  function norm(t) { return s(t).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9@]+/g, " ").trim(); }
  var SIGN = /С уважением, администрация 24 Московской больницы\.?/;
  function body(t) { return s(t).replace(/^\s*Здравствуйте[^\n]*\n/, "").replace(SIGN, "").trim(); }
  function stems(t) { var o = {}; norm(t).split(" ").forEach(function (w) { if (w.length > 3) o[w.slice(0, 6)] = 1; }); return o; }
  function jac(A, B) { var n = 0, u = 0, k; for (k in A) { u++; if (B[k]) n++; } for (k in B) if (!A[k]) u++; return u ? n / u : 0; }
  function sents(t) { return (body(t).match(/[^.!?]+[.!?]*/g) || []).map(function (x) { return x.trim(); }).filter(Boolean); }
  var NEG = /разобрат|разбер|gkb24@|напишите|свяж|ответственн|рассмотрени|обеспокои/i;

  var NAMES = ["Речь (Ильяхов)", "Закрыты жалоба и вопрос", "Длина как у вас", "Похоже на ваши ответы", "Ваши фразы", "Ваше начало", "Ваши правки", "Не слишком коротко", "Без повторов"];
  var W0 = [1.5, 1.2, 0.8, 2.2, 1.2, 0.4, 1.0, 0.6, 0.6], W = W0.slice(), db = null, pairs = 0;

  // ваши ответы на похожие отзывы (того же тона): с чем сравнивать вариант
  var herCache = { v: -1, list: [] };
  function herAnswers() {
    var v = window.__otvVer ? window.__otvVer("kb") : 0; if (herCache.v === v) return herCache.list;
    var kb = (window.__otvAll && window.__otvAll("kb")) || {}, list = [];
    Object.keys(kb).forEach(function (id) {
      var e = kb[id]; if (!e || e.kind === "appeal" || e.source === "площадка" || !s(e.answer).trim()) return;
      if (!(e.edited || e.source === "загружено" || e.source === "обучение" || e.status === "published" || e.status === "approved")) return;
      list.push({ id: id, sit: stems(e.situation), sitText: norm(e.situation), ans: stems(body(e.answer)), neg: NEG.test(s(e.answer)), q: e.kind === "question" });
    });
    herCache = { v: v, list: list }; return list;
  }
  function features(text, req) {
    req = req || {};
    var SP = window.__otvSpeech, L = window.__otvLearn, C = window.__otvCompose, b = body(text), S = sents(text), lb = norm(b);
    var negT = NEG.test(b), q = req.kind === "question";
    var a = SP ? SP.audit(text).score / 10 : 0.7;
    var miss = SP && !q ? SP.covers(text, req.review).length : 0;
    var st = L && L.style ? L.style() : null, target = st && st.total >= 5 ? (negT ? st.negLen : st.posLen) : (negT ? 4 : 3);
    var lenFit = target ? Math.max(0, 1 - Math.abs(S.length - target) / 3) : 0.5;
    // похожесть на ваши ответы на 5 самых похожих отзывов (без этого же отзыва)
    var R = stems(req.review), rn = norm(req.review), A = stems(b);
    var near = herAnswers().filter(function (h) { return h.id !== req.kbId && h.sitText !== rn && h.neg === negT && h.q === q; })
      .map(function (h) { return { h: h, s: jac(R, h.sit) }; }).sort(function (x, y) { return y.s - x.s; }).slice(0, 5);
    var her = near.length ? Math.max.apply(null, near.map(function (x) { return jac(A, x.h.ans); })) : 0.3;
    var mine = st ? st.phrases.filter(function (p) { return lb.indexOf(norm(p.text)) >= 0; }).length : 0;
    var phr = S.length ? Math.min(1, mine / S.length * 1.5) : 0;
    var fav = st && st.open[0] && st.open[0].n >= 3 && lb.indexOf(st.open[0].word) === 0 ? 1 : 0;
    var lc = { tone: negT ? "negative" : "positive", platform: req.platform };
    var learned = L && L.penalty ? Math.max(-1, Math.min(1, -L.penalty(text, lc) / 5)) : 0;
    var shortP = b.length < 60 ? 0 : 1;
    var rep = C && C.repeats && C.repeats(b) ? 0 : 1;
    return [a, -miss, lenFit, her, phr, fav, learned, shortP, rep];
  }
  function score(text, req) { var f = features(text, req), t = 0; for (var i = 0; i < f.length; i++) t += W[i] * f[i]; return t; }
  function best(cands, req) {
    var sc = cands.filter(Boolean).map(function (t) { return { t: t, s: score(t, req) }; }).sort(function (a, b) { return b.s - a.s; });
    return sc.length ? sc[0].t : null;
  }
  // учимся на выборе: победитель должен набирать больше проигравшего
  function learn(winner, loser, req) {
    if (!winner || !loser) return;
    var fw = features(winner, req), fl = features(loser, req), d = 0, i;
    for (i = 0; i < fw.length; i++) d += W[i] * (fw[i] - fl[i]);
    if (d > 0.5) { pairs++; return save(); }      // и так угадываем с запасом
    for (i = 0; i < fw.length; i++) W[i] = Math.max(0, Math.min(5, W[i] + 0.25 * (fw[i] - fl[i])));
    pairs++; return save();
  }
  function save() { if (db) return db.collection("settings").doc("judge").set({ w: W, pairs: pairs, at: new Date().toISOString() }).catch(function () {}); return Promise.resolve(); }
  function explain(text, req) { var f = features(text, req); return NAMES.map(function (n, i) { return n + ": " + (Math.round(f[i] * 100) / 100) + " × " + (Math.round(W[i] * 100) / 100); }).join("\n"); }
  if (window.claude && window.claude.use) window.claude.use("db").then(function (d) {
    db = d; if (!d) return;
    return d.collection("settings").doc("judge").get().then(function (sn) { if (sn && sn.exists) { var v = sn.data() || {}; if (Array.isArray(v.w) && v.w.length === W0.length) W = v.w.slice(); pairs = v.pairs || 0; } });
  }).catch(function () {});
  window.__otvJudge = { features: features, score: score, best: best, learn: learn, explain: explain, weights: function () { return W.slice(); }, pairs: function () { return pairs; }, NAMES: NAMES, reset: function () { W = W0.slice(); pairs = 0; return save(); } };
})();
