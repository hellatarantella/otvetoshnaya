/* «Ответошная» — среда выполнения программы.
   Даёт странице тот же интерфейс window.claude.use(...), что и онлайн-сервис,
   но всё хранит у пользователя: зашифрованный файл через ядро программы (Tauri).
   В обычном браузере (для проверок) хранит в localStorage. */
(function () {
  "use strict";
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
      return invoke("db_load").then(function (s) { data = JSON.parse(s || "{}") || {}; },
        function (e) { loadError = String(e || "Не удалось открыть данные"); data = {}; });
    }
    try { data = JSON.parse(localStorage.getItem("otv-data") || "{}") || {}; } catch (e) { data = {}; }
    return Promise.resolve();
  })();

  function flush() {
    if (!dirty || loadError) return saving;
    dirty = false;
    var json = JSON.stringify(data);
    saving = saving.then(function () {
      if (IN_APP) return invoke("db_save", { json: json });
      try { localStorage.setItem("otv-data", json); } catch (e) {}
    }).catch(function (e) { showBar("Не удалось сохранить: " + e, "err"); dirty = true; });
    return saving;
  }
  function scheduleSave() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 150);
  }
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", function () { if (document.hidden) flush(); });

  function notify(name) {
    (subs[name] || []).slice().forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
  }
  function bucket(name) { return data[name] || (data[name] = {}); }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function guard() { if (loadError) throw { code: "storage_locked", message: loadError }; }

  function write(name, id, doc) {
    guard();
    if (doc === null) delete bucket(name)[id]; else bucket(name)[id] = clone(doc);
    scheduleSave();
    setTimeout(function () { notify(name); }, 0);
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
  }
  function hideBar() { if (bar) bar.hidden = true; }
  window.__otvBar = { show: showBar, hide: hideBar };

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
      verText = "Ответошная " + i.version + (i.keyError ? " · данные не открыты" : " · данные зашифрованы");
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
      document.body.append(v);
    }).catch(function () {});
    setTimeout(function () { checkUpdate(true); }, 2500);
    setInterval(function () { checkUpdate(true); }, 10 * 60 * 1000);   // исправления приходят в течение 10 минут
    window.addEventListener("focus", function () { checkUpdate(false); });   // вернулись в программу: проверяем сразу
    document.addEventListener("visibilitychange", function () { if (!document.hidden) checkUpdate(false); });
  });
})();
