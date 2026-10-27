/* «Ответошная» — презентация «Онлайн-обращения» по утверждённому шаблону ГКБ № 24.
   Слайды — та же разметка, что в утверждённой презентации (16–22.10.2026), цифры подставляются из данных программы.
   Из одной отрисовки получаются оба файла: PDF (векторный, с шрифтом Cera Round внутри) и редактируемый PPTX.
   Шрифт и фото врачей хранятся только в программе на компьютере, не в репозитории. */
(function () {
  "use strict";
  var W = 1920, H = 1080;
  var B = "font-family:'Cera Round Bold', Arial, sans-serif;font-weight:400;";
  var C = { blue: "#3D587D", red: "#E7303F", ice: "#EEF2F8", pink: "#FDECEE", ink: "#1E2A36", grey: "#63707E", mute: "#9AA5B4", line: "#D9DEE5",
    mid: "#4F78B0", bar: "#A9BBD4", bar2: "#8FA6C6", pale: "#C3D1E4", gold: "#FFF7E3", goldB: "#E2B33C", goldD: "#D9A520", goldT: "#8A6200", navy: "#1e2e46" };
  var A = function (k) { return (window.__otvDeckAssets || {})[k] || ""; };

  /* ---------- русский текст ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  // неразрывный пробел после коротких слов и «№»: без висящих предлогов
  function nb(s) { var x = esc(s), re = /(^|[\s(«„;])((?:[а-яёА-ЯЁ]{1,2}|№|без|для|над|под|при|про|что|или))\s+/g, f = function (m, a, w) { return a + w + "&#160;"; }; return x.replace(re, f).replace(re, f); }
  // число и слово: 1 отзыв, 2 отзыва, 5 отзывов
  function plural(n, one, few, many) { n = Math.abs(n) % 100; var d = n % 10; if (n > 10 && n < 20) return many; if (d === 1) return one; if (d >= 2 && d <= 4) return few; return many; }
  var W_POS = ["позитивный отзыв", "позитивных отзыва", "позитивных отзывов"];
  var W_NEG = ["негативный отзыв", "негативных отзыва", "негативных отзывов"];
  var W_THX = ["благодарность", "благодарности", "благодарностей"];
  function pw(n, w) { return plural(n, w[0], w[1], w[2]); }
  function ordinal(n) { return n + "-е"; }
  var MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  var MON1 = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  function d0(iso) { return new Date(iso + "T12:00:00"); }
  function dm(iso) { var d = d0(iso); return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2); }
  function dmShort(iso) { var d = d0(iso); return d.getDate() + "." + ("0" + (d.getMonth() + 1)).slice(-2); }
  function human(a, b) { var x = d0(a), y = d0(b); return x.getMonth() === y.getMonth() ? x.getDate() + "–" + y.getDate() + " " + MON[y.getMonth()] + " " + y.getFullYear() : x.getDate() + " " + MON[x.getMonth()] + " – " + y.getDate() + " " + MON[y.getMonth()] + " " + y.getFullYear(); }
  function pct(a, b) { if (!b) return 0; return Math.round((a / b - 1) * 100); }
  function signed(n) { return (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n) + "%"; }

  /* ---------- общие части слайда ---------- */
  function frame(id, title, n, foot, bg) {
    return '<div style="position:absolute;left:0px;top:172px;width:1920px;height:2px;background:' + C.line + '"></div>' +
      '<h2 style="position:absolute;left:80px;top:66px;width:1480px;font-size:54px;' + B + 'line-height:1.1;color:' + C.blue + '">' + nb(title) + '</h2>' +
      '<img src="' + A("logo24") + '" alt="Логотип «24+»" style="position:absolute;left:1638px;top:60px;width:202px;height:72px;object-fit:contain">' +
      '<p style="position:absolute;left:80px;top:1010px;width:900px;font-size:24px;color:' + C.mute + '">ГБУЗ «ГКБ №&#160;24 ДЗМ» · ' + esc(foot) + '</p>' +
      '<p style="position:absolute;left:1640px;top:1010px;width:200px;font-size:24px;' + B + 'color:' + C.mute + ';text-align:right">' + ("0" + n).slice(-2) + '</p>';
  }
  var SEC = 'background:#FFFFFF;color:' + C.ink + ';font-family:\'Cera Round\', Arial, sans-serif;';
  var PLAT = { "ПроДокторов": ["pd", 150, 36], "Сайт": ["site", 54, 36], "Яндекс": ["ya", 110, 38], "ДокТу": ["doctu", 120, 36], "2ГИС": ["gis", 100, 38], "Google": ["google", 110, 36], "НаПоправку": ["np", 150, 36] };
  function platLogo(p, alt) { var x = PLAT[p] || PLAT["Сайт"]; if (!A(x[0])) return '<p style="font-size:24px;' + B + 'color:' + C.blue + '">' + esc(p) + '</p>'; return '<img src="' + A(x[0]) + '" alt="' + esc(alt || (p === "Сайт" ? "Сайт больницы" : p)) + '" style="width:' + x[1] + 'px;height:' + x[2] + 'px;object-fit:contain">'; }
  function photo(p, style, alt) { return '<img src="' + (p && p.src || "") + '" alt="' + esc(alt || "") + '" style="' + style + ';object-fit:cover;object-position:' + (p && p.pos || "center center") + '">'; }

  /* ---------- слайды недели ---------- */
  function sCover(D) {
    return '<section id="cover" style="background:' + C.navy + '">' +
      photo(D.photos.cover, "position:absolute;top:0px;left:0px;width:1920px;height:1080px", "") +
      '<img src="' + A("logoWhite") + '" alt="Логотип «24+ Московская больница»" style="position:absolute;top:46px;left:80px;width:366px;height:61px;object-fit:contain">' +
      '<div style="position:absolute;top:152px;left:0px;width:1920px;height:2px;background:#ffffff33"></div>' +
      '<div data-shape="ellipse" style="position:absolute;top:150px;left:1000px;width:900px;height:900px;border-radius:50%;background:#ffffff;opacity:0.14"></div>' +
      '<img src="' + A("icon") + '" alt="Иконка «24+ Московская больница»" style="position:absolute;top:319px;left:1169px;width:562px;height:560px;border-radius:66px;object-fit:contain;box-shadow:0 24px 48px #0b121c66">' +
      '<img src="' + A("heart") + '" alt="Значок с сердцем" style="position:absolute;top:228px;left:1622px;width:168px;height:174px;object-fit:contain">' +
      '<h1 style="position:absolute;top:356px;left:80px;width:1000px;font-size:88px;' + B + 'line-height:1.12;white-space:nowrap;color:#ffffff">Онлайн-обращения</h1>' +
      '<div style="position:absolute;top:480px;left:80px;width:1000px;display:flex;flex-direction:row;align-items:start">' +
      '<p style="font-size:52px;' + B + 'line-height:1.15;white-space:nowrap;color:#ffffff;background:' + C.red + ';padding:10px 30px;border-radius:18px">' + esc(D.coverLabel) + '</p></div>' +
      '<p style="position:absolute;top:628px;left:80px;width:900px;font-size:42px;' + B + 'color:#ffffff">ГБУЗ «ГКБ №&#160;24 ДЗМ»</p></section>';
  }
  function sEnd(D) {
    return '<section id="end" style="background:' + C.navy + '">' +
      photo(D.photos.end, "position:absolute;left:0px;top:0px;width:1920px;height:1080px", "") +
      '<div data-shape="ellipse" style="position:absolute;top:90px;left:510px;width:900px;height:900px;border-radius:50%;background:#ffffff;opacity:0.14"></div>' +
      '<img src="' + A("icon") + '" alt="Иконка «24+ Московская больница»" style="position:absolute;top:259px;left:679px;width:562px;height:560px;border-radius:66px;object-fit:contain;box-shadow:0 24px 48px #0b121c66">' +
      '<img src="' + A("heart") + '" alt="Значок с сердцем" style="position:absolute;top:168px;left:1132px;width:168px;height:174px;object-fit:contain"></section>';
  }
  function sWeek(D, n) {
    var w = D.week, max = Math.max.apply(null, w.bars.map(function (b) { return b.v; }).concat([1]));
    var bars = w.bars.map(function (b) {
      var h = Math.round(b.v / max * 219);
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px"><p style="font-size:' + (b.cur ? 28 : 24) + 'px;' + B + 'color:' + (b.cur ? C.blue : C.grey) + '">' + b.v + '</p><div style="width:64px;height:' + h + 'px;background:' + (b.cur ? C.blue : C.bar) + ';border-radius:8px 8px 0px 0px"></div></div>';
    }).join("");
    var labels = w.bars.map(function (b) { return '<p style="flex:1;font-size:24px;' + (b.cur ? B : "") + 'text-align:center;color:' + (b.cur ? C.blue : C.grey) + '">' + esc(b.label) + '</p>'; }).join("");
    var tiles = w.platforms.map(function (p) {
      var logo = platLogo(p.key, p.key === "Сайт" ? "Логотип сайта «24+»" : p.key);
      if (p.key === "Сайт") logo = '<div style="display:flex;flex-direction:row;align-items:center;gap:10px">' + logo + '</div>';
      return '<div style="display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:12px;background:#FFFFFF;border:2px solid #DCE4EF;border-radius:18px;padding:18px 24px">' + logo +
        '<p style="font-size:40px;' + B + 'line-height:1;color:' + (p.v ? C.blue : C.mute) + '">' + p.v + '</p></div>';
    }).join("");
    return '<section id="week" style="' + SEC + 'padding:212px 80px 104px 80px;display:flex;flex-direction:column;gap:20px">' + frame("week", w.title, n, D.foot) +
      '<div style="flex:1;display:grid;grid-template-columns:560px 1fr;gap:24px">' +
      '<div style="display:flex;flex-direction:column;gap:8px;background:' + C.blue + ';border-radius:28px;padding:40px 48px">' +
      '<p style="font-size:200px;' + B + 'line-height:1;color:#FFFFFF;white-space:nowrap">' + w.pos + '</p>' +
      '<p style="font-size:36px;' + B + 'line-height:1.2;color:#FFFFFF">' + esc(pw(w.pos, W_POS)) + '</p>' +
      '<p style="font-size:26px;line-height:1.4;color:' + C.pale + '">' + nb(w.place) + '</p>' +
      '<div style="flex:1"></div>' +
      '<p style="align-self:start;max-width:100%;font-size:28px;' + B + 'color:' + C.blue + ';background:#FFFFFF;padding:8px 22px;border-radius:12px">' + nb(w.vsPrev) + '</p>' +
      '<p style="align-self:start;max-width:100%;font-size:28px;' + B + 'color:#FFFFFF;background:' + C.mid + ';padding:8px 22px;border-radius:12px">' + nb(w.vsAvg) + '</p></div>' +
      '<div style="display:flex;flex-direction:column;gap:24px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">' +
      '<div style="display:flex;flex-direction:column;gap:6px;background:' + C.pink + ';border-radius:24px;padding:26px 36px">' +
      '<p style="font-size:84px;' + B + 'line-height:1;color:' + C.red + ';white-space:nowrap">' + w.neg + '</p>' +
      '<p style="font-size:28px;' + B + 'color:' + C.ink + '">' + esc(pw(w.neg, W_NEG)) + '</p>' +
      '<p style="font-size:24px;color:' + C.grey + '">' + nb(w.negLine) + '</p></div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;background:' + C.ice + ';border-radius:24px;padding:26px 36px">' +
      '<p style="font-size:84px;' + B + 'line-height:1;color:' + C.blue + ';white-space:nowrap">' + w.share + '%</p>' +
      '<p style="font-size:28px;' + B + 'color:' + C.ink + '">отзывов позитивные</p>' +
      '<p style="font-size:24px;color:' + C.grey + '">' + nb(w.shareLine) + '</p></div></div>' +
      '<div style="flex:1;display:flex;flex-direction:column;gap:10px;background:' + C.ice + ';border-radius:24px;padding:24px 36px 18px 36px">' +
      '<p style="font-size:24px;' + B + 'color:' + C.grey + '">' + nb("Позитивные отзывы за последние " + w.bars.length + " недель") + '</p>' +
      '<div style="flex:1;display:flex;flex-direction:row;align-items:end;gap:16px;border-bottom:2px solid ' + C.pale + '">' + bars + '</div>' +
      '<div style="display:flex;flex-direction:row;gap:16px">' + labels + '</div></div></div></div>' +
      '<div style="display:grid;grid-template-columns:repeat(' + w.platforms.length + ', 1fr);gap:16px">' + tiles + '</div></section>';
  }
  // золотая карточка; при 3–4 карточках — компактнее (фото и шрифты меньше), структура та же
  function goldCard(c, small) {
    var ph = small ? 180 : 220;
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:' + (small ? 10 : 12) + 'px;background:' + C.gold + ';border:3px solid ' + C.goldB + ';border-radius:24px;padding:' + (small ? "28px 20px 24px 20px" : "36px 30px 30px 30px") + '">' +
      photo(c.photo, "width:" + ph + "px;height:" + ph + "px;border-radius:50%;border:6px solid " + C.goldB, "Фото: " + c.short) +
      '<p style="font-size:26px;' + B + 'color:' + C.goldT + ';text-align:center">' + nb(c.dept) + '</p>' +
      '<p style="font-size:' + (small ? 40 : 44) + 'px;' + B + 'line-height:1.1;color:' + C.ink + ';text-align:center">' + esc(c.sur) + '</p>' +
      '<p style="font-size:28px;line-height:1.25;color:' + C.ink + ';text-align:center">' + esc(c.name) + '</p>' +
      '<div style="display:flex;flex-direction:row;align-items:baseline;gap:14px"><p style="font-size:' + (small ? 76 : 88) + 'px;' + B + 'line-height:1.05;color:' + C.goldT + ';white-space:nowrap">' + c.n + '</p><p style="font-size:30px;' + B + 'color:' + C.goldT + '">' + esc(pw(c.n, W_THX)) + '</p></div>' +
      (c.quote ? '<p style="font-size:' + (small ? 24 : 26) + 'px;font-style:italic;line-height:1.4;color:' + C.blue + ';text-align:center">«' + nb(c.quote) + '»</p>' : '') +
      '<div style="flex:1"></div>' +
      '<p style="font-size:24px;line-height:1.3;color:' + C.goldT + ';text-align:center">' + nb(c.where) + '</p></div>';
  }
  function sHeroes(D, n) {
    var h = D.heroes, k = h.cards.length;
    if (k <= 2) {
      var rest = h.rest.length ? '<div style="display:flex;flex-direction:column;gap:16px;background:' + C.ice + ';border-radius:24px;padding:28px 28px">' +
        '<p style="font-size:28px;' + B + 'color:' + C.blue + '">' + nb(h.restTitle) + '</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:' + (h.rest.length > 18 ? "6px" : "10px") + ' 18px">' + h.rest.map(function (r) {
          return '<p style="font-size:' + (h.rest.length > 18 ? 22 : 24) + 'px;line-height:1.25;color:' + C.ink + '"><b>' + esc(r.short) + '</b><br><span style="color:' + C.grey + '">' + nb(r.dept) + '</span></p>';
        }).join("") + '</div></div>' : '';
      return '<section id="heroes" style="' + SEC + 'padding:212px 80px 104px 80px;display:grid;grid-template-columns:' + Array(k + 1).join("540px ") + '1fr;gap:24px">' + frame("heroes", "Лидеры по благодарностям за неделю", n, D.foot) +
        h.cards.map(function (c) { return goldCard(c, false); }).join("") + rest + '</section>';
    }
    // 3–4 карточки: карточки в ряд, остальные — строкой во всю ширину под ними
    var strip = h.rest.length ? '<div style="grid-column:1 / -1;display:flex;flex-direction:column;gap:6px;background:' + C.ice + ';border-radius:20px;padding:16px 28px">' +
      '<p style="font-size:24px;line-height:1.35;color:' + C.ink + '"><b style="color:' + C.blue + '">' + nb(h.restTitle) + ':</b> ' + h.rest.map(function (r) { return esc(r.short); }).join(", ") + '</p></div>' : '';
    return '<section id="heroes" style="' + SEC + 'padding:204px 80px 96px 80px;display:grid;grid-template-columns:repeat(' + k + ', 1fr);grid-template-rows:1fr auto;gap:20px 24px">' + frame("heroes", "Лидеры по благодарностям за неделю", n, D.foot) +
      h.cards.map(function (c) { return goldCard(c, true); }).join("") + strip + '</section>';
  }
  function sReview(D, n) {
    var r = D.review;
    return '<section id="review" style="background:' + C.blue + ';color:#FFFFFF;font-family:\'Cera Round\', Arial, sans-serif;padding:0px 80px 0px 0px;display:flex;flex-direction:row;gap:64px">' +
      photo(r.photo, "width:768px;height:1080px;flex:none", "Фото: " + r.short) +
      '<p style="position:absolute;left:832px;top:1010px;width:900px;font-size:24px;color:' + C.pale + '">ГБУЗ «ГКБ №&#160;24 ДЗМ» · ' + esc(D.foot) + '</p>' +
      '<p style="position:absolute;left:1640px;top:1010px;width:200px;font-size:24px;' + B + 'color:' + C.pale + ';text-align:right">' + ("0" + n).slice(-2) + '</p>' +
      '<div style="flex:1;display:flex;flex-direction:column;gap:22px;padding:84px 0px 112px 0px">' +
      '<p style="align-self:start;font-size:28px;' + B + 'color:#FFFFFF;background:' + C.red + ';padding:8px 26px;border-radius:12px">Отзыв недели</p>' +
      '<p style="font-size:50px;' + B + 'line-height:1.22;color:#FFFFFF">«' + nb(r.quote) + '»</p>' +
      '<p style="font-size:28px;line-height:1.35;color:' + C.pale + '">' + nb(r.lineBefore) + '<b style="color:#FFFFFF">' + nb(r.lineName) + '</b>' + nb(r.lineAfter) + '</p>' +
      '<div style="align-self:start;display:flex;flex-direction:row;align-items:center;gap:22px;background:#FFFFFF;border-radius:16px;padding:12px 26px">' +
      r.platforms.map(function (p) { return platLogo(p); }).join("") +
      '<p style="font-size:24px;' + B + 'color:' + C.blue + '">' + esc(r.date) + '</p></div>' +
      '<div style="flex:1"></div>' +
      (r.voices.length ? '<p style="font-size:26px;' + B + 'color:' + C.pale + '">' + nb(r.voicesTitle) + '</p>' +
      '<div style="display:grid;grid-template-columns:repeat(' + r.voices.length + ', 1fr);gap:20px">' + r.voices.map(function (v) {
        return '<div style="display:flex;flex-direction:column;gap:10px;background:#FFFFFF;border-radius:20px;padding:24px 26px">' +
          '<p style="font-size:24px;font-style:italic;line-height:1.38;color:' + C.ink + '">«' + nb(v.quote) + '»</p><div style="flex:1"></div>' +
          '<p style="font-size:24px;' + B + 'line-height:1.25;color:' + C.blue + '">' + esc(v.short) + '</p>' +
          '<p style="font-size:24px;line-height:1.25;color:' + C.grey + '">' + nb(v.role) + '</p></div>';
      }).join("") + '</div>' : '') + '</div></section>';
  }
  function sWhere(D, n) {
    var w = D.where, bw = 90;
    // широкий вариант: много отделений или три призовых места — две фотографии справа вместо трёх, слева больше места
    var wide = w.wide != null ? w.wide : w.gold.length >= 3;
    var gold = w.gold.map(function (g) {
      return '<div style="display:flex;flex-direction:column;gap:12px;background:' + C.gold + ';border:3px solid ' + C.goldB + ';border-radius:24px;padding:22px 26px"><div style="display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:12px"><div style="width:60px;height:60px;flex:none;display:flex;align-items:center;justify-content:center;background:' + C.goldD + ';border-radius:50%"><p style="font-size:30px;' + B + 'color:#FFFFFF">' + g.place + '</p></div><p style="font-size:84px;' + B + 'line-height:1;color:' + C.goldT + ';white-space:nowrap">' + g.n + '</p></div><div style="display:flex;flex-direction:column;gap:2px">' +
        g.names.map(function (x) { return '<p style="font-size:' + (g.names.length > 4 ? 24 : 28) + 'px;' + B + 'line-height:1.3;color:' + C.ink + ';' + (x.length < 18 ? "white-space:nowrap" : "") + '">' + nb(x) + '</p>'; }).join("") + '</div></div>';
    }).join("");
    // список — всегда одна колонка с ровным шагом, как в утверждённых презентациях; при длинном списке строки плотнее
    var maxNames = Math.max.apply(null, w.gold.map(function (g) { return g.names.length; }).concat([0]));
    var long = w.one.length > 6 || (w.one.length > 4 && maxNames > 3), lw = 430;
    var ones = w.one.map(function (x) {
      return '<div style="display:grid;grid-template-columns:' + lw + 'px 1fr;gap:16px;align-items:center"><p style="font-size:' + (long ? 26 : 30) + 'px;line-height:1.2;color:' + C.ink + ';' + (x.name.length <= 28 ? "white-space:nowrap" : "") + '">' + nb(x.name) + '</p><div style="display:flex;flex-direction:row;align-items:center;gap:14px"><div style="width:' + Math.min(bw * x.n, 200) + 'px;height:' + (long ? 28 : 32) + 'px;flex:none;background:' + C.bar2 + ';border-radius:8px"></div><p style="font-size:28px;' + B + 'color:' + C.blue + '">' + x.n + '</p></div></div>';
    }).join("");
    var oneTitle = w.one.every(function (x) { return x.n === 1; }) ? "По&#160;одной благодарности" : "Остальные отделения";
    var list = w.one.length ? '<p style="font-size:26px;' + B + 'color:' + C.grey + '">' + oneTitle + '</p><div style="display:flex;flex-direction:column;gap:' + (long ? 8 : 14) + 'px">' + ones + '</div>' : '';
    var general = w.general ? '<div style="align-self:start;display:flex;flex-direction:row;align-items:center;gap:20px;background:' + C.blue + ';border-radius:14px;padding:8px 24px"><p style="font-size:40px;' + B + 'line-height:1.1;color:#FFFFFF;white-space:nowrap">' + w.general + '</p><p style="font-size:26px;' + B + 'color:#FFFFFF">о&#160;больнице в&#160;целом</p></div>' : '';
    var left = '<div style="display:flex;flex-direction:column;gap:' + (long ? 16 : 22) + 'px"><div style="display:grid;grid-template-columns:repeat(' + Math.max(2, w.gold.length) + ', 1fr);gap:20px">' + gold + '</div>' + list + '<div style="flex:1"></div>' + general + '</div>';
    var ph = w.photos;
    if (wide) return '<section id="where" style="' + SEC + 'padding:212px 80px 104px 80px;display:grid;grid-template-columns:1fr 520px;gap:28px">' + frame("where", "Отделения: благодарности за неделю", n, D.foot) + left +
      '<div style="display:flex;flex-direction:column;gap:28px">' + photo(ph[0], "width:520px;height:374px;border-radius:24px", "") + photo(ph[1] || ph[0], "width:520px;height:374px;border-radius:24px", "") + '</div></section>';
    return '<section id="where" style="' + SEC + 'padding:212px 80px 104px 80px;display:grid;grid-template-columns:1fr 440px 600px;gap:28px">' + frame("where", "Отделения: благодарности за неделю", n, D.foot) + left +
      photo(ph[0], "width:440px;height:776px;border-radius:24px", ph[0] && ph[0].alt) +
      '<div style="display:flex;flex-direction:column;gap:28px">' + photo(ph[1], "width:600px;height:374px;border-radius:24px", ph[1] && ph[1].alt) + photo(ph[2], "width:600px;height:374px;border-radius:24px", ph[2] && ph[2].alt) + '</div></section>';
  }
  /* самопроверка вёрстки: текст за краем слайда, на подвале или налезает на соседний блок — выгрузка запрещена */
  function layoutIssues(sec) {
    var base = sec.getBoundingClientRect(), out = [], foot = 1000;
    var texts = [].filter.call(sec.querySelectorAll("p,h1,h2"), function (e) { return e.textContent.trim() && !e.closest("aside"); });
    texts.forEach(function (e) {
      var rg = document.createRange(); rg.selectNodeContents(e);
      var r = rg.getBoundingClientRect(), x = r.left - base.left, y = r.top - base.top, isFoot = y >= foot - 2;
      var name = "«" + e.textContent.trim().slice(0, 40) + "»";
      if (x + r.width > W + 1 || y + r.height > H + 1 || x < -1) out.push(name + " выходит за край слайда");
      else if (!isFoot && y + r.height > foot + 2 && !/^(cover|end)$/.test(sec.id)) out.push(name + " налезает на подвал");
      if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).whiteSpace === "nowrap") out.push(name + " не помещается по ширине");
      // текст или плашка выходит за свою карточку (ближайший блок с фоном)
      for (var a = e.parentElement; a && a !== sec; a = a.parentElement) {
        var bg = getComputedStyle(a).backgroundColor;
        if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) { var ar = a.getBoundingClientRect(), er = e.getBoundingClientRect(); if (er.right > ar.right + 2 || er.left < ar.left - 2) out.push(name + " выходит за карточку"); break; }
      }
    });
    // карточки и плашки не должны выходить за свою колонку
    [].forEach.call(sec.querySelectorAll("div"), function (d) {
      if (d.scrollHeight > d.clientHeight + 4 && getComputedStyle(d).overflow === "visible" && d.children.length && d.parentElement === sec) out.push("блок с текстом «" + d.textContent.trim().slice(0, 30) + "» не помещается по высоте");
    });
    // сам текст (по ширине) в пределах строки абзаца (по высоте): крупные цифры с плотной строкой — как в утверждённом образце
    var tr = texts.map(function (e) { var r = document.createRange(); r.selectNodeContents(e); var a = r.getBoundingClientRect(), b = e.getBoundingClientRect(); return { left: a.left, right: a.right, top: Math.max(a.top, b.top), bottom: Math.min(a.bottom, b.bottom) }; });
    for (var i = 0; i < texts.length; i++) for (var j = i + 1; j < texts.length; j++) {
      var a = tr[i], b = tr[j];
      if (texts[i].contains(texts[j]) || texts[j].contains(texts[i])) continue;
      var ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 6 && oy > 6) out.push("«" + texts[i].textContent.trim().slice(0, 25) + "» и «" + texts[j].textContent.trim().slice(0, 25) + "» налезают друг на друга");
    }
    return out.filter(function (x, k) { return out.indexOf(x) === k; }).slice(0, 6);
  }
  function sYear(D, n) {
    var y = D.year, k = y.weeks.length, wSvg = 1760, base = 641, top = 80, slot = wSvg / k;
    var max = Math.max.apply(null, y.weeks.map(function (w) { return w.pos; }).concat([1]));
    var sc = (base - 1 - top) / max, bw = Math.min(25, slot * 0.6), nw = Math.min(12, slot * 0.29);
    var rects = "", avgY = (base - 1 - y.avg * sc).toFixed(1);
    y.weeks.forEach(function (w, i) {
      var x = i * slot + 1.5, hp = w.pos * sc, hn = w.neg * sc, cur = i === k - 1;
      rects += '<rect x="' + x.toFixed(1) + '" y="' + (base - 1 - hp).toFixed(1) + '" width="' + bw + '" height="' + hp.toFixed(1) + '" rx="4" fill="' + (cur ? C.blue : C.bar) + '"/>';
      if (w.neg) rects += '<rect x="' + (x + bw + 2).toFixed(1) + '" y="' + (base - 1 - hn).toFixed(1) + '" width="' + nw + '" height="' + hn.toFixed(1) + '" rx="3" fill="' + C.red + '"/>';
    });
    // подписи месяцев: у первой недели месяца
    var months = "", seen = {};
    y.weeks.forEach(function (w, i) {
      var m = d0(w.start).getMonth(); if (seen[m]) return; seen[m] = 1;
      var x = Math.round(i * slot + 2), last = d0(y.weeks[k - 1].start).getMonth() === m;
      months += last ? '<p style="position:absolute;left:1610px;top:668px;width:150px;font-size:24px;color:' + C.blue + ';' + B + 'text-align:right">' + MON1[m] + '</p>'
        : '<p style="position:absolute;left:' + x + 'px;top:668px;width:150px;font-size:24px;color:' + C.grey + '">' + MON1[m] + '</p>';
    });
    var lab = function (i, v, col, size, align) {
      var cx = i * slot + 1.5 + bw / 2, yv = base - 1 - v * sc - 44;
      var left = align === "right" ? 1640 : Math.round(cx - 60);
      return '<p style="position:absolute;left:' + left + 'px;top:' + Math.round(yv) + 'px;width:120px;font-size:' + size + 'px;' + B + 'text-align:' + (align || "center") + ';color:' + col + '">' + v + '</p>';
    };
    var peak = y.peakIdx, low = y.lowIdx;
    return '<section id="year" style="' + SEC + 'padding:208px 80px 104px 80px;display:flex;flex-direction:column;gap:28px">' + frame("year", "Динамика " + y.year + " года по неделям", n, D.foot) +
      '<div style="display:flex;flex-direction:row;align-items:center;gap:40px">' +
      [["Позитивные", C.bar], ["Негативные", C.red], ["Эта неделя", C.blue]].map(function (l) { return '<div style="display:flex;flex-direction:row;align-items:center;gap:12px"><div style="width:28px;height:28px;background:' + l[1] + ';border-radius:6px"></div><p style="font-size:26px;color:' + C.grey + '">' + l[0] + '</p></div>'; }).join("") + '</div>' +
      '<div style="position:relative;width:1760px;height:704px">' +
      '<svg width="1760" height="660" viewBox="0 0 1760 660" style="width:1760px;height:660px"><line x1="0" y1="' + base + '" x2="1760" y2="' + base + '" stroke="' + C.pale + '" stroke-width="2"/><line x1="0" y1="' + avgY + '" x2="1760" y2="' + avgY + '" stroke="' + C.grey + '" stroke-width="2" stroke-dasharray="8 8"/>' + rects + '</svg>' +
      months + (peak !== k - 1 ? lab(peak, y.weeks[peak].pos, C.blue, 28) : "") + (low !== k - 1 ? lab(low, y.weeks[low].pos, C.grey, 28) : "") + lab(k - 1, y.weeks[k - 1].pos, C.blue, 32, "right") +
      '<p style="position:absolute;left:1083px;top:' + Math.round(+avgY - 44) + 'px;width:360px;font-size:26px;' + B + 'color:' + C.grey + '">средняя неделя: ' + y.avg + '</p>' +
      '</div></section>';
  }
  var ORDER = [["cover", sCover], ["week", sWeek], ["heroes", sHeroes], ["review", sReview], ["where", sWhere], ["year", sYear], ["end", sEnd]];
  function slidesHtml(D) { return ORDER.filter(function (x) { return !(D.skip || {})[x[0]]; }).map(function (x, i) { return x[1](D, i + 1); }); }

  window.__otvDeck = window.__otvDeck || {};
  Object.assign(window.__otvDeck, { slidesHtml: slidesHtml, layoutIssues: layoutIssues, nb: nb, pw: pw, plural: plural, human: human, dm: dm, dmShort: dmShort, pct: pct, signed: signed, ordinal: ordinal, W: W, H: H, C: C, W_POS: W_POS, W_NEG: W_NEG, W_THX: W_THX, MON: MON });
})();
