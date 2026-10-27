/**
 * «Ответошная» — связь программы с отчётами «Позитив», «Негатив» и справочником.
 *
 * Ставится один раз (5 минут):
 *  1. script.google.com → «Создать проект». Удалите всё в окне и вставьте этот текст целиком. Сохраните (значок дискеты).
 *  2. «Развернуть» → «Новое развертывание» → значок шестерёнки → «Веб-приложение».
 *     «Запуск от имени»: Я. «У кого есть доступ»: Все. → «Развернуть».
 *  3. Google попросит разрешение — «Предоставить доступ», выберите свой аккаунт,
 *     «Дополнительные настройки» → «Перейти к проекту» → «Разрешить».
 *  4. Скопируйте «URL веб-приложения» и вставьте его в программе: «Отчёты» → «Подключить Google».
 *
 * Скрипт работает от вашего имени и правит только эти файлы. Программа связывается с ним
 * по секретному ключу, который знает только она (первое подключение запоминает ключ).
 */
var VERSION = 8;
var POS_ID = '1PnkJU3cjl6LlZxe1E9fHfmW7-E5kLi8Nkyr2G4dkw1A';   // «Позитив»
var NEG_ID = '1Sp8sJv90_bUDYoo-4jPVQrHqLQU-E33s2MLJx0lrlpg';   // «Негатив»
var REF_ID = '1s-0vfTvZeqVOrrreu9YY5fM3BycOfBtChuIu2wO8pdI';   // «[ГКБ24] Сбор отзывов — справочник»
var STAFF_ID = '11WQHQVWv-ZmvQr04DpK84ZlzhIWE5gLVbhr0CbXMzmY'; // «[ГКБ24] Список врачей» (берём только ФИО, должность, подразделение)

var ORDER = ['ПроДокторов', 'Сайт', 'Яндекс', 'ДокТу', '2ГИС', 'Google', 'НаПоправку', 'Книга отзывов', 'Колл-центр'];
var COLORS = { 'ПроДокторов': '#eaaae4', 'Сайт': '#bdd7ee', 'Яндекс': '#ffe699', 'ДокТу': '#c6e0b4', '2ГИС': '#d9d2e9',
  'Google': '#f4cccc', 'НаПоправку': '#fce5cd', 'Книга отзывов': '#ead1dc', 'Колл-центр': '#d0e0e3' };
var NUM_COL = { 'ПроДокторов': 0, 'Сайт': 1, 'Яндекс': 2, 'ДокТу': 3 };   // остальные — «Другие»
var MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
var MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
var NEG_LABELS = ['Площадка', 'Дата размещения отзыва', 'Отзыв', 'Ответ', 'Ссылка'];

/* ---------------- вход ---------------- */
function doGet() { return out({ ok: true, app: 'Ответошная', version: VERSION }); }

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(120000);
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var props = PropertiesService.getScriptProperties();
    var tok = props.getProperty('TOKEN');
    var given = String(req.token || '');
    if (given.length < 32) return out({ ok: false, error: 'Нет ключа программы' });
    if (req.action === 'pair') {
      if (tok && tok !== given) return out({ ok: false, error: 'Скрипт уже связан с другой копией программы. Создайте новое развертывание.' });
      if (!tok) props.setProperty('TOKEN', given);
      return out({ ok: true, version: VERSION, state: state() });
    }
    if (!tok || tok !== given) return out({ ok: false, error: 'Нет доступа: подключите скрипт заново' });
    var fn = ACTIONS[req.action];
    if (!fn) return out({ ok: false, error: 'Неизвестное действие: ' + req.action });
    var res = fn(req) || {};
    res.ok = true; res.version = VERSION;
    return out(res);
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

var ACTIONS = {
  state: function () { return { state: state() }; },
  refs: function () { return { refs: refs() }; },
  add: function (req) { var r = add(req.positive || [], req.negative || []); tidy(); r.numbers = numbers('color'); r.state = state(); return r; },
  numbers: function (req) { tidy(); return { numbers: numbers(req.mode || 'color') }; },
  answers: function (req) { return { updated: negAnswers(req.items || []) }; },
  export: function () { return { files: exportBoth() }; },
  newweek: function (req) { return newWeek(req); },
  patch: function (req) { var n = patch(req.items || []); tidy(); return { patched: n, state: state() }; }
};

/* ---------------- даты и период ---------------- */
function pad(n) { return (n < 10 ? '0' : '') + n; }
function ddmm(d) { return pad(d.getDate()) + '.' + pad(d.getMonth() + 1); }
function ddmmyyyy(d) { return ddmm(d) + '.' + d.getFullYear(); }
function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
function parseTitle(title) { // «Позитив 2026_91_02.10_08.10»
  var m = /(\d{4})_(\d+)_(\d{2})\.(\d{2})_(\d{2})\.(\d{2})/.exec(title);
  if (!m) throw new Error('Не понял период в названии файла: ' + title);
  var y = +m[1], a = new Date(y, +m[4] - 1, +m[3]), b = new Date(y, +m[6] - 1, +m[5]);
  if (b < a) b.setFullYear(y + 1);
  return { year: y, num: +m[2], start: a, end: b };
}
function tabName(a, b) {
  return a.getMonth() === b.getMonth()
    ? a.getDate() + '–' + b.getDate() + ' ' + MONTHS_GEN[b.getMonth()] + ' подробный'
    : a.getDate() + ' ' + MONTHS_GEN[a.getMonth()] + ' – ' + b.getDate() + ' ' + MONTHS_GEN[b.getMonth()] + ' подробный';
}
function parseDmy(s) { // «02.10.2026» или дата
  if (s instanceof Date) return s;
  var m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(String(s || ''));
  return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
}
function parseRuDate(s) { // «2 октября 2026»
  var m = /(\d{1,2})\s+([а-яё]+)\s+(\d{4})/i.exec(String(s || ''));
  if (!m) return parseDmy(s);
  var mi = MONTHS_GEN.indexOf(m[2].toLowerCase());
  return mi < 0 ? null : new Date(+m[3], mi, +m[1]);
}
function normPlat(p) {
  p = String(p || '').trim();
  if (/^докту$/i.test(p)) return 'ДокТу';
  if (/^сайт/i.test(p)) return 'Сайт';
  if (/^книга/i.test(p)) return 'Книга отзывов';
  return p;
}
function head(t) { return String(t || '').replace(/\s+/g, ' ').trim().slice(0, 120); }

/* ---------------- «Позитив» ---------------- */
function detailSheet(ss) {
  var sh = ss.getSheets().filter(function (s) { return /подробн/i.test(s.getName()); })[0];
  return sh || ss.getSheets()[0];
}
function readPositive(sh) {
  var last = Math.max(sh.getLastRow(), 3);
  var vals = sh.getRange(3, 1, last - 2, 7).getDisplayValues();
  var rows = [];
  for (var i = 0; i < vals.length; i++) {
    var v = vals[i], plat = normPlat(v[2]);
    if (!plat) continue;
    rows.push({ row: i + 3, num: v[0], date: v[1], platform: plat, dept: v[3], text: v[4], fb: v[5], doctor: v[6],
      filled: !!(String(v[1]).trim() || String(v[4]).trim()) });
  }
  return rows;
}
function sections(rows) {
  var out = {}, order = [];
  rows.forEach(function (r) {
    if (!out[r.platform]) { out[r.platform] = []; order.push(r.platform); }
    out[r.platform].push(r);
  });
  return { by: out, order: order };
}

/* ---------------- «Негатив» ---------------- */
function negTable(doc) {
  var t = doc.getBody().getTables();
  if (!t.length) throw new Error('В «Негативе» нет таблицы');
  return t[0];
}
function cellText(row, i) { return i < row.getNumCells() ? row.getCell(i).getText().replace(/\s+$/, '') : ''; }
function readNegative(t) {
  var blocks = [], cur = null;
  for (var i = 0; i < t.getNumRows(); i++) {
    var row = t.getRow(i), label = cellText(row, 0).replace(/\s+/g, ' ').trim(), val = cellText(row, 1);
    if (/^Площадка/.test(label)) { cur = { start: i, platform: val.trim(), date: '', text: '', answer: '', link: '' }; blocks.push(cur); continue; }
    if (!cur) continue;
    if (/^Дата/.test(label)) cur.date = val.trim();
    else if (/^Отзыв/.test(label)) cur.text = val;
    else if (/^Ответ/.test(label)) cur.answer = val;
    else if (/^Ссылка/.test(label)) { cur.link = val.trim(); cur.end = i; cur = null; }
  }
  blocks.forEach(function (b, k) { b.n = k + 1; b.empty = !b.platform && !b.date && !String(b.text).trim(); });
  return blocks;
}

/* ---------------- состояние отчётов ---------------- */
function state() {
  var ss = SpreadsheetApp.openById(POS_ID), sh = detailSheet(ss);
  var posTitle = ss.getName(), per = parseTitle(posTitle);
  var negDoc = DocumentApp.openById(NEG_ID), negTitle = negDoc.getName();
  var rows = readPositive(sh), blocks = readNegative(negTable(negDoc));
  return {
    posTitle: posTitle, negTitle: negTitle, tab: sh.getName(),
    period: ddmm(per.start) + '–' + ddmm(per.end) + '.' + per.end.getFullYear(), start: iso(per.start), end: iso(per.end),
    positive: rows.filter(function (r) { return r.filled; }).map(function (r) {
      return { platform: r.platform, num: r.num, date: r.date, dept: r.dept, doctor: r.doctor, text: head(r.text), full: String(r.text || '') };
    }),
    negative: blocks.filter(function (b) { return !b.empty; }).map(function (b) {
      var d = parseRuDate(b.date);
      return { n: b.n, platform: b.platform, date: d ? ddmmyyyy(d) : b.date, text: head(b.text), answer: head(b.answer),
        full: String(b.text || ''), fullAnswer: String(b.answer || ''), link: b.link };
    })
  };
}

/* ---------------- справочник ---------------- */
function refs() {
  var ref = SpreadsheetApp.openById(REF_ID);
  var deps = ref.getSheetByName('Подразделения').getDataRange().getDisplayValues().slice(1)
    .filter(function (r) { return r[0]; }).map(function (r) { return [r[0], r[1], r[2], r[3] || '']; });
  var exc = ref.getSheetByName('Исключения').getDataRange().getDisplayValues().slice(1)
    .filter(function (r) { return r[0]; }).map(function (r) { return [r[0], r[1], r[2], r[3], r[4]]; });
  var st = SpreadsheetApp.openById(STAFF_ID), now = new Date(), tab = null;
  var want = MONTHS[now.getMonth()] + ' ' + now.getFullYear();
  tab = st.getSheetByName(want);
  if (!tab) { // последняя месячная вкладка
    var best = null, bestKey = -1;
    st.getSheets().forEach(function (s) {
      var m = /^([А-Яа-яё]+)\s+(\d{4})$/.exec(s.getName().trim()); if (!m) return;
      var mi = MONTHS.indexOf(m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()); if (mi < 0) return;
      var k = +m[2] * 12 + mi; if (k > bestKey) { bestKey = k; best = s; }
    });
    tab = best;
  }
  var staff = [];
  if (tab) {
    var vals = tab.getDataRange().getDisplayValues(), hdr = vals[0] || [];
    var cF = hdr.indexOf('Фамилия, имя, отчество'), cP = hdr.indexOf('Штатная должность'), cD = hdr.indexOf('Штатное подразделение');
    if (cF < 0) cF = 1; if (cP < 0) cP = 5; if (cD < 0) cD = 7;
    for (var i = 1; i < vals.length; i++) {
      var f = String(vals[i][cF] || '').trim();
      if (f.split(/\s+/).length < 2 || /\d/.test(f)) continue;
      staff.push([f, String(vals[i][cP] || '').trim(), String(vals[i][cD] || '').trim()]);   // только ФИО, должность, подразделение
    }
  }
  var cats = SpreadsheetApp.openById(POS_ID).getSheetByName('Цифры').getRange('A3:A60').getDisplayValues()
    .map(function (r) { return r[0]; }).filter(String);
  return { departments: deps, exceptions: exc, staff: staff, staffTab: tab ? tab.getName() : '', categories: cats };
}

/* ---------------- внести в отчёты ---------------- */
function add(pos, neg) {
  var refsOut = {};
  if (pos.length) addPositive(pos, refsOut);
  if (neg.length) addNegative(neg, refsOut);
  return { refs: refsOut };
}

function addPositive(items, refsOut) {
  var ss = SpreadsheetApp.openById(POS_ID), sh = detailSheet(ss);
  var byPlat = {};
  items.forEach(function (it) { var p = normPlat(it.platform); (byPlat[p] = byPlat[p] || []).push(it); });
  ORDER.concat(Object.keys(byPlat).filter(function (p) { return ORDER.indexOf(p) < 0; })).forEach(function (plat) {
    var list = byPlat[plat]; if (!list) return;
    var sec = sections(readPositive(sh)), rows = sec.by[plat];
    if (!rows) { rows = createSection(sh, sec, plat, list.length); }
    var filled = rows.filter(function (r) { return r.filled; });
    var need = filled.length + list.length - rows.length;
    if (need > 0) { growSection(sh, rows, need, plat); rows = sections(readPositive(sh)).by[plat]; }
    // существующие + новые, по дате
    var data = filled.map(function (r) { return { d: parseDmy(r.date), date: r.date, dept: r.dept, text: null, doctor: r.doctor, row: r.row, keep: true }; });
    list.forEach(function (it) { data.push({ d: parseDmy(it.date), dept: it.dept || '', text: String(it.text || ''), doctor: it.doctor || '—', id: it.id }); });
    data.sort(function (a, b) { return (a.d ? a.d.getTime() : 0) - (b.d ? b.d.getTime() : 0); });
    // переносим строки целиком (B, D, E, G), чтобы порядок был по дате
    var oldVals = {};
    filled.forEach(function (r) {
      oldVals[r.row] = { b: sh.getRange(r.row, 2).getValue(), d: sh.getRange(r.row, 4).getValue(), e: sh.getRange(r.row, 5).getValue(), g: sh.getRange(r.row, 7).getValue() };
    });
    for (var i = 0; i < data.length; i++) {
      var r = rows[i].row, x = data[i];
      var v = x.keep ? oldVals[x.row] : { b: x.d, d: x.dept, e: x.text, g: x.doctor };
      sh.getRange(r, 2).setValue(v.b).setNumberFormat('dd.mm.yyyy');
      sh.getRange(r, 4).setValue(v.d);
      sh.getRange(r, 5).setValue(v.e);
      sh.getRange(r, 7).setValue(v.g);
      if (x.id) refsOut[x.id] = 'Позитив · ' + plat + ' №' + (rows[i].num || (i + 1));
    }
    SpreadsheetApp.flush();
  });
}
function rowFormat(sh, fromRow, toRow, n) {
  sh.getRange(fromRow, 1, 1, 7).copyTo(sh.getRange(toRow, 1, n, 7), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
}
function growSection(sh, rows, n, plat) {
  var last = rows[rows.length - 1];
  sh.insertRowsAfter(last.row, n);
  rowFormat(sh, last.row, last.row + 1, n);
  var start = (parseInt(last.num, 10) || rows.length) + 1, fb = last.fb || 'Дан ответ';
  var vals = [];
  for (var i = 0; i < n; i++) vals.push([start + i]);
  sh.getRange(last.row + 1, 1, n, 1).setValues(vals);
  sh.getRange(last.row + 1, 3, n, 1).setValue(plat);
  sh.getRange(last.row + 1, 6, n, 1).setValue(fb);
}
function createSection(sh, sec, plat, n) {
  // после ближайшей предыдущей по порядку площадки
  var at = 2, idx = ORDER.indexOf(plat);
  sec.order.forEach(function (p) {
    var pi = ORDER.indexOf(p);
    if (pi < 0 || idx < 0 || pi < idx) { var rs = sec.by[p]; at = Math.max(at, rs[rs.length - 1].row); }
  });
  var tmpl = sec.order.length ? sec.by[sec.order[0]][0].row : 3;
  sh.insertRowsAfter(at, n);
  if (tmpl > at) tmpl += n;
  rowFormat(sh, tmpl, at + 1, n);
  var vals = [];
  for (var i = 0; i < n; i++) vals.push([i + 1, '', plat, '', '', 'Дан ответ']);
  sh.getRange(at + 1, 1, n, 6).setValues(vals);
  sh.getRange(at + 1, 1, n, 6).setBackground(COLORS[plat] || '#eeeeee');
  SpreadsheetApp.flush();
  return sections(readPositive(sh)).by[plat];
}

function addNegative(items, refsOut) {
  var doc = DocumentApp.openById(NEG_ID), t = negTable(doc);
  items.forEach(function (it) {
    var blocks = readNegative(t), empty = blocks.filter(function (b) { return b.empty; })[0], b;
    if (empty) {
      b = empty;
    } else {
      var lastB = blocks[blocks.length - 1];
      if (!lastB) throw new Error('В «Негативе» нет ни одного блока. Восстановите хотя бы один пустой блок');
      var at = (lastB.end != null ? lastB.end : lastB.start + 4) + 1;
      for (var k = 0; k < 5; k++) t.insertTableRow(at + k, t.getRow(lastB.start + k).copy());
      b = { start: at, n: blocks.length + 1 };
    }
    var vals = [it.platform, it.date, String(it.text || ''), String(it.answer || '—'), it.link || '—'];
    for (var j = 0; j < 5; j++) setCell(t.getRow(b.start + j).getCell(1), vals[j], j === 4 && /^https?:\/\//.test(vals[j]) ? vals[j] : null);
    if (it.id) refsOut[it.id] = 'Негатив · блок ' + b.n;
  });
  doc.saveAndClose();
}
function setCell(cell, text, link) {
  // текст ячейки целиком. Последний абзац ячейки Google удалить не даёт — оставляем его, остальные убираем.
  // Пустой текст Google вставлять не разрешает («Невозможно вставить пустой текстовый элемент»): пустые строки пропускаем, пустую ячейку очищаем
  while (cell.getNumChildren() > 1) cell.removeChild(cell.getChild(0));
  var p = cell.getChild(0).asParagraph();
  var parts = String(text == null ? '' : text).split(/\r?\n/).map(function (x) { return x.replace(/\s+$/, ''); }).filter(function (x) { return x.trim().length > 0; });
  if (!parts.length) { try { p.clear(); } catch (e) { p.setText(' '); } return; }
  var tmpl = p.copy();
  p.setText(parts[0]);
  p.editAsText().setLinkUrl(0, parts[0].length - 1, link || null);
  for (var i = 1; i < parts.length; i++) { var q = tmpl.copy(); q.setText(parts[i]); q.editAsText().setLinkUrl(null); cell.insertParagraph(i, q); }
}

/* ответы в «Негативе»: проект → опубликованный текст */
function negAnswers(items) {
  var doc = DocumentApp.openById(NEG_ID), t = negTable(doc), blocks = readNegative(t), n = 0;
  items.forEach(function (it) {
    var key = head(it.text).slice(0, 60);
    var b = blocks.filter(function (x) { return !x.empty && head(x.text).slice(0, 60) === key; })[0];
    if (!b) return;
    var row = b.start + 3;
    setCell(t.getRow(row).getCell(1), String(it.answer || '—'), null);
    n++;
  });
  doc.saveAndClose();
  return n;
}

/* исправление уже записанных ячеек. Что и где править, решает программа; скрипт только пишет.
   Каждая правка проверяет «ключ» (начало текста, который сейчас стоит в строке): если строку успели поменять или сдвинуть, правка пропускается.
   items: { kind: 'pos', platform, num, key, text } | { kind: 'neg', n, key, text?, answer?, link? } */
function patch(items) {
  var n = 0, pos = items.filter(function (x) { return x.kind === 'pos'; }), neg = items.filter(function (x) { return x.kind === 'neg'; });
  if (pos.length) {
    var ss = SpreadsheetApp.openById(POS_ID), sh = detailSheet(ss), rows = readPositive(sh);
    pos.forEach(function (it) {
      var r = rows.filter(function (x) { return x.platform === normPlat(it.platform) && String(x.num) === String(it.num); })[0];
      if (!r || head(r.text).slice(0, 60) !== head(it.key).slice(0, 60)) return;
      if (String(it.text || '').trim()) { sh.getRange(r.row, 5).setValue(String(it.text)); n++; }
      // врач: только если в строке он не указан (ручную запись не трогаем)
      if (String(it.doctor || '').trim() && /^\s*[—-]?\s*$/.test(String(r.doctor || ''))) { sh.getRange(r.row, 7).setValue(String(it.doctor)); n++; }
    });
  }
  if (neg.length) {
    var doc = DocumentApp.openById(NEG_ID), t = negTable(doc), blocks = readNegative(t);
    neg.forEach(function (it) {
      var b = blocks.filter(function (x) { return x.n === it.n && !x.empty; })[0];
      if (!b || head(b.text).slice(0, 60) !== head(it.key).slice(0, 60)) return;
      if (it.text != null && String(it.text).trim()) setCell(t.getRow(b.start + 2).getCell(1), String(it.text), null);
      if (it.answer != null) setCell(t.getRow(b.start + 3).getCell(1), String(it.answer || '—'), null);
      if (it.link != null) setCell(t.getRow(b.start + 4).getCell(1), String(it.link || '—'), /^https?:\/\//.test(String(it.link)) ? String(it.link) : null);
      n++;
    });
    doc.saveAndClose();
  }
  return n;
}

/* порядок в отчётах: по дате размещения, от ранней (вверху) к поздней (внизу); потом номера подряд */
function tidy() { sortPositive(); sortNegative(); renumber(); }
function dkey_(s) { var d = parseDmy(s) || parseRuDate(s); return d ? d.getTime() : 9e15; }
function sortPositive() {
  var ss = SpreadsheetApp.openById(POS_ID), sh = detailSheet(ss), rows = readPositive(sh), sec = sections(rows), n = 0;
  sec.order.forEach(function (pl) {
    var list = sec.by[pl], filled = list.filter(function (r) { return r.filled; });
    var sorted = filled.map(function (r, i) { return { r: r, i: i }; }).sort(function (a, b) { return (dkey_(a.r.date) - dkey_(b.r.date)) || (a.i - b.i); }).map(function (x) { return x.r; });
    var want = sorted.concat(list.filter(function (r) { return !r.filled; }));
    if (want.every(function (r, i) { return r.row === list[i].row; })) return;
    var vals = want.map(function (r) { return sh.getRange(r.row, 2, 1, 6).getValues()[0]; });
    list.forEach(function (r, i) { sh.getRange(r.row, 2, 1, 6).setValues([vals[i]]); });
    n++;
  });
  return n;
}
function sortNegative() {
  var doc = DocumentApp.openById(NEG_ID), t = negTable(doc), blocks = readNegative(t).filter(function (b) { return !b.empty; });
  var sorted = blocks.map(function (b, i) { return { b: b, i: i }; }).sort(function (a, c) { return (dkey_(a.b.date) - dkey_(c.b.date)) || (a.i - c.i); }).map(function (x) { return x.b; });
  if (sorted.every(function (b, i) { return b === blocks[i]; })) return 0;
  var data = sorted.map(function (b) { return [b.platform, b.date, b.text, b.answer, b.link]; });
  blocks.forEach(function (b, i) {
    for (var j = 0; j < 5; j++) setCell(t.getRow(b.start + j).getCell(1), data[i][j], j === 4 && /^https?:\/\//.test(data[i][j]) ? data[i][j] : null);
  });
  doc.saveAndClose();
  return 1;
}

/* номера в «Позитиве» идут подряд 1, 2, 3… в каждом разделе площадки — по факту строк, а не как были записаны.
   Удалили строку — номера ниже сдвигаются сами */
function renumber() {
  var ss = SpreadsheetApp.openById(POS_ID), sh = detailSheet(ss), rows = readPositive(sh), sec = sections(rows), n = 0;
  sec.order.forEach(function (pl) {
    sec.by[pl].forEach(function (r, i) { if (String(r.num) !== String(i + 1)) { sh.getRange(r.row, 1).setValue(i + 1); n++; } });
  });
  return n;
}

/* ---------------- «Цифры» ---------------- */
function numbers(mode) {
  var ss = SpreadsheetApp.openById(POS_ID), sh = detailSheet(ss), num = ss.getSheetByName('Цифры');
  var names = num.getRange('A3:A60').getDisplayValues().map(function (r) { return r[0]; });
  var n = names.indexOf(''); if (n < 0) n = names.length; names = names.slice(0, n);
  var counts = {}, unknown = [];
  names.forEach(function (d) { counts[d] = [0, 0, 0, 0, 0]; });
  readPositive(sh).forEach(function (r) {
    if (!r.filled) return;
    var d = String(r.dept).trim(), c = NUM_COL.hasOwnProperty(r.platform) ? NUM_COL[r.platform] : 4;
    if (!counts[d]) { unknown.push(d || '(пусто)'); return; }
    counts[d][c]++;
  });
  var total = function (d) { return counts[d].reduce(function (a, b) { return a + b; }, 0); };
  names.sort(function (a, b) {
    return (total(b) - total(a)) || (counts[b][0] - counts[a][0]) || a.localeCompare(b, 'ru');
  });
  var rows = names.map(function (d) { return [d].concat(counts[d].map(function (x) { return x || ''; })); });
  var last = 2 + rows.length;
  num.getRange(3, 1, rows.length, 6).setValues(rows);
  var L = ['B', 'C', 'D', 'E', 'F'];
  num.getRange(2, 1, 1, 7).setValues([['ВСЕГО ОТЗЫВОВ'].concat(L.map(function (c) { return '=SUM(' + c + '3:' + c + last + ')'; }), ['=SUM(B2:F2)'])]);
  num.getRange(1, 1, 2, 7).setBackground('#ffffff').setFontWeight('bold');
  var body = num.getRange(3, 1, rows.length, 7);
  body.setFontWeight('normal').setFontColor('#000000');
  if (mode === 'white') body.setBackground('#ffffff');
  else {
    body.setBackgrounds(names.map(function (d) {
      var t = total(d), c = t >= 3 ? '#92d050' : t === 2 ? '#ffe699' : t === 1 ? '#fbbc04' : '#ea4335';
      return [c, c, c, c, c, c, c];
    }));
  }
  var sum = [0, 0, 0, 0, 0];
  names.forEach(function (d) { counts[d].forEach(function (x, i) { sum[i] += x; }); });
  return { totals: { 'ПроДокторов': sum[0], 'Сайт': sum[1], 'Яндекс': sum[2], 'ДокТу': sum[3], 'Другие': sum[4] }, unknown: unknown };
}

/* ---------------- сохранить и начать новую неделю ---------------- */
function exportBoth() {
  var token = ScriptApp.getOAuthToken();
  function ex(id, mime, ext) {
    var name = DriveApp.getFileById(id).getName();
    var r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id + '/export?mimeType=' + encodeURIComponent(mime),
      { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error('Google не отдал файл «' + name + '»: ' + r.getResponseCode());
    return { name: name + ext, data: Utilities.base64Encode(r.getBlob().getBytes()) };
  }
  return [ex(POS_ID, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.xlsx'),
          ex(NEG_ID, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx')];
}

function newWeek(req) {
  if (!req.saved) throw new Error('Сначала сохраните старые отчёты');
  var ss = SpreadsheetApp.openById(POS_ID), posTitle = ss.getName(), per = parseTitle(posTitle);
  var a = addDays(per.end, 1), b = addDays(per.end, 7), today = new Date();
  if (today < a) throw new Error('Неделя ' + ddmm(per.start) + '–' + ddmm(per.end) + ' ещё не закончилась. Новый отчёт можно начать с пятницы');
  if (req.expect && req.expect !== ddmm(a) + '–' + ddmm(b)) throw new Error('Отчёт уже сменился. Обновите окно');
  var negDoc = DocumentApp.openById(NEG_ID), negTitle = negDoc.getName();
  // у «Негатива» свой счётчик: неделя без негатива номер не тратит (документ просто переходит на новую неделю с тем же номером)
  var negEmpty = !readNegative(negTable(negDoc)).some(function (b) { return !b.empty; });
  var mN = /(\d{4})_(\d+)_/.exec(negTitle), negNum = mN ? +mN[2] + (negEmpty ? 0 : 1) : per.num + 1;
  var newPos = 'Позитив ' + a.getFullYear() + '_' + (per.num + 1) + '_' + ddmm(a) + '_' + ddmm(b);
  var newNeg = 'Негатив ' + a.getFullYear() + '_' + negNum + '_' + ddmm(a) + '_' + ddmm(b);

  // «Позитив»
  var sh = detailSheet(ss);
  sh.setName(tabName(a, b));
  sh.getRange('A1').setValue('ПОЗИТИВНЫЕ ОТЗЫВЫ_' + ddmm(a) + '–' + ddmm(b) + ' ' + b.getFullYear() + ' г.');
  readPositive(sh).forEach(function (r) {
    sh.getRange(r.row, 2).clearContent(); sh.getRange(r.row, 4, 1, 2).clearContent(); sh.getRange(r.row, 7).clearContent();
  });
  SpreadsheetApp.flush();
  numbers('white');
  DriveApp.getFileById(POS_ID).setName(newPos);

  // «Негатив»
  var body = negDoc.getBody();
  var found = body.findText('\\d{2}\\.\\d{2}\\s*-\\s*\\d{2}\\.\\d{2}\\.\\d{4}');
  if (found) {
    var el = found.getElement().asText();
    el.deleteText(found.getStartOffset(), found.getEndOffsetInclusive());
    el.insertText(found.getStartOffset(), ddmm(a) + '-' + ddmm(b) + '.' + b.getFullYear());
  }
  var t = negTable(negDoc), blocks = readNegative(t);
  if (blocks.length) {
    for (var k = blocks.length - 1; k >= 1; k--) for (var r = blocks[k].end; r >= blocks[k].start; r--) t.removeRow(r);
    var f = blocks[0];
    for (var j = 0; j < 5; j++) setCell(t.getRow(f.start + j).getCell(1), '', null);
  }
  negDoc.saveAndClose();
  DriveApp.getFileById(NEG_ID).setName(newNeg);
  return { posTitle: newPos, negTitle: newNeg, period: ddmm(a) + '–' + ddmm(b) + '.' + b.getFullYear(), state: state() };
}

/* Для проверки из редактора: Выполнить → testState */
function testState() { Logger.log(JSON.stringify(state()).slice(0, 2000)); }
