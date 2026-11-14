/* «Ответошная» — среда выполнения программы.
   Даёт странице тот же интерфейс window.claude.use(...), что и онлайн-сервис,
   но всё хранит у пользователя: зашифрованный файл через ядро программы (Tauri).
   В обычном браузере (для проверок) хранит в localStorage. */
(function () {
  "use strict";
  /* 12.11: «никогда не игнорирует», «не было грубости», «без равнодушия», «неплохо» — это похвала, а не жалоба.
     Перед поиском признаков недовольства такие обороты убираем из текста (везде: отчёт, тон, ответы) */
  var NEGSTEM = "(игнорир|равнодуш|безразлич|груб|хам|нагруб|кричал|кричит|повышал|повышает|обман|торопил|торопит|отмахив|отказыва|подвод|плохо|плох|ужасн|долго ждал|долго ждать)";
  var UNNEG = [
    new RegExp("(^|[^а-яё])(?:никогда|ни разу|нисколько|ничуть|совсем|вовсе|никто|ничем)?\\s*(?:не|ни)\\s+(?:был[аио]?|бывает|встречал[аи]?|встретил[аи]?|видел[аи]?|заметил[аи]?|позволя\\S*|почувствовал[аи]?|пришлось|приходилось|было никакого|было ни)?\\s*" + NEGSTEM + "[а-яё]*", "gi"),
    new RegExp("(^|[^а-яё])(?:без|ни капли|ни грамма|ни тени|никакого|никакой|никаких)\\s+(?:малейш\\S*\\s+|всякого\\s+)?(?:хамств|грубост|равнодуш|безразлич|очеред|ожидани|спешк)[а-яё]*", "gi"),
    /(^|[^а-яё])(неравнодуш|неплох|небезразлич)[а-яё]*/gi
  ];
  window.__otvUnneg = function (t) { var x = t == null ? "" : String(t); UNNEG.forEach(function (re) { x = x.replace(re, "$1 "); }); return x; };
  var T = window.__TAURI__ || null;
  var invoke = T && T.core ? T.core.invoke : null;
  var IN_APP = !!invoke;
  window.__OTV_APP = IN_APP;

  /* ---------- хранилище ---------- */
  var data = {};                 // {collection: {id: doc}}
  var subs = {};                 // {collection: [fn]}
  var loadError = "";
  var saveTimer = null, saving = Promise.resolve(), dirty = false;

  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  var ready = (function () {
    if (IN_APP) {
      return invoke("db_load").then(function (s) { data = JSON.parse(s || "{}") || {}; epoch++; },
        function (e) { loadError = String(e || "Не удалось открыть данные"); data = {}; });
    }
    try { data = JSON.parse(localStorage.getItem("otv-data") || "{}") || {}; } catch (e) { data = {}; }
    epoch++;
    return Promise.resolve();
  })();

  function flush() {
    if (!dirty || loadError) return saving;
    dirty = false;
    var json = JSON.stringify(data);
    // большие данные — заметка в журнал (раз в сеанс на каждые 10 МБ): помогает разбирать вылеты
    var mb = Math.floor(json.length / 10485760) * 10;
    if (mb >= 30 && mb > (flush.warned || 0)) { flush.warned = mb; try { if (window.__otvLog) window.__otvLog("данные программы больше " + mb + " МБ"); } catch (e) {} }
    saving = saving.then(function () {
      if (IN_APP) return invoke("db_save", { json: json }).then(function () { window.__otvSaveErr = ""; });
      try { localStorage.setItem("otv-data", json); } catch (e) {}
      window.__otvSaveErr = "";
    }).catch(function (e) {
      window.__otvSaveErr = String(e).slice(0, 160);   // для самоконтроля
      showBar("Не удалось сохранить: " + e + ". Повторю через 3 секунды", "err"); dirty = true;
      try { if (window.__otvLog) window.__otvLog("сохранение данных не прошло: " + String(e).slice(0, 160)); } catch (x) {}
      clearTimeout(saveTimer); saveTimer = setTimeout(flush, 3000);   // повтор сам, не дожидаясь следующей записи
    });
    return saving;
  }
  function scheduleSave() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 400);   // пачкой: при частых записях файл не переписывается каждые 0,15 с
  }
  window.addEventListener("pagehide", flush);
  window.addEventListener("beforeunload", flush);
  window.addEventListener("blur", flush);   // ушли из окна или закрываете программу: несохранённая пачка уходит сразу
  document.addEventListener("visibilitychange", function () { if (document.hidden) flush(); });

  function notify(name) {
    (subs[name] || []).slice().forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
  }
  function bucket(name) { return data[name] || (data[name] = {}); }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function guard() { if (loadError) throw { code: "storage_locked", message: loadError }; }

  var vers = {}, epoch = 0, pendingNotify = {};   // счётчик изменений коллекции: проверить «изменилось ли» без копирования всей коллекции
  /* синхронизация двух компьютеров (sync.js): о каждой настоящей правке узнаёт обмен; правки, пришедшие с другого
     компьютера, пишутся мимо него (иначе вернулись бы обратно) */
  var syncHook = null, applying = false;
  window.__otvSetSyncHook = function (f) { syncHook = f; };
  window.__otvApplyRemote = function (name, id, doc) { applying = true; try { write(name, id, doc); } finally { applying = false; } };
  function write(name, id, doc) {
    guard();
    var watch = syncHook && !applying && name.indexOf("sync_") !== 0, prevJ = watch ? JSON.stringify(bucket(name)[id] === undefined ? null : bucket(name)[id]) : null;
    vers[name] = (vers[name] || 0) + 1;
    if (doc === null) delete bucket(name)[id]; else bucket(name)[id] = clone(doc);
    if (watch) { var nextJ = doc === null ? "null" : JSON.stringify(bucket(name)[id]); if (nextJ !== prevJ) { try { syncHook(name, id, doc === null ? null : JSON.parse(nextJ)); } catch (e) { console.error(e); } } }
    scheduleSave();
    // много записей подряд (сбор, импорт) — одно уведомление подписчикам, а не по одному на каждую запись
    if (!pendingNotify[name]) { pendingNotify[name] = 1; setTimeout(function () { pendingNotify[name] = 0; notify(name); }, 0); }
    if (name !== "kb") {
      var after = doc === null ? null : clone(bucket(name)[id]);
      setTimeout(function () { try { window.dispatchEvent(new CustomEvent("otv-write", { detail: { name: name, id: id, doc: after } })); } catch (e) {} }, 0);
    }
    return Promise.resolve();
  }

  function snapOf(name) {
    var c = bucket(name);
    return { docs: Object.keys(c).map(function (id) { return { id: id, data: function () { return clone(c[id]); } }; }),
             size: Object.keys(c).length, empty: !Object.keys(c).length };
  }

  function listen(name, fn) {
    (subs[name] = subs[name] || []).push(fn);
    ready.then(function () { setTimeout(fn, 0); });
    return function () { var a = subs[name] || []; var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  }

  function collection(name) {
    return {
      onSnapshot: function (cb, errCb) {
        return listen(name, function () {
          if (loadError) { if (errCb) errCb({ code: "storage_locked", message: loadError }); return; }
          cb(snapOf(name));
        });
      },
      get: function () { return ready.then(function () { return snapOf(name); }); },
      add: function (doc) { var id = newId(); return ready.then(function () { return write(name, id, doc); }).then(function () { return { id: id }; }); },
      doc: function (id) {
        return {
          id: id,
          get: function () { return ready.then(function () { var v = bucket(name)[id]; return { id: id, exists: v !== undefined, data: function () { return clone(v); } }; }); },
          set: function (doc) { return ready.then(function () { return write(name, id, doc); }); },
          update: function (patch) {
            return ready.then(function () {
              var cur = bucket(name)[id];
              if (cur === undefined) throw { code: "not_found" };
              return write(name, id, Object.assign({}, cur, patch));
            });
          },
          delete: function () { return ready.then(function () { return write(name, id, null); }); },
          onSnapshot: function (cb, errCb) {
            return listen(name, function () {
              if (loadError) { if (errCb) errCb({ code: "storage_locked", message: loadError }); return; }
              var v = bucket(name)[id];
              cb({ id: id, exists: v !== undefined, data: function () { return clone(v); } });
            });
          }
        };
      }
    };
  }
  var db = { collection: collection };

  /* ---------- файлы: загрузки и фото ---------- */
  function blobToB64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { var s = String(r.result); res(s.slice(s.indexOf(",") + 1)); };
      r.onerror = function () { rej(r.error); };
      r.readAsDataURL(blob);
    });
  }
  var downloads = {
    save: function (o) {
      var blob = o.data instanceof Blob ? o.data : new Blob([o.data == null ? "" : o.data]);
      if (IN_APP) return blobToB64(blob).then(function (b) { return invoke("save_download", { filename: o.filename || "файл", data: b }); });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = o.filename || "файл";
      document.body.append(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      return Promise.resolve();
    }
  };
  var assets = {
    upload: function (file) {
      if (!IN_APP) return Promise.resolve({ id: newId(), url: URL.createObjectURL(file) });
      var ext = (String(file.name || "").split(".").pop() || String(file.type || "").split("/").pop() || "bin");
      return blobToB64(file).then(function (b) { return invoke("asset_put", { ext: ext, data: b }); })
        .then(function (r) { return { id: r.id, url: T.core.convertFileSrc(r.path) }; });
    },
    delete: function (id) { return IN_APP ? invoke("asset_delete", { id: String(id || "") }) : Promise.resolve(); }
  };

  /* ---------- то, что пока делает Claude ---------- */
  // На шаге 1 сбор, публикация, ИИ-ответы и выгрузка Google-файлов остаются в онлайн-сервисе.
  // Возвращаем null — страница сама показывает, что действие недоступно.
  window.claude = {
    use: function (name) {
      if (name === "db") return ready.then(function () { return db; });
      if (name === "downloads") return Promise.resolve(downloads);
      if (name === "assets") return Promise.resolve(assets);
      return Promise.resolve(null);
    }
  };

  /* ---------- полоса программы: версия, обновления, перенос данных ---------- */
  var bar = null;
  function showBar(text, cls, actions) {
    if (!document.body) { document.addEventListener("DOMContentLoaded", function () { showBar(text, cls, actions); }); return; }
    if (!bar) {
      bar = document.createElement("div"); bar.id = "otvBar"; bar.setAttribute("role", "status");
      document.body.prepend(bar);
    }
    bar.className = "otv-bar " + (cls || "");
    bar.textContent = "";
    var sp = document.createElement("span"); sp.textContent = text; bar.append(sp);
    (actions || []).forEach(function (a) {
      var b = document.createElement("button"); b.type = "button"; b.className = "btn"; b.textContent = a[0];
      b.addEventListener("click", a[1]); bar.append(b);
    });
    bar.hidden = false;
    try { document.dispatchEvent(new Event("otv-bar")); } catch (e) {}
  }
  function hideBar() { if (bar) bar.hidden = true; try { document.dispatchEvent(new Event("otv-bar")); } catch (e) {} }
  window.__otvBar = { show: showBar, hide: hideBar };
  /* 14.11: «убирай все длинные тире везде». В текстах программы (интерфейс, ответы, письма) длинного тире нет:
     « — » становится запятой. Цитаты в «ёлочках» и тексты отзывов (слова пациентов) не трогаем; одиночное «—» в таблице
     (значит «нет») остаётся */
  // prev — последний символ текста перед строкой (для «<b>Заголовок</b> — текст»)
  function undash(str, prev) {
    str = String(str == null ? "" : str);
    if (str.indexOf("—") < 0) return str;
    var out = "", depth = 0, i0 = 0;
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (ch === "«" || ch === "»") {
        var seg = str.slice(i0, i); out += depth ? seg : fix(seg, i0 ? str[i0 - 1] : prev); out += ch; i0 = i + 1;
        depth += ch === "«" ? 1 : -1; if (depth < 0) depth = 0;
      }
    }
    var tail = str.slice(i0); out += depth ? tail : fix(tail, i0 ? str[i0 - 1] : prev);
    return out;
    function fix(x, before) {
      x = x.replace(/([^\s,:;(—])\s+—\s+(?=\d)/g, "$1: ").replace(/([^\s,:;(—])\s+—\s+/g, "$1, ");   // «Итого — 5» → «Итого: 5»
      var m = /^(\s*)—\s+/.exec(x);
      if (m) {
        // в начале куска: после слова или «» — запятая; после точки, двоеточия или в самом начале — просто убираем
        var b0 = String(before == null ? "" : before);
        var rest = x.slice(m[0].length);
        if (b0 && !/[.!?:;\n]/.test(b0)) x = (/^\d/.test(rest) ? ": " : ", ") + rest;
        else x = (/[.!?]/.test(b0) ? " " + rest.charAt(0).toUpperCase() : rest.charAt(0)) + rest.slice(1);
      }
      return x.replace(/\s+—\s*$/g, "").replace(/,\s*,/g, ",");
    }
  }
  function prevChar(n) {
    for (var p = n; p; ) {
      var q = p.previousSibling;
      while (!q && p.parentNode && p.parentNode !== document.body) { p = p.parentNode; q = p.previousSibling; }
      if (!q) return "";
      var tx = q.textContent || ""; tx = tx.replace(/\s+$/, "");
      if (tx) return tx[tx.length - 1];
      p = q;
    }
    return "";
  }
  window.__otvUndash = undash;
  var SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|BLOCKQUOTE|CODE|PRE)$/;
  function skipNode(n) {
    for (var e = n.parentNode; e && e !== document.body; e = e.parentNode) {
      if (e.nodeType === 1 && (SKIP.test(e.nodeName) || e.isContentEditable || (e.classList && (e.classList.contains("deck-slide") || e.classList.contains("raw") || e.classList.contains("hist-text"))))) return true;
    }
    return false;
  }
  function undashTree(root) {
    if (!root || !document.body) return;
    if (root.nodeType === 3) { if (root.nodeValue.indexOf("—") >= 0 && !skipNode(root)) { var v = undash(root.nodeValue, prevChar(root)); if (v !== root.nodeValue) root.nodeValue = v; } return; }
    if (root.nodeType !== 1 || SKIP.test(root.nodeName)) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, list = [];
    while ((n = w.nextNode())) if (n.nodeValue.indexOf("—") >= 0) list.push(n);
    list.forEach(function (x) { if (!skipNode(x)) { var v = undash(x.nodeValue, prevChar(x)); if (v !== x.nodeValue) x.nodeValue = v; } });
    if (root.querySelectorAll) Array.prototype.forEach.call(root.querySelectorAll("[placeholder],[title]"), function (e) {
      ["placeholder", "title"].forEach(function (k) { var a = e.getAttribute(k); if (a && a.indexOf("—") >= 0) e.setAttribute(k, undash(a)); });
    });
  }
  function startUndash() {
    undashTree(document.body);
    try {
      new MutationObserver(function (ms) {
        ms.forEach(function (m) {
          if (m.type === "characterData") undashTree(m.target);
          else Array.prototype.forEach.call(m.addedNodes, undashTree);
        });
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) {}
  }
  if (document.body) startUndash(); else document.addEventListener("DOMContentLoaded", startUndash);
  // 14.11: «интерфейс перегружен» — редкие настройки (уведомления, второй компьютер) свёрнуты в одну строку с состоянием; открытое остаётся открытым
  var foldOpen = {};
  window.__otvFoldAll = function () { foldOpen.__all = true; Array.prototype.forEach.call(document.querySelectorAll("details.fold"), function (d) { d.open = true; }); };   // для проверок
  window.__otvFold = function (card, key, state) {
    var d = document.createElement("details"); d.className = card.className + " fold";
    var h = card.querySelector("h2"), sm = document.createElement("summary");
    sm.textContent = h ? h.textContent : key; if (h) h.remove();
    if (state) { var st = document.createElement("span"); st.className = "fold-st"; st.textContent = state; sm.append(st); }
    d.append(sm); while (card.firstChild) d.append(card.firstChild);
    d.open = !!(foldOpen[key] || foldOpen.__all);
    d.addEventListener("toggle", function () { foldOpen[key] = d.open; });
    return d;
  };

  // Стили полосы — в runtime.css (политика безопасности окна запрещает встроенные стили из скриптов).

  // Действия, которые на шаге 1 ещё делает онлайн-сервис.
  var LATER = {dwBtn: "Презентации в программе: шаг 4", dmBtn: "Презентации в программе: шаг 4"};
  document.addEventListener("click", function (e) {
    if (!IN_APP) return;
    var b = e.target && e.target.closest ? e.target.closest("button") : null;
    if (!b) return;
    var why = LATER[b.id] || "";
    if (!why) return;
    e.preventDefault(); e.stopImmediatePropagation();
    showBar(why + ". Пока это делает онлайн-сервис «Ответошная».", "", [["Понятно", hideBar]]);
  }, true);

  // Внешние ссылки — в системном браузере, окно программы никуда не уходит.
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (/^https?:\/\//i.test(href)) {
      e.preventDefault();
      if (IN_APP) invoke("plugin:opener|open_url", { url: href }).catch(function () {});
      else window.open(href, "_blank", "noopener");
    }
  }, true);

  // Перенос данных из онлайн-сервиса: файл «Ответошная — данные.json», выгруженный там кнопкой.
  function importFile() {
    var inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,application/json";
    inp.addEventListener("change", function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      f.text().then(function (txt) {
        var src = JSON.parse(txt);
        var cols = src && src.collections;
        if (!cols || typeof cols !== "object") throw new Error("Это не файл выгрузки «Ответошной»");
        var n = 0;
        Object.keys(cols).forEach(function (c) {
          var b = bucket(c);
          Object.keys(cols[c] || {}).forEach(function (id) { b[id] = cols[c][id]; n++; });
        });
        if (src.settings && typeof src.settings === "object") bucket("registry_meta").settings = Object.assign({}, bucket("registry_meta").settings || {}, src.settings);
        bucket("registry_meta").__import = { at: new Date().toISOString(), from: String(src.exportedAt || ""), count: n };
        scheduleSave(); flush();
        Object.keys(cols).forEach(notify);
        fillDocLinks(); settleRequests();
        try { window.dispatchEvent(new Event("otv-imported")); } catch (e) {}
        showBar("Перенесено записей: " + n + (IN_APP ? ". Данные сохранены у вас и зашифрованы. Файл выгрузки теперь можно удалить из «Загрузок»." : ". Проверочный режим: данные в браузере."), "ok", [["Закрыть", hideBar]]);
      }).catch(function (e) { showBar("Не удалось перенести: " + (e && e.message || e), "err", [["Выбрать другой файл", importFile]]); });
    });
    inp.click();
  }
  window.__otvImport = importFile;

  // Ссылки на Google-файлы отчётов: идентификаторы — из перенесённых настроек, в коде их нет.
  function fillDocLinks() {
    var m = bucket("registry_meta"), r = m.report || {}, st = m.settings || {};
    var rep = {positiveId: r.positiveId || st.positiveId, negativeId: r.negativeId || st.negativeId};
    document.querySelectorAll('a[href*="__POS_ID__"],a[href*="__NEG_ID__"]').forEach(function (a) {
      var h = a.getAttribute("href"), id = h.indexOf("__POS_ID__") >= 0 ? rep.positiveId : rep.negativeId;
      if (id && /^[A-Za-z0-9_-]{20,}$/.test(String(id))) { a.setAttribute("href", h.replace(/__(POS|NEG)_ID__/, id)); a.hidden = false; }
      else a.hidden = true;
    });
  }
  window.__otvFillDocLinks = fillDocLinks;
  window.__otvAll = function (name) { return clone(bucket(name)); };
  // копия коллекции только для чтения: одна на версию (не копировать всю базу при каждом расчёте). Менять её нельзя
  var roCache = {};
  window.__otvAllRO = function (name) { var v = window.__otvVer(name), c = roCache[name]; if (c && c.v === v) return c.d; c = roCache[name] = { v: v, d: clone(bucket(name)) }; return c.d; };
  window.__otvGet = function (name, id) { var v = bucket(name)[id]; return v === undefined ? null : clone(v); };   // одна запись без копии всей коллекции
  // счётчик изменений: дёшево (без перебора коллекции) — каждая запись идёт через write(), загрузка данных меняет «эпоху»
  window.__otvVer = function (name) { return epoch + "|" + (vers[name] || 0); };

  // Запросы «собрать/обновить», перенесённые из онлайн-сервиса, в программе не выполняются задачами Claude:
  // висящий запрос делал кнопки «нажатыми». Снимаем его, сохраняя время и итог последнего сбора.
  function settleRequests() {
    var rq = bucket("requests"), changed = false;
    Object.keys(rq).forEach(function (id) {
      var r = rq[id] || {};
      if (r.state === "queued" || r.state === "dispatched" || r.state === "running") {
        rq[id] = Object.assign({}, r, {state: "done", finishedAt: r.lastFinishedAt || r.finishedAt || "", message: r.lastMessage || r.message || ""});
        changed = true;
      }
    });
    if (changed) { scheduleSave(); notify("requests"); }
  }

  document.addEventListener("DOMContentLoaded", function () {
    ready.then(fillDocLinks);
    ready.then(settleRequests);
    ready.then(function () {
      if (loadError) { showBar("Данные не открылись: " + loadError + ". Ничего не удалено.", "err"); return; }
      var meta = bucket("registry_meta");
      var empty = !Object.keys(bucket("answers")).length && !Object.keys(bucket("registry")).length && !meta.__import;
      if (empty) showBar("Программа пустая. Перенесите данные из онлайн-сервиса: там кнопка «Выгрузить данные для программы».", "", [["Перенести данные", importFile]]);
    });
    if (!IN_APP) return;
    /* обновления: значок версии в углу сам становится кнопкой «Обновить», пока обновление не поставлено.
       Сообщение в полосе сверху может закрыть итог сбора, а значок остаётся всегда. */
    var verBtn = null, verText = "", upVer = "", installing = false, lastCheck = 0, retry = null;
    function jl(t) { try { if (window.__otvLog) window.__otvLog(t); } catch (e) {} }
    function startInstall() {
      if (installing) return;
      installing = true;
      if (verBtn) { verBtn.textContent = "Скачиваю обновление " + upVer + "…"; verBtn.disabled = true; }
      showBar("Скачиваю обновление… программа перезапустится сама.", "");
      jl("обновление " + upVer + ": скачиваю");
      try { T.event.listen("update-progress", function (ev) { var d = ev.payload || {}; if (!d.total) return; var pc = Math.round(d.done * 100 / d.total);
        showBar("Скачиваю обновление: " + pc + "%. Программа перезапустится сама.", ""); if (verBtn) verBtn.textContent = "Скачиваю обновление: " + pc + "%"; }); } catch (e) {}
      flush().then(function () { return invoke("update_install"); })
        .catch(function (e) {
          installing = false; jl("обновление не прошло: " + e);
          markUpdate(upVer);
          showBar("Обновление не прошло: " + e + ". Нажмите «Обновить» ещё раз.", "err", [["Обновить", startInstall], ["Закрыть", hideBar]]);
        });
    }
    function markUpdate(ver) {
      upVer = ver;
      if (!verBtn) return;
      verBtn.disabled = false;
      verBtn.textContent = "Есть новая версия " + ver + ". Обновить";
      verBtn.classList.add("otv-ver-up");
    }
    function checkUpdate(force, manual) {
      if (installing) return;
      var now = Date.now();
      if (!force && now - lastCheck < 3 * 60 * 1000) return;
      lastCheck = now;
      invoke("update_check").then(function (ver) {
        if (!ver) { if (manual) showBar("У вас последняя версия.", "ok", [["Закрыть", hideBar]]); return; }
        var fresh = ver !== upVer;
        markUpdate(ver);
        if (fresh) {
          jl("есть новая версия " + ver);
          showBar("Есть новая версия " + ver + ".", "", [["Обновить", startInstall], ["Позже", hideBar]]);
        }
      }).catch(function (e) {
        jl("проверка обновлений не прошла: " + String(e).slice(0, 160));
        if (manual) showBar("Не получилось проверить обновления: нет связи с сервером обновлений. Попробую ещё раз через 2 минуты.", "err", [["Закрыть", hideBar]]);
        clearTimeout(retry); retry = setTimeout(function () { checkUpdate(true); }, 2 * 60 * 1000);   // связь плохая: пробуем снова через 2 минуты
      });
    }
    invoke("app_info").then(function (i) {
      var v = document.createElement("button"); v.type = "button"; v.className = "otv-ver";
      window.__otvAppVersion = String(i.version || "");
      verText = "версия " + i.version + (i.keyError ? " · данные не открыты" : "");   // 14.11: служебное — внизу страницы, не поверх карточек
      v.textContent = verText; verBtn = v;
      if (upVer) markUpdate(upVer);
      v.addEventListener("click", function () {
        if (upVer) { startInstall(); return; }
        invoke("app_info").then(function (x) {
          var where = x.keySource === "keychain" ? "в системной связке ключей" : x.keySource === "file" ? "в защищённом файле программы (связка ключей недоступна)" : "не создан";
          showBar("Защита: файл данных " + (x.encrypted ? "зашифрован (AES-256)" : "НЕ зашифрован") + ", ключ " + where +
                  ". Резервных копий: " + x.backups + " (храним " + x.backupsKeep + " дней). Обновления принимаются только с подписью." +
                  " Окно не открывает посторонние сайты. Версия " + x.version + ".", x.encrypted && !x.keyError ? "ok" : "err", [["Проверить обновления", function () { hideBar(); checkUpdate(true, true); }], ["Закрыть", hideBar]]);
        });
      });
      var ft = document.querySelector(".foot"); if (ft && !i.keyError) { v.classList.add("otv-ver-foot"); ft.append(v); } else document.body.append(v);
    }).catch(function () {});
    setTimeout(function () { checkUpdate(true); }, 2500);
    setInterval(function () { checkUpdate(true); }, 10 * 60 * 1000);   // исправления приходят в течение 10 минут
    window.addEventListener("focus", function () { checkUpdate(false); });   // вернулись в программу: проверяем сразу
    document.addEventListener("visibilitychange", function () { if (!document.hidden) checkUpdate(false); });
  });
})();
