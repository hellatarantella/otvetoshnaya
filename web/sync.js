/* Синхронизация двух компьютеров (10.11).
   Mac и рабочий компьютер держат одни и те же данные: отзывы, ответы и их статусы, ваши правки и обучение ИИ,
   фразы, факты, уведомления, недели. Каждый пишет свои изменения в зашифрованные файлы, другой их читает.
   Файлы лежат в папке вашего Google Диска, но прочитать их можно только внутри «Ответошной»:
   шифр AES-256, ключ есть лишь у двух копий программы (переносится кодом подключения).
   Каждый компьютер пишет только свои файлы — перезаписать друг друга они не могут.
   Спор по одной записи решает время правки: остаётся более поздняя.
   Не синхронизируется: настройки этого компьютера (дежурство, вход в кабинеты, модель, бот MAX), фото презентаций.
   Публикует ответ только тот компьютер, на котором вы нажали «Опубликовать». */
(function () {
  "use strict";
  var T = window.__TAURI__, invoke = T && T.core && T.core.invoke;
  if (!invoke) return;
  function s(v) { return v == null ? "" : String(v); }
  function jlog(x) { if (window.__otvLog) window.__otvLog("синхронизация: " + x); }

  var SHARED = { registry: 1, registry_meta: 1, alerts: 1, mail: 1, answers: 1, phrases: 1, facts: 1, deckPicks: 1, kb: 1, weeks: 1 };
  var SHARED_SETTINGS = { refs: 1, report: 1, judge: 1, learn: 1, trainRules: 1, custom_sources: 1, deckFonts: 1, stats: 1, pilot: 1 };
  function shared(c, i) { return !!SHARED[c] || (c === "settings" && !!SHARED_SETTINGS[i]); }
  var PART = 1500000, BATCH = 4, TICK = 120e3, SNAP_EVERY = 300;   // обмен раз в 2 минуты и через 15 секунд после правки

  var db = null, cfg = null, tsm = {}, out = {}, busy = false, again = false, st = { at: 0, sent: 0, got: 0, err: "" };
  var burst = {};   // защита от «пинг-понга»: одна запись не уходит чаще 6 раз за 10 минут

  /* ---------- байты, шифр, сжатие ---------- */
  function b64(bytes) { var r = "", i, C = 0x8000; for (i = 0; i < bytes.length; i += C) r += String.fromCharCode.apply(null, bytes.subarray(i, i + C)); return btoa(r); }
  function unb64(t) { var bin = atob(t), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  function pipe(bytes, Stream) { return new Response(new Blob([bytes]).stream().pipeThrough(new Stream("gzip"))).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  var keyP = null;
  function key() { return keyP || (keyP = crypto.subtle.importKey("raw", unb64(cfg.key), "AES-GCM", false, ["encrypt", "decrypt"])); }
  function enc(obj) {
    var raw = new TextEncoder().encode(JSON.stringify(obj)), gz = !!window.CompressionStream;
    return (gz ? pipe(raw, CompressionStream) : Promise.resolve(raw)).then(function (body) {
      var iv = crypto.getRandomValues(new Uint8Array(12));
      return key().then(function (k) { return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, k, body); }).then(function (ct) {
        ct = new Uint8Array(ct); var o = new Uint8Array(2 + 12 + ct.length); o[0] = 1; o[1] = gz ? 1 : 0; o.set(iv, 2); o.set(ct, 14); return b64(o);
      });
    });
  }
  function dec(text) {
    var a = unb64(text); if (a[0] !== 1) return Promise.reject(new Error("файл обмена другой версии — обновите программу"));
    return key().then(function (k) { return crypto.subtle.decrypt({ name: "AES-GCM", iv: a.subarray(2, 14) }, k, a.subarray(14)); })
      .then(function (pt) { pt = new Uint8Array(pt); return a[1] ? pipe(pt, DecompressionStream) : pt; })
      .then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); }, function (e) { throw e && e.name === "OperationError" ? new Error("ключ не подходит: на этом компьютере другой код подключения") : e; });
  }

  /* ---------- метки времени записей: >0 — последняя правка здесь, <0 — пришла с другого компьютера ---------- */
  var tsDirty = {}, tsTimer = null, outTimer = null;
  function setTs(c, i, v) { (tsm[c] = tsm[c] || {})[i] = v; tsDirty[c] = 1; clearTimeout(tsTimer); tsTimer = setTimeout(saveTs, 2000); }
  function saveTs() { Object.keys(tsDirty).forEach(function (c) { db.collection("sync_ts").doc(c).set(tsm[c] || {}); }); tsDirty = {}; }
  function saveOut() { clearTimeout(outTimer); outTimer = setTimeout(function () { db.collection("sync_out").doc("q").set({ list: Object.keys(out).map(function (k) { return out[k]; }) }); }, 1500); }
  function saveCfg() { return db.collection("settings").doc("sync").set(cfg); }

  function onWrite(c, i, d) {
    if (!cfg || !cfg.enabled || !shared(c, i)) return;
    var now = Date.now(), b = burst[c + "\u0001" + i] = (burst[c + "\u0001" + i] || []).filter(function (x) { return now - x < 600e3; });
    b.push(now); if (b.length > 6) { if (b.length === 7) jlog("запись " + c + "/" + i + " меняется слишком часто — пропускаю, чтобы компьютеры не перебрасывались ею"); return; }
    var t = Math.max(now, Math.abs((tsm[c] || {})[i] || 0) + 1);
    setTs(c, i, t);
    out[c + "\u0001" + i] = { c: c, i: i, d: d, t: t };
    saveOut(); later(15e3);
  }
  function applyOne(ch) {
    if (!ch || !shared(ch.c, ch.i)) return 0;
    var cur = Math.abs((tsm[ch.c] || {})[ch.i] || 0);
    if (!(+ch.t > cur)) return 0;
    try { window.__otvApplyRemote(ch.c, ch.i, ch.d == null ? null : ch.d); } catch (e) { return 0; }
    setTs(ch.c, ch.i, -ch.t);
    return 1;
  }

  /* ---------- обмен ---------- */
  function call(a, x) { return window.__otvReports.call(a, x); }
  function pad(n) { return ("0000000" + n).slice(-8); }
  function push() {
    var keys = Object.keys(out); if (!keys.length) return Promise.resolve();
    var batch = keys.slice(0, 2000).map(function (k) { return out[k]; });
    var seq = (cfg.seq || 0) + 1, name = "log-" + cfg.dev + "-" + pad(seq) + ".bin";
    return enc({ dev: cfg.dev, seq: seq, ch: batch }).then(function (data) {
      if (data.length > 8000000 && batch.length > 1) { /* слишком много за раз — по частям */ batch = batch.slice(0, Math.ceil(batch.length / 4)); return enc({ dev: cfg.dev, seq: seq, ch: batch }); }
      return data;
    }).then(function (data) { return call("sput", { name: name, data: data }); }).then(function () {
      batch.forEach(function (ch) { var k = ch.c + "\u0001" + ch.i; if (out[k] && out[k].t === ch.t) delete out[k]; });
      cfg.seq = seq; cfg.logsSinceSnap = (cfg.logsSinceSnap || 0) + 1; st.sent += batch.length;
      saveOut(); return saveCfg();
    }).then(function () { if (Object.keys(out).length) return push(); });
  }
  // полный слепок своих данных: новый компьютер начинает с него; после слепка старые свои файлы удаляются
  function snapshot() {
    var all = [];
    Object.keys(SHARED).forEach(function (c) {
      var docs = window.__otvAll(c) || {}, ts = tsm[c] || {};
      Object.keys(docs).forEach(function (i) { all.push({ c: c, i: i, d: docs[i], t: Math.abs(ts[i] || 0) || 1 }); });
      Object.keys(ts).forEach(function (i) { if (docs[i] === undefined && Math.abs(ts[i]) > 1) all.push({ c: c, i: i, d: null, t: Math.abs(ts[i]) }); });
    });
    var sets = window.__otvAll("settings") || {}, tss = tsm.settings || {};
    Object.keys(SHARED_SETTINGS).forEach(function (i) { if (sets[i] !== undefined) all.push({ c: "settings", i: i, d: sets[i], t: Math.abs(tss[i] || 0) || 1 }); });
    var parts = [], cur = [], size = 0;
    all.forEach(function (ch) { var n = JSON.stringify(ch).length; if (size + n > PART && cur.length) { parts.push(cur); cur = []; size = 0; } cur.push(ch); size += n; });
    if (cur.length || !parts.length) parts.push(cur);
    var upto = cfg.seq || 0, stamp = Date.now().toString(36);
    return parts.reduce(function (p, part, k) {
      return p.then(function () { return enc({ ch: part }); }).then(function (data) { return call("sput", { name: "snap-" + cfg.dev + "-" + stamp + "-" + k + ".bin", data: data }); });
    }, Promise.resolve()).then(function () {
      return enc({ upto: upto, stamp: stamp, parts: parts.length, n: all.length }).then(function (data) { return call("sput", { name: "snap-" + cfg.dev + ".bin", data: data }); });
    }).then(function () {
      cfg.logsSinceSnap = 0; cfg.snapAt = new Date().toISOString(); jlog("слепок данных: " + all.length + " записей");
      return saveCfg().then(function () { return call("slist", { prefix: "" }); }).then(function (r) {
        var old = (r.files || []).map(function (f) { return f.name; }).filter(function (n) {
          var m = /^log-([a-f0-9]+)-(\d{8})\.bin$/.exec(n), q = /^snap-([a-f0-9]+)-([a-z0-9]+)-\d+\.bin$/.exec(n);
          return (m && m[1] === cfg.dev && +m[2] <= upto) || (q && q[1] === cfg.dev && q[2] !== stamp);
        });
        return old.length ? call("sdel", { names: old }) : null;
      });
    });
  }
  function getMany(names) {
    var res = {};
    return names.reduce(function (p, n, k) {
      if (k % BATCH) return p;
      return p.then(function () { return call("sget", { names: names.slice(k, k + BATCH) }); }).then(function (r) { Object.assign(res, r.files || {}); });
    }, Promise.resolve()).then(function () { return res; });
  }
  function applySnap(dev) {
    return getMany(["snap-" + dev + ".bin"]).then(function (f) {
      var t = f["snap-" + dev + ".bin"]; if (!t) return null;
      return dec(t).then(function (idx) {
        var names = []; for (var k = 0; k < idx.parts; k++) names.push("snap-" + dev + "-" + idx.stamp + "-" + k + ".bin");
        return names.reduce(function (p, n) {
          return p.then(function () { return getMany([n]); }).then(function (ff) { if (!ff[n]) throw new Error("слепок другого компьютера ещё не дописан"); return dec(ff[n]); })
            .then(function (o) { (o.ch || []).forEach(function (ch) { st.got += applyOne(ch); }); });
        }, Promise.resolve()).then(function () { return idx.upto; });
      });
    });
  }
  function pull() {
    return call("slist", { prefix: "" }).then(function (r) {
      var byDev = {};
      (r.files || []).forEach(function (f) {
        var m = /^log-([a-f0-9]+)-(\d{8})\.bin$/.exec(f.name), q = /^snap-([a-f0-9]+)\.bin$/.exec(f.name);
        var dev = (m || q || [])[1]; if (!dev || dev === cfg.dev) return;
        var o = byDev[dev] = byDev[dev] || { logs: [], snap: false };
        if (m) o.logs.push(+m[2]); else o.snap = true;
      });
      cfg.cursors = cfg.cursors || {};
      return Object.keys(byDev).reduce(function (p, dev) {
        return p.then(function () {
          var o = byDev[dev], cur = cfg.cursors[dev] || 0;
          o.logs.sort(function (a, b) { return a - b; });
          var first = o.logs.length ? o.logs[0] : Infinity, need = o.logs.filter(function (n) { return n > cur; });
          var step = Promise.resolve(cur);
          // впервые видим этот компьютер или пропустили удалённые им старые файлы — начинаем с его слепка
          if (o.snap && (cur === 0 || first > cur + 1)) step = applySnap(dev).then(function (upto) { return upto == null ? cur : Math.max(cur, upto); });
          return step.then(function (c2) {
            cfg.cursors[dev] = c2;
            var rest = o.logs.filter(function (n) { return n > c2; }), names = rest.map(function (n) { return "log-" + dev + "-" + pad(n) + ".bin"; });
            return names.reduce(function (p2, n, k) {
              if (k % BATCH) return p2;
              return p2.then(function () { return getMany(names.slice(k, k + BATCH)); }).then(function (ff) {
                return names.slice(k, k + BATCH).reduce(function (p3, nm) {
                  return p3.then(function () { if (!ff[nm]) return; return dec(ff[nm]).then(function (o2) { (o2.ch || []).forEach(function (ch) { st.got += applyOne(ch); }); cfg.cursors[dev] = Math.max(cfg.cursors[dev] || 0, +o2.seq || 0); }); });
                }, Promise.resolve());
              }).then(saveCfg);
            }, Promise.resolve()).then(function () { void need; });
          });
        });
      }, Promise.resolve()).then(function () { cfg.peers = Object.keys(byDev); });
    });
  }
  var timer = null;
  function later(ms) { clearTimeout(timer); timer = setTimeout(run, ms == null ? TICK : ms); }
  function run() {
    var R = window.__otvReports;
    if (!cfg || !cfg.enabled) return Promise.resolve();
    if (!R || !R.ready || !R.ready()) { st.err = "нет связи с Google — подключите его на вкладке «Отчёты»"; later(); return Promise.resolve(); }
    if (busy) { again = true; return Promise.resolve(); }
    busy = true;
    return push().then(function () { return cfg.snapAt && (cfg.logsSinceSnap || 0) < SNAP_EVERY ? null : snapshot(); }).then(pull).then(push)
      .then(function () { st.at = Date.now(); st.err = ""; }, function (e) { st.err = s(e && e.message || e); jlog("ошибка: " + st.err); })
      .then(function () { busy = false; saveTs(); if (again) { again = false; later(1000); } else later(); render(); });
  }

  /* ---------- включение и код подключения ---------- */
  function rid() { var a = new Uint8Array(6); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join(""); }
  function enable(k) {
    var fresh = !cfg.enabled;
    cfg.enabled = true; cfg.key = k || cfg.key || b64(crypto.getRandomValues(new Uint8Array(32))); keyP = null;
    if (fresh) { cfg.seq = 0; cfg.cursors = {}; cfg.snapAt = ""; cfg.logsSinceSnap = 0; }
    return saveCfg().then(function () { later(2000); });
  }
  window.__otvSync = {
    shared: shared,
    // ответ с последней правкой с другого компьютера этот компьютер сам не публикует
    remoteOwned: function (c, i) { return !!(cfg && cfg.enabled && ((tsm[c] || {})[i] || 0) < 0); },
    enabled: function () { return !!(cfg && cfg.enabled); },
    key: function () { return cfg && cfg.enabled ? cfg.key : ""; },
    enable: enable,
    run: run,
    state: function () { return { enabled: !!(cfg && cfg.enabled), at: st.at, sent: st.sent, got: st.got, err: st.err, peers: (cfg && cfg.peers) || [], pending: Object.keys(out).length }; },
    _resnap: function () { if (cfg) cfg.snapAt = ""; },
    _enc: function (o) { return enc(o); }, _dec: function (t) { return dec(t); }
  };

  window.claude.use("db").then(function (d) {
    db = d;
    return Promise.all([db.collection("settings").doc("sync").get(), db.collection("sync_ts").get(), db.collection("sync_out").doc("q").get()]);
  }).then(function (r) {
    cfg = (r[0] && r[0].exists && r[0].data()) || {};
    if (!cfg.dev) { cfg.dev = rid(); saveCfg(); }
    (r[1].docs || []).forEach(function (x) { tsm[x.id] = x.data() || {}; });
    ((r[2] && r[2].exists && r[2].data().list) || []).forEach(function (ch) { out[ch.c + "\u0001" + ch.i] = ch; });
    window.__otvSetSyncHook(onWrite);
    if (cfg.enabled) later(15e3);
    render();
  }).catch(function () {});

  function render() { if (window.__otvDutyRender) window.__otvDutyRender(); }
})();
