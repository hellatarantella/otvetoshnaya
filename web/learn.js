/* «Ответошная» — обучение на ваших правках.
   В каждой карточке ответа хранится черновик программы и ваш итоговый текст. Программа сравнивает их по всей «Базе ответов»
   и выводит правила трёх видов (правило — когда так сделано не меньше двух раз и чаще, чем наоборот):
   • «Убираете»: фраза из черновика, которую вы вычёркиваете, — шаблоны её больше не предлагают, модель получает её в «не писать»;
   • «Заменяете»: слово или оборот, который вы меняете на свой («благодарим» → «спасибо»), — программа сразу пишет по-вашему;
   • «Добавляете»: ваше предложение, которое вы дописываете сами, — программа предлагает варианты с ним выше.
   Правило может действовать везде или только в своей ситуации: жалобы / благодарности, своя площадка — правило, выученное
   на жалобах, не мешает ответам на благодарности. Все правила видны в «Базе ответов», любое можно отключить. */
(function () {
  "use strict";
  var SIGN = /^С уважением, администрация 24 Московской больницы\.?$/i;
  var NEG = /хамств|хамил|грубил|груб[оы]\b|ужасн|отвратит|безобраз|не рекоменд|не совету|разочаров|кошмар|равнодуш|не помогл|обманул|грязн|не дозвон|нагруб|бардак|халатн|возмутит|позор|жалоб|плохо|сожален|извин|разобраться/i;
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
  // похожесть по порядку слов (общая подпоследовательность): «Благодарим вас за отзыв…» и «Спасибо вам за отзыв…» — одно
  // и то же предложение с заменой начала, а не новое
  function seqSim(a, b) {
    var A = norm(a).split(" "), B = norm(b).split(" "); if (!A[0] || !B[0]) return 0;
    var prev = new Array(B.length + 1).fill(0), cur;
    for (var i = 1; i <= A.length; i++) { cur = [0]; for (var j = 1; j <= B.length; j++) cur[j] = A[i - 1] === B[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]); prev = cur; }
    return 2 * prev[B.length] / (A.length + B.length);
  }
  function close(a, b) { return Math.max(sim(a, b), seqSim(a, b)); }
  // ситуация записи: тон (по отзыву и ответу) и площадка
  function ctxOf(e) {
    var neg = e.kind === "appeal" || NEG.test(s(e.situation)) || /сожалеем|разобраться|приносим извинени/i.test(s(e.answer));
    return { tone: neg ? "neg" : "pos", platform: s(e.platform) };
  }
  function scopesOf(c) { return ["all", "tone:" + c.tone].concat(c.platform ? ["pl:" + c.platform] : []); }
  var SCOPE_NAME = function (sc) { return sc === "all" ? "везде" : sc === "tone:neg" ? "в ответах на жалобы" : sc === "tone:pos" ? "в ответах на благодарности" : "на площадке " + sc.slice(3); };

  // замена внутри похожего предложения: различающийся кусок (до 4 слов с каждой стороны)
  function diffSpan(a, b) {
    var A = norm(a).split(" "), B = norm(b).split(" "), i = 0, j = 0;
    while (i < A.length && i < B.length && A[i] === B[i]) i++;
    var ea = A.length - 1, eb = B.length - 1;
    while (ea >= i && eb >= i && A[ea] === B[eb]) { ea--; eb--; }
    var from = A.slice(i, ea + 1).join(" "), to = B.slice(i, eb + 1).join(" ");
    if (!from || !to || from.split(" ").length > 4 || to.split(" ").length > 4) return null;
    return { from: from, to: to };
  }

  var cache = { key: "", vkey: "", rules: [] }, disabled = {};
  function compute() {
    // база не менялась — правила те же (раньше вся база копировалась при оценке каждого варианта ответа)
    var vkey = window.__otvVer ? window.__otvVer("kb") : "";
    if (vkey && cache.vkey === vkey) return cache.rules;
    var kb = (window.__otvAll && window.__otvAll("kb")) || {}, ids = Object.keys(kb);
    var key = ids.length + "|" + ids.map(function (i) { return s(kb[i].updatedAt); }).sort().slice(-1)[0];
    if (cache.key === key) { cache.vkey = vkey; return cache.rules; }
    var rem = {}, rep = {}, add = {};
    var bump = function (map, k, sc, field, extra) { var o = map[sc + "|" + k] = map[sc + "|" + k] || Object.assign({ scope: sc, k: k, yes: 0, no: 0 }, extra); o[field]++; };
    ids.forEach(function (id) {
      var e = kb[id]; if (!e || !s(e.draft).trim() || !s(e.answer).trim() || e.kind === "appeal") return;
      var D = sents(e.draft), A = sents(e.answer), scs = scopesOf(ctxOf(e));
      D.forEach(function (d) {
        var k = norm(d); if (!k) return;
        var best = null, bs = 0; A.forEach(function (a) { var x = norm(a) === k ? 1 : close(a, d); if (x > bs) { bs = x; best = a; } });
        // осталось (почти как было) или поправлено (замена слов) — не «убрали»
        var kept = bs >= 0.5;
        scs.forEach(function (sc) { bump(rem, k, sc, kept ? "no" : "yes", { phrase: d.replace(/[.!?]+$/, "") }); });
        // похожее, но поправленное предложение — ищем замену слова или оборота
        if (best && bs >= 0.5 && norm(best) !== k) { var dsp = diffSpan(d, best); if (dsp) scs.forEach(function (sc) { bump(rep, dsp.from + "→" + dsp.to, sc, "yes", { from: dsp.from, to: dsp.to }); }); }
      });
      // своё предложение, которого не было в черновике
      A.forEach(function (a) { var k = norm(a); if (!k || D.some(function (d) { return close(a, d) >= 0.5; })) return; scs.forEach(function (sc) { bump(add, k, sc, "yes", { phrase: a.replace(/[.!?]+$/, "") }); }); });
    });
    // второй проход: заменяемое слово осталось нетронутым в другом ответе — довод против правила замены
    var repC = Object.keys(rep).filter(function (rk) { return rep[rk].yes >= 2; });
    if (repC.length) ids.forEach(function (id) {
      var e = kb[id]; if (!e || !s(e.draft).trim() || !s(e.answer).trim() || e.kind === "appeal") return;
      var scs = scopesOf(ctxOf(e)), nd = " " + norm(e.draft) + " ", na = " " + norm(e.answer) + " ";
      repC.forEach(function (rk) { var r = rep[rk]; if (scs.indexOf(r.scope) >= 0 && nd.indexOf(" " + r.from + " ") >= 0 && na.indexOf(" " + r.from + " ") >= 0) r.no++; });
    });
    var rules = [];
    /* где действует правило: «везде», если так было и в жалобах, и в благодарностях; если только в одной ситуации — только в ней;
       своя площадка — только когда в целом правило не складывается, а на этой площадке складывается */
    var pick = function (map, type) {
      var ok = function (r) { return r && r.yes >= 2 && r.yes / (r.yes + r.no) >= 0.6; }, by = {};
      Object.keys(map).forEach(function (mk) { var r = map[mk]; (by[r.k] = by[r.k] || {})[r.scope] = r; });
      Object.keys(by).forEach(function (k) {
        var g = by[k], all = g.all, neg = g["tone:neg"], pos = g["tone:pos"], chosen = [];
        if (ok(all)) {
          var oneTone = (neg && neg.yes === all.yes && !(pos && pos.yes)) ? neg : (pos && pos.yes === all.yes && !(neg && neg.yes)) ? pos : null;
          chosen.push(oneTone && ok(oneTone) ? oneTone : all);
        } else {
          [neg, pos].forEach(function (t) { if (ok(t)) chosen.push(t); });
          if (!chosen.length) Object.keys(g).forEach(function (sc) { if (sc.indexOf("pl:") === 0 && ok(g[sc])) chosen.push(g[sc]); });
        }
        chosen.forEach(function (r) { rules.push(Object.assign({ type: type, key: type + ":" + r.scope + ":" + r.k, removed: r.yes, kept: r.no, scopeName: SCOPE_NAME(r.scope) }, r)); });
      });
    };
    pick(rem, "remove"); pick(rep, "replace"); pick(add, "add");
    rules.sort(function (a, b) { return b.yes - a.yes; });
    cache = { key: key, vkey: vkey, rules: rules };
    return rules;
  }
  function inCtx(r, c) { if (r.scope === "all" || !c) return true; if (r.scope.indexOf("tone:") === 0) return r.scope === "tone:" + c.tone; return r.scope === "pl:" + c.platform; }
  function ctxNorm(c) { if (!c) return null; return { tone: c.tone === "negative" || c.tone === "neg" ? "neg" : "pos", platform: s(c.platform) }; }
  // отключено вами (и по старому ключу — до обучения шага 2 ключом была сама фраза)
  function off(r) { return !!disabled[r.key] || (r.type === "remove" && !!disabled[r.k]); }
  function active(c, type) { c = ctxNorm(c); return compute().filter(function (r) { return !off(r) && (!type || r.type === type) && inCtx(r, c); }); }
  // сколько изученных правил «убираете» нарушает текст (для шаблонов: такие варианты уходят вниз)
  function hits(text, c) { var n = norm(text); return active(c, "remove").filter(function (r) { return n.indexOf(r.k) >= 0; }); }
  // замены — как пишете вы: заменяется только целое слово или оборот, регистр первой буквы сохраняется
  function rewrite(text, c) {
    var t = s(text);
    active(c, "replace").forEach(function (r) {
      var src = r.from.split(" ").map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/е/g, "[её]"); }).join("[\\s\\u00a0]+");
      var re = new RegExp("(^|[^а-яёa-z0-9])(" + src + ")(?=$|[^а-яёa-z0-9])", "gi");
      t = t.replace(re, function (m, pre, w) { var to = r.to; if (w.charAt(0) !== w.charAt(0).toLowerCase()) to = to.charAt(0).toUpperCase() + to.slice(1); return pre + to; });
    });
    return t;
  }
  function bonus(text, c) { var n = norm(text); return active(c, "add").filter(function (r) { return n.indexOf(r.k) >= 0; }).length * 0.6; }
  window.__otvLearn = {
    rules: function () { return compute().map(function (r) { return Object.assign({ off: off(r) }, r); }); },
    active: function (c, type) { return active(c, type || "remove"); },
    replaces: function (c) { return active(c, "replace"); },
    favorites: function (c) { return active(c, "add"); },
    penalty: function (text, c) { return hits(text, c).length * 5 - bonus(text, c); },
    hits: hits, rewrite: rewrite, ctxOf: ctxOf,
    setDisabled: function (key, off) {
      if (off) disabled[key] = 1; else { delete disabled[key]; var r0 = compute().filter(function (r) { return r.key === key; })[0]; if (r0) delete disabled[r0.k]; }
      return window.claude.use("db").then(function (db) { return db.collection("settings").doc("learn").set({ disabled: Object.keys(disabled), at: new Date().toISOString() }); });
    }
  };
  if (window.claude && window.claude.use) window.claude.use("db").then(function (db) {
    if (!db) return;
    db.collection("settings").onSnapshot(function (sn) { sn.docs.forEach(function (x) { if (x.id === "learn") { disabled = {}; ((x.data() || {}).disabled || []).forEach(function (k) { disabled[k] = 1; }); } }); }, function () {});
  }).catch(function () {});
})();
