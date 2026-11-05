/* «Ответошная» — сборщик ответов из частей.
   Ответ складывается по разбору отзыва (речевая аналитика): вступление → (сотрудники, их ставит программа) →
   середина → ответ на жалобу или вопрос → концовка. В каждой части — несколько формулировок по Ильяхову и
   по правилам справочника (без извинений, без «клиники», без пересказа отзыва, без оценки своих врачей).
   Сотни сочетаний → ответы не повторяются; что вы оставляете или пролистываете, запоминается по каждой фразе. */
(function () {
  "use strict";
  function s(x) { return x == null ? "" : String(x); }
  var MAIL = "gkb24@zdrav.mos.ru", ECC = "8-495-685-17-94";

  /* ---------- банки фраз: [id, текст, условие?] ---------- */
  var B = {
    pOpen: [
      ["po1", "Спасибо за отзыв и тёплые слова."], ["po2", "Спасибо, что нашли время написать нам."], ["po3", "Благодарим за отзыв."],
      ["po4", "Спасибо за добрые слова."], ["po5", "Спасибо, что поделились впечатлениями."], ["po6", "Благодарим вас за тёплый отзыв."],
      ["po7", "Спасибо за такой подробный отзыв.", function (c) { return c.len > 300; }],
      ["po8", "Спасибо за высокую оценку.", function (c) { return c.rating >= 5; }],
      ["po9", "Спасибо, что написали о своём опыте."], ["po10", "Спасибо за такую высокую оценку.", function (c) { return c.rating >= 5; }]
    ],
    pMid: [
      ["pm1", "Для команды такие слова важны."], ["pm2", "Такие отзывы поддерживают сотрудников в работе."],
      ["pm3", "Ваши слова — лучшая поддержка для команды."], ["pm4", "Такие письма напоминают, ради чего мы работаем."],
      ["pm5", "Приятно знать, что всё прошло хорошо."], ["pm6", "Сотрудникам будет приятно прочитать ваш отзыв.", function (c) { return c.type !== "doctor"; }],
      ["pm7", "Нам радостно читать такие слова."],
      // её собственные формулировки (из базы ответов и чата «Ответы на отзывы»)
      ["pm8", "Мы стараемся, чтобы пациентам было у нас комфортно."], ["pm9", "Ценим ваше доверие и всегда готовы помочь."],
      ["pm10", "Важно и приятно получать такие отзывы.", function (c) { return c.len > 250 && c.type !== "doctor"; }],
      ["pm11", "Рады, что вам у нас понравилось.", function (c) { return c.len <= 160 && c.type !== "doctor"; }]
    ],
    dOpen: [
      ["do1", "Спасибо за отзыв."], ["do2", "Спасибо, что нашли время написать отзыв."], ["do3", "Благодарим за тёплые слова."],
      ["do4", "Спасибо за высокую оценку.", function (c) { return c.rating >= 5; }], ["do5", "Спасибо, что поделились впечатлениями о приёме."]
    ],
    dMid: [["dm1", "Такие отзывы важны для нас."], ["dm2", "Приятно читать такие слова."], ["dm3", "Ваш отзыв поможет другим пациентам с выбором."]],
    close: [["cl1", "Желаем здоровья и всего самого доброго."]],
    nOpen: [
      ["no1", "Спасибо, что рассказали о произошедшем."], ["no2", "Благодарим, что сообщили нам о ситуации."],
      ["no3", "Спасибо, что написали нам об этом."], ["no4", "Благодарим за обратную связь."]
    ],
    nEmp: [["ne1", "Понимаем, что ситуация вас огорчила."], ["ne2", "Понимаем ваши чувства."]],
    nConcern: [
      ["nc1", "Ситуация требует внимательного рассмотрения."], ["nc2", "Нас обеспокоило то, что вы описали."],
      ["nc3", "Мы хотим разобраться в том, что произошло."], ["nc4", "Нам важно разобраться в этой ситуации."]
    ],
    nAsk: [
      ["na1", "Пожалуйста, напишите нам на " + MAIL + ": укажите ФИО, дату и контактный телефон."],
      ["na2", "Напишите, пожалуйста, на " + MAIL + " и укажите ФИО, дату обращения и телефон для связи."],
      ["na3", "Чтобы мы могли разобраться, напишите на " + MAIL + ": ФИО, дату и телефон."]
    ],
    nPromise: [
      ["np1", "Мы свяжемся с ответственными подразделениями и после проверки вернёмся к вам."],
      ["np2", "Передадим обращение ответственным подразделениям, а после проверки свяжемся с вами."],
      ["np3", "После проверки мы ответим вам и предложим, что делать дальше."]
    ],
    // смешанный: сначала благодарность за обратную связь и добрые слова о сотрудниках, потом жалоба (правило базы обучения)
    mOpen: [
      ["mo1", "Спасибо за обратную связь и добрые слова о сотрудниках — обязательно передадим их."],
      ["mo2", "Спасибо за добрые слова о наших коллегах, передадим их."],
      ["mo3", "Спасибо, что написали, и за тёплые слова о сотрудниках — мы их передадим."]
    ],
    mTurn: [["mu1", "Вместе с тем то, что вы описали, требует внимательного рассмотрения."], ["mu2", "А в ситуации, о которой вы пишете, мы хотим разобраться."], ["mu3", "Замечания, о которых вы пишете, мы тоже не оставим без внимания."]],
    qOpen: [["qo1", "Спасибо за вопрос."], ["qo2", "Благодарим за обращение."], ["qo3", "Спасибо, что написали нам."]],
    qEcc: [
      ["qe1", "Подробно ответить и записать вас смогут в Едином контактном центре: " + ECC + "."],
      ["qe2", "Уточнить подробности и записаться можно в Едином контактном центре по телефону " + ECC + "."]
    ],
    qMail: [["qm1", "Если удобнее письменно, напишите на " + MAIL + " — ответим."], ["qm2", "Письменно — на " + MAIL + "."]]
  };
  // ваши фразы из ответов (обучение на правках) — в те же места ответа, с большим весом
  var MINE = { pOpen: ["pos", "open"], pMid: ["pos", "mid"], dOpen: ["pos", "open"], dMid: ["pos", "mid"], close: ["pos", "close"], nOpen: ["neg", "nOpen"], nConcern: ["neg", "concern"], nAsk: ["neg", "ask"], nPromise: ["neg", "promise"] };
  function hid(t) { var h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return "u" + (h >>> 0).toString(36); }
  function bank(name, c) {
    var arr = B[name].filter(function (x) { return !x[2] || x[2](c); }).map(function (x) { return { id: x[0], text: x[1], w: 1 }; });
    var L = window.__otvLearn, m = MINE[name];
    if (L && L.myPhrases && m && !(c.type === "doctor" && /mid/i.test(name) && false)) L.myPhrases(m[0], m[1]).forEach(function (p) {
      if (c.type === "doctor" && /передад|больниц|стационар|отделени|наш\S* сотрудник/i.test(p.text)) return;   // правило страницы врача
      if (arr.some(function (x) { return x.text.toLowerCase() === p.text.toLowerCase(); })) return;
      arr.push({ id: hid(p.text), text: p.text, w: 2.5 + Math.min(3, p.n) * 0.7 + (p.mine ? 1.5 : 0) });
    });
    // новые формулировки модели, которые вы согласовали (в «Базе ответов»)
    if (m) { var PH = ((window.__otvAllRO || window.__otvAll) && (window.__otvAllRO || window.__otvAll)("phrases")) || {};
      Object.keys(PH).forEach(function (k) { var p = PH[k]; if (!p || p.status !== "approved" || p.tone !== m[0] || p.slot !== m[1]) return;
        if (c.type === "doctor" && /передад|больниц|стационар|отделени|наш\S* сотрудник/i.test(p.text)) return;
        if (!arr.some(function (x) { return x.text.toLowerCase() === p.text.toLowerCase(); })) arr.push({ id: k, text: p.text, w: 1.3 }); }); }
    // ваш стиль: любимое первое слово вступления — чаще
    var st = L && L.style ? L.style() : null, fav = st && st.open[0] && st.open[0].n >= 3 ? st.open[0].word : "";
    if (fav && /Open$/.test(name)) arr.forEach(function (x) { if (x.text.toLowerCase().replace(/ё/g, "е").indexOf(fav) === 0) x.w *= 2; });
    // середина под тему отзыва (разбор): «команда» — сотрудникам будет приятно; «забота», «условия» — стараемся, чтобы было комфортно;
    // подробный — «важно и приятно получать такие отзывы»; короткий — «рады, что вам у нас понравилось»
    if (name === "pMid" || name === "dMid") {
      var T = c.themes || [], pref = {};
      if (T.indexOf("медсёстры и команда") >= 0) { pref.pm6 = 4; pref.pm2 = 3; pref.pm3 = 3; }
      if (T.indexOf("внимание и забота") >= 0 || T.indexOf("условия, питание") >= 0) pref.pm8 = 3;
      if (c.len > 300) pref.pm10 = 3;
      if (c.len <= 120) pref.pm11 = 3;
      arr.forEach(function (x) { if (pref[x.id]) x.w *= pref[x.id]; });
    }
    var G = window.__otvGen; if (G && G.learnedOf) arr.forEach(function (x) { x.w *= Math.exp(Math.max(-2, Math.min(2, G.learnedOf("cs:" + x.id)))); });
    return arr;
  }
  function pickOne(name, c, rnd) {
    var a = bank(name, c); if (!a.length) return null;
    var sum = a.reduce(function (t, x) { return t + x.w; }, 0), r = rnd() * sum;
    for (var i = 0; i < a.length; i++) { r -= a[i].w; if (r <= 0) return [a[i].id, a[i].text]; }
    var z = a[a.length - 1]; return [z.id, z.text];
  }
  function rng(seed) { var x = seed || 1; return function () { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; }; }

  // один вариант по ситуации; parts — id фраз (по ним учимся)
  function one(c, rnd) {
    var parts = [], add = function (bank) { var p = pickOne(bank, c, rnd); if (p) parts.push(p); };
    if (c.type === "question") {
      add("qOpen");
      (c.facts || []).slice(0, rnd() < 0.5 ? 2 : 1).forEach(function (f) { parts.push([f.id, f.text]); });   // факты из справки — по смыслу вопроса
      if (!(c.facts || []).length || rnd() < 0.5) add("qEcc");
      if (rnd() < 0.6) add("qMail");
    }
    else if (c.tone === "negative") {
      if (c.mixed && c.type !== "doctor") { add("mOpen"); add("mTurn"); }
      else { add("nOpen"); if (c.emotion >= 2) add("nEmp"); add("nConcern"); }
      add("nAsk"); add("nPromise");
    } else if (c.type === "doctor") {
      add("dOpen"); if (c.len > 120 && rnd() < 0.7) add("dMid"); add("close");
    } else {
      // длина — по вашему стилю: обычно сколько предложений в ваших ответах на благодарности
      var L = window.__otvLearn, st = L && L.style ? L.style() : null, want = st && st.total >= 5 ? st.posLen : 0;
      var mids = want ? Math.max(0, Math.min(2, want - 2 + (c.len > 400 ? 1 : 0) - (c.len < 80 ? 1 : 0))) : c.len > 400 ? 1 : c.len > 120 ? (rnd() < 0.6 ? 1 : 0) : (rnd() < 0.4 ? 1 : 0);   // на короткий — иногда «Рады, что вам у нас понравилось»
      add("pOpen"); for (var mi = 0; mi < mids; mi++) add("pMid"); add("close");
    }
    return { key: "cmp:" + c.tone + ":" + parts.map(function (p) { return p[0]; }).join("."), parts: parts.map(function (p) { return p[0]; }), text: parts.map(function (p) { return p[1]; }).join(" ") };
  }
  // повтор слова (первые 4 буквы) в одной фразе или в соседних — как в проверке текста карточки; плюс одно слово (6 букв) в любых двух фразах
  var FUNC = /^(что|чтобы|это|этот|эта|эти|этого|ваш|ваше|вашей|вашу|ваши|ваших|наш|наше|нашей|нашу|наши|наших|нам|нас|вам|вас|всего|всегда|всё|все|очень|было|были|быть|себя|свой|своё|свою|свои|которые|который)$/;
  var FREE = /^(gkb24|zdrav)/;
  function k4(w) { w = w.toLowerCase().replace(/ё/g, "е"); if (/^так(ой|ая|ое|ие|ую|им|их|ими|ого|ому)$/.test(w)) return "такой"; return w.length >= 4 ? w.slice(0, 4) : null; }
  function repeats(text) {
    var S = s(text).split(/[.!?]+\s+/).filter(Boolean).map(function (x) {
      return (x.match(/[А-Яа-яЁё]+/g) || []).filter(function (w) { return !FUNC.test(w.toLowerCase()); }).map(k4).filter(Boolean);
    });
    for (var i = 0; i < S.length; i++) {
      var seen = {};
      for (var a = 0; a < S[i].length; a++) { if (seen[S[i][a]]) return true; seen[S[i][a]] = 1; }
      if (i + 1 < S.length) for (var b = 0; b < S[i + 1].length; b++) if (seen[S[i + 1][b]]) return true;
    }
    var all = {}, bad = false;
    (text.match(/[^.!?]+[.!?]*/g) || []).forEach(function (x, i) {
      var here = {};
      (x.toLowerCase().replace(/ё/g, "е").match(/[а-яa-z0-9]{6,}/g) || []).forEach(function (w) { var k = w.slice(0, 6); if (FREE.test(k) || here[k]) return; here[k] = 1; if (all[k] != null && all[k] !== i) bad = true; all[k] = i; });
    });
    return bad;
  }
  // несколько разных вариантов для отзыва
  function variants(it, info, n) {
    var SP = window.__otvSpeech, a = SP ? SP.analyze(s(it.review)) : { tone: "", emotion: 0 };
    var F = info.type === "question" && window.__otvFacts ? window.__otvFacts.forQuestion(s(it.review), 3) : [];
    var c = { themes: (a && a.posThemes) || [], facts: F, tone: info.tone, type: info.type, mixed: a.tone === "mixed", emotion: a.emotion || 0, len: s(it.review).length, rating: Number(it.rating) || 0 };
    var rnd = rng(Math.floor(Math.random() * 2147483646) + 1), out = [], seen = {};
    for (var i = 0; i < (n || 10) * 4 && out.length < (n || 10); i++) { var v = one(c, rnd); if (seen[v.key] || repeats(v.text)) continue; seen[v.key] = 1; out.push(v); }
    return out;
  }
  window.__otvCompose = { variants: variants, banks: B, repeats: repeats };
})();
