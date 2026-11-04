/* «Ответошная» — вкладка «Аналитика»: отделения, врачи, площадки, темы и год по месяцам за выбранный период.
   Данные — те же строки, что в недельных отчётах программы (сохранённые недели + текущий отчёт), без повторов;
   месяцы 2026 до программы — только итоги из утверждённой сводки. Цифры считает код, суммы сверяются. */
(function () {
  "use strict";
  function s(x) { return x == null ? "" : String(x); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function M() { return window.__otvDeckMonth; }
  function today() { return new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); }
  function addDays(d, n) { var x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function lastDay(ym) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7); return ym + "-" + ("0" + new Date(Date.UTC(y, m, 0)).getUTCDate()).slice(-2); }
  function ymAdd(ym, k) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + k; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + "-" + ("0" + (m + 1)).slice(-2); }
  function dm(d) { return d ? d.slice(8, 10) + "." + d.slice(5, 7) + "." + d.slice(0, 4) : ""; }
  function days(a, b) { return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5) + 1; }
  function pct(a, b) { if (!b) return ""; var v = (a - b) * 100 / b, r = v < 0 ? -Math.round(-v) : Math.round(v); return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r) + "%"; }
  function person(tok) { return window.__otvReports && window.__otvReports.person ? window.__otvReports.person(tok) : null; }

  /* ---------- периоды ---------- */
  var PRESETS = [["lastm", "Прошлый месяц"], ["curm", "Текущий месяц"], ["q", "Последний квартал"], ["ytd", "С начала года"], ["all", "Все данные программы"], ["own", "Свой период"]];
  function range(key, own, minD) {
    var t = today(), ym = t.slice(0, 7);
    if (key === "curm") return { start: ym + "-01", end: t };
    if (key === "lastm") { var p = ymAdd(ym, -1); return { start: p + "-01", end: lastDay(p) }; }
    if (key === "q") { var m = +ym.slice(5, 7), qs = Math.floor((m - 1) / 3) * 3 + 1, qy = +ym.slice(0, 4); qs -= 3; if (qs < 1) { qs += 12; qy--; } var a = qy + "-" + ("0" + qs).slice(-2); return { start: a + "-01", end: lastDay(ymAdd(a, 2)) }; }
    if (key === "ytd") return { start: t.slice(0, 4) + "-01-01", end: t };
    if (key === "all") return { start: minD || t, end: t };
    var a2 = s(own && own.start) || ym + "-01", b2 = s(own && own.end) || t;
    return a2 <= b2 ? { start: a2, end: b2 } : { start: b2, end: a2 };
  }
  function dateOf(r, mode) { return mode === "placed" ? r.placed : r.arrived; }

  /* ---------- расчёт ---------- */
  function compute(rows, rg, mode) {
    var R = rows.filter(function (r) { var d = dateOf(r, mode); return d >= rg.start && d <= rg.end; });
    var P = R.filter(function (r) { return r.tone === "pos"; }), N = R.filter(function (r) { return r.tone === "neg"; });
    var minD = rows.reduce(function (a, r) { var d = dateOf(r, mode); return !a || d < a ? d : a; }, "");
    // прошлый такой же период: месяц → прошлый месяц, иначе — столько же дней перед началом
    var prev = null, len = days(rg.start, rg.end), pa, pb;
    if (rg.start.slice(8) === "01" && rg.end === lastDay(rg.end.slice(0, 7))) { var mm = (+rg.end.slice(0, 4) - +rg.start.slice(0, 4)) * 12 + (+rg.end.slice(5, 7) - +rg.start.slice(5, 7)) + 1; pa = ymAdd(rg.start.slice(0, 7), -mm) + "-01"; pb = addDays(rg.start, -1); }
    else { pb = addDays(rg.start, -1); pa = addDays(rg.start, -len); }
    if (minD && pa >= minD) {
      var PR = rows.filter(function (r) { var d = dateOf(r, mode); return d >= pa && d <= pb; });
      prev = { start: pa, end: pb, pos: PR.filter(function (r) { return r.tone === "pos"; }).length, neg: PR.filter(function (r) { return r.tone === "neg"; }).length };
    }
    var GEN = "О больнице в целом";
    function group(list, keyOf) {
      var g = {};
      list.forEach(function (r) { keyOf(r).forEach(function (k) { var x = g[k.key] = g[k.key] || { name: k.key, sub: k.sub || "", pos: 0, neg: 0, rows: [], note: k.note || "" }; x[r.tone]++; x.rows.push(r); }); });
      return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return (b.pos + b.neg) - (a.pos + a.neg) || b.pos - a.pos || a.name.localeCompare(b.name, "ru"); });
    }
    var depts = group(R, function (r) { var d = s(r.dept).trim(); return [{ key: !d || /^ГКБ\s*24$/i.test(d) ? GEN : d }]; });
    var docs = group(R, function (r) {
      return s(r.doctor).split(/\s*[,;]\s*/).filter(function (x) { return x && x !== "—" && x !== "-"; }).map(function (tok) {
        var p = person(tok); return p && !p.ambiguous ? { key: p.fio || p.short, sub: p.cat || "" } : { key: tok, note: "нет в «Списке врачей» или неоднозначно" };
      });
    });
    var plats = group(R, function (r) { return [{ key: r.platform || "—" }]; });
    var uniq = {}; P.forEach(function (r) { var k = s(r.text).toLowerCase().slice(0, 120); if (k) uniq[k] = r; });
    var uP = Object.keys(uniq).map(function (k) { return uniq[k]; }), nU = uP.length || 1;
    // темы: по разбору ИИ, если отзыв уже разобран моделью; иначе — по ключевым словам
    var themes = M().THEMES.map(function (t) { var rs = uP.filter(function (r) { var a = aiOf(r); return a ? a.pos.indexOf(t[0]) >= 0 : t[1].test(r.text); }); return { name: t[0], n: rs.length, pct: Math.round(rs.length * 100 / nU), rows: rs }; }).sort(function (a, b) { return b.n - a.n; });
    var aiN = R.filter(function (r) { return !!aiOf(r); }).length;
    var negT = M().NEG_THEMES.map(function (t) { var rs = N.filter(function (r) { var a = aiOf(r); return a ? a.neg.indexOf(t[0]) >= 0 : t[2].test(r.text); }); return { name: t[0], desc: t[1], n: rs.length, rows: rs }; }).filter(function (t) { return t.n; }).sort(function (a, b) { return b.n - a.n; });
    var checks = [];
    var sd = depts.reduce(function (a, d) { return a + d.pos; }, 0), sp = plats.reduce(function (a, d) { return a + d.pos; }, 0);
    checks.push({ bad: sd !== P.length, text: "Отделения в сумме: " + sd + " из " + P.length + " благодарностей" });
    checks.push({ bad: sp !== P.length, text: "Площадки в сумме: " + sp + " из " + P.length });
    var un = docs.filter(function (d) { return d.note; });
    if (un.length) checks.push({ bad: true, text: "Врачи не найдены в списке: " + un.map(function (d) { return d.name; }).join("; ") });
    if (minD && rg.start < minD) checks.push({ bad: false, text: "Данные программы начинаются с " + dm(minD) + ": более ранние дни периода не посчитаны" });
    // год по месяцам: до программы — утверждённая сводка
    var y = +rg.end.slice(0, 4), months = [];
    for (var k = 1; k <= 12; k++) {
      var ym = y + "-" + ("0" + k).slice(-2); if (ym > today().slice(0, 7)) break;
      var t = M().monthTotals(ym, rows, mode === "placed" ? "placed" : "arrival");
      months.push({ label: M().MON_NOM[k - 1], pos: t ? t.pos : null, neg: t ? t.neg : null, seed: !!(t && t.seed), cur: ym === today().slice(0, 7) });
    }
    return { aiN: aiN, rg: rg, pos: P.length, neg: N.length, prev: prev, depts: depts, docs: docs, plats: plats, themes: themes, negT: negT, months: months, checks: checks, minD: minD, year: y, uniq: uP.length };
  }

  // разбор ИИ по тексту отзыва (из реестра программы)
  var aiIdx = { v: -1, m: {} };
  function aiOf(r) {
    var v = window.__otvVer ? window.__otvVer("registry") : 0;
    if (aiIdx.v !== v) {
      var reg = (window.__otvAll && window.__otvAll("registry")) || {}, m = {};
      Object.keys(reg).forEach(function (id) { var x = reg[id]; if (x && x.ai) { var k = low2(x.fullText || x.text); if (k) m[k] = x.ai; } });
      aiIdx = { v: v, m: m };
    }
    return aiIdx.m[low2(r.text)] || null;
  }
  function low2(t) { return s(t).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/g, " ").trim().slice(0, 80); }
  /* ---------- лучшие: N первых по благодарностям; кто набрал столько же, сколько последний, — в резерв ---------- */
  function top(list, n) {
    var L = list.filter(function (x) { return x.pos > 0 && !x.note && x.name !== "О больнице в целом"; })
      .sort(function (a, b) { return b.pos - a.pos || a.name.localeCompare(b.name, "ru"); });
    var main = L.slice(0, n), edge = main.length === n ? main[n - 1].pos : -1;
    var reserve = L.slice(n).filter(function (x) { return x.pos === edge; });
    var place = 0, prev = null;   // место: одинаковое число — одно место (1, 2, 2, 3)
    main.concat(reserve).forEach(function (x) { if (x.pos !== prev) { place++; prev = x.pos; } x.place = place; x.tie = !!reserve.length && x.pos === edge; });
    return { main: main, reserve: reserve, edge: edge };
  }

  /* ---------- выгрузка в Excel: листы «Итог», «Отделения», «Врачи», «Площадки», «Темы», «Месяцы», «Отзывы» ---------- */
  function xesc(v) { return s(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function col(i) { var t = ""; i++; while (i > 0) { var m = (i - 1) % 26; t = String.fromCharCode(65 + m) + t; i = Math.floor((i - 1) / 26); } return t; }
  function sheetXml(rows) {
    var w = [];
    rows.forEach(function (r) { r.forEach(function (v, i) { var l = Math.min(80, s(v).length + 2); w[i] = Math.max(w[i] || 8, l); }); });
    var cols = "<cols>" + w.map(function (x, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + x + '" customWidth="1"/>'; }).join("") + "</cols>";
    var data = rows.map(function (r, ri) {
      return '<row r="' + (ri + 1) + '">' + r.map(function (v, ci) {
        var ref = col(ci) + (ri + 1), st = ri === 0 ? ' s="1"' : "";
        return typeof v === "number" && isFinite(v) ? '<c r="' + ref + '"' + st + '><v>' + v + "</v></c>" : '<c r="' + ref + '" t="inlineStr"' + st + '><is><t xml:space="preserve">' + xesc(v) + "</t></is></c>";
      }).join("") + "</row>";
    }).join("");
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' + cols + "<sheetData>" + data + "</sheetData></worksheet>";
  }
  function xlsx(sheets) {
    var Z = window.JSZip; if (!Z) return Promise.reject(new Error("не удалось собрать файл Excel"));
    var z = new Z(), n = sheets.length;
    z.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map(function (x, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join("") + "</Types>");
    z.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    z.file("xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets.map(function (x, i) { return '<sheet name="' + xesc(x.name.slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join("") + "</sheets></workbook>");
    z.file("xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (x, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join("") +
      '<Relationship Id="rId' + (n + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    z.file("xl/styles.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
    sheets.forEach(function (x, i) { z.file("xl/worksheets/sheet" + (i + 1) + ".xml", sheetXml(x.rows)); });
    return z.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  function workbook(A, mode) {
    var t = function (list, name) { return [[name, "Благодарности", "Жалобы", "Всего"]].concat(list.map(function (x) { return [x.name + (x.sub ? " (" + x.sub + ")" : ""), x.pos, x.neg, x.pos + x.neg]; })); };
    var rows = [];
    A.depts.forEach(function (d) { d.rows.forEach(function (r) { if (rows.indexOf(r) < 0) rows.push(r); }); });
    return [
      { name: "Итог", rows: [["Показатель", "Значение"], ["Период", dm(A.rg.start) + " – " + dm(A.rg.end)], ["Как считали", mode === "placed" ? "по дате в отчёте" : "по дате поступления"], ["Благодарности", A.pos], ["Жалобы", A.neg],
        ["Доля жалоб, %", A.pos + A.neg ? Math.round(A.neg * 100 / (A.pos + A.neg)) : 0]].concat(A.prev ? [["Прошлый период", dm(A.prev.start) + " – " + dm(A.prev.end)], ["Благодарности в прошлом периоде", A.prev.pos], ["Жалобы в прошлом периоде", A.prev.neg]] : []) },
      { name: "Отделения", rows: t(A.depts, "Отделение") },
      { name: "Врачи", rows: t(A.docs, "Врач") },
      { name: "Площадки", rows: t(A.plats, "Площадка") },
      { name: "Темы", rows: [["Тема", "Вид", "Отзывов"]].concat(A.themes.map(function (x) { return [x.name, "благодарность", x.n]; }), A.negT.map(function (x) { return [x.name, "жалоба", x.n]; })) },
      { name: "Месяцы", rows: [["Месяц " + A.year, "Благодарности", "Жалобы", "Источник"]].concat(A.months.map(function (m) { return [m.label, m.pos == null ? "" : m.pos, m.neg == null ? "" : m.neg, m.seed ? "утверждённая сводка" : "программа"]; })) },
      { name: "Отзывы", rows: [["Дата", "Площадка", "Вид", "Отделение", "Врач", "Текст"]].concat(rows.sort(function (a, b) { return dateOf(a, mode).localeCompare(dateOf(b, mode)); }).map(function (r) { return [dm(dateOf(r, mode)), r.platform || "", r.tone === "pos" ? "благодарность" : "жалоба", r.dept || "", r.doctor || "", s(r.text)]; })) }
    ];
  }
  function exportXlsx(A, mode) {
    var name = "Аналитика отзывов " + dm(A.rg.start) + "–" + dm(A.rg.end) + ".xlsx";
    return Promise.all([xlsx(workbook(A, mode)), window.claude.use("downloads")]).then(function (r) { return r[1].save({ filename: name, data: r[0] }).then(function () { return name; }); });
  }

  /* ---------- вкладка ---------- */
  var root, db, snaps = {}, mode = "placed", preset = "lastm", own = {}, open = null, timer = 0, showTop = false;
  try { var sv = JSON.parse(localStorage.getItem("otv-an") || "{}"); if (sv.preset) preset = sv.preset; if (sv.mode) mode = sv.mode; if (sv.own) own = sv.own; } catch (e) {}
  function keep() { try { localStorage.setItem("otv-an", JSON.stringify({ preset: preset, mode: mode, own: own })); } catch (e) {} }
  function visible() { var p = document.getElementById("tab-analytics"); return p && !p.hidden; }
  function soon() { clearTimeout(timer); timer = setTimeout(function () { if (visible()) render(); }, 250); }

  function table(title, head, list, cols, kind) {
    var box = el("section", "an-card"); box.append(el("h3", null, title));
    if (!list.length) { box.append(el("p", "an-muted", "Нет данных за период")); return box; }
    var t = el("table", "an-t"), hr = el("tr");
    head.forEach(function (h, i) { var th = el("th", i ? "num" : null, h); hr.append(th); }); t.append(hr);
    list.forEach(function (x, i) {
      var tr = el("tr", "an-row"); tr.tabIndex = 0; tr.title = "Показать отзывы";
      cols.forEach(function (c, j) { var td = el("td", j ? "num" : null); var v = c(x); if (v && v.nodeType) td.append(v); else td.textContent = v == null ? "" : String(v); tr.append(td); });
      var id = kind + ":" + i;
      var go = function () { open = open === id ? null : id; render(); };
      tr.addEventListener("click", go); tr.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
      t.append(tr);
      if (open === id) { var dr = el("tr"), dd = el("td"); dd.colSpan = head.length; dd.append(reviews(x.rows)); dr.append(dd); t.append(dr); }
    });
    box.append(t); return box;
  }
  function topBlock(A) {
    var box = el("section", "an-card an-top"); box.id = "anTop";
    box.append(el("h3", null, "Лучшие по благодарностям · " + dm(A.rg.start) + " – " + dm(A.rg.end)));
    [["Отделения — топ-3", top(A.depts, 3), false], ["Врачи — топ-10", top(A.docs, 10), true]].forEach(function (g) {
      var t = g[1], col = el("div", "an-topcol"); col.append(el("h4", null, g[0]));
      if (!t.main.length) { col.append(el("p", "an-muted", "Нет благодарностей за период")); box.append(col); return; }
      var ol = el("ol", "an-toplist");
      var item = function (x, res) {
        var li = el("li", res ? "res" : null); li.append(el("span", "an-pl", x.place + " место"), el("span", "an-nm", x.name));
        if (g[2] && x.sub) li.append(el("span", "an-sub", " · " + x.sub));
        li.append(el("span", "an-n", x.pos + " " + plural(x.pos, "благодарность", "благодарности", "благодарностей")));
        return li;
      };
      t.main.forEach(function (x) { ol.append(item(x, false)); }); col.append(ol);
      if (t.reserve.length) {
        col.append(el("p", "an-res", "Резерв — столько же благодарностей (" + t.edge + "), сколько у последнего в списке; выберите, кого показать:"));
        var rl = el("ol", "an-toplist"); t.reserve.forEach(function (x) { rl.append(item(x, true)); }); col.append(rl);
      }
      box.append(col);
    });
    return box;
  }
  function plural(n, a, b, c) { var m = n % 100, k = n % 10; return m > 10 && m < 15 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; }
  function nameCell(x) { var f = document.createDocumentFragment(); f.append(el("span", null, x.name)); if (x.sub) f.append(el("span", "an-sub", " · " + x.sub)); if (x.note) f.append(el("span", "an-bad", " · " + x.note)); return f; }
  function reviews(rows) {
    var w = el("div", "an-rev");
    rows.slice().sort(function (a, b) { return b.arrived.localeCompare(a.arrived); }).slice(0, 60).forEach(function (r) {
      var it = el("div", "an-ri " + r.tone);
      it.append(el("div", "an-rh", dm(dateOf(r, mode)) + " · " + (r.platform || "—") + " · " + (r.tone === "pos" ? "благодарность" : "жалоба") + (r.dept ? " · " + r.dept : "") + (r.doctor ? " · " + r.doctor : "")));
      var tx = s(r.text); it.append(el("div", "an-rt", tx.length > 400 ? tx.slice(0, 400) + "…" : tx)); w.append(it);
    });
    if (rows.length > 60) w.append(el("p", "an-muted", "Показаны 60 последних из " + rows.length));
    return w;
  }
  function render() {
    if (!root || !M()) return;
    var rows = M().allRows(snaps), minD = rows.reduce(function (a, r) { var d = dateOf(r, mode); return !a || d < a ? d : a; }, "");
    var rg = range(preset, own, minD), A = compute(rows, rg, mode);
    root.textContent = "";
    var ctl = el("div", "ctl"), act = el("div", "actions an-ctl");
    var ps = el("select", "btn"); ps.id = "anPreset"; ps.setAttribute("aria-label", "Период");
    PRESETS.forEach(function (p) { var o = el("option", null, p[1]); o.value = p[0]; if (p[0] === preset) o.selected = true; ps.append(o); });
    ps.addEventListener("change", function () { preset = ps.value; open = null; keep(); render(); });
    act.append(el("b", null, "Период:"), ps);
    if (preset === "own") {
      ["start", "end"].forEach(function (k) { var i = el("input", "btn"); i.type = "date"; i.value = rg[k]; i.setAttribute("aria-label", k === "start" ? "С" : "По"); i.addEventListener("change", function () { own[k] = i.value; keep(); render(); }); act.append(el("span", null, k === "start" ? "с" : "по"), i); });
    }
    var ms = el("select", "btn"); ms.id = "anMode"; ms.setAttribute("aria-label", "Как относить отзыв к дате");
    [["placed", "по дате в отчёте"], ["arrival", "по дате поступления"]].forEach(function (p) { var o = el("option", null, p[1]); o.value = p[0]; if (p[0] === mode) o.selected = true; ms.append(o); });
    ms.addEventListener("change", function () { mode = ms.value; keep(); render(); });
    act.append(el("b", null, "Считать:"), ms);
    var tb = el("button", "btn primary", showTop ? "Скрыть лучших" : "Лучшие: 3 отделения и 10 врачей"); tb.type = "button"; tb.id = "anTopBtn";
    tb.addEventListener("click", function () { showTop = !showTop; render(); });
    act.append(tb);
    var xb = el("button", "btn", "Скачать в Excel"); xb.type = "button"; xb.id = "anXlsx";
    xb.addEventListener("click", function () {
      xb.disabled = true; xb.textContent = "Сохраняю…";
      exportXlsx(A, mode).then(function (n) { xb.textContent = "Сохранено в «Загрузки»"; if (window.__otvBar) window.__otvBar.show("Сохранено в «Загрузки»: " + n, "ok", [["Закрыть", window.__otvBar.hide]]); },
        function (e) { xb.textContent = "Не сохранилось"; if (window.__otvBar) window.__otvBar.show("Не сохранилось: " + (e && e.message || e), "err", [["Закрыть", window.__otvBar.hide]]); })
        .then(function () { setTimeout(function () { xb.disabled = false; xb.textContent = "Скачать в Excel"; }, 2500); });
    });
    act.append(xb);
    ctl.append(el("p", "ctl-p", "Период " + dm(rg.start) + " – " + dm(rg.end) + " · из недельных отчётов программы, без повторов"), act);
    root.append(ctl);
    if (!rows.length) { root.append(el("p", "an-muted", "Нет данных: аналитика считается по недельным отчётам программы. Подключите Google во вкладке «Отчёты» и соберите неделю.")); return; }

    var kp = el("div", "an-kpi");
    function card(label, v, sub, cls) { var c = el("div", "an-k " + (cls || "")); c.append(el("div", "an-kl", label), el("div", "an-kv", String(v))); if (sub) c.append(el("div", "an-ks", sub)); kp.append(c); }
    var p = A.prev, ps2 = p ? "к " + dm(p.start) + "–" + dm(p.end) + ": " : "";
    card("Благодарности", A.pos, p ? ps2 + p.pos + (p.pos ? " (" + (pct(A.pos, p.pos) || "0%") + ")" : "") : "прошлого такого же периода нет в данных");
    card("Жалобы", A.neg, p ? ps2 + p.neg + (p.neg ? " (" + (pct(A.neg, p.neg) || "0%") + ")" : "") : "", "neg");
    card("Доля жалоб", A.pos + A.neg ? Math.round(A.neg * 100 / (A.pos + A.neg)) + "%" : "—", "от всех отзывов периода");
    card("Отделений с благодарностями", A.depts.filter(function (d) { return d.pos && d.name !== "О больнице в целом"; }).length, "");
    root.append(kp);

    var bad = A.checks.filter(function (c) { return c.bad; });   // сверка видна, только если что-то не сошлось
    if (bad.length) { var ch = el("ul", "an-checks"); bad.forEach(function (c) { ch.append(el("li", "bad", "⚠ " + c.text)); }); root.append(ch); }

    if (showTop) root.append(topBlock(A));
    var grid = el("div", "an-grid");
    grid.append(table("Отделения", ["Отделение", "Благодарности", "Жалобы"], A.depts, [nameCell, function (x) { return x.pos; }, function (x) { return x.neg || ""; }], "d"));
    grid.append(table("Врачи", ["Врач", "Благодарности", "Жалобы"], A.docs, [nameCell, function (x) { return x.pos; }, function (x) { return x.neg || ""; }], "v"));
    grid.append(table("Площадки", ["Площадка", "Благодарности", "Жалобы"], A.plats, [nameCell, function (x) { return x.pos; }, function (x) { return x.neg || ""; }], "p"));
    if (A.aiN || window.__otvAi) {
      var aiL = el("p", "an-muted", "Темы: разобрано моделью " + A.aiN + " из " + (A.pos + A.neg) + " отзывов периода, остальные — по ключевым словам");
      if (window.__otvAi && window.__otvAi.pending()) {
        var ab = el("button", "link", "Разобрать моделью"); ab.type = "button";
        ab.addEventListener("click", function () { ab.disabled = true; ab.textContent = "Разбираю…"; window.__otvAi.analyzeBatch(20).then(function (n) { ab.textContent = "Разобрано: " + n; soon(); }); });
        aiL.append(" · ", ab);
      }
      root.append(aiL);
    }
    grid.append(table("За что благодарят", ["Тема", "Отзывов", "Доля"], A.themes, [function (x) { return x.name; }, function (x) { return x.n; }, function (x) { return x.pct + "%"; }], "t"));
    grid.append(table("На что жалуются", ["Тема", "Жалоб"], A.negT, [function (x) { var f = document.createDocumentFragment(); f.append(el("span", null, x.name), el("span", "an-sub", " · " + x.desc)); return f; }, function (x) { return x.n; }], "n"));
    var yb = el("section", "an-card"); yb.append(el("h3", null, A.year + " год по месяцам"));
    var yt = el("table", "an-t"), yh = el("tr"); ["Месяц", "Благодарности", "Жалобы"].forEach(function (h, i) { yh.append(el("th", i ? "num" : null, h)); }); yt.append(yh);
    A.months.forEach(function (m) { var tr = el("tr", m.cur ? "an-cur" : null); tr.append(el("td", null, m.label + (m.seed ? " *" : m.cur ? " (идёт)" : "")), el("td", "num", m.pos == null ? "нет данных" : String(m.pos)), el("td", "num", m.neg == null ? "" : String(m.neg))); yt.append(tr); });
    yb.append(yt, el("p", "an-muted", "* до программы — итоги из утверждённой сводной таблицы (все каналы)"));
    grid.append(yb);
    root.append(grid);
    if (window.__otvAnLast !== undefined) window.__otvAnLast = A;
  }
  function start() {
    var panel = document.getElementById("tab-analytics"); if (!panel || !window.claude) return;
    root = el("div", "an"); panel.append(root);
    var mo = new MutationObserver(function () { if (visible()) soon(); }); mo.observe(panel, { attributes: true, attributeFilter: ["hidden"] });
    window.claude.use("db").then(function (d) {
      db = d;
      db.collection("weeks").onSnapshot(function (sn) { snaps = {}; sn.docs.forEach(function (x) { var v = x.data() || {}; if (v.start) snaps[v.start] = v; }); soon(); }, function () {});
    });
    if (visible()) soon();
  }
  window.__otvAnalytics = { workbook: workbook, xlsx: xlsx, compute: compute, range: range, top: top, render: function () { render(); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
