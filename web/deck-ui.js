/* Вкладка «Презентации → Неделя»: презентация собирается в программе, без онлайн-сервиса.
   Порядок: данные недели → проверка цифр → что подтвердить (фото, цитаты, отзыв недели) → предпросмотр с правкой текста → PDF и PPTX.
   Выгрузка закрыта, пока не подтверждено всё нужное и вёрстка не прошла самопроверку. */
(function () {
  "use strict";
  var DK = function () { return window.__otvDeck; };
  /* Общая основа вкладок «Неделя» и «Месяц»: подтверждения, фото, правка на слайде, самопроверка, подгонка, PDF и PPTX
     одинаковые; различаются только данные (K.list, K.build) и слайды (K.slides) */
  function makeDeckUi(K) {
  var openReview = false, db = null, root = null, weekSel = null, cur = null, res = null, fonts = null, photos = {}, picks = {}, snaps = {}, busy = false, fontFaces = false;
  function s(x) { return x == null ? "" : String(x); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(text, cls, fn) { var b = el("button", "btn" + (cls ? " " + cls : ""), text); b.type = "button"; b.addEventListener("click", fn); return b; }
  function log(m) { if (window.__otvLog) window.__otvLog("презентация: " + m); }
  // фото отделения хранится крупно (4:3): слайд сам обрезает его под вертикальную или горизонтальную ячейку
  var KIND_SIZE = { face: [600, 600], tall: [960, 1350], dept: [1400, 1050], cover: [1920, 1080], end: [1920, 1080], mcover: [1920, 1080], mend: [1920, 1080] };
  // постоянные фото (обложка, закрывающий слайд недели и месяца): по умолчанию — из утверждённых презентаций
  var FIXED = { cover: "coverDefault", end: "endDefault", mcover: "monthCoverDefault", mend: "monthEndDefault" };
  function isFixed(kind) { return !!FIXED[kind]; }
  // обложка и закрывающий слайд постоянные (загружены один раз, можно заменить); фото отделений — по названию отделения, копятся в библиотеке

  /* ---------- данные ---------- */
  function weeks() { return K.list(snaps); }
  function photoKey(k, kind) { return kind + "|" + k; }
  function photoOf(k, kind, slot) {
    var p = photos[photoKey(k, kind)];
    // обложка и закрывающий слайд — фото утверждённых презентаций (как раньше); своё ставится только кнопкой «Заменить»
    if (isFixed(kind)) {
      if (p && p.override) return { src: p.src, pos: "center center" };
      var A = window.__otvDeckAssets || {}, d = A[FIXED[kind]];
      return d ? { src: d, pos: "center center" } : null;
    }
    return p ? { src: p.src, pos: "center center" } : null;
  }
  function pickId() { return K.pickId ? K.pickId(cur) : cur.data.start; }
  function pickDoc() { return cur ? (picks[pickId()] || {}) : {}; }
  // каждое нажатие даёт видимый ответ: «Сохранено…» или причину (29.10: казалось, что кнопки не работают)
  function bar(t, kind) { if (window.__otvBar) window.__otvBar.show(t, kind || "", [["Закрыть", window.__otvBar.hide]]); }
  // запрос и его ключ: по нему после пересборки находим ту же строку (или видим, что запрос закрыт)
  function needKey(n) { return n.kind + ":" + s(n.short || n.field || n.who || n.slot || ""); }
  // ответ на нажатие — прямо в строке, где нажали (05.11: «нажимаю подтвердить — ниче не меняется, выглядит глючно»)
  function rowMsg(row, text, kind) {
    if (!row) return; var m = row.querySelector(".deck-need-msg");
    if (!m) { m = el("p", "deck-need-msg"); row.append(m); }
    m.className = "deck-need-msg " + (kind || ""); m.textContent = text;
  }
  function fail(row, text) { rowMsg(row, "⚠ " + text, "bad"); bar(text, "err"); if (row) { row.classList.remove("is-shake"); void row.offsetWidth; row.classList.add("is-shake"); } }
  var fx = null;   // что показать после пересборки: какие слайды изменились и что сохранено
  function savePick(row, patch, msg) {
    if (row && !(row instanceof Element)) { msg = patch; patch = row; row = null; }
    if (!cur) { fail(row, "Не выбран период презентации"); return Promise.resolve(); }
    var id = pickId(), d = Object.assign({}, picks[id] || {}, patch, { at: new Date().toISOString() });
    if (row) { row.classList.add("is-saving"); [].forEach.call(row.querySelectorAll("button,input,select"), function (x) { x.disabled = true; }); rowMsg(row, "Сохраняю и пересобираю слайды…", "busy"); }
    var pv = root && root.querySelector(".deck-preview"); if (pv) pv.classList.add("is-busy");
    var prev = slides.slice(), key = row ? row.dataset.k : "";
    // даём экрану показать «Сохраняю…» до тяжёлой пересборки
    return new Promise(function (ok) { setTimeout(ok, 30); }).then(function () {
      picks[id] = d;
      return db.collection("deckPicks").doc(id).set(d);
    }).then(function () {
      fx = { prev: prev, key: key, msg: msg || "Сохранено", until: Date.now() + 4000 };
      rebuild(); bar((msg || "Сохранено") + ". Презентация пересобрана", "ok");
    }).catch(function (e) {
      log("решение не сохранилось: " + (e && e.stack || e));
      if (row) { row.classList.remove("is-saving"); [].forEach.call(row.querySelectorAll("button,input,select"), function (x) { x.disabled = false; }); }
      if (pv) pv.classList.remove("is-busy");
      fail(row, "Не сохранилось: " + (e && e.message || e) + ". Журнал записан");
    });
  }
  // после пересборки: строка «✓ Сохранено» на месте закрытого запроса, подсветка изменившихся слайдов
  function showFx(pv) {
    // держим отметку 4 с: пересборка по событию базы сразу после сохранения не должна её стереть
    var f = fx; if (!f || !root) return; if (Date.now() > f.until) { fx = null; return; }
    var changed = []; slides.forEach(function (h, i) { if (f.prev[i] !== h) changed.push(i); });
    var frames = pv ? pv.querySelectorAll(".deck-slide") : [];
    changed.forEach(function (i) { var fr = frames[i]; if (fr) { fr.classList.add("just-changed"); setTimeout(function () { fr.classList.remove("just-changed"); }, 2600); } });
    var still = f.key && [].filter.call(root.querySelectorAll(".deck-need"), function (r) { return r.dataset.k === f.key; });
    var nums = changed.map(function (i) { return i + 1; });
    var tail = nums.length ? (nums.length === 1 ? " · обновился слайд " + nums[0] : " · обновились слайды " + nums.join(", ")) : " · так и стоит на слайдах";
    if (still && still.length) { still.forEach(function (r) { rowMsg(r, "✓ " + f.msg + tail, "ok"); r.classList.add("just-saved"); }); }
    var box = root.querySelector(".deck-needs"); if (!box) return;
    var done = el("div", "deck-done"); done.append(el("span", null, "✓ " + f.msg + tail));
    if (nums.length && frames[changed[0]]) done.append(btn("Показать", "", function () { frames[changed[0]].scrollIntoView({ behavior: "smooth", block: "center" }); frames[changed[0]].classList.add("just-changed"); setTimeout(function () { frames[changed[0]].classList.remove("just-changed"); }, 2600); }));
    var h = box.querySelector("h3"); h.after(done);
    setTimeout(function () { done.classList.add("fade"); }, 6000);
  }
  // фраза до сохранения: объём и законченность. Не подходит — сразу говорим, что не так (раньше молча заменялась прежней)
  function quoteProblem(v, band) {
    if (!v) return "впишите или выберите цитату";
    if (band && (v.length < band[0] || v.length > band[1])) return v.length + " знаков, нужно " + band[0] + "–" + band[1];
    if (band && DK().okQuote && !DK().okQuote(v, band)) return "фраза обрывочная: нужно законченное предложение от 6 слов";
    return "";
  }
  // цитата из отзыва, который уже стоит в другом блоке, программа не примет — говорим сразу, а не молча
  function usedProblem(v, used) {
    var k = s(v).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/g, " ").trim().slice(0, 30);
    return k && (used || []).some(function (u) { return u.indexOf(k) >= 0; }) ? "этот отзыв уже стоит в другом блоке презентации (повторять нельзя) — выберите другую цитату или впишите свою" : "";
  }
  function person(tok) { return window.__otvReports && window.__otvReports.person ? window.__otvReports.person(tok) : null; }

  /* ---------- шрифт ---------- */
  function b64ToFace(name, b64) { var f = new FontFace(name, "url(data:font/ttf;base64," + b64 + ")"); return f.load().then(function (x) { document.fonts.add(x); }); }
  function useFonts() {
    if (!fonts || !fonts.regular || !fonts.bold || fontFaces) return Promise.resolve();
    fontFaces = true;
    return Promise.all([b64ToFace("Cera Round", fonts.regular), b64ToFace("Cera Round Bold", fonts.bold)]).catch(function (e) { fontFaces = false; log("шрифт не загрузился: " + e); });
  }
  function readB64(file) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(",")[1]); }; r.onerror = rej; r.readAsDataURL(file); }); }

  /* ---------- сборка ---------- */
  var rbTimer = null, rbDirty = false;
  function visible() { var p = document.getElementById("tab-" + K.tab); return !!(p && !p.hidden && p.offsetParent !== null && !document.hidden); }
  // пересборка по событиям данных: только когда вкладка открыта, и пачкой (несколько событий подряд — одна пересборка)
  function rebuildSoon() { if (!visible()) { rbDirty = true; return; } clearTimeout(rbTimer); rbTimer = setTimeout(rebuild, 300); }
  function rebuild() {
    if (!root) return;
    clearTimeout(rbTimer); rbDirty = false; rebuild.count = (rebuild.count || 0) + 1;
    var ws = weeks(); if (!ws.length) { paintEmpty(); return; }
    if (!cur || !ws.some(function (w) { return w.key === cur.key; })) cur = ws.filter(function (w) { return w.def; })[0] || ws[0]; else cur = ws.filter(function (w) { return w.key === cur.key; })[0];
    try { res = K.build(cur.data, snaps, { person: person, photoOf: photoOf, pick: pickDoc() }); }
    catch (e) { res = null; log("не собралась: " + (e && e.stack || e)); }
    try { paint(ws); } catch (e) { log("отрисовка: " + (e && e.stack || e)); root.append(el("p", "ctl-st err", "Ошибка отрисовки презентации: " + (e && e.message || e) + ". Журнал записан")); }
  }
  function paintEmpty() { root.textContent = ""; root.append(el("p", "hint", K.empty)); }

  function paint(ws) {
    root.textContent = "";
    var top = el("div", "ctl"), acts = el("div", "actions");
    weekSel = el("select", "btn"); weekSel.setAttribute("aria-label", K.selLabel);
    ws.forEach(function (w) { var o = el("option", null, w.label); o.value = w.key; if (cur && w.key === cur.key) o.selected = true; weekSel.append(o); });
    weekSel.addEventListener("change", function () { cur = ws.filter(function (w) { return w.key === weekSel.value; })[0]; rebuild(); });
    // «Обновить презентацию»: перечитать отчёт из Google и пересобрать слайды со всеми текущими решениями и фото
    var bRef = btn("Обновить презентацию", "primary", function () {
      var r = window.__otvReports, t0 = Date.now(); bRef.disabled = true; bRef.textContent = "Обновляю…"; bar("Перечитываю отчёт из Google и пересобираю презентацию…");
      var slow = new Promise(function (ok) { setTimeout(function () { ok("slow"); }, 30000); });
      Promise.race([(r && r.refresh ? r.refresh() : Promise.resolve()).then(function () { return "ok"; }, function (e) { log("обновление: " + (e && e.message || e)); return "err"; }), slow]).then(function (how) {
        rebuild();
        bar(how === "ok" ? "Презентация обновлена: свежий отчёт из Google, все решения и фото на месте" : how === "slow" ? "Google не ответил за 30 секунд — пересобрала по последним данным" : "Отчёт из Google не перечитался — пересобрала по последним данным. Журнал записан", how === "ok" ? "ok" : "err");
        log("обновление презентации: " + how + ", " + Math.round((Date.now() - t0) / 1000) + " с");
      });
    });
    acts.append(weekSel, bRef);
    top.append(acts); root.append(top);
    if (!res) { root.append(el("p", "ctl-st err", "Не удалось собрать презентацию. Журнал записан.")); return; }

    // шрифт
    if (!fonts || !fonts.regular || !fonts.bold) root.append(fontBox());
    // проверки
    var chk = el("div", "deck-box"); chk.append(el("h3", null, "Цифры и сверка с отчётом"));
    var ul = el("ul", "deck-checks");
    res.checks.forEach(function (c) { var li = el("li", c.bad ? "bad" : "ok", (c.bad ? "⚠ " : "✓ ") + c.text); ul.append(li); });
    chk.append(ul); root.append(chk);
    // что подтвердить
    var need = res.need;
    var nb = el("div", "deck-box deck-needs"); nb.append(el("h3", null, need.length ? "Нужно ваше решение: " + need.length : "Всё подтверждено"));
    need.forEach(function (n) { nb.append(needRow(n)); });
    if (!need.length) nb.append(el("p", "hint", "Текст на слайдах можно поправить прямо в предпросмотре: нажмите на текст."));
    nb.append(extraRow());
    root.append(nb);
    // предпросмотр
    var pv = el("div", "deck-preview"); root.append(pv);
    var issuesBox = el("div", "deck-box"); root.append(issuesBox);
    var exp = el("div", "ctl"), ea = el("div", "actions"), st = el("p", "ctl-st"); st.hidden = true;
    var bPdf = btn("Скачать PDF", "primary", function () { exportAs("pdf", st); }), bPpt = btn("Скачать PPTX", "", function () { exportAs("pptx", st); });
    ea.append(bPdf, bPpt); exp.append(ea, st); root.insertBefore(exp, chk);
    // пост в канал: текст по отчёту недели и обложка картинкой — готовы сами, без ручного сбора
    if (res.D && res.D.post) {
      var pb = el("details", "ctl deck-post"); pb.append(el("summary", null, "Пост в канал: текст и визуал"));
      var pt = el("textarea", "deck-post-t"); pt.value = res.D.post; pt.rows = Math.min(22, res.D.post.split("\n").length + 1); pt.setAttribute("aria-label", "Текст поста");
      var pst = el("p", "ctl-st"); pst.hidden = true;
      var copyB = btn("Скопировать текст", "primary", function () {
        var done = function () { pst.hidden = false; pst.className = "ctl-st ok"; pst.textContent = "Текст скопирован"; };
        try { (navigator.clipboard ? navigator.clipboard.writeText(pt.value) : Promise.reject()).then(done, function () { pt.select(); document.execCommand("copy"); done(); }); } catch (e) { pt.select(); document.execCommand("copy"); done(); }
      });
      var pngB = btn("Скачать визуал (PNG)", "", function () { exportCover(pst); });
      var pa = el("div", "actions"); pa.append(copyB, pngB);
      pb.append(pt, pa, pst); root.insertBefore(pb, chk);
    }
    useFonts().then(function () { renderPreview(pv, issuesBox, [bPdf, bPpt], need.length || res.checks.some(function (c) { return c.bad; }) || !fonts); });
  }

  function fontBox() {
    var b = el("div", "deck-box warn");
    b.append(el("h3", null, "Шрифт презентации: Cera Round"));
    b.append(el("p", "hint", "Один раз загрузите два файла шрифта: обычный и жирный (.ttf). Они хранятся только в программе на этом компьютере."));
    var r = el("input"); r.type = "file"; r.accept = ".ttf,font/ttf"; r.setAttribute("aria-label", "Cera Round обычный");
    var bo = el("input"); bo.type = "file"; bo.accept = ".ttf,font/ttf"; bo.setAttribute("aria-label", "Cera Round Bold");
    var msg = el("span", "hint");
    b.append(el("span", "hint", "Обычный: "), r, el("span", "hint", " Жирный: "), bo, btn("Сохранить шрифт", "primary", function () {
      var a = r.files && r.files[0], c = bo.files && bo.files[0];
      if (!a || !c) { msg.textContent = "Выберите оба файла."; return; }
      Promise.all([readB64(a), readB64(c)]).then(function (x) {
        fonts = { regular: x[0], bold: x[1], names: [a.name, c.name], at: new Date().toISOString() }; fontFaces = false;
        return db.collection("settings").doc("deckFonts").set(fonts);
      }).then(rebuild, function (e) { msg.textContent = "Не сохранилось: " + e; });
    }), msg);
    return b;
  }

  /* ---------- решения пользователя ---------- */
  function needRow(n) {
    var row = el("div", "deck-need"); row.dataset.k = needKey(n); row.append(el("p", null, n.text));
    if (n.kind === "photo") {
      var kind = KIND_SIZE[n.slot] ? n.slot : n.tall ? "tall" : "face";
      row.append(photoPicker(n.who, kind));
      if (kind === "face") row.append(btn("Фото нет: перенести в строку «Ещё…»", "", function () { var g = Object.assign({}, pickDoc().gold || {}); g[n.short] = "rest"; savePick(row, { gold: g }); }));
    } else if (n.kind === "quote") {
      var qp = quotePicker(n.options, n.current, n.band, "Цитата");
      row.append(qp.box, btn("Подтвердить цитату", "primary", function () { var v = qp.value(), bad = quoteProblem(v, n.band) || usedProblem(v, n.used) || (n.stale ? n.stale(v) : ""); if (bad) { fail(row, "Цитата для " + n.short + " не принята: " + bad); return; } var q = Object.assign({}, pickDoc().quote || {}); q[n.short] = v; savePick(row, { quote: q, own: ownList(v, n.options) }, "Цитата для " + n.short + " сохранена"); }));
    } else if (n.kind === "review") {
      var list = el("div", "deck-opts"), chosen = null, rq = null, rqBox = el("div");
      var setQ = function (o, cur0) { rq = quotePicker(o.quotes && o.quotes.length ? o.quotes : [o.quote], cur0 || o.quote, n.band, "Цитата отзыва недели"); rqBox.textContent = ""; rqBox.append(rq.box); };
      (n.options || []).forEach(function (o, i) {
        var lab = el("label", "deck-opt"), rb = el("input"); rb.type = "radio"; rb.name = "rv" + (n.current ? "c" : ""); rb.value = o.key; if (n.current ? o.key === n.current : !i) { rb.checked = true; chosen = o; }
        rb.addEventListener("change", function () { chosen = o; setQ(o); });
        lab.append(rb, el("b", null, " " + o.short + " · " + o.platform + " · " + s(o.date)), el("span", null, " «" + o.quote + "»"));
        list.append(lab);
      });
      if (chosen) setQ(chosen);
      row.append(list, rqBox, btn("Выбрать отзыв недели", "primary", function () { if (!chosen) { fail(row, "Выберите отзыв недели"); return; } var v = rq.value() || chosen.quote, bad = quoteProblem(v, n.band); if (bad) { fail(row, "Цитата отзыва недели не принята: " + bad); return; } savePick(row, { review: chosen.key, own: ownList(v, chosen.quotes || [chosen.quote]), reviewText: Object.assign({}, pickDoc().reviewText || {}, { quote: v }) }, "Отзыв недели выбран"); }));
    } else if (n.kind === "choice") {
      // выбор одного из вариантов (например, как считать месяц) — сохраняется в решениях периода
      var box = el("div", "deck-opts"), val = n.current, nm = "ch" + Math.random().toString(36).slice(2, 7);
      (n.options || []).forEach(function (o) {
        var lab = el("label", "deck-opt"), rb = el("input"); rb.type = "radio"; rb.name = nm; rb.value = o.key; rb.checked = o.key === n.current;
        rb.addEventListener("change", function () { val = o.key; }); lab.append(rb, el("span", null, " " + o.label)); box.append(lab);
      });
      row.append(box, btn("Подтвердить", "primary", function () { var patch = {}; patch[n.field] = val; savePick(row, patch, "Сохранено: " + ((n.options || []).filter(function (o) { return o.key === val; })[0] || {}).label); }));
    } else if (n.kind === "voices") {
      // у каждого голоса — врач и выбор цитаты из его отзыва (или своя фраза)
      var opts = n.options || [], slots = [0, 1, 2].map(function (i) {
        var box = el("div", "deck-voice"), se = el("select", "btn"); se.setAttribute("aria-label", "Голос " + (i + 1));
        se.append(el("option", null, "— не ставить —"));
        var c0 = n.current ? n.current[i] : null, curShort = c0 && (c0.short || c0), qBox = el("div"), qp = null;
        opts.forEach(function (o, k) { var op = el("option", null, o.short + ": «" + o.quote + "»"); op.value = String(k); if (curShort ? (c0.key ? o.key === c0.key : o.short === curShort) : (!n.current && k === i)) op.selected = true; se.append(op); });
        var setQ = function (keep) { var o = opts[+se.value]; qBox.textContent = ""; qp = null; if (!o) return; qp = quotePicker(o.quotes && o.quotes.length ? o.quotes : [o.quote], keep && c0 && c0.quote || o.quote, n.band, "Цитата голоса " + (i + 1)); qBox.append(qp.box); };
        se.addEventListener("change", function () { setQ(false); }); setQ(true);
        box.append(el("b", null, "Голос " + (i + 1) + " "), se, qBox);
        return { box: box, get: function () { var o = opts[+se.value]; if (!o || !qp) return null; return { short: o.short, quote: qp.value() || o.quote, key: o.key, opts: o.quotes || [o.quote] }; } };
      });
      slots.forEach(function (x) { row.append(x.box); });
      row.append(btn("Подтвердить голоса", "primary", function () {
        var v = slots.map(function (x) { return x.get(); }).filter(Boolean), ownAll = (pickDoc().own || []).slice();
        v.forEach(function (x) { ownAll = ownList(x.quote, x.opts, ownAll); delete x.opts; });
        var bad = v.map(function (x, i) { var p = quoteProblem(x.quote, n.band); return p ? "голос " + (i + 1) + " (" + x.short + "): " + p : ""; }).filter(Boolean);
        if (bad.length) { fail(row, "Голоса не приняты: " + bad.join("; ")); return; }
        savePick(row, { voices: v, own: ownAll }, "Голоса недели сохранены");
      }));
    }
    return row;
  }
  // выбор цитаты: варианты из отзыва + правка вручную, счётчик объёма
  function quotePicker(options, current, band, label) {
    var box = el("div", "deck-qp"), sel = el("select", "btn"); sel.setAttribute("aria-label", label);
    var opts = (options || []).filter(Boolean).slice(); if (current && opts.indexOf(current) < 0) opts.unshift(current);
    opts.forEach(function (q) { var o = el("option", null, q); if (q === current) o.selected = true; sel.append(o); });
    var inp = el("input"); inp.type = "text"; inp.className = "deck-in"; inp.value = current || opts[0] || ""; inp.placeholder = "Цитата, сокращённая без изменения смысла"; inp.setAttribute("aria-label", label + ": текст");
    var cnt = el("span", "hint"), upd = function () { var L = inp.value.trim().length, b = band; cnt.textContent = L + " знаков" + (b ? (L < b[0] || L > b[1] ? " — нужно " + b[0] + "–" + b[1] : " ✓") : ""); cnt.className = "hint" + (b && (L < b[0] || L > b[1]) ? " bad" : ""); };
    sel.addEventListener("change", function () { inp.value = sel.value; upd(); }); inp.addEventListener("input", upd); upd();
    if (opts.length > 1) box.append(el("span", "hint", opts.length + " " + DK().plural(opts.length, "вариант", "варианта", "вариантов") + ": "));
    if (!opts.length) {   // нечего предложить: пустой выпадающий список не показываем, объясняем почему
      box.append(el("span", "hint bad", "Подходящих фраз нет: отзывы о враче уже стоят в других блоках или были в прошлых презентациях. Впишите цитату из отзыва этой недели или выберите для «Отзыва недели» другой отзыв."), inp, cnt);
      return { box: box, value: function () { return inp.value.trim(); } };
    }
    box.append(sel, inp, cnt);
    return { box: box, value: function () { return inp.value.trim(); } };
  }
  // своя фраза (не из предложенных) — программа не оценивает её по смыслу при перепроверке
  function ownList(v, options, base) { var o = (base || pickDoc().own || []).filter(function (x) { return x !== v; }); if (v && (options || []).indexOf(v) < 0) o.push(v); return o; }
  // всегда доступно: заменить фото и вернуть выбор
  function extraRow() {
    var d = el("details", "deck-extra"); d.append(el("summary", null, K.reviewTitle));
    d.open = !!openReview; d.addEventListener("toggle", function () { openReview = d.open; });
    var D = res.D;
    // всё, что уже выбрано, можно поменять: варианты показаны с текущим выбором
    (res.choices || []).forEach(function (c) { d.append(needRow(c)); });
    d.append(el("h3", null, "Фото"));
    K.photos(D, fioOf).forEach(function (x) { d.append(el("p", null, x[0]), photoPicker(x[1], x[2])); });
    d.append(btn(K.resetText, "", function () { if (!cur) return; var id = pickId(); picks[id] = {}; db.collection("deckPicks").doc(id).delete().then(rebuild); }));
    return d;
  }
  function fioOf(short) { var x = (res.doctors || []).filter(function (d) { return d.short === short; })[0]; return x ? x.fio : short; }

  /* ---------- фото: загрузка и кадрирование ---------- */
  function photoPicker(key, kind) {
    var wrap = el("span", "deck-ph"), f = el("input"); f.type = "file"; f.accept = "image/jpeg,image/png,image/webp"; f.setAttribute("aria-label", "Фото: " + key);
    var have = isFixed(kind) ? photoOf(key, kind) : photos[photoKey(key, kind)];
    if (have) { var im = el("img"); im.src = have.src; im.alt = key; im.className = kind === "face" ? "round" : ""; wrap.append(im); }
    f.addEventListener("change", function () { var file = f.files && f.files[0]; if (file) cropDialog(file, kind, function (data) { savePhoto(key, kind, data); }); });
    wrap.append(f); return wrap;
  }
  function savePhoto(key, kind, data) {
    var id = photoKey(key, kind), doc = { key: key, kind: kind, week: "", src: data, at: new Date().toISOString(), override: isFixed(kind) };
    photos[id] = doc;
    return db.collection("deckPhotos").doc(id.replace(/[^\wа-яё-]+/gi, "_")).set(doc).then(rebuild);
  }
  function cropDialog(file, kind, done) {
    var size = KIND_SIZE[kind], url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var dlg = el("div", "deck-crop"), box = el("div", "deck-crop-in"), cv = el("canvas"), W = 480, H = Math.round(W * size[1] / size[0]);
      if (H > 600) { H = 600; W = Math.round(H * size[0] / size[1]); }
      cv.width = W; cv.height = H; cv.className = kind === "face" ? "round" : "";
      var base = Math.max(W / img.naturalWidth, H / img.naturalHeight), z = 1, cx = 0.5, cy = kind === "face" || kind === "tall" ? 0.35 : 0.5;
      var zoom = el("input"); zoom.type = "range"; zoom.min = "1"; zoom.max = "4"; zoom.step = "0.01"; zoom.value = "1"; zoom.setAttribute("aria-label", "Крупнее");
      function geom(w, h) { var sc = Math.max(w / img.naturalWidth, h / img.naturalHeight) * z, dw = img.naturalWidth * sc, dh = img.naturalHeight * sc; var x = Math.min(0, Math.max(w - dw, w / 2 - cx * dw)), y = Math.min(0, Math.max(h - dh, h / 2 - cy * dh)); return { x: x, y: y, w: dw, h: dh }; }
      function draw() { var g = cv.getContext("2d"), q = geom(W, H); g.clearRect(0, 0, W, H); g.drawImage(img, q.x, q.y, q.w, q.h); }
      var drag = null;
      cv.addEventListener("pointerdown", function (e) { drag = { x: e.clientX, y: e.clientY, cx: cx, cy: cy }; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener("pointermove", function (e) { if (!drag) return; var q = geom(W, H); cx = drag.cx - (e.clientX - drag.x) / q.w; cy = drag.cy - (e.clientY - drag.y) / q.h; cx = Math.max(0, Math.min(1, cx)); cy = Math.max(0, Math.min(1, cy)); draw(); });
      cv.addEventListener("pointerup", function () { drag = null; });
      zoom.addEventListener("input", function () { z = +zoom.value; draw(); });
      var hint = el("p", "hint", kind === "face" ? "Лицо в центре круга, одинакового размера с другими фото (двигайте фото, ползунок — крупнее)" : "Двигайте фото и выберите кадр");
      box.append(hint, cv, zoom, btn("Сохранить", "primary", function () {
        var out = el("canvas"); out.width = size[0]; out.height = size[1];
        var g = out.getContext("2d"), q = geom(size[0], size[1]);
        if (isFixed(kind)) {   // обложка: размытие и фирменный синий, как в утверждённом шаблоне; закрывающий — лёгкий синий тон
          var isCover = /cover$/.test(kind);
          g.filter = isCover ? "blur(6px)" : "none"; g.drawImage(img, q.x - 12, q.y - 12, q.w + 24, q.h + 24); g.filter = "none";
          g.fillStyle = isCover ? "rgba(30,46,70,0.72)" : "rgba(30,46,70,0.45)"; g.fillRect(0, 0, size[0], size[1]);
        } else g.drawImage(img, q.x, q.y, q.w, q.h);
        var data = out.toDataURL("image/jpeg", 0.86);
        URL.revokeObjectURL(url); dlg.remove(); done(data);
      }), btn("Отмена", "", function () { URL.revokeObjectURL(url); dlg.remove(); }));
      dlg.append(box); document.body.append(dlg); draw();
    };
    img.onerror = function () { URL.revokeObjectURL(url); alertBar("Это фото не открылось. Нужен JPG, PNG или WebP."); };
    img.src = url;
  }
  function alertBar(t) { if (window.__otvBar) window.__otvBar.show(t, "err", [["Закрыть", window.__otvBar.hide]]); }

  /* ---------- вставка слайдов ----------
     Окно программы (Tauri) дописывает в политику безопасности nonce, и стили, вставленные внутри HTML (style="…"), браузер
     отбрасывает (27.10: превью развалилось, выгрузка не работала). Поэтому стили переносим из HTML в элементы кодом (CSSOM) —
     так работает при любой политике безопасности */
  function setHtml(host, html) {
    var doc = new DOMParser().parseFromString("<!doctype html><html><body>" + html + "</body></html>", "text/html");
    [].forEach.call(doc.body.querySelectorAll("[style]"), function (e) { e.setAttribute("data-css", e.getAttribute("style")); e.removeAttribute("style"); });
    host.textContent = "";
    [].slice.call(doc.body.childNodes).forEach(function (n) { host.appendChild(document.importNode(n, true)); });
    [].forEach.call(host.querySelectorAll("[data-css]"), function (e) { e.style.cssText = e.getAttribute("data-css"); e.removeAttribute("data-css"); });
  }
  function cloneSec(sec) { var t = document.createElement("div"); setHtml(t, sec.outerHTML); return t.firstElementChild; }
  // стили слайда действительно применились (иначе слайд рассыпается, а выгрузка дала бы кривой файл)
  function styled(sec) { var t = sec.querySelector("h1,h2"); return !t || getComputedStyle(t).position === "absolute"; }
  // масштаб превью — из ширины окна (формула в CSS не работает в Safari)
  // наблюдатели размера снимаются при каждой пересборке: раньше копились и держали в памяти старые слайды с фото (вылеты, 03.11)
  var observers = [];
  function dropObservers() { observers.forEach(function (o) { try { o(); } catch (e) {} }); observers = []; }
  function fit(fr, inner) {
    var go = function () { var w = fr.clientWidth; if (w) inner.style.transform = "scale(" + (w / 1920) + ")"; };
    go();
    if (window.ResizeObserver) { var ro = new ResizeObserver(go); ro.observe(fr); observers.push(function () { ro.disconnect(); }); }
    else { window.addEventListener("resize", go); observers.push(function () { window.removeEventListener("resize", go); }); }
  }
  // правка слайда хранится без встроенных фото (раньше каждая правка копировала фото в данные — данные пухли)
  function lightHtml(h) { return String(h).replace(/(<img\b[^>]*?\bsrc=")data:[^"]*"/gi, '$1"'); }

  /* ---------- предпросмотр и самопроверка ---------- */
  var slides = [];
  function renderPreview(pv, issuesBox, buttons, blocked) {
    dropObservers(); pv.textContent = ""; slides = K.slides(res.D);
    var edits = (pickDoc().edits || {}), all = [];
    slides.forEach(function (h, i) {
      var fr = el("div", "deck-slide"), inner = el("div", "deck-slide-in"); fr.dataset.n = String(i + 1);
      setHtml(inner, h); fr.append(inner); pv.append(fr); fit(fr, inner);
      var sec = inner.firstElementChild, id = sec.id, saved = edits[id];
      var gen = [].filter.call(sec.querySelectorAll("p,h1,h2"), function (x) { return x.textContent.trim(); }).map(function (x) { return tnorm(x.textContent); });
      if (saved && saved.sig === sig(h)) {
        var srcs = [].map.call(sec.querySelectorAll("img"), function (im) { return im.getAttribute("src"); });
        setHtml(sec, saved.html);
        [].forEach.call(sec.querySelectorAll("img"), function (im, k) { if (!im.getAttribute("src") && srcs[k]) im.setAttribute("src", srcs[k]); });
      }
      editable(sec);
      /* 12.11: ваша правка текста держится за сам абзац (его исходный текст), а не за весь слайд: пересборка
         из-за новых данных отчёта (цифры, другие строки) её больше не стирает. Правка пропадает, только если
         программа поставила в это место другой текст (например, вы выбрали другую цитату) */
      var te = (pickDoc().tedits || {})[id] || [];
      (sec.__eds || []).forEach(function (t2, k) {
        t2.__orig = gen[k] != null ? gen[k] : tnorm(t2.textContent);
        var e2 = te.filter(function (x) { return x.o === t2.__orig; })[0];
        if (e2 && tnorm(t2.textContent) === t2.__orig && e2.t) { t2.textContent = e2.t; fixNb(t2); }
      });
      sec.addEventListener("focusout", function () {
        clean(sec);
        var e = Object.assign({}, pickDoc().edits || {}); e[id] = { sig: sig(h), html: lightHtml(sec.innerHTML) };
        var all2 = Object.assign({}, pickDoc().tedits || {}), eds2 = sec.__eds || [];
        var list = (all2[id] || []).filter(function (x) { return !eds2.some(function (t3) { return t3.__orig === x.o; }); });
        eds2.forEach(function (t3) { var now = t3.textContent.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim(); if (t3.__orig && tnorm(now) !== t3.__orig) list.push({ o: t3.__orig, t: now }); });
        all2[id] = list;
        savePickQuiet({ edits: e, tedits: all2 }); check();
      });
      all.push(sec);
    });
    try { showFx(pv); } catch (e) { log("отметка сохранения: " + e); }
    function check() {
      // самопроверка — на неуменьшенной копии слайда
      var issues = [], tmp = el("div", "deck-measure");
      document.body.append(tmp);
      all.forEach(function (sec, i) {
        tmp.textContent = ""; var c = cloneSec(sec); tmp.append(c);
        if (!styled(c)) { issues.push("Слайд " + (i + 1) + ": оформление слайда не применилось. Журнал записан"); log("слайд " + c.id + ": стили не применились"); return; }
        DK().layoutIssues(c).forEach(function (x) { issues.push("Слайд " + (i + 1) + ": " + x); });
      });
      tmp.remove();
      issuesBox.textContent = "";
      issuesBox.append(el("h3", null, issues.length ? "Вёрстка: нужно поправить" : "Вёрстка проверена: всё помещается"));
      issues.forEach(function (x) { issuesBox.append(el("p", "bad", "⚠ " + x)); });
      if (issues.length) issuesBox.append(el("p", "hint", "Сократите текст прямо на слайде или выберите другую цитату."));
      var dis = blocked || issues.length > 0;
      buttons.forEach(function (b) { b.disabled = dis; b.title = dis ? "Сначала подтвердите всё в «Нужно ваше решение» и уберите замечания по вёрстке" : ""; });
    }
    // подгонка — на неуменьшенной копии (в превью слайд уменьшен), результат переносим в превью
    // все слайды: «Отделения» — своя подгонка колонки, затем общее правило (текст ступенями до −20%, расположение то же)
    var fitAll = function () { all.forEach(function (sec) { var tmp = el("div", "deck-measure"); document.body.append(tmp); var c = cloneSec(sec); tmp.append(c); DK().fitSlide(c); DK().fitText(c); setHtml(sec, c.innerHTML); tmp.remove(); editable(sec); }); };
    Promise.all([].concat.apply([], all.map(function (sec) { return [].map.call(sec.querySelectorAll("img"), function (im) { return im.complete ? 0 : new Promise(function (r) { im.onload = im.onerror = r; }); }); }))).then(function () { return document.fonts.ready; }).then(function () { fitAll(); check(); }).catch(function (e) { log("предпросмотр: " + (e && e.stack || e)); issuesBox.textContent = ""; issuesBox.append(el("p", "bad", "Ошибка предпросмотра: " + (e && e.message || e) + ". Журнал записан")); });
  }
  /* правка прямо на слайде — только текст. Вставка из другого места приносила своё оформление (мелкий шрифт), Enter — новые
     блоки: часть цитаты становилась другого размера (28.10). Теперь вставляется простой текст, Enter завершает правку,
     а всё чужое, что всё же попало внутрь, при выходе из правки превращается в текст абзаца.
     Абзац становится редактируемым только на время правки (по щелчку): в окне программы (движок Safari) у редактируемого
     текста неразрывный пробел переносится как обычный — предлоги повисали в конце строки (28.10). После правки неразрывные
     пробелы после предлогов и союзов расставляются заново */
  function editable(sec) {
    var keep = [], eds = [];
    sec.querySelectorAll("p,h1,h2").forEach(function (t) {
      if (!t.textContent.trim()) return;
      eds.push(t); t.tabIndex = -1; t.classList.add("deck-ed");
      // сохранённая раньше правка могла принести чужое оформление — убираем его
      [].forEach.call(t.querySelectorAll("*"), function (x) { if (/^(DIV|P|FONT|H\d)$/.test(x.tagName) || /font-size|font-family|line-height/.test(x.getAttribute("style") || "") || x.style && (x.style.fontSize || x.style.fontFamily)) unwrap(x); });
      t.normalize(); fixNb(t);
      [].forEach.call(t.querySelectorAll("*"), function (x) { keep.push(x); });
      var on = function () { if (t.isContentEditable) return; t.contentEditable = "plaintext-only"; if (t.contentEditable !== "plaintext-only") t.contentEditable = "true"; t.spellcheck = false; };
      t.addEventListener("focus", on);
      t.addEventListener("click", function (e) {
        if (t.isContentEditable && document.activeElement === t && t.__caret) return;
        on(); t.focus(); t.__caret = 1;
        var r = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null;
        if (r && t.contains(r.startContainer)) { var sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); }
      });
      t.addEventListener("blur", function () { t.__caret = 0; t.removeAttribute("contenteditable"); });
      t.addEventListener("paste", function (e) { e.preventDefault(); var tx = ((e.clipboardData || window.clipboardData).getData("text/plain") || "").replace(/\s+/g, " "); document.execCommand("insertText", false, tx); });
      t.addEventListener("drop", function (e) { e.preventDefault(); });
      t.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); t.blur(); } });
    });
    sec.__keep = keep; sec.__eds = eds;
  }
  function fixNb(t) { var w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT), n, all = []; while ((n = w.nextNode())) all.push(n); all.forEach(function (x) { var v = DK().nbText(x.nodeValue); if (v !== x.nodeValue) x.nodeValue = v; }); }
  function unwrap(x) { if (!x.parentNode) return; x.parentNode.replaceChild(document.createTextNode((/^(BR|DIV|P)$/.test(x.tagName) ? " " : "") + x.textContent), x); }
  function clean(sec) {
    var keep = sec.__keep || [];
    (sec.__eds || []).forEach(function (t) {
      var bad = [].filter.call(t.querySelectorAll("*"), function (x) { return keep.indexOf(x) < 0; });
      bad.forEach(function (x) { if (t.contains(x)) unwrap(x); });
      t.normalize(); fixNb(t);
    });
  }
  function tnorm(x) { return String(x || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim(); }
  function sig(h) { var x = 0; for (var i = 0; i < h.length; i++) x = (x * 31 + h.charCodeAt(i)) | 0; return x; }
  function savePickQuiet(patch) { if (!cur) return; var id = pickId(); picks[id] = Object.assign({}, picks[id] || {}, patch); db.collection("deckPicks").doc(id).set(picks[id]).catch(function () {}); }

  // обложка недели картинкой для поста (как обложка презентации)
  function exportCover(st) {
    if (busy) return; busy = true; st.hidden = false; st.className = "ctl-st"; st.textContent = "Готовлю картинку…";
    var s0 = root.querySelector(".deck-slide-in > section"); if (!s0) { busy = false; st.textContent = "Нет обложки"; return; }
    var tmp = el("div", "deck-measure"); document.body.append(tmp); var sec = cloneSec(s0); tmp.append(sec);
    document.fonts.ready.then(function () { return DK().measure(sec); }).then(function (pr) { tmp.remove(); return DK().toPng(pr, fonts); })
      .then(function (blob) { var name = K.fileName(cur.data) + ".png"; return window.claude.use("downloads").then(function (dl) { return dl.save({ filename: name, data: blob }); }).then(function () { return name; }); })
      .then(function (n) { busy = false; st.className = "ctl-st ok"; st.textContent = "Сохранено в «Загрузки»: " + n; log("визуал поста " + n); },
        function (e) { busy = false; tmp.remove(); st.className = "ctl-st err"; st.textContent = "Не получилось: " + (e && e.message || e); });
  }
  /* ---------- выгрузка ---------- */
  function exportAs(kind, st) {
    if (busy) return; busy = true;
    st.hidden = false; st.className = "ctl-st"; st.textContent = kind === "pdf" ? "Готовлю PDF…" : "Готовлю PPTX…";
    var tmp = el("div", "deck-measure"); document.body.append(tmp);
    var secs = [].map.call(root.querySelectorAll(".deck-slide-in > section"), function (s0) { return cloneSec(s0); });   // только слайды этой вкладки
    var prims = [];
    secs.reduce(function (p, sec) { return p.then(function () {
      tmp.textContent = ""; tmp.append(sec); sec.querySelectorAll("[contenteditable]").forEach(function (x) { x.removeAttribute("contenteditable"); });
      if (!styled(sec)) throw new Error("оформление слайда «" + sec.id + "» не применилось");
      return DK().measure(sec).then(function (x) { prims.push(x); }); }); }, document.fonts.ready)
      .then(function () {
        tmp.remove();
        var name = K.fileName(cur.data);
        if (kind === "pdf") return { name: name + ".pdf", blob: DK().toPdf(prims, fonts).output("blob") };
        var notes = secs.map(function (sec) { return (res.D.notes || {})[sec.id] || ""; });
        return DK().toPptx(prims, notes).write({ outputType: "blob" }).then(function (b) { return { name: name + ".pptx", blob: b }; });
      })
      .then(function (f) { return window.claude.use("downloads").then(function (dl) { return dl.save({ filename: f.name, data: f.blob }); }).then(function () { return f; }); })
      .then(function (f) {
        busy = false; st.className = "ctl-st ok";
        st.textContent = "Сохранено в «Загрузки»: " + f.name + (kind === "pptx" ? ". В PowerPoint должны быть установлены шрифты Cera Round и Cera Round Bold" : "");
        log("выгружено " + f.name);
      }, function (e) { busy = false; tmp.remove(); st.className = "ctl-st err"; st.textContent = "Не получилось: " + (e && e.message || e); log("выгрузка: " + (e && e.stack || e)); });
  }

  /* ---------- запуск ---------- */
  function mount() {
    var panel = document.getElementById("tab-" + K.tab); if (!panel || root) return;
    [].forEach.call(panel.children, function (c) { c.hidden = true; });   // прежняя сборка через онлайн-сервис больше не нужна
    root = el("div", "deck-ui"); panel.append(root);
    window.claude.use("db").then(function (d) {
      db = d;
      var n = 0, go = function () { if (++n >= 4) rebuildSoon(); };
      db.collection("weeks").onSnapshot(function (sn) { snaps = {}; sn.docs.forEach(function (x) { var v = x.data() || {}; if (v.start) snaps[v.start] = v; }); if (n >= 4) rebuildSoon(); go(); }, go);
      // одна запись на фото: если одно и то же загружали в разные недели — берём последнее
      db.collection("deckPhotos").onSnapshot(function (sn) { photos = {}; sn.docs.forEach(function (x) { var v = x.data() || {}, k = photoKey2(v); if (!photos[k] || String(v.at || "") > String(photos[k].at || "")) photos[k] = v; }); if (n >= 4) rebuildSoon(); go(); }, go);
      db.collection("deckPicks").onSnapshot(function (sn) {
        picks = {};
        sn.docs.forEach(function (x) {
          var v = x.data() || {}, heavy = false;
          Object.keys(v.edits || {}).forEach(function (k) { var e = v.edits[k]; if (e && /src="data:/.test(e.html || "")) { e.html = lightHtml(e.html); heavy = true; } });
          picks[x.id] = v;
          if (heavy) db.collection("deckPicks").doc(x.id).set(v).then(function () { log("правки слайдов облегчены (без фото внутри)"); }).catch(function () {});
        });
        go();
      }, go);
      db.collection("settings").onSnapshot(function (sn) { var f = null; sn.docs.forEach(function (x) { if (x.id === "deckFonts") f = x.data() || null; }); if ((f && f.at) !== (fonts && fonts.at) || !!f !== !!fonts) { fonts = f; fontFaces = false; if (n >= 4) rebuildSoon(); } go(); }, go);
    });
    // при открытии вкладки — свежие данные отчёта из Google (строки, удалённые или поправленные вручную, сразу учитываются)
    function fresh() { var r = window.__otvReports; return (r && r.refresh ? r.refresh() : Promise.resolve()).catch(function (e) { log("отчёт не перечитан: " + (e && e.message || e)); }).then(rebuild); }
    window.addEventListener("otv-tab", function (e) { if (e.detail === K.tab && db) fresh(); });
    // 12.11: данные отчёта изменились — презентация пересобирается сама, даже если её вкладка закрыта
    window.addEventListener("otv-report-changed", function () { if (root) { clearTimeout(rbTimer); rbTimer = setTimeout(rebuild, 400); } });
  }
  function photoKey2(v) { return v.kind + "|" + v.key; }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
  return { rebuild: function () { rebuild(); }, _state: function () { return { res: res, cur: cur, photos: photos, picks: picks, observers: observers.length, rebuilds: rebuild.count || 0 }; } };
  }

  function s0(x) { return x == null ? "" : String(x); }
  // неделя
  window.__otvDeckUi = makeDeckUi({
    tab: "deckw", selLabel: "Неделя", empty: "Нет данных недели: подключите Google во вкладке «Отчёты» и обновите отчёт.",
    reviewTitle: "Пересмотреть выбор: цитаты, отзыв недели, голоса, фото", resetText: "Сбросить все решения этой недели",
    list: function (snaps) {
      var list = [], st = window.__otvReports && window.__otvReports.state && window.__otvReports.state();
      Object.keys(snaps).sort().reverse().forEach(function (k) { list.push({ key: k, label: "Неделя " + DK().dm(snaps[k].start) + "–" + DK().dm(snaps[k].end) + " (сохранённый отчёт)", data: snaps[k] }); });
      if (st && st.start) list.unshift({ key: "cur", label: "Текущий отчёт: " + s0(st.period), data: { start: st.start, end: st.end, positive: st.positive || [], negative: st.negative || [] } });
      return list;
    },
    build: function (data, snaps, opt) { return DK().build(data, DK().history(Object.keys(snaps).map(function (k) { return snaps[k]; })), opt); },
    slides: function (D) { return DK().slidesHtml(D); },
    photos: function (D, fioOf) {
      var out = [];
      (D.heroes.cards || []).forEach(function (c) { out.push(["Фото: " + c.short, fioOf(c.short), "face"]); });
      if (D.review) out.push(["Фото «Отзыва недели»: " + D.review.short, fioOf(D.review.short), "tall"]);
      out.push(["Обложка", "Обложка", "cover"], ["Закрывающий слайд", "Закрывающий слайд", "end"]);
      (D.where.slots || []).forEach(function (nm) { out.push(["Фото отделения: " + nm, nm, "dept"]); });
      return out;
    },
    fileName: function (d) { return "Онлайн-обращения " + DK().dm(d.start) + "–" + DK().dm(d.end) + "." + d.end.slice(0, 4); }
  });
  window.__otvMakeDeckUi = makeDeckUi;   // месячная вкладка подключается из deck-month.js
})();
