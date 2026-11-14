/* «Ответошная» — самоконтроль (04.11: «программа сама должна отслеживать, всё ли верно»).
   Программа сама проверяет: жалобы без ответа больше суток, ответы, которые ждут согласования, ответ на площадке
   не совпадает с согласованным, что требует отчёт недели, что ждёт презентация закрытой недели, сохранение данных.
   Наверху — одна отметка: «✓ Всё в порядке» или «⚠ N — что сделать»; по нажатию — список с переходом. Ничего лишнего. */
(function () {
  "use strict";
  function s(x) { return x == null ? "" : String(x); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function norm(t) { return s(t).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/g, " ").trim(); }
  function all(name) { var f = window.__otvAllRO || window.__otvAll; return (f && f(name)) || {}; }
  function ageDays(d) {
    d = s(d); var m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(d), t = m ? Date.parse(m[3] + "-" + m[2] + "-" + m[1] + "T12:00:00+03:00") : Date.parse(d);
    return isNaN(t) ? 0 : (Date.now() - t) / 864e5;
  }
  var WAIT = /^(new|pending|check)$/;
  // тот же ли это ответ: без приветствия (площадки склеивают строки — приветствие бывает в одной строке с текстом),
  // без подписи и разницы в пробелах, кавычках, тире; площадка может обрезать длинный ответ — сравниваем начало
  function replyCore(t) {
    return norm(s(t).replace(/^\s*Здравствуйте[^!.\n]{0,60}[!.\n]?/, "").replace(/С уважением[\s\S]*$/, "").replace(/[«»"„“”'’]/g, "").replace(/[—–-]/g, " ")).replace(/\s+/g, " ").trim();
  }
  function sameReply(a, b) {
    var x = replyCore(a), y = replyCore(b); if (!x || !y) return true;
    var n = Math.min(60, x.length, y.length);
    return x.slice(0, n) === y.slice(0, n);
  }
  function issues() {
    var out = [], A = all("answers"), G = window.__otvGen, negOld = 0, posOld = 0, diff = [];
    Object.keys(A).forEach(function (id) {
      var a = A[id]; if (!a) return;
      if (WAIT.test(s(a.status)) && s(a.review).trim()) {
        var tone = ""; try { tone = G && G.toneOf ? G.toneOf(a) : ""; } catch (e) {}
        var age = ageDays(a.date);
        if (tone === "negative" && age >= 1) negOld++; else if (age >= 3) posOld++;
      }
      if (a.status === "published" && s(a.answer).trim()) {   // на площадке другой текст, чем согласованный
        var r = window.__otvGet ? window.__otvGet("registry", id) : null;
        if (r && s(r.reply).trim() && !sameReply(r.reply, a.answer)) diff.push(a.platform + (a.author ? ", " + a.author : ""));
      }
    });
    // 14.11: «чтобы любой человек мог сделать эту работу» — отметка наверху говорит и про обычные шаги: что не прочитано,
    // что ждёт решения, что согласовано, но не опубликовано, что не опубликовалось
    var R0 = window.__otvReports, todo0 = R0 && R0.lastTodo ? R0.lastTodo() : [];
    // «Не прочитано» и кнопка «Войти» — строкой под «Собрать отзывы»; в отметке «что сделать» не повторяем (14.11: «дубли»)
    var fresh = { pos: 0, neg: 0, qa: 0 }, agreed = 0, pubErr = 0, errTab = "pos";
    Object.keys(A).forEach(function (id) {
      var a = A[id]; if (!a || !s(a.review).trim() || a.kind === "appeal") return;
      if (WAIT.test(s(a.status))) { var tn = ""; try { tn = G && G.toneOf ? G.toneOf(a) : ""; } catch (e) {} fresh[a.kind === "question" ? "qa" : tn === "negative" ? "neg" : "pos"]++; }
      var canPub = /^(ПроДокторов|Яндекс|2ГИС|ДокТу|Google|НаПоправку)$/.test(s(a.platform));   // остальное (почта, книга отзывов) программа не публикует
      if (a.status === "approved" && canPub && s(a.publishError)) { pubErr++; try { if (G && G.toneOf && G.toneOf(a) === "negative") errTab = "neg"; } catch (e) {} } else if (a.status === "approved" && canPub) agreed++;
    });
    if (fresh.neg) out.push({ text: "Жалобы ждут ответа: " + fresh.neg, tab: "neg" });
    if (fresh.pos) out.push({ text: "Отзывы ждут ответа: " + fresh.pos + " — прочитайте ответ и нажмите «Согласовать»", tab: "pos" });
    if (fresh.qa) out.push({ text: "Вопросы ждут ответа: " + fresh.qa, tab: "qa" });
    if (pubErr) out.push({ text: "Ответ не опубликовался: " + pubErr + " — причина написана на карточке", tab: errTab });
    if (agreed) out.push({ text: "Согласовано, но не опубликовано: " + agreed + " — откройте «Согласовано» и нажмите «Опубликовать»", tab: "pos" });
    if (negOld) out.push({ text: "Жалобы без ответа больше суток: " + negOld, tab: "neg" });
    if (posOld) out.push({ text: "Ответы ждут согласования больше 3 дней: " + posOld, tab: "pos" });
    // список сотрудников за текущий месяц: по нему в ответах и отчётах имена и отделения
    var SS = window.__otvReports && window.__otvReports.staffStatus ? window.__otvReports.staffStatus() : null;
    if (SS && (SS.stale || SS.empty)) out.push({ text: "Список сотрудников: " + (SS.empty ? "пустой" : "нет вкладки «" + SS.want + "», в работе «" + SS.tab + "»") + " — добавьте новую вкладку в таблицу «[ГКБ24] Список врачей» и нажмите «Обновить список»", tab: "check" });
    if (diff.length) out.push({ text: "На площадке текст ответа не совпадает с согласованным: " + diff.slice(0, 3).join("; ") + (diff.length > 3 ? " и ещё " + (diff.length - 3) : ""), tab: "pos" });
    var R = window.__otvReports; if (R && R.lastTodo) R.lastTodo().forEach(function (t) { out.push({ text: "Отчёт: " + t, tab: "check" }); });
    // презентация закрытой недели (четверг после 15:00 и позже) ждёт решений
    var U = window.__otvDeckUi, msk = new Date(Date.now() + 3 * 3600e3), dow = msk.getUTCDay(), hr = msk.getUTCHours();
    if (U && U._state && (dow === 4 && hr >= 15 || dow === 5)) { try { var st = U._state(), n = st && st.res && st.res.need ? st.res.need.length : 0; if (n) out.push({ text: "Презентация недели: нужно ваше решение — " + n, tab: "deckw" }); } catch (e) {} }
    // вопросы без справки: программе нечем ответить по существу — добавьте факт
    var FX = window.__otvFacts, qNo = 0;
    if (FX && FX.forQuestion) Object.keys(A).forEach(function (id) { var a = A[id]; if (a && a.kind === "question" && WAIT.test(s(a.status)) && !FX.forQuestion(s(a.review), 1).length) qNo++; });
    if (qNo) out.push({ text: "Вопросы без справки: " + qNo + " — программе нечем ответить по существу. Добавьте факт в «Базе ответов» → «Справка для ответов на вопросы»", tab: "qa" });
    // разнообразие: доля разных фраз в последних 30 ответах (черновики и опубликованные)
    var V = variety(A); if (V && V.n >= 10 && V.share < 0.5) out.push({ text: "Ответы стали однообразными: разных фраз " + Math.round(V.share * 100) + "%. Возьмите новые формулировки от модели или загрузите свои ответы", tab: "pos" });
    // сбои программы за двое суток — из журнала
    if (jErr.length) out.push({ text: "Сбои программы за двое суток: " + jErr.length + " (последний: " + jErr[jErr.length - 1].slice(0, 120) + "). Сохраните журнал и пришлите мне", tab: "", act: ["Сохранить журнал", function () { return window.__otvSaveJournal && window.__otvSaveJournal(); }] });
    if (window.__otvSaveErr) out.push({ text: "Данные не сохраняются: " + window.__otvSaveErr + " — программа повторяет сама; если не пройдёт, перезапустите программу", tab: "" });
    return out;
  }
  function variety(A) {
    var list = Object.keys(A).map(function (k) { return A[k]; }).filter(function (a) { return a && s(a.answer).trim() && a.kind !== "appeal" && /^(pending|approved|fix|published)$/.test(s(a.status)); })
      .sort(function (a, b) { return s(b.publishedAt || b.createdAt || b.date).localeCompare(s(a.publishedAt || a.createdAt || a.date)); }).slice(0, 30);
    var sents = [];
    list.forEach(function (a) { (s(a.answer).replace(/^\s*Здравствуйте[^\n]*\n/, "").replace(/С уважением[\s\S]*$/, "").match(/[^.!?]+[.!?]*/g) || []).forEach(function (x) { x = norm(x); if (x.length > 12 && !/^(желаем здоровья|пожалуйста напишите|напишите пожалуйста)/.test(x)) sents.push(x); }); });
    if (!sents.length) return null;
    var u = {}; sents.forEach(function (x) { u[x] = 1; });
    return { n: list.length, share: Object.keys(u).length / sents.length };
  }
  // журнал: сбои за двое суток (вылеты, внутренние ошибки, ошибки страницы)
  var jErr = [], jAt = 0;
  function scanJournal() {
    if (!window.__otvReadJournal || Date.now() - jAt < 5 * 60 * 1000) return;
    jAt = Date.now();
    window.__otvReadJournal().then(function (txt) {
      var cut = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10) + " " + new Date(Date.now() - 2 * 864e5).toISOString().slice(11, 19);
      jErr = s(txt).split("\n").filter(function (l) { return l.slice(0, 19) >= cut && /ВЫЛЕТ|ВНУТРЕННЯЯ ОШИБКА|ЧЁРНЫЙ ЭКРАН|ошибка страницы/.test(l); }).map(function (l) { return l.slice(24); });
      paint();
    }, function () {});
  }
  var chip, pop, timer = 0, last = [];
  function paint() {
    if (!chip) return;
    last = issues();
    chip.className = "ctrl-chip " + (last.length ? "warn" : "ok");
    chip.textContent = last.length ? "⚠ Что сделать: " + last.length : "✓ Всё в порядке";
    chip.title = last.length ? last.map(function (i) { return i.text; }).join("\n") : "Программа проверила ответы, отчёт, презентацию и сохранение данных";
    if (pop && !pop.hidden) fill();
  }
  function fill() {
    pop.textContent = "";
    if (!last.length) { pop.append(el("p", "hint", "Всё в порядке: ответы, отчёт недели, презентация и сохранение данных проверены.")); return; }
    var ul = el("ul", "ctrl-list");
    last.forEach(function (i) {
      var li = el("li", null, i.text);
      if (i.act) { var ab = el("button", "link", i.act[0]); ab.type = "button"; ab.addEventListener("click", function () { Promise.resolve(i.act[1]()).then(function () { ab.textContent = "Готово: в «Загрузках»"; }, function () { ab.textContent = "Не получилось"; }); }); li.append(" ", ab); }
      if (i.tab) { var b = el("button", "link", "Открыть"); b.type = "button"; b.addEventListener("click", function () { pop.hidden = true; if (window.__otvShowTab) window.__otvShowTab(i.tab); }); li.append(" ", b); }
      ul.append(li);
    });
    pop.append(ul);
  }
  function soon() { clearTimeout(timer); timer = setTimeout(paint, 1500); }
  function start() {
    var nav = document.getElementById("tabs"); if (!nav) return;
    var wrap = el("div", "ctrl"); chip = el("button", "ctrl-chip ok", "✓ Всё в порядке"); chip.type = "button"; chip.id = "ctrlChip";
    pop = el("div", "ctrl-pop"); pop.id = "ctrlPop"; pop.hidden = true;
    chip.addEventListener("click", function () { pop.hidden = !pop.hidden; if (!pop.hidden) fill(); });
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) pop.hidden = true; });
    wrap.append(chip, pop);
    var h1 = document.querySelector("h1.brand");   // отметка — в строке с названием программы, справа
    if (h1) { h1.classList.add("has-ctrl"); h1.append(wrap); } else nav.parentNode.insertBefore(wrap, nav);
    window.addEventListener("otv-write", soon);
    setInterval(function () { scanJournal(); paint(); }, 5 * 60 * 1000);
    setTimeout(function () { scanJournal(); paint(); }, 3000);
  }
  window.__otvControl = { _same: sameReply,  issues: issues, refresh: paint, variety: function () { return variety(all("answers")); }, _journal: function (lines) { jErr = lines; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
