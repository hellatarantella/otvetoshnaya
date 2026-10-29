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
  // без висящих в конце строки предлогов и союзов: после них неразрывный пробел (правило: нигде в презентации)
  var SHORTW = "(?:[а-яёА-ЯЁ]{1,2}|№|без|для|над|под|при|про|обо|ото|изо|что|или|как|если|чтобы|когда|через|перед|после|между|около|вокруг|среди|также|тоже|либо|зато|хотя|пока|ради|кроме|вместо|благодаря)";
  function nb(s) { var x = esc(s), re = new RegExp("(^|[\\s(«„;\u00a0])(" + SHORTW + ")\\s+", "gi"), f = function (m, a, w) { return a + w + "&#160;"; }; return x.replace(re, f).replace(re, f).replace(/([А-ЯЁ][а-яё-]+)\s+([А-ЯЁ]\.\s?[А-ЯЁ]\.)/g, "$1&#160;$2"); }
  // то же для готового текста (после правки прямо на слайде): неразрывный пробел символом
  function nbText(x) { var re = new RegExp("(^|[\\s(«„;\u00a0])(" + SHORTW + ")[ \\t]+", "gi"), f = function (m, a, w) { return a + w + "\u00a0"; }; return String(x).replace(re, f).replace(re, f).replace(/([А-ЯЁ][а-яё-]+) +([А-ЯЁ]\. ?[А-ЯЁ]\.)/g, "$1\u00a0$2"); }
  function nbName(s) { return esc(s).replace(/\s+/g, "&#160;"); }
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
      '<p data-eqh="dept" style="display:flex;align-items:flex-end;justify-content:center;font-size:26px;' + B + 'color:' + C.goldT + ';text-align:center">' + nb(c.dept) + '</p>' +
      '<p data-fitw="sur" style="max-width:100%;white-space:nowrap;font-size:' + (small ? 40 : 44) + 'px;' + B + 'line-height:1.1;color:' + C.ink + ';text-align:center">' + esc(c.sur) + '</p>' +
      '<p style="font-size:28px;line-height:1.25;color:' + C.ink + ';text-align:center">' + esc(c.name) + '</p>' +
      '<div style="display:flex;flex-direction:row;align-items:baseline;gap:14px"><p style="position:relative;top:0.05em;font-size:' + (small ? 76 : 88) + 'px;' + B + 'line-height:1.05;color:' + C.goldT + ';white-space:nowrap">' + c.n + '</p><p style="font-size:30px;' + B + 'color:' + C.goldT + '">' + esc(pw(c.n, W_THX)) + '</p></div>' +
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
      '<p style="font-size:24px;line-height:1.35;color:' + C.ink + '"><b style="color:' + C.blue + '">' + nb(h.restTitle) + ':</b> ' + h.rest.map(function (r) { return nbName(r.short); }).join(", ") + '</p></div>' : '';
    return '<section id="heroes" style="' + SEC + 'padding:204px 80px 96px 80px;display:grid;grid-template-columns:repeat(' + k + ', minmax(0px, 1fr));grid-template-rows:1fr auto;gap:20px 24px">' + frame("heroes", "Лидеры по благодарностям за неделю", n, D.foot) +
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
      '<div style="display:grid;grid-template-columns:repeat(' + r.voices.length + ', minmax(0px, 1fr));gap:20px">' + r.voices.map(function (v) {
        return '<div style="display:flex;flex-direction:column;gap:10px;background:#FFFFFF;border-radius:20px;padding:24px 26px">' +
          '<p style="font-size:24px;font-style:italic;line-height:1.38;color:' + C.ink + '">«' + nb(v.quote) + '»</p><div style="flex:1"></div>' +
          '<p style="font-size:24px;' + B + 'line-height:1.25;color:' + C.blue + '">' + esc(v.short) + '</p>' +
          '<p style="font-size:24px;line-height:1.25;color:' + C.grey + '">' + nb(v.role) + '</p></div>';
      }).join("") + '</div>' : '') + '</div></section>';
  }
  // «Отделения»: всегда утверждённая сетка (текст | вертикальное фото | два горизонтальных). Призовые места — строки
  // по содержимому: слева медаль и число, справа названия отдельными плашками (не сливаются в абзац и не разнесены по краям).
  // Шаг списка подбирается так, чтобы колонка заполнялась без дыр: при коротком списке строки свободнее, при длинном — плотнее
  function sWhere(D, n) {
    var w = D.where, H = 776, cw = 664 - 48 - 150 - 18;   // ширина под плашки названий в строке места
    var goldH = w.gold.map(function (g) { var x = 0, lines = 1; g.names.forEach(function (nm) { var ww = nm.length * 15 + 44; if (x && x + ww > cw) { lines++; x = 0; } x += ww + 10; }); return Math.max(76, lines * 50 - 10) + 34; });
    // высота без промежутков списка; свободное место делим на промежутки (не больше 28), не хватает — строки плотнее
    var nOne = w.one.length, goldSum = goldH.reduce(function (a, b) { return a + b; }, 0) + 14 * Math.max(0, w.gold.length - 1);
    var fixed = goldSum + (nOne ? 22 + 34 : 0) + (w.general ? 22 + 58 : 0), rowH = 40, free0 = H - fixed - nOne * rowH;
    var compact = nOne && free0 / (nOne + 1) < 10;
    if (compact) { rowH = 34; free0 = H - fixed - nOne * rowH; }
    var gap = nOne ? Math.max(4, Math.min(28, free0 / (nOne + 1))) : 14, fs = compact ? 26 : (gap >= 26 && nOne <= 5 ? 32 : 30);
    // призовые места — таблица в одной золотой панели: «Место | Отделения | Благодарностей» — место и число в разных колонках
    // с заголовками (рядом медаль и число путались), каждое отделение своей плашкой
    var GCOL = "grid-template-columns:72px 1fr 72px;align-items:center;gap:14px";
    var gold = (w.gold.length ? '<div style="display:flex;flex-direction:row;align-items:center;gap:14px;padding:10px 0px 6px 0px">' + ["Место", "Отделения", "Благодарностей"].map(function (t, i) { return '<p style="font-size:20px;' + B + 'color:' + C.goldT + (i === 0 ? ';width:72px;text-align:center' : i === 1 ? ';flex:1' : ';text-align:right') + '">' + t + '</p>'; }).join("") + '</div>' : '') +
      w.gold.map(function (g) {
      return '<div style="height:2px;background:#F0D58A"></div>' +
        '<div data-fit="prow" style="display:grid;' + GCOL + ';padding:' + (compact ? "8px 0px" : "14px 0px") + '">' +
        '<div style="display:flex;justify-content:center"><div style="width:52px;height:52px;display:flex;align-items:center;justify-content:center;background:' + C.goldD + ';border-radius:50%"><p style="font-size:28px;' + B + 'color:#FFFFFF">' + g.place + '</p></div></div>' +
        '<div style="display:flex;flex-direction:row;flex-wrap:wrap;align-items:center;gap:10px">' + g.names.map(function (x) {
          return '<p data-fit="chip" style="max-width:100%;font-size:28px;' + B + 'line-height:1.2;color:' + C.ink + ';background:#FFFFFF;border-radius:12px;padding:6px 16px">' + nb(x).replace(/ (\d)/g, "&#160;$1") + '</p>';
        }).join("") + '</div>' +
        '<p style="font-size:' + (compact ? 56 : 64) + 'px;' + B + 'line-height:1;color:' + C.goldT + ';white-space:nowrap;text-align:right">' + g.n + '</p></div>';
    }).join("");
    var ones = w.one.map(function (x) {
      return '<div style="display:grid;grid-template-columns:430px 1fr;gap:16px;align-items:center"><p style="font-size:' + fs + 'px;line-height:1.2;color:' + C.ink + ';' + (x.name.length <= 28 ? "white-space:nowrap" : "") + '">' + nb(x.name).replace(/ (\d)/g, "&#160;$1") + '</p><div style="display:flex;flex-direction:row;align-items:center;gap:14px"><div style="width:' + Math.min(90 * x.n, 180) + 'px;height:' + (compact ? 26 : 32) + 'px;flex:none;background:' + C.bar2 + ';border-radius:8px"></div><p style="font-size:28px;' + B + 'line-height:1;color:' + C.blue + '">' + x.n + '</p></div></div>';
    }).join("");
    var oneTitle = w.one.every(function (x) { return x.n === 1; }) ? "По&#160;одной благодарности" : "Остальные отделения";
    var list = nOne ? '<div data-fit="list" style="display:flex;flex-direction:column;gap:' + Math.round(gap) + 'px"><p style="font-size:26px;' + B + 'color:' + C.grey + '">' + oneTitle + '</p>' + ones + '</div>' : '';
    var general = w.general ? '<div data-fit="general" style="align-self:start;display:flex;flex-direction:row;align-items:center;gap:20px;background:' + C.blue + ';border-radius:14px;padding:8px 24px"><p style="font-size:40px;' + B + 'line-height:1.1;color:#FFFFFF;white-space:nowrap">' + w.general + '</p><p style="font-size:26px;' + B + 'color:#FFFFFF">о&#160;больнице в&#160;целом</p></div>' : '';
    var left = '<div data-fit="col" style="display:flex;flex-direction:column;gap:22px;height:776px;min-height:0">' + (w.gold.length ? '<div data-fit="gold" style="display:flex;flex-direction:column;gap:0px;background:' + C.gold + ';border:3px solid ' + C.goldB + ';border-radius:24px;padding:6px 24px">' + gold + '</div>' : '') + '' + list + '<div data-fit="spacer" style="flex:1"></div>' + general + '</div>';
    var ph = w.photos || [];
    return '<section id="where" style="' + SEC + 'padding:212px 80px 104px 80px;display:grid;grid-template-columns:1fr 440px 600px;gap:28px">' + frame("where", "Отделения: благодарности за неделю", n, D.foot) + left +
      photo(ph[0], "width:440px;height:776px;border-radius:24px", ph[0] && ph[0].alt) +
      '<div style="display:flex;flex-direction:column;gap:28px">' + photo(ph[1], "width:600px;height:374px;border-radius:24px", ph[1] && ph[1].alt) + photo(ph[2], "width:600px;height:374px;border-radius:24px", ph[2] && ph[2].alt) + '</div></section>';
  }
  /* подгонка слайда «Отделения» по факту отрисовки: колонка текста заполняется ровно — без дыр и без выхода за подвал */
  function fitSlide(sec) {
    if (!sec || sec.id !== "where") return;
    var col = sec.querySelector('[data-fit="col"]'), list = sec.querySelector('[data-fit="list"]'), goldB = sec.querySelector('[data-fit="gold"]'), sp = sec.querySelector('[data-fit="spacer"]');
    if (!col) return;
    var avail = col.getBoundingClientRect().height;
    var content = function () { var h = 0, kids = [].filter.call(col.children, function (k) { return k !== sp; }); kids.forEach(function (k) { h += k.getBoundingClientRect().height; }); return h + 22 * (col.children.length - 1); };
    var rows = list ? [].slice.call(list.children, 1) : [];
    var setRows = function (fs, bar, gap) { if (!list) return; list.style.gap = gap + "px"; rows.forEach(function (r) { var p = r.querySelector("p"); if (p) p.style.fontSize = fs + "px"; var b = r.querySelector("div > div"); if (b) b.style.height = bar + "px"; }); };
    var steps = [[30, 32, 14], [28, 30, 10], [26, 26, 6], [24, 24, 4], [22, 20, 2]], i = 0;
    setRows.apply(null, steps[0]);
    while (content() > avail + 1 && ++i < steps.length) setRows.apply(null, steps[i]);
    if (content() > avail + 1 && goldB) { [].forEach.call(goldB.querySelectorAll('[data-fit="prow"]'), function (g) { g.style.padding = "6px 0px"; }); [].forEach.call(goldB.querySelectorAll('[data-fit="chip"]'), function (p) { p.style.fontSize = "22px"; p.style.padding = "4px 12px"; }); [].forEach.call(goldB.querySelectorAll('[data-fit="prow"] > div:nth-child(2)'), function (d) { d.style.gap = "6px"; }); }
    spread(sec);
  }
  // свободное место — поровну в промежутки списка (не больше 28 px), чтобы не было дыры над плашкой
  function spread(sec) {
    var col = sec.querySelector('[data-fit="col"]'), list = sec.querySelector('[data-fit="list"]'), goldB = sec.querySelector('[data-fit="gold"]'), sp = sec.querySelector('[data-fit="spacer"]');
    if (!col) return;
    var avail = col.getBoundingClientRect().height, rows = list ? [].slice.call(list.children, 1) : [];
    var content = function () { var h = 0, kids = [].filter.call(col.children, function (k) { return k !== sp; }); kids.forEach(function (k) { h += k.getBoundingClientRect().height; }); return h + 22 * (col.children.length - 1); };
    if (list && rows.length) { var free = avail - content(); if (free > 0) { var g0 = parseFloat(list.style.gap) || 14, g1 = Math.min(28, g0 + free / (rows.length + 1)); list.style.gap = g1 + "px"; } }
    // короткая неделя: остаток — в строки мест и списка (свободнее и крупнее), а что осталось — поровну сверху и снизу, без дыры внизу
    var prows = goldB ? [].slice.call(goldB.querySelectorAll('[data-fit="prow"]')) : [], left = avail - content();
    if (left > 40) {
      if (prows.length) { var add = Math.min(22, left / 2 / (prows.length * 2)); prows.forEach(function (g) { g.style.padding = (14 + add) + "px 0px"; }); }
      if (list && rows.length) { left = avail - content(); var g2 = Math.min(48, (parseFloat(list.style.gap) || 14) + left / 2 / (rows.length + 1)); list.style.gap = g2 + "px"; }
      left = avail - content();
      if (left > 40 && sp && !sec.querySelector('[data-fit="general"]')) { sp.style.flex = "none"; col.style.justifyContent = "center"; }
    }
  }
  /* общее правило для всех слайдов (29.10): расположение блоков не меняется, а если текст не помещается — обычный текст
     (до 34 px: цитаты, имена, подписи, списки) уменьшается ступенями, одинаково на всём слайде, но не больше чем на 20%.
     Заголовки и большие цифры не трогаем. Исходный размер хранится в элементе, повторная подгонка начинается с него */
  function fitText(sec) {
    if (!sec || /^(cover|end)$/.test(sec.id)) return 1;
    var els = [].filter.call(sec.querySelectorAll("p,b,span"), function (e) {
      if (!e.hasAttribute("data-fs0")) { var f = parseFloat(getComputedStyle(e).fontSize) || 0; if (!e.style.fontSize && e.tagName !== "P") return false; e.setAttribute("data-fs0", f); }
      var f0 = +e.getAttribute("data-fs0"); return f0 > 0 && f0 <= 34 && getComputedStyle(e).position !== "absolute";
    });
    var set = function (k) { els.forEach(function (e) { e.style.fontSize = (Math.round(+e.getAttribute("data-fs0") * k * 10) / 10) + "px"; }); };
    // длинное слово в узкой карточке (фамилия): вся группа уменьшается одинаково, ровно чтобы поместилось самое длинное
    var widthFit = function () {
      var groups = {};
      [].forEach.call(sec.querySelectorAll("[data-fitw]"), function (e) { if (!e.hasAttribute("data-fs0")) e.setAttribute("data-fs0", parseFloat(getComputedStyle(e).fontSize) || 0); e.style.fontSize = e.getAttribute("data-fs0") + "px"; (groups[e.getAttribute("data-fitw")] = groups[e.getAttribute("data-fitw")] || []).push(e); });
      Object.keys(groups).forEach(function (g) {
        var r = Math.max.apply(null, groups[g].map(function (e) { return e.clientWidth ? e.scrollWidth / e.clientWidth : 1; }));
        if (r > 1) groups[g].forEach(function (e) { e.style.fontSize = Math.max(+e.getAttribute("data-fs0") * 0.6, Math.floor(+e.getAttribute("data-fs0") / r * 0.98)) + "px"; });
      });
    };
    // подписи разной длины в однотипных карточках: высота по самой высокой, чтобы число и цитата стояли на одном уровне
    var eqH = function () {
      var groups = {};
      [].forEach.call(sec.querySelectorAll("[data-eqh]"), function (e) { e.style.minHeight = ""; (groups[e.getAttribute("data-eqh")] = groups[e.getAttribute("data-eqh")] || []).push(e); });
      Object.keys(groups).forEach(function (g) { var h = Math.max.apply(null, groups[g].map(function (e) { return e.getBoundingClientRect().height; })); groups[g].forEach(function (e) { e.style.minHeight = h + "px"; }); });
    };
    var steps = [1, 0.95, 0.9, 0.85, 0.8], i = 0;
    set(1); widthFit(); eqH();
    while (layoutIssues(sec).length && ++i < steps.length) { set(steps[i]); widthFit(); eqH(); }
    if (sec.id === "where") spread(sec);
    return steps[Math.min(i, steps.length - 1)];
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
  Object.assign(window.__otvDeck, { spread: spread, fitText: fitText, nbText: nbText, slidesHtml: slidesHtml, fitSlide: fitSlide, layoutIssues: layoutIssues, nb: nb, pw: pw, plural: plural, human: human, dm: dm, dmShort: dmShort, pct: pct, signed: signed, ordinal: ordinal, W: W, H: H, C: C, W_POS: W_POS, W_NEG: W_NEG, W_THX: W_THX, MON: MON });
})();
