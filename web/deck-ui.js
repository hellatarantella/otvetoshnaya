/* Вкладка «Презентации → Неделя»: презентация собирается в программе, без онлайн-сервиса.
   Порядок: данные недели → проверка цифр → что подтвердить (фото, цитаты, отзыв недели) → предпросмотр с правкой текста → PDF и PPTX.
   Выгрузка закрыта, пока не подтверждено всё нужное и вёрстка не прошла самопроверку. */
(function () {
  "use strict";
  var DK = function () { return window.__otvDeck; };
  var openReview = false, db = null, root = null, weekSel = null, cur = null, res = null, fonts = null, photos = {}, picks = {}, snaps = {}, busy = false, fontFaces = false;
  function s(x) { return x == null ? "" : String(x); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(text, cls, fn) { var b = el("button", "btn" + (cls ? " " + cls : ""), text); b.type = "button"; b.addEventListener("click", fn); return b; }
  function log(m) { if (window.__otvLog) window.__otvLog("презентация: " + m); }
  // фото отделения хранится крупно (4:3): слайд сам обрезает его под вертикальную или горизонтальную ячейку
  var KIND_SIZE = { face: [600, 600], tall: [960, 1350], dept: [1400, 1050], cover: [1920, 1080], end: [1920, 1080] };
  // обложка и закрывающий слайд постоянные (загружены один раз, можно заменить); фото отделений — по названию отделения, копятся в библиотеке

  /* ---------- данные ---------- */
  function weeks() {
    var list = [], st = window.__otvReports && window.__otvReports.state && window.__otvReports.state();
    Object.keys(snaps).sort().reverse().forEach(function (k) { list.push({ key: k, label: "Неделя " + DK().dm(snaps[k].start) + "–" + DK().dm(snaps[k].end) + " (сохранённый отчёт)", data: snaps[k] }); });
    if (st && st.start) list.unshift({ key: "cur", label: "Текущий отчёт: " + s(st.period), data: { start: st.start, end: st.end, positive: st.positive || [], negative: st.negative || [] } });
    return list;
  }
  function photoKey(k, kind) { return kind + "|" + k; }
  function photoOf(k, kind, slot) {
    var p = photos[photoKey(k, kind)];
    // обложка и закрывающий слайд — фото утверждённых презентаций (как раньше); своё ставится только кнопкой «Заменить»
    if (kind === "cover" || kind === "end") {
      if (p && p.override) return { src: p.src, pos: "center center" };
      var A = window.__otvDeckAssets || {}, d = A[kind === "cover" ? "coverDefault" : "endDefault"];
      return d ? { src: d, pos: "center center" } : null;
    }
    return p ? { src: p.src, pos: "center center" } : null;
  }
  function pickDoc() { return cur ? (picks[cur.data.start] || {}) : {}; }
  // каждое нажатие даёт видимый ответ: «Сохранено…» или причину (29.10: казалось, что кнопки не работают)
  function bar(t, kind) { if (window.__otvBar) window.__otvBar.show(t, kind || "", [["Закрыть", window.__otvBar.hide]]); }
  function savePick(patch, msg) {
    if (!cur) { bar("Не выбрана неделя презентации", "err"); return Promise.resolve(); }
    var id = cur.data.start, d = Object.assign({}, picks[id] || {}, patch, { at: new Date().toISOString() });
    picks[id] = d;
    return db.collection("deckPicks").doc(id).set(d).then(function () { rebuild(); bar((msg || "Сохранено") + ". Презентация пересобрана", "ok"); })
      .catch(function (e) { log("решение не сохранилось: " + (e && e.stack || e)); bar("Не сохранилось: " + (e && e.message || e) + ". Журнал записан", "err"); });
  }
  // фраза до сохранения: объём и законченность. Не подходит — сразу говорим, что не так (раньше молча заменялась прежней)
  function quoteProblem(v, band) {
    if (!v) return "впишите или выберите цитату";
    if (band && (v.length < band[0] || v.length > band[1])) return v.length + " знаков, нужно " + band[0] + "–" + band[1];
    if (band && DK().okQuote && !DK().okQuote(v, band)) return "фраза обрывочная: нужно законченное предложение от 6 слов";
    return "";
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
  function rebuild() {
    if (!root) return;
    var ws = weeks(); if (!ws.length) { paintEmpty(); return; }
    if (!cur || !ws.some(function (w) { return w.key === cur.key; })) cur = ws[0]; else cur = ws.filter(function (w) { return w.key === cur.key; })[0];
    var hist = DK().history(Object.keys(snaps).map(function (k) { return snaps[k]; }));
    try { res = DK().build(cur.data, hist, { person: person, photoOf: photoOf, pick: pickDoc() }); }
    catch (e) { res = null; log("не собралась: " + (e && e.stack || e)); }
    try { paint(ws); } catch (e) { log("отрисовка: " + (e && e.stack || e)); root.append(el("p", "ctl-st err", "Ошибка отрисовки презентации: " + (e && e.message || e) + ". Журнал записан")); }
  }
  function paintEmpty() { root.textContent = ""; root.append(el("p", "hint", "Нет данных недели: подключите Google во вкладке «Отчёты» и обновите отчёт.")); }

  function paint(ws) {
    root.textContent = "";
    var top = el("div", "ctl"), acts = el("div", "actions");
    weekSel = el("select", "btn"); weekSel.setAttribute("aria-label", "Неделя");
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
    var nb = el("div", "deck-box"); nb.append(el("h3", null, need.length ? "Нужно ваше решение: " + need.length : "Всё подтверждено"));
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
    var row = el("div", "deck-need"); row.append(el("p", null, n.text));
    if (n.kind === "photo") {
      var kind = n.slot === "cover" ? "cover" : n.slot === "end" ? "end" : n.slot === "dept" ? "dept" : n.tall ? "tall" : "face";
      row.append(photoPicker(n.who, kind));
      if (kind === "face") row.append(btn("Фото нет: перенести в строку «Ещё…»", "", function () { var g = Object.assign({}, pickDoc().gold || {}); g[n.short] = "rest"; savePick({ gold: g }); }));
    } else if (n.kind === "quote") {
      var qp = quotePicker(n.options, n.current, n.band, "Цитата");
      row.append(qp.box, btn("Подтвердить цитату", "primary", function () { var v = qp.value(), bad = quoteProblem(v, n.band); if (bad) { bar("Цитата для " + n.short + " не принята: " + bad, "err"); return; } var q = Object.assign({}, pickDoc().quote || {}); q[n.short] = v; savePick({ quote: q, own: ownList(v, n.options) }, "Цитата для " + n.short + " сохранена"); }));
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
      row.append(list, rqBox, btn("Выбрать отзыв недели", "primary", function () { if (!chosen) { bar("Выберите отзыв недели", "err"); return; } var v = rq.value() || chosen.quote, bad = quoteProblem(v, n.band); if (bad) { bar("Цитата отзыва недели не принята: " + bad, "err"); return; } savePick({ review: chosen.key, own: ownList(v, chosen.quotes || [chosen.quote]), reviewText: Object.assign({}, pickDoc().reviewText || {}, { quote: v }) }); }));
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
        if (bad.length) { bar("Голоса не приняты: " + bad.join("; "), "err"); return; }
        savePick({ voices: v, own: ownAll }, "Голоса недели сохранены");
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
    box.append(sel, inp, cnt);
    return { box: box, value: function () { return inp.value.trim(); } };
  }
  // своя фраза (не из предложенных) — программа не оценивает её по смыслу при перепроверке
  function ownList(v, options, base) { var o = (base || pickDoc().own || []).filter(function (x) { return x !== v; }); if (v && (options || []).indexOf(v) < 0) o.push(v); return o; }
  // всегда доступно: заменить фото и вернуть выбор
  function extraRow() {
    var d = el("details", "deck-extra"); d.append(el("summary", null, "Пересмотреть выбор: цитаты, отзыв недели, голоса, фото"));
    d.open = !!openReview; d.addEventListener("toggle", function () { openReview = d.open; });
    var D = res.D;
    // всё, что уже выбрано, можно поменять: варианты показаны с текущим выбором
    (res.choices || []).forEach(function (c) { d.append(needRow(c)); });
    d.append(el("h3", null, "Фото"));
    (D.heroes.cards || []).forEach(function (c) { d.append(el("p", null, "Фото: " + c.short), photoPicker(fioOf(c.short), "face")); });
    if (D.review) d.append(el("p", null, "Фото «Отзыва недели»: " + D.review.short), photoPicker(fioOf(D.review.short), "tall"));
    [["Обложка", "cover"], ["Закрывающий слайд", "end"]].concat((D.where.slots || []).map(function (nm) { return [nm, "dept"]; })).forEach(function (x) { d.append(el("p", null, x[1] === "dept" ? "Фото отделения: " + x[0] : x[0]), photoPicker(x[0], x[1])); });
    d.append(btn("Сбросить все решения этой недели", "", function () { if (!cur) return; picks[cur.data.start] = {}; db.collection("deckPicks").doc(cur.data.start).delete().then(rebuild); }));
    return d;
  }
  function fioOf(short) { var x = (res.doctors || []).filter(function (d) { return d.short === short; })[0]; return x ? x.fio : short; }

  /* ---------- фото: загрузка и кадрирование ---------- */
  function photoPicker(key, kind) {
    var wrap = el("span", "deck-ph"), f = el("input"); f.type = "file"; f.accept = "image/jpeg,image/png,image/webp"; f.setAttribute("aria-label", "Фото: " + key);
    var have = (kind === "cover" || kind === "end") ? photoOf(key, kind) : photos[photoKey(key, kind)];
    if (have) { var im = el("img"); im.src = have.src; im.alt = key; im.className = kind === "face" ? "round" : ""; wrap.append(im); }
    f.addEventListener("change", function () { var file = f.files && f.files[0]; if (file) cropDialog(file, kind, function (data) { savePhoto(key, kind, data); }); });
    wrap.append(f); return wrap;
  }
  function savePhoto(key, kind, data) {
    var id = photoKey(key, kind), doc = { key: key, kind: kind, week: "", src: data, at: new Date().toISOString(), override: kind === "cover" || kind === "end" };
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
        if (kind === "cover" || kind === "end") {   // обложка: размытие и фирменный синий, как в утверждённом шаблоне
          g.filter = kind === "cover" ? "blur(6px)" : "none"; g.drawImage(img, q.x - 12, q.y - 12, q.w + 24, q.h + 24); g.filter = "none";
          g.fillStyle = kind === "cover" ? "rgba(30,46,70,0.72)" : "rgba(30,46,70,0.45)"; g.fillRect(0, 0, size[0], size[1]);
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
  function fit(fr, inner) {
    var go = function () { var w = fr.clientWidth; if (w) inner.style.transform = "scale(" + (w / 1920) + ")"; };
    go(); if (window.ResizeObserver) new ResizeObserver(go).observe(fr); else window.addEventListener("resize", go);
  }

  /* ---------- предпросмотр и самопроверка ---------- */
  var slides = [];
  function renderPreview(pv, issuesBox, buttons, blocked) {
    pv.textContent = ""; slides = DK().slidesHtml(res.D);
    var edits = (pickDoc().edits || {}), all = [];
    slides.forEach(function (h, i) {
      var fr = el("div", "deck-slide"), inner = el("div", "deck-slide-in");
      setHtml(inner, h); fr.append(inner); pv.append(fr); fit(fr, inner);
      var sec = inner.firstElementChild, id = sec.id, saved = edits[id];
      if (saved && saved.sig === sig(h)) setHtml(sec, saved.html);
      editable(sec);
      sec.addEventListener("focusout", function () { clean(sec); var e = Object.assign({}, pickDoc().edits || {}); e[id] = { sig: sig(h), html: sec.innerHTML }; savePickQuiet({ edits: e }); check(); });
      all.push(sec);
    });
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
  function sig(h) { var x = 0; for (var i = 0; i < h.length; i++) x = (x * 31 + h.charCodeAt(i)) | 0; return x; }
  function savePickQuiet(patch) { if (!cur) return; var id = cur.data.start; picks[id] = Object.assign({}, picks[id] || {}, patch); db.collection("deckPicks").doc(id).set(picks[id]).catch(function () {}); }

  /* ---------- выгрузка ---------- */
  function exportAs(kind, st) {
    if (busy) return; busy = true;
    st.hidden = false; st.className = "ctl-st"; st.textContent = kind === "pdf" ? "Готовлю PDF…" : "Готовлю PPTX…";
    var tmp = el("div", "deck-measure"); document.body.append(tmp);
    var secs = [].map.call(document.querySelectorAll(".deck-slide-in > section"), function (s0) { return cloneSec(s0); });
    var prims = [];
    secs.reduce(function (p, sec) { return p.then(function () {
      tmp.textContent = ""; tmp.append(sec); sec.querySelectorAll("[contenteditable]").forEach(function (x) { x.removeAttribute("contenteditable"); });
      if (!styled(sec)) throw new Error("оформление слайда «" + sec.id + "» не применилось");
      return DK().measure(sec).then(function (x) { prims.push(x); }); }); }, document.fonts.ready)
      .then(function () {
        tmp.remove();
        var name = "Онлайн-обращения " + DK().dm(cur.data.start) + "–" + DK().dm(cur.data.end) + "." + cur.data.end.slice(0, 4);
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
    var panel = document.getElementById("tab-deckw"); if (!panel || root) return;
    [].forEach.call(panel.children, function (c) { c.hidden = true; });   // прежняя сборка через онлайн-сервис больше не нужна
    root = el("div", "deck-ui"); panel.append(root);
    window.claude.use("db").then(function (d) {
      db = d;
      var n = 0, go = function () { if (++n >= 4) rebuild(); };
      db.collection("weeks").onSnapshot(function (sn) { snaps = {}; sn.docs.forEach(function (x) { var v = x.data() || {}; if (v.start) snaps[v.start] = v; }); if (n >= 4) rebuild(); go(); }, go);
      // одна запись на фото: если одно и то же загружали в разные недели — берём последнее
      db.collection("deckPhotos").onSnapshot(function (sn) { photos = {}; sn.docs.forEach(function (x) { var v = x.data() || {}, k = photoKey2(v); if (!photos[k] || String(v.at || "") > String(photos[k].at || "")) photos[k] = v; }); if (n >= 4) rebuild(); go(); }, go);
      db.collection("deckPicks").onSnapshot(function (sn) { picks = {}; sn.docs.forEach(function (x) { picks[x.id] = x.data() || {}; }); go(); }, go);
      db.collection("settings").onSnapshot(function (sn) { var f = null; sn.docs.forEach(function (x) { if (x.id === "deckFonts") f = x.data() || null; }); if ((f && f.at) !== (fonts && fonts.at) || !!f !== !!fonts) { fonts = f; fontFaces = false; if (n >= 4) rebuild(); } go(); }, go);
    });
    // при открытии вкладки — свежие данные отчёта из Google (строки, удалённые или поправленные вручную, сразу учитываются)
    function fresh() { var r = window.__otvReports; return (r && r.refresh ? r.refresh() : Promise.resolve()).catch(function (e) { log("отчёт не перечитан: " + (e && e.message || e)); }).then(rebuild); }
    window.addEventListener("otv-tab", function (e) { if (e.detail === "deckw" && db) fresh(); });
  }
  function photoKey2(v) { return v.kind + "|" + v.key; }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
  window.__otvDeckUi = { rebuild: function () { rebuild(); }, _state: function () { return { res: res, cur: cur, photos: photos, picks: picks }; } };
})();
