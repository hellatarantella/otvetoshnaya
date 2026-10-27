/* Презентация → PDF и PPTX из одной отрисовки.
   Слайд рисуется браузером (тот же HTML, что в предпросмотре), затем обходится один раз: прямоугольники, круги, линии,
   картинки (уже обрезанные под рамку) и текст по словам с точными координатами. Из этого списка рисуются оба файла,
   поэтому PDF и PPTX не расходятся ни с предпросмотром, ни между собой. */
(function () {
  "use strict";
  var W = 1920, H = 1080;

  function rgba(c) {
    var m = /rgba?\(([^)]+)\)/.exec(c || ""); if (!m) return null;
    var p = m[1].split(",").map(function (x) { return parseFloat(x); });
    var a = p.length > 3 ? p[3] : 1; if (!a) return null;
    var hex = p.slice(0, 3).map(function (x) { return ("0" + Math.round(x).toString(16)).slice(-2); }).join("").toUpperCase();
    return { hex: hex, a: a };
  }
  function px(v) { return parseFloat(v) || 0; }
  function isBold(cs) { return /Bold/.test(cs.fontFamily) || +cs.fontWeight >= 600; }
  function loadImg(src) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { rej(new Error("картинка не загрузилась")); }; i.src = src; }); }
  function pathRound(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r[0], y);
    g.arcTo(x + w, y, x + w, y + h, r[1]); g.arcTo(x + w, y + h, x, y + h, r[2]); g.arcTo(x, y + h, x, y, r[3]); g.arcTo(x, y, x + w, y, r[0]); g.closePath();
  }
  function radii(cs, w, h) {
    return ["borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"].map(function (k) {
      var v = cs[k] || "0"; var r = /%/.test(v) ? parseFloat(v) / 100 * Math.min(w, h) : px(v); return Math.min(r, w / 2, h / 2);
    });
  }
  // object-fit/object-position → какая часть картинки видна в рамке
  function fitBox(img, w, h, fit, pos) {
    var iw = img.naturalWidth, ih = img.naturalHeight, s = fit === "contain" ? Math.min(w / iw, h / ih) : fit === "fill" ? null : Math.max(w / iw, h / ih);
    if (s === null) return { dx: 0, dy: 0, dw: w, dh: h };
    var dw = iw * s, dh = ih * s, p = (pos || "50% 50%").split(/\s+/);
    var f = function (v, free) { if (/%$/.test(v)) return free * parseFloat(v) / 100; if (/px$/.test(v)) return parseFloat(v); return free / 2; };
    return { dx: f(p[0], w - dw), dy: f(p[1] || "50%", h - dh), dw: dw, dh: dh };
  }

  /* ---------- обход отрисованного слайда ---------- */
  function measure(sec) {
    var base = sec.getBoundingClientRect(), out = [], jobs = [];
    var R = function (r) { return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }; };
    var scs = getComputedStyle(sec), sbg = rgba(scs.backgroundColor);
    if (sbg) out.push({ t: "rect", x: 0, y: 0, w: W, h: H, fill: sbg.hex, alpha: sbg.a, r: [0, 0, 0, 0] });
    var all = sec.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      var e = all[i], cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || e.tagName === "ASIDE" || e.closest("aside")) continue;
      if (e.closest("svg") && e.tagName.toLowerCase() !== "svg") continue;
      var b = R(e.getBoundingClientRect()); if (!b.w || !b.h) continue;
      var op = +cs.opacity;
      if (e.tagName.toLowerCase() === "svg") { svgPrims(e, b, out); continue; }
      var bg = rgba(cs.backgroundColor), bw = px(cs.borderTopWidth), bc = bw ? rgba(cs.borderTopColor) : null, rr = radii(cs, b.w, b.h);
      var ell = rr[0] >= b.w / 2 - 0.5 && Math.abs(b.w - b.h) < 1;
      if (e.tagName === "IMG") {
        var slot = { t: "img", x: b.x, y: b.y, w: b.w, h: b.h, ell: ell, src: e.currentSrc || e.src, shadow: cs.boxShadow !== "none" ? cs.boxShadow : "" };
        out.push(slot); jobs.push(cropImg(e, cs, slot, rr, bw));
        if (bc) out.push({ t: "rect", x: b.x + bw / 2, y: b.y + bw / 2, w: b.w - bw, h: b.h - bw, stroke: bc.hex, sw: bw, r: rr.map(function (r) { return Math.max(0, r - bw / 2); }), ell: ell });
        continue;
      }
      if (bg || bc) out.push({ t: "rect", x: b.x, y: b.y, w: b.w, h: b.h, fill: bg && bg.hex, alpha: (bg ? bg.a : 1) * op, stroke: bc && bc.hex, sw: bw, r: rr, ell: ell });
      var bb = px(cs.borderBottomWidth); if (bb && !bw) { var c2 = rgba(cs.borderBottomColor); if (c2) out.push({ t: "line", x1: b.x, y1: b.y + b.h - bb / 2, x2: b.x + b.w, y2: b.y + b.h - bb / 2, color: c2.hex, w: bb }); }
      // <b>, <span> внутри абзаца уже вошли в текст абзаца
      if (!/^inline($|-flex)/.test(cs.display) || cs.display === "inline-block") textPrims(e, cs, b, base, out);
    }
    return Promise.all(jobs).then(function () { return out; });
  }
  function svgPrims(svg, b, out) {
    svg.querySelectorAll("rect,line").forEach(function (n) {
      var g = function (k) { return parseFloat(n.getAttribute(k)) || 0; };
      if (n.tagName === "rect") out.push({ t: "rect", x: b.x + g("x"), y: b.y + g("y"), w: g("width"), h: g("height"), fill: (rgba(getComputedStyle(n).fill) || {}).hex || n.getAttribute("fill").slice(1).toUpperCase(), alpha: 1, r: [g("rx"), g("rx"), 0, 0], bar: true });
      else out.push({ t: "line", x1: b.x + g("x1"), y1: b.y + g("y1"), x2: b.x + g("x2"), y2: b.y + g("y2"), color: n.getAttribute("stroke").slice(1).toUpperCase(), w: g("stroke-width"), dash: n.getAttribute("stroke-dasharray") || "" });
    });
  }
  // картинка: вырезаем ровно видимую часть, со скруглением и тенью — одинаково для PDF и PPTX
  function cropImg(e, cs, slot, rr, bw) {
    return loadImg(slot.src).then(function (img) {
      var sc = 2, pad = 0, sh = null;
      var m = /(-?\d+)px (-?\d+)px (\d+)px[^#r]*?(#[0-9a-f]{6,8}|rgba?\([^)]+\))/i.exec(slot.shadow || "") || /(rgba?\([^)]+\)|#[0-9a-f]{6,8}) (-?\d+)px (-?\d+)px (\d+)px/i.exec(slot.shadow || "");
      if (m) { sh = /^(rgba|#)/.test(m[1]) ? { c: m[1], x: +m[2], y: +m[3], b: +m[4] } : { x: +m[1], y: +m[2], b: +m[3], c: m[4] }; pad = sh.b + Math.max(Math.abs(sh.x), Math.abs(sh.y)); }
      var cw = Math.round((slot.w + pad * 2) * sc), ch = Math.round((slot.h + pad * 2) * sc), cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
      var g = cv.getContext("2d"); g.scale(sc, sc); g.translate(pad, pad);
      var r = slot.ell ? [slot.w / 2, slot.w / 2, slot.w / 2, slot.w / 2] : rr;
      if (sh) { g.save(); g.shadowColor = sh.c; g.shadowBlur = sh.b; g.shadowOffsetX = sh.x * sc; g.shadowOffsetY = sh.y * sc; pathRound(g, 0, 0, slot.w, slot.h, r); g.fillStyle = "#000"; g.fill(); g.restore(); }
      g.save();
      if (slot.ell) { g.beginPath(); g.arc(slot.w / 2, slot.h / 2, slot.w / 2 - bw, 0, Math.PI * 2); g.closePath(); }   // как в браузере: фото внутри рамки
      else pathRound(g, bw, bw, slot.w - 2 * bw, slot.h - 2 * bw, r.map(function (x) { return Math.max(0, x - bw); }));
      g.clip();
      if (sh) g.clearRect(0, 0, slot.w, slot.h);
      var f = fitBox(img, slot.w - 2 * bw, slot.h - 2 * bw, cs.objectFit, cs.objectPosition);
      g.drawImage(img, bw + f.dx, bw + f.dy, f.dw, f.dh); g.restore();
      var opaque = !sh && !r.some(function (x) { return x > 0; }) && cs.objectFit !== "contain" && !/png|svg/i.test(slot.src.slice(0, 30));
      slot.data = cv.toDataURL(opaque ? "image/jpeg" : "image/png", 0.9); slot.fmt = opaque ? "JPEG" : "PNG";
      slot.x -= pad; slot.y -= pad; slot.w += pad * 2; slot.h += pad * 2;
    }, function () { slot.data = ""; });
  }
  // текст: каждое слово с точной рамкой и базовой линией + блок целиком (для редактируемого PPTX)
  function textPrims(e, cs, b, base, out) {
    var nodes = [].filter.call(e.childNodes, function (n) { return n.nodeType === 3 && n.nodeValue.replace(/[\s ]+/g, ""); });
    var hasBlockKids = [].some.call(e.children, function (c) { var d = getComputedStyle(c).display; return !/inline/.test(d) && c.tagName !== "BR"; });
    if (!nodes.length && !(e.children.length && !hasBlockKids && e.textContent.trim())) return;
    if (hasBlockKids) { if (nodes.length) runsOf(e, nodes, base, out, null); return; }
    // блок с текстом (p, h1, h2): собираем все строчные куски, включая <b>, <span>, <br>
    var runs = [], words = [];
    (function walk(n) {
      [].forEach.call(n.childNodes, function (c) {
        if (c.nodeType === 3) { if (c.nodeValue) { var ps = getComputedStyle(c.parentElement); runs.push(style(ps, c.nodeValue)); wordsOf(c, ps, base, words); } }
        else if (c.tagName === "BR") runs.push({ br: true });
        else if (c.nodeType === 1) walk(c);
      });
    })(e);
    var pl = px(cs.paddingLeft), pt = px(cs.paddingTop), pr = px(cs.paddingRight), pb = px(cs.paddingBottom);
    var lh = cs.lineHeight === "normal" ? px(cs.fontSize) * 1.2 : px(cs.lineHeight);
    out.push({ t: "text", x: b.x + pl, y: b.y + pt, w: b.w - pl - pr, h: b.h - pt - pb, align: cs.textAlign === "start" ? "left" : cs.textAlign, nowrap: cs.whiteSpace === "nowrap", lh: lh, runs: runs, words: words });
  }
  function runsOf(e, nodes, base, out) { nodes.forEach(function (n) { var ps = getComputedStyle(n.parentElement), w = []; wordsOf(n, ps, base, w); if (!w.length) return; var x0 = Math.min.apply(null, w.map(function (q) { return q.x; })), y0 = Math.min.apply(null, w.map(function (q) { return q.top; })); out.push({ t: "text", x: x0, y: y0, w: Math.max.apply(null, w.map(function (q) { return q.x + q.w; })) - x0, h: px(ps.lineHeight) || px(ps.fontSize) * 1.2, align: "left", nowrap: true, lh: px(ps.lineHeight) || px(ps.fontSize) * 1.2, runs: [style(ps, n.nodeValue.trim())], words: w }); }); }
  function style(cs, text) { var c = rgba(cs.color) || { hex: "000000" }; return { text: text, size: px(cs.fontSize), bold: isBold(cs), italic: cs.fontStyle === "italic", color: c.hex }; }
  var probeCache = {};
  function wordsOf(node, cs, base, out) {
    var txt = node.nodeValue, re = /[^\s ]+/g, m, rg = document.createRange();
    var key = cs.fontFamily + "|" + cs.fontSize + "|" + cs.fontStyle, asc = probeCache[key];
    if (asc == null) {
      // базовая линия шрифта: пустой inline-block стоит ровно на ней
      var host = document.createElement("span"); host.style.cssText = "position:absolute;left:0;top:0;white-space:nowrap;line-height:normal;font-family:" + cs.fontFamily + ";font-size:" + cs.fontSize + ";font-style:" + cs.fontStyle;
      host.innerHTML = 'Ag<span style="display:inline-block;width:0;height:0;vertical-align:baseline"></span>'; document.body.appendChild(host);
      var r1 = document.createRange(); r1.selectNodeContents(host.firstChild); var top = r1.getBoundingClientRect().top, bl = host.lastChild.getBoundingClientRect().top;
      asc = probeCache[key] = bl - top; host.remove();
    }
    var st = style(cs, "");
    while ((m = re.exec(txt))) {
      rg.setStart(node, m.index); rg.setEnd(node, m.index + m[0].length);
      var rs = rg.getClientRects(); if (!rs.length) continue;
      // слово с переносом на две строки не бывает: берём первый прямоугольник
      var r = rs[0];
      out.push({ text: m[0].replace(/ /g, " "), x: r.left - base.left, top: r.top - base.top, w: r.width, base: r.top - base.top + asc, size: st.size, bold: st.bold, italic: st.italic, color: st.color });
    }
  }

  /* ---------- PDF ---------- */
  function toPdf(slides, fonts) {
    var J = window.jspdf && window.jspdf.jsPDF; if (!J) throw new Error("нет модуля PDF");
    var doc = new J({ orientation: "landscape", unit: "pt", format: [960, 540], compress: true }), k = 0.5;
    doc.addFileToVFS("CeraR.ttf", fonts.regular); doc.addFont("CeraR.ttf", "CeraR", "normal");
    doc.addFileToVFS("CeraB.ttf", fonts.bold); doc.addFont("CeraB.ttf", "CeraB", "normal");
    var hex = function (h) { return "#" + h; };
    slides.forEach(function (prims, si) {
      if (si) doc.addPage([960, 540], "landscape");
      prims.forEach(function (p) {
        if (p.t === "rect") {
          var x = p.x * k, y = p.y * k, w = p.w * k, h = p.h * k, mode = p.fill && p.stroke ? "FD" : p.fill ? "F" : "S";
          if (p.alpha != null && p.alpha < 1) doc.setGState(new doc.GState({ opacity: p.alpha }));
          if (p.fill) doc.setFillColor(hex(p.fill));
          if (p.stroke) { doc.setDrawColor(hex(p.stroke)); doc.setLineWidth(p.sw * k); }
          if (p.ell) doc.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, mode);
          else roundPath(doc, x, y, w, h, p.r.map(function (r) { return r * k; }), mode);
          if (p.alpha != null && p.alpha < 1) doc.setGState(new doc.GState({ opacity: 1 }));
        } else if (p.t === "line") {
          doc.setDrawColor(hex(p.color)); doc.setLineWidth(p.w * k);
          if (p.dash) doc.setLineDashPattern(p.dash.split(/[\s,]+/).map(function (v) { return +v * k; }), 0);
          doc.line(p.x1 * k, p.y1 * k, p.x2 * k, p.y2 * k);
          if (p.dash) doc.setLineDashPattern([], 0);
        } else if (p.t === "img") {
          if (p.data) doc.addImage(p.data, p.fmt, p.x * k, p.y * k, p.w * k, p.h * k, undefined, "FAST");
        } else if (p.t === "text") {
          p.words.forEach(function (q) {
            doc.setFont(q.bold ? "CeraB" : "CeraR", "normal"); doc.setFontSize(q.size * k); doc.setTextColor(hex(q.color));
            // ширину слова подгоняем под браузерную, чтобы строки совпали один в один
            var wPdf = doc.getTextWidth(q.text), sx = wPdf > 0 ? Math.min(1.08, Math.max(0.92, q.w * k / wPdf)) : 1;
            var opt = { baseline: "alphabetic" };
            if (Math.abs(sx - 1) > 0.002 || q.italic) opt.horizontalScale = sx;
            // у шрифта нет курсива: браузер наклоняет буквы сам, в PDF делаем тот же наклон (≈ 11°)
            // наклон относительно самого слова: сдвиг компенсирует высоту строки на странице
            if (q.italic) opt.angle = new doc.Matrix(1, 0, 0.2, 1, -0.2 * (540 - q.base * k), 0);
            doc.text(q.text, q.x * k, q.base * k, opt);
          });
        }
      });
    });
    return doc;
  }
  function roundPath(doc, x, y, w, h, r, mode) {
    if (!r.some(function (v) { return v > 0; })) { doc.rect(x, y, w, h, mode); return; }
    if (r[0] === r[1] && r[1] === r[2] && r[2] === r[3]) { doc.roundedRect(x, y, w, h, r[0], r[0], mode); return; }
    var c = 0.5523, L = [];
    // путь по часовой стрелке со своими радиусами углов
    doc.moveTo(x + r[0], y); doc.lineTo(x + w - r[1], y); if (r[1]) doc.curveTo(x + w - r[1] + r[1] * c, y, x + w, y + r[1] - r[1] * c, x + w, y + r[1]);
    doc.lineTo(x + w, y + h - r[2]); if (r[2]) doc.curveTo(x + w, y + h - r[2] + r[2] * c, x + w - r[2] + r[2] * c, y + h, x + w - r[2], y + h);
    doc.lineTo(x + r[3], y + h); if (r[3]) doc.curveTo(x + r[3] - r[3] * c, y + h, x, y + h - r[3] + r[3] * c, x, y + h - r[3]);
    doc.lineTo(x, y + r[0]); if (r[0]) doc.curveTo(x, y + r[0] - r[0] * c, x + r[0] - r[0] * c, y, x + r[0], y);
    doc.close(); if (mode === "F") doc.fill(); else if (mode === "S") doc.stroke(); else doc.fillStroke();
  }

  /* ---------- PPTX (редактируемый: текст — настоящие надписи, плашки — фигуры) ---------- */
  function toPptx(slides, notes) {
    var P = window.PptxGenJS; if (!P) throw new Error("нет модуля PowerPoint");
    var pres = new P(); pres.layout = "LAYOUT_WIDE"; // 13,333 × 7,5 дюйма = 1920 × 1080
    var k = 1 / 144, pt = 0.5;
    slides.forEach(function (prims, si) {
      var s = pres.addSlide();
      prims.forEach(function (p) {
        if (p.t === "rect") {
          var o = { x: p.x * k, y: p.y * k, w: p.w * k, h: p.h * k, line: p.stroke ? { color: p.stroke, width: p.sw * pt } : { type: "none" } };
          o.fill = p.fill ? { color: p.fill, transparency: p.alpha != null && p.alpha < 1 ? Math.round((1 - p.alpha) * 100) : 0 } : { type: "none" };
          var r = p.r || [0, 0, 0, 0];
          if (p.ell) s.addShape(pres.ShapeType.ellipse, o);
          else if (r[0] && r[0] === r[1] && r[1] === r[2] && r[2] === r[3]) s.addShape(pres.ShapeType.roundRect, Object.assign(o, { rectRadius: r[0] * k }));
          else if (r[0] && !r[2]) { // скругление только сверху (столбики): скруглённая фигура + прямоугольник снизу
            s.addShape(pres.ShapeType.roundRect, Object.assign({}, o, { rectRadius: r[0] * k }));
            if (p.h > r[0] * 2) s.addShape(pres.ShapeType.rect, Object.assign({}, o, { y: (p.y + p.h / 2) * k, h: p.h / 2 * k }));
          } else s.addShape(pres.ShapeType.rect, o);
        } else if (p.t === "line") {
          s.addShape(pres.ShapeType.line, { x: Math.min(p.x1, p.x2) * k, y: Math.min(p.y1, p.y2) * k, w: Math.abs(p.x2 - p.x1) * k || 0.001, h: Math.abs(p.y2 - p.y1) * k || 0, line: { color: p.color, width: p.w * pt, dashType: p.dash ? "dash" : "solid" } });
        } else if (p.t === "img") {
          if (p.data) s.addImage({ data: p.data, x: p.x * k, y: p.y * k, w: p.w * k, h: p.h * k });
        } else if (p.t === "text") {
          // строки ровно как в предпросмотре: переносы там же, где у браузера (в любой программе слайд выглядит одинаково)
          var runs = [], prev = null;
          p.words.forEach(function (q) {
            var sameLine = prev && Math.abs(q.base - prev.base) < q.size * 0.5;
            var sameStyle = prev && sameLine && prev.bold === q.bold && prev.italic === q.italic && prev.color === q.color && prev.size === q.size;
            if (prev && !sameLine) runs[runs.length - 1].options.breakLine = true;
            // пробел — только там, где он есть в предпросмотре («Валериевну,» без пробела перед запятой)
            var sp = sameLine && q.x - (prev.x + prev.w) > q.size * 0.12 ? " " : "";
            if (sameStyle) runs[runs.length - 1].text += sp + q.text;
            else runs.push({ text: sp + q.text, options: { fontFace: q.bold ? "Cera Round Bold" : "Cera Round", fontSize: q.size * pt, color: q.color, italic: q.italic, bold: false } });
            prev = q;
          });
          if (!runs.length) return;
          // поле чуть шире: у PowerPoint своя разбивка строк, запас не даёт перенести последнее слово
          var slack = p.nowrap ? 0.25 : 0.03, w = p.w * (1 + slack), x = p.align === "center" ? p.x - p.w * slack / 2 : p.align === "right" ? p.x - p.w * slack : p.x;
          s.addText(runs, { x: x * k, y: p.y * k, w: w * k, h: Math.max(p.h, p.lh) * k, margin: 0, valign: "top", align: p.align === "justify" ? "left" : p.align, lineSpacing: p.lh * pt, paraSpaceBefore: 0, paraSpaceAfter: 0, fit: "none", wrap: !p.nowrap, isTextBox: true });
        }
      });
      if (notes && notes[si]) s.addNotes(notes[si]);
    });
    return pres;
  }

  window.__otvDeck = window.__otvDeck || {};
  Object.assign(window.__otvDeck, { measure: measure, toPdf: toPdf, toPptx: toPptx });
})();
