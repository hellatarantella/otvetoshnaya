/* «Ответошная» — встроенная модель (Qwen3 4B, llama.cpp) прямо на этом компьютере.
   Скачивается один раз (около 2,5 ГБ), работает без интернета; тексты никуда не уходят.
   Пишет варианты для «↻ Ещё вариант»: правила справочника + лучшие образцы из вашей базы ответов
   (то, что вы согласовали и исправили, — в первую очередь). Итог проходит ту же проверку правил,
   что и шаблоны; если модель ошиблась — вариант берётся из шаблонов.
   Вкладка «Ответы → Модель»: скачать, включить, проверка вслепую. */
(function () {
  "use strict";
  if (!window.__OTV_APP) return;
  var T = window.__TAURI__, invoke = T && T.core && T.core.invoke;
  if (!invoke) return;
  var SIGN = "С уважением, администрация 24 Московской больницы";
  var SIZE = "2,5 ГБ";
  function s(v) { return v == null ? "" : String(v); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function gb(b) { return (b / 1e9).toFixed(1).replace(".", ",") + " ГБ"; }

  /* ---------- состояние ---------- */
  var st = { installed: false, server: false, running: false, bytes: 0, download: {}, enabled: false, exam: null, busy: false };
  var db = null;
  function refresh() {
    return invoke("model_status").then(function (r) {
      r = r || {};
      st.installed = !!r.installed; st.server = !!r.server; st.running = !!r.running; st.bytes = r.bytes || 0; st.download = r.download || {};
      render(); return st;
    }, function () { return st; });
  }
  function saveSettings() {
    if (db) db.collection("settings").doc("model").set({ enabled: st.enabled, exam: st.exam || null, updatedAt: new Date().toISOString() }).catch(function () {});
  }
  window.claude.use("db").then(function (d) {
    db = d;
    return db.collection("settings").doc("model").get();
  }).then(function (snap) {
    if (snap && snap.exists) { var v = snap.data() || {}; st.enabled = !!v.enabled; st.exam = v.exam || null; }
    render();
  }).catch(function () {});
  try { T.event.listen("model-progress", function () { refresh(); }); } catch (e) {}
  refresh();

  /* ---------- запрос к модели ---------- */
  function ref(id) { var n = document.getElementById(id); return n ? n.textContent.trim() : ""; }
  function styleRules() {
    // правила справочника без пункта о подписи (подпись и приветствие ставит программа)
    return ref("ref-style").replace(/^1\.[^\n]*\n/m, "").replace(/\n{3,}/g, "\n\n");
  }
  var COMMON = "Мы — больница: не пиши «клиника» и «медицинский центр». Не пересказывай, что именно понравилось или не понравилось пациенту (еда, чистота, парковка, вежливость, обследования), — пиши общими словами. ";
  function situationRules(tone, type) {
    if (type === "question") return "ЭТО ВОПРОС. Отвечай только по фактам выше и по образцам. Ничего не выдумывай: телефоны, сроки, имена, порядок. " +
      "Если фактов не хватает — дай номер Единого контактного центра 8-495-685-17-94 и почту gkb24@zdrav.mos.ru. Не пересказывай вопрос.";
    if (tone === "negative") return "ЭТО ЖАЛОБА. Поблагодари за обратную связь. Не спорь, не оправдывайся, не извиняйся и не пиши «сожалеем». " +
      "Не пересказывай жалобу и не обещай наказаний. Предложи разобраться: попроси написать на gkb24@zdrav.mos.ru, указав дату и отделение. 2–3 предложения.";
    var r = "ЭТО БЛАГОДАРНОСТЬ. Короткий отзыв — короткий ответ, подробный — развёрнутый и тёплый, но сдержанный. Концовка: «Желаем здоровья и всего самого доброго.»";
    if (type === "doctor") r += " Отзыв на странице ВРАЧА: ничего «не передаём», врача по имени не называем, о больнице и стационаре не пишем, слова отзыва себе не присваиваем.";
    else r += " Если в отзыве назван врач по имени и отчеству, можно написать, что передадим ему благодарность (так, как он назван в отзыве) и команде отделения.";
    return r;
  }
  function itemOf(req) {
    return { platform: s(req.platform), page: s(req.page), author: s(req.author), review: s(req.review), rating: req.rating,
      tone: req.tone, kind: req.kind === "question" ? "question" : "", kbId: req.kbId || "" };
  }
  function bodyOf(text) {
    return s(text).replace(/\r/g, "").split("\n").map(function (l) { return l.trim(); }).filter(function (l) {
      return l && !/^Здравствуйте/i.test(l) && l.replace(/\.$/, "") !== SIGN;
    }).join(" ");
  }
  function messagesFor(req) {
    var G = window.__otvGen, it = itemOf(req), ex = G.examples(it, 4);
    var sys = "Ты пишешь ответы на отзывы и вопросы пациентов от имени администрации ГКБ №24 (24 Московская больница).\n" +
      "Пиши только основной текст ответа по-русски: 1–4 предложения, без приветствия и без подписи — их добавит программа. Только текст ответа, без пояснений и кавычек.\n\n" +
      styleRules() + "\n\n" + COMMON + situationRules(ex.tone, ex.type);
    if (ex.list.length) {
      sys += "\n\nОБРАЗЦЫ, КОТОРЫЕ СОТРУДНИЦА СОГЛАСОВАЛА (повторяй стиль, длину и тон, но не копируй дословно):\n" +
        ex.list.map(function (e) { return (e.situation ? "Отзыв: «" + e.situation.slice(0, 300) + "»\nОтвет: " : "— ") + e.body; }).join("\n");
    }
    var where = [s(req.platform), s(req.page)].filter(Boolean).join(", ");
    var r = Number(req.rating);
    var user = (req.kind === "question" ? "Вопрос" : "Отзыв") + (where ? " (" + where + (req.rating != null && req.rating !== "" && !isNaN(r) ? ", оценка " + r + " из 5" : "") + ")" : "") +
      (req.author ? ", автор: " + s(req.author) : "") + ":\n«" + s(req.review).slice(0, 1500) + "»";
    var cur = bodyOf(req.current);
    if (cur) user += "\n\nЭтот вариант уже есть, напиши другой, своими словами:\n" + cur;
    user += "\n\nНапиши ответ.";
    return { messages: [{ role: "system", content: sys }, { role: "user", content: user }], it: it, tone: ex.tone, type: ex.type };
  }
  var PHONES = ["84956851794", "84956136310"], MAILS = ["gkb24@zdrav.mos.ru", "gkb24-pmu@zdrav.mos.ru"];
  function valid(t) {
    if (t.length < 40 || t.length > 1400) return false;
    if (/<|>|\bthink\b/i.test(t)) return false;
    var rest = t.replace(/\S+@\S+|https?:\/\/\S+/g, "");
    if (/[a-z]{4,}/i.test(rest)) return false;                                       // латиница — сбой модели
    var phones = (t.match(/\+?\d[\d\s()\-]{8,}\d/g) || []).map(function (x) { return x.replace(/\D/g, "").replace(/^7/, "8"); });
    if (phones.some(function (p) { return !PHONES.some(function (a) { return p.indexOf(a) === 0; }); })) return false; // выдуманный телефон
    var mails = t.match(/[\w.+-]+@[\w.-]+\w/g) || [];
    if (mails.some(function (m) { return MAILS.indexOf(m.toLowerCase()) < 0; })) return false;
    return true;
  }
  function same(a, b) {
    var w = function (x) { var o = {}; s(x).toLowerCase().replace(/ё/g, "е").split(/[^а-яa-z0-9]+/).forEach(function (y) { if (y.length > 3) o[y.slice(0, 6)] = 1; }); return o; };
    var A = w(a), B = w(b), n = 0, u = 0, k;
    for (k in A) { u++; if (B[k]) n++; } for (k in B) if (!A[k]) u++;
    return u ? n / u > 0.8 : true;
  }
  function generate(messages, temperature) {
    return invoke("model_generate", { messages: messages, maxTokens: 360, temperature: temperature });
  }
  function write(req) {
    if (!window.__otvGen || req.kind === "appeal") return Promise.resolve(null);
    var m = messagesFor(req);
    var tryOnce = function (temp) {
      return generate(m.messages, temp).then(function (out) {
        var t = bodyOf(s(out).replace(/<think>[\s\S]*?<\/think>/g, "")).replace(/^[«"]+|[»"]+$/g, "").trim();
        if (!valid(t)) return null;
        var p = window.__otvGen.polish(t, m.it);
        if (!p || bodyOf(p).length < 40) return null;
        if (req.current && same(bodyOf(p), bodyOf(req.current))) return null;          // тот же вариант — не годится
        return p;
      });
    };
    st.running = true; render();
    return tryOnce(0.7).then(function (r) { return r || tryOnce(0.5); }).then(function (r) { refresh(); return r; }, function (e) { refresh(); throw e; });
  }
  // модель пишет варианты, только если проверка вслепую показала «не хуже» хотя бы в 60% (не меньше 10 отзывов)
  var PASS = 0.6;
  function passed() { var r = st.exam; return !!(r && r.n >= 10 && (r.model + r.tie) / r.n >= PASS); }
  window.__otvModel = {
    ready: function () { return st.installed && st.server && st.enabled && passed(); },
    passed: passed,
    write: function (req) { return write(req); },
    state: function () { return st; }
  };

  /* ---------- проверка вслепую ---------- */
  var exam = null; // {items:[{req, mine, model, swap, pick}], i, n}
  function examPool() {
    var kb = (window.__otvAll && window.__otvAll("kb")) || {};
    var out = Object.keys(kb).map(function (k) { var e = kb[k]; e.id = k; return e; }).filter(function (e) {
      return e.kind === "review" && (e.status === "published" || e.status === "approved") && s(e.situation).trim().length > 25 && bodyOf(e.answer).length > 40;
    });
    for (var i = out.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = out[i]; out[i] = out[j]; out[j] = x; }
    return out;
  }
  function reqOfKb(e) {
    var m = /^Здравствуйте,\s*([^!.\n]+)[!.]/.exec(s(e.answer));
    var neg = window.__otvGen && window.__otvGen.NEG_ANS.test(s(e.answer));
    return { kind: "answer", platform: s(e.platform), page: s(e.page), review: s(e.situation), author: m ? m[1].trim() : "", tone: neg ? "negative" : "positive", kbId: e.id };
  }
  function startExam(n) {
    var list = examPool().slice(0, n);
    if (!list.length) { examMsg = "В базе пока нет опубликованных ответов на отзывы. Проверять не на чем."; render(); return; }
    exam = { items: list.map(function (e) { return { req: reqOfKb(e), mine: s(e.answer), model: null, failed: false, swap: Math.random() < 0.5, pick: null }; }), i: 0 };
    examMsg = ""; render(); pump();
  }
  var pumping = false;
  function pump() { // пишет ответы модели заранее, по одному
    if (pumping || !exam) return;
    var next = exam.items.filter(function (x) { return x.model == null && !x.failed; })[0];
    if (!next) return;
    pumping = true;
    write(next.req).then(function (t) { if (t) next.model = t; else next.failed = true; }, function () { next.failed = true; })
      .then(function () { pumping = false; render(); pump(); });
  }
  function finishExam() {
    var done = exam.items.filter(function (x) { return x.pick; });
    var res = { at: new Date().toISOString(), n: done.length, model: 0, mine: 0, tie: 0, bad: 0 };
    done.forEach(function (x) { res[x.pick]++; });
    st.exam = res; exam = null; saveSettings(); render();
  }
  function examLine(r) {
    if (!r || !r.n) return "";
    var ok = r.model + r.tie;
    return "Проверка " + new Date(r.at).toLocaleDateString("ru-RU") + ": модель не хуже ваших ответов в " + ok + " из " + r.n +
      " (" + Math.round(ok * 100 / r.n) + "%). Лучше модель: " + r.model + ", лучше ваш: " + r.mine + ", одинаково: " + r.tie + (r.bad ? ", оба плохие: " + r.bad : "") + ".";
  }

  /* ---------- вкладка «Модель» ---------- */
  var examMsg = "";
  function render() {
    var box = document.getElementById("modelBox"); if (!box) return;
    box.textContent = "";
    var top = el("div", "card");
    top.append(el("h2", null, "Встроенная модель"));
    top.append(el("p", "meta", "Пишет варианты ответов прямо на этом компьютере, без интернета: по правилам справочника и по вашим согласованным ответам. Чем больше ответов в базе, тем точнее."));
    var line = el("p", "mdl-st"), act = el("div", "actions");
    var d = st.download || {};
    if (!st.server) {
      line.textContent = "В этой версии программы модели нет. Она появится после обновления.";
    } else if (d.active) {
      line.textContent = "Скачивается: " + (d.total ? gb(d.done) + " из " + gb(d.total) + " (" + Math.round(d.done * 100 / d.total) + "%)" : "начинаю…") + ". Можно работать дальше.";
      var pr = el("progress", "mdl-pr"); pr.max = d.total || 1; pr.value = d.done || 0; top.append(pr);
    } else if (!st.installed) {
      line.textContent = d.error ? "Не скачалась: " + d.error : "Не скачана · " + SIZE + ".";
      var dl = el("button", "btn primary pawbtn", d.error ? "Скачать ещё раз" : "Скачать модель"); dl.type = "button";
      dl.addEventListener("click", function () { dl.disabled = true; invoke("model_download").then(function () { setTimeout(refresh, 600); }, function (e) { st.download = { error: s(e) }; render(); }); });
      act.append(dl);
    } else {
      line.textContent = "Готова · " + gb(st.bytes) + (st.running ? " · работает" : "") + ".";
      top.append(line);
      if (passed()) {
        var tg = el("label", "mdl-tg"), cb = el("input"); cb.type = "checkbox"; cb.checked = st.enabled;
        cb.addEventListener("change", function () { st.enabled = cb.checked; saveSettings(); render(); });
        tg.append(cb, document.createTextNode(" «Ещё вариант» пишет модель"));
        top.append(tg);
        top.append(el("p", "meta", st.enabled ? "Если модель ошибётся или задумается дольше 12 секунд, вариант возьмётся из шаблонов и базы ответов." : "Сейчас варианты берутся из шаблонов и базы ответов, мгновенно."));
      } else {
        top.append(el("p", "meta", "Варианты сейчас берутся из шаблонов и базы ответов, мгновенно. Модель подключится к «Ещё вариант», когда проверка вслепую покажет «не хуже» хотя бы в 60% ответов" +
          (st.exam && st.exam.n ? " (сейчас " + Math.round((st.exam.model + st.exam.tie) * 100 / st.exam.n) + "%)" : "") + "."));
      }
      var del = el("button", "btn ghost", "Удалить модель"); del.type = "button";
      del.addEventListener("click", function () {
        if (del.dataset.armed !== "1") { del.dataset.armed = "1"; del.textContent = "Точно удалить?"; setTimeout(function () { del.dataset.armed = ""; del.textContent = "Удалить модель"; }, 4000); return; }
        st.enabled = false; saveSettings(); invoke("model_delete").then(refresh, refresh);
      });
      act.append(del);
      top.append(act); box.append(top);
      box.append(examCard());
      return;
    }
    top.append(line); if (act.childNodes.length) top.append(act);
    box.append(top);
  }
  function examCard() {
    var c = el("div", "card");
    c.append(el("h2", null, "Проверка вслепую"));
    if (!exam) {
      c.append(el("p", "meta", "Модель пишет ответы на отзывы из вашей базы, а вы сравниваете их с вашими опубликованными ответами, не зная, где чей. Включайте модель, если она не хуже."));
      if (st.exam) c.append(el("p", "mdl-st", examLine(st.exam)));
      if (examMsg) c.append(el("p", "mdl-st err", examMsg));
      var a = el("div", "actions");
      var go = el("button", "btn primary", st.exam ? "Проверить ещё раз · 20 отзывов" : "Начать · 20 отзывов"); go.type = "button";
      go.addEventListener("click", function () { startExam(20); });
      a.append(go); c.append(a);
      return c;
    }
    var items = exam.items, it = items[exam.i];
    var answered = items.filter(function (x) { return x.pick; }).length;
    c.append(el("p", "meta", "Отзыв " + (exam.i + 1) + " из " + items.length + " · оценено: " + answered));
    var rv = el("blockquote", "review"); rv.textContent = it.req.review; c.append(rv);
    if (it.model == null && !it.failed) {
      c.append(el("p", "mdl-st", "Модель пишет ответ… (первый раз дольше: модель загружается)"));
    } else if (it.failed) {
      c.append(el("p", "mdl-st err", "Модель не справилась с этим отзывом. Он засчитан как «лучше ваш»."));
      if (!it.pick) it.pick = "mine";
    } else {
      var A = it.swap ? it.model : it.mine, B = it.swap ? it.mine : it.model;
      [["А", A], ["Б", B]].forEach(function (p) {
        var b = el("div", "mdl-ans"); b.append(el("div", "label", "Ответ " + p[0])); b.append(el("div", "rev", p[1])); c.append(b);
      });
      var row = el("div", "actions");
      [["Лучше А", it.swap ? "model" : "mine"], ["Лучше Б", it.swap ? "mine" : "model"], ["Одинаково хорошо", "tie"], ["Оба плохие", "bad"]].forEach(function (o) {
        var b = el("button", "btn" + (it.pick === o[1] ? " primary" : ""), o[0]); b.type = "button";
        b.addEventListener("click", function () { it.pick = o[1]; if (exam.i < items.length - 1) exam.i++; render(); });
        row.append(b);
      });
      c.append(row);
    }
    var nav = el("div", "actions");
    var prev = el("button", "btn ghost", "← Назад"); prev.type = "button"; prev.disabled = exam.i === 0;
    prev.addEventListener("click", function () { exam.i--; render(); });
    var next = el("button", "btn ghost", "Дальше →"); next.type = "button"; next.disabled = exam.i >= items.length - 1;
    next.addEventListener("click", function () { exam.i++; render(); });
    var fin = el("button", "btn", answered ? "Закончить и посчитать" : "Отменить"); fin.type = "button";
    fin.addEventListener("click", function () { if (answered) finishExam(); else { exam = null; render(); } });
    nav.append(prev, next, fin); c.append(nav);
    return c;
  }
  window.addEventListener("otv-tab", function () { if (document.getElementById("modelBox")) refresh(); });
  document.addEventListener("DOMContentLoaded", render);
})();
