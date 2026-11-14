/* Дежурство двух компьютеров (10.11).
   Mac и рабочий компьютер подстраховывают друг друга: сам собирает, обновляет отчёт и шлёт уведомления только
   «дежурный». Основной дежурит, пока на связи; не выходил на связь 20 минут — дежурство сам берёт запасной,
   основной вернулся — отдаёт обратно. Отметка «кто на связи» идёт через ваш Google-скрипт (без данных).
   Данные у обоих одни и те же — их переносит sync.js зашифрованными файлами (прочитать может только программа).
   Публикация — только по вашему нажатию на том компьютере, где вы нажали; повтор того же отзыва в отчёт
   скрипт не вносит, уведомление, уже присланное в чат MAX, второй компьютер не повторяет. */
(function () {
  "use strict";
  var T = window.__TAURI__, invoke = T && T.core && T.core.invoke;
  if (!invoke) return;
  function s(v) { return v == null ? "" : String(v); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function jlog(x) { if (window.__otvLog) window.__otvLog("дежурство: " + x); }
  var FRESH = 20 * 60e3, TICK = 5 * 60e3;
  var db = null, cfg = {}, last = null, lastOkAt = 0, msg = "", msgErr = false, wasDuty = null, codeOpen = false;

  function rid() { var a = new Uint8Array(6); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join(""); }
  function role() { return cfg.role === "backup" ? "backup" : "main"; }
  function save() { return db ? db.collection("settings").doc("duty").set(cfg) : Promise.resolve(); }

  // кто дежурит по отметкам: из тех, кто на связи последние 20 минут, — основной; при равенстве — по номеру
  function holder(map, now) {
    var live = Object.keys(map || {}).filter(function (k) { return now - (+map[k].at || 0) < FRESH; });
    live.sort(function (a, b) { var ra = map[a].role === "backup" ? 1 : 0, rb = map[b].role === "backup" ? 1 : 0; return ra - rb || (a < b ? -1 : 1); });
    return live[0] || null;
  }
  function others() { return last ? Object.keys(last.map || {}).filter(function (k) { return k !== cfg.dev; }) : []; }
  function multi() { return others().length > 0; }
  // без связи с Google дольше 25 минут: основной продолжает работать, запасной не вмешивается
  function isDuty(now) {
    now = now || Date.now();
    if (!last || !multi()) return true;
    if (now - lastOkAt > FRESH + 5 * 60e3) return role() === "main";
    var h = holder(last.map, last.now + (now - lastOkAt));
    return !h || h === cfg.dev;
  }
  function tick() {
    var R = window.__otvReports;
    if (!R || !R.ready || !R.ready() || !cfg.dev) { render(); return Promise.resolve(); }
    return R.call("duty", { dev: cfg.dev, name: cfg.name || "", role: role() }).then(function (r) {
      last = { map: r.duty || {}, now: +r.now || Date.now() }; lastOkAt = Date.now();
      var d = isDuty();
      if (wasDuty !== null && d !== wasDuty) jlog(d ? "дежурство перешло к этому компьютеру" : "дежурит другой компьютер — этот ждёт");
      wasDuty = d; render();
    }, function (e) { msg = "нет связи с Google: " + s(e && e.message || e); msgErr = true; render(); });
  }
  window.__otvDuty = { isDuty: function () { return isDuty(); }, multi: multi, tick: tick, _holder: holder, _set: function (l, okAt) { last = l; lastOkAt = okAt || Date.now(); } };

  window.claude.use("db").then(function (d) {
    db = d;
    return db.collection("settings").doc("duty").get();
  }).then(function (x) {
    cfg = (x && x.exists && x.data()) || {};
    if (!cfg.dev) { cfg.dev = rid(); cfg.name = cfg.name || (/Mac/i.test(navigator.platform) ? "Mac" : "Рабочий компьютер"); save(); }
    render(); setTimeout(tick, 20e3); setInterval(tick, TICK);
  }).catch(function () {});

  /* ---------- код подключения второго компьютера: Google-скрипт и бот MAX, без отзывов и персональных данных ---------- */
  function b64e(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/=+$/, ""); }
  function b64d(t) { return JSON.parse(decodeURIComponent(escape(atob(s(t).replace(/\s+/g, ""))))); }
  function makeCode() {
    var g = window.__otvReports && window.__otvReports.cfg && window.__otvReports.cfg();
    var n = (window.__otvGet && window.__otvGet("settings", "notify")) || {};
    if (!g || !g.url || !g.token) return null;
    var S = window.__otvSync; if (!S) return null;
    return "OTV1." + b64e({ k: S.key(), g: { url: g.url, token: g.token }, m: n.token ? { token: n.token, bot: n.bot || "", targets: n.targets || [], since: n.since || "" } : null });
  }
  function applyCode(code) {
    var m = /^OTV1\.(.+)$/.exec(s(code).trim()); if (!m) throw new Error("это не код подключения «Ответошной»");
    var o = b64d(m[1]); if (!o.g || !/^https:\/\/script\.google\.com\//.test(s(o.g.url)) || s(o.g.token).length < 32) throw new Error("в коде нет связи с Google");
    var jobs = [db.collection("settings").doc("google").set({ url: o.g.url, token: o.g.token, paired: true })];
    if (o.m && o.m.token) jobs.push(db.collection("settings").doc("notify").set({ token: o.m.token, bot: o.m.bot, targets: o.m.targets || [], since: new Date().toISOString(), enabled: true }));
    cfg.role = "backup"; jobs.push(save());
    if (o.k && window.__otvSync) jobs.push(window.__otvSync.enable(o.k));
    return Promise.all(jobs);
  }

  function render() {
    var box = document.getElementById("dutyBox"); if (!box) return;
    box.textContent = "";
    var c = el("div", "card ntf");
    c.append(el("h2", null, "Два компьютера: дежурство и синхронизация"));
    c.append(el("p", "meta", "Сам собирает, обновляет отчёт и присылает уведомления только дежурный компьютер. Основной дежурит, пока на связи; не выходил на связь 20 минут — дежурство берёт запасной. Данные у обоих одни и те же: обмен идёт зашифрованными файлами, прочитать которые может только «Ответошная»."));
    var R = window.__otvReports, g = R && R.ready && R.ready();
    var line = el("p", "mdl-st");
    if (!g) line.textContent = "Сначала подключите Google на вкладке «Отчёты» — через него компьютеры узнают, кто на связи.";
    else if (!last) line.textContent = "Проверяю, кто на связи…";
    else {
      var now = last.now + (Date.now() - lastOkAt), h = holder(last.map, now);
      var names = Object.keys(last.map).map(function (k) { var x = last.map[k], ago = Math.round((now - x.at) / 60e3); return (k === cfg.dev ? "этот (" + (x.name || "без имени") + ")" : (x.name || "другой")) + " — " + (x.role === "backup" ? "запасной" : "основной") + ", " + (ago < 1 ? "на связи сейчас" : "был на связи " + ago + " мин назад"); });
      line.textContent = (multi() ? (isDuty() ? "Дежурит этот компьютер." : "Дежурит: " + s((last.map[h] || {}).name || "другой компьютер") + ". Этот ждёт и подхватит, если тот пропадёт.") : "Пока один компьютер — он и дежурит.") + " " + names.join("; ") + ".";
    }
    c.append(line);
    var S = window.__otvSync, ss = S && S.state();
    if (ss) {
      var sl = el("p", "mdl-st");
      sl.textContent = !ss.enabled ? "Синхронизация данных выключена: включится, когда вы создадите код для второго компьютера."
        : "Синхронизация: " + (ss.err ? "не удалась — " + ss.err : ss.at ? "последний обмен " + new Date(ss.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) + (ss.peers.length ? "" : " · второй компьютер ещё не подключён") : "готовлю первый обмен…") +
          (ss.pending ? " · ждут отправки: " + ss.pending : "") + ". Данные зашифрованы: прочитать их можно только в «Ответошной».";
      c.append(sl);
    }
    var row = el("div", "actions ntf-role");
    var nm = el("input", "ntf-tok"); nm.value = s(cfg.name); nm.placeholder = "Название этого компьютера"; nm.maxLength = 40;
    nm.addEventListener("change", function () { cfg.name = nm.value.trim(); save().then(tick); });
    row.append(nm);
    [["main", "основной"], ["backup", "запасной"]].forEach(function (o) {
      var lb = el("label", "ntf-opt"), rb = el("input"); rb.type = "radio"; rb.name = "dutyRole"; rb.checked = role() === o[0];
      rb.addEventListener("change", function () { if (rb.checked) { cfg.role = o[0]; save().then(tick); } });
      lb.append(rb, document.createTextNode(" " + o[1])); row.append(lb);
    });
    c.append(row);
    var act = el("div", "actions");
    if (g) {
      var cb = el("button", "btn", "Код для второго компьютера"); cb.type = "button";
      cb.addEventListener("click", function () {
        var S = window.__otvSync;
        (S && !S.enabled() ? S.enable() : Promise.resolve()).then(function () { var code = makeCode(); if (!code) { msg = "Сначала подключите Google."; msgErr = true; render(); return; }
        var done = function () { msg = "Код скопирован. Вставьте его на втором компьютере: «Источники» → «Ввести код». Код — как пароль: после ввода удалите его из переписки."; msgErr = false; render(); };
        try { navigator.clipboard.writeText(code).then(done, done); } catch (e) { done(); }
        });
      });
      act.append(cb);
    }
    var ib = el("button", "btn" + (g ? "" : " primary"), "Ввести код"); ib.type = "button";
    ib.addEventListener("click", function () { codeOpen = true; render(); var f = document.querySelector("#dutyBox .duty-code"); if (f) f.focus(); });
    if (codeOpen) {
      var w = el("div", "actions"), f = el("input", "ntf-tok duty-code"); f.type = "password"; f.placeholder = "Код подключения с первого компьютера"; f.autocomplete = "off";
      var ok = el("button", "btn primary", "Подключить"); ok.type = "button";
      ok.addEventListener("click", function () {
        try { applyCode(f.value).then(function () { codeOpen = false; msg = "Подключено: Google и бот MAX как на первом компьютере, этот — запасной. Перезапускаю окно…"; msgErr = false; render(); setTimeout(function () { location.reload(); }, 1500); }); }
        catch (e) { msg = s(e && e.message || e); msgErr = true; render(); }
      });
      w.append(f, ok); c.append(w);
    }
    act.append(ib);
    if (S && S.enabled()) { var sb = el("button", "btn", "Синхронизировать сейчас"); sb.type = "button"; sb.addEventListener("click", function () { sb.disabled = true; S.run().then(render); }); act.append(sb); }
    c.append(act);
    if (msg) c.append(el("p", "ctl-st" + (msgErr ? " err" : " ok"), msg));
    if (window.__otvFold) { var S2 = window.__otvSync, two = S2 && S2.enabled && S2.enabled(); c = window.__otvFold(c, "duty", two ? "включено" : "работает один компьютер"); if (msg || codeOpen) c.open = true; }
    box.append(c);
  }
  window.__otvDutyRender = render;
  window.addEventListener("otv-tab", render);
  document.addEventListener("DOMContentLoaded", render);
})();
