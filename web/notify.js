/* Уведомления о негативных отзывах в MAX.
   Как только сбор нашёл новый негативный отзыв (жалоба или оценка 1–2), программа шлёт его боту сотрудницы в MAX
   ровно в формате:
     #нампишут
     Площадка: Яндекс
     Дата отзыва: 7 ноября
     Оценка 1/5
     Ник пользователя: …
     (пустая строка)
     текст отзыва
   Каждый отзыв — один раз (отметка notifiedAt в записи «alerts»). Не ушло (нет сети) — повторит при следующем сборе.
   Токен бота хранится в зашифрованных данных программы (settings/notify), в журнал и на экран не выводится. */
(function () {
  "use strict";
  var T = window.__TAURI__, invoke = T && T.core && T.core.invoke;
  if (!invoke) return;
  function s(v) { return v == null ? "" : String(v); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function nowIso() { return new Date().toISOString(); }
  function jlog(x) { if (window.__otvLog) window.__otvLog("уведомления: " + x); }
  var MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

  function dateWords(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s(d)) || /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s(d));
    if (!m) return s(d) || "не указана";
    return m[1].length === 4 ? (+m[3]) + " " + MON[+m[2] - 1] : (+m[1]) + " " + MON[+m[2] - 1];
  }
  /* 10.11: персональные данные не уходят из программы. В MAX — без контактов авторов писем, а в тексте скрыты
     почта, телефоны и ФИО (кроме сотрудников больницы из справочника — дежурному важно, о ком отзыв) */
  function staffKeys() {
    var r = (window.__otvGet && window.__otvGet("settings", "refs")) || {}, k = {};
    (r.staff || []).forEach(function (x) { var p = s(x && x[0]).toLowerCase().replace(/ё/g, "е").split(/\s+/); if (p[0]) k["s:" + p[0].slice(0, 5)] = 1; if (p[1] && p[2]) k["n:" + p[1].slice(0, 4) + " " + p[2].slice(0, 5)] = 1; });
    return k;
  }
  function isStaff(m, k) {
    var w = m.toLowerCase().replace(/ё/g, "е").replace(/[.]/g, " ").split(/\s+/).filter(Boolean);
    for (var i = 0; i < w.length; i++) { if (w[i].length > 2 && k["s:" + w[i].slice(0, 5)]) return true; if (w[i + 1] && k["n:" + w[i].slice(0, 4) + " " + w[i + 1].slice(0, 5)]) return true; }
    return false;
  }
  function mask(text) {
    var k = staffKeys(), F = "[ФИО скрыто]";
    var x = s(text).replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[почта скрыта]").replace(/\+?\d[\d\s()-]{8,}\d/g, "[телефон скрыт]");
    var P = "[А-ЯЁ][а-яё]*(?:вич|вн|ичн)[а-яё]{0,3}(?![а-яё])";
    [new RegExp("[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+ " + P, "g"), new RegExp("[А-ЯЁ][а-яё]+ " + P, "g"),
     /[А-ЯЁ][а-яё]{2,} [А-ЯЁ]\.\s?[А-ЯЁ]\./g, /[А-ЯЁ]\.\s?[А-ЯЁ]\.\s?[А-ЯЁ][а-яё]{2,}/g].forEach(function (re) {
      x = x.replace(re, function (m) { return isStaff(m, k) ? m : F; });
    });
    return x;
  }
  /* текст уведомления строго по образцам (10.11): площадки — с оценкой и ником; письмо с сайта — без контактов автора */
  function format(a) {
    var r = a.rating == null || a.rating === "" ? null : +a.rating;
    var txt = mask(s(a.text).trim()); if (txt.length > 3500) txt = txt.slice(0, 3500) + "…";
    if (s(a.platform) === "Сайт")
      return "#нампишут\nПлощадка: Сайт\nДата отзыва: " + dateWords(a.date) + "\n\n" + txt + "\n\nКонтакты автора — в программе.";
    return "#нампишут\n" +
      "Площадка: " + (s(a.platform) || "не указана") + "\n" +
      "Дата отзыва: " + dateWords(a.date) + "\n" +
      "Оценка " + (r != null && !isNaN(r) ? (Math.round(r * 10) / 10 + "").replace(".", ",") + "/5" : "не указана") + "\n" +
      "Ник пользователя: " + (s(a.author).trim() || "не указан") + "\n\n" + txt;
  }
  // какие записи слать: найдены после включения, не старше 14 дней по дате отзыва, ещё не отправлены
  function due(a, cfg, now) {
    if (!a || a.notifiedAt || a.status === "done" || a.answered) return false;
    if (!cfg.since || s(a.detectedAt) < cfg.since) return false;
    var t = Date.parse(s(a.date)); if (!isNaN(t) && (now || Date.now()) - t > 14 * 864e5) return false;
    return !!s(a.text).trim() || a.rating != null;
  }
  window.__otvNotifyFmt = { format: format, due: due, mask: mask };

  var db = null, cfg = {}, alerts = {}, sending = {}, msg = "", msgErr = false;
  function save() { cfg.updatedAt = nowIso(); return db ? db.collection("settings").doc("notify").set(cfg) : Promise.resolve(); }
  /* получатели: люди, написавшие боту, и общие чаты MAX, куда добавлен бот. key: u<id> или c<id> */
  function targets() {
    var l = Array.isArray(cfg.targets) ? cfg.targets.slice() : [];
    if (!l.length && cfg.userId) l.push({ key: "u" + cfg.userId, user: cfg.userId, name: s(cfg.who) || "вы" });   // настройки до 10.11
    return l;
  }
  function ready() { return !!(cfg.enabled && cfg.token && targets().length); }
  function sendTo(tg, text) { return invoke("max_send", { token: cfg.token, userId: tg.user || null, chatId: tg.user ? null : tg.chat || null, text: text }); }
  // всем получателям; кому уже ушло (skip) — не повторяем. Ответ: список ключей, кому дошло, и ошибка, если кому-то нет
  function sendAll(text, skip) {
    var ok = [], err = "";
    return targets().filter(function (tg) { return !skip || skip.indexOf(tg.key) < 0; }).reduce(function (p, tg) {
      return p.then(function () { return sendTo(tg, text).then(function () { ok.push(tg.key); }, function (e) { err = (tg.name ? tg.name + ": " : "") + s(e && e.message || e); }); });
    }, Promise.resolve()).then(function () { return { ok: ok, err: err }; });
  }

  /* Два компьютера — подстраховка друг друга без повторов (10.11). Оба с одним ботом; у каждого роль:
     «основной» шлёт сразу, «подстраховка» — только если через 45 минут такого сообщения в чате MAX всё ещё нет
     (основной выключен, спит или не видит площадку). Перед каждой отправкой оба смотрят последние сообщения чата:
     уже есть такое же — не шлют, а просто отмечают у себя как отправленное. Общая «память» — сам чат MAX. */
  var BACKUP_WAIT = 45 * 60e3, BACKUP_FORCE = 6 * 3600e3;
  // роль по дежурству (два компьютера): дежурный шлёт сразу, второй — только если через 45 минут в чате ничего нет
  function role() { var D = window.__otvDuty; if (D && D.multi()) return D.isDuty() ? "main" : "backup"; return cfg.role === "backup" ? "backup" : "main"; }
  function norm(x) { return s(x).replace(/\s+/g, " ").trim(); }
  function chatOf(tg) { return tg.chat || tg.dchat || null; }
  // тексты последних сообщений чата получателя: null — прочитать не удалось
  function history(tg, cache) {
    var c = chatOf(tg); if (!c) return Promise.resolve(null);
    if (cache[c] !== undefined) return Promise.resolve(cache[c]);
    return invoke("max_messages", { token: cfg.token, chatId: c }).then(function (raw) {
      var j = {}; try { j = JSON.parse(raw || "{}"); } catch (e) {}
      var set = {}; (j.messages || []).forEach(function (m) { var tx = m && m.body && m.body.text; if (tx) set[norm(tx)] = 1; });
      return (cache[c] = set);
    }, function () { return (cache[c] = null); });
  }
  function rememberChat(tg, raw) {   // ответ MAX на отправку: в нём номер чата-диалога, по нему потом проверяем повторы
    if (tg.chat || tg.dchat) return;
    try { var j = JSON.parse(raw || "{}"), c = j.message && j.message.recipient && j.message.recipient.chat_id; if (c) { tg.dchat = c; cfg.targets = targets().map(function (x) { return x.key === tg.key ? tg : x; }); } } catch (e) {}
  }
  var busyFlush = false;
  function flush(now) {
    now = now || Date.now();
    if (!db || !ready() || busyFlush) return Promise.resolve();
    var list = Object.keys(alerts).filter(function (id) { return !sending[id] && due(alerts[id], cfg); })
      .sort(function (a, b) { return s(alerts[a].detectedAt).localeCompare(s(alerts[b].detectedAt)); });
    if (!list.length) return Promise.resolve();
    busyFlush = true;
    var cache = {}, errs = [], okAny = false;
    return list.reduce(function (p, id) {
      return p.then(function () {
        sending[id] = 1;
        var a = alerts[id], text = format(a), key = norm(text), age = now - (Date.parse(s(a.detectedAt)) || now);
        var sent = Array.isArray(a.sentTo) ? a.sentTo.slice() : [], waiting = false;
        return targets().filter(function (tg) { return sent.indexOf(tg.key) < 0; }).reduce(function (q, tg) {
          return q.then(function () {
            if (role() === "backup" && age < BACKUP_WAIT) { waiting = true; return; }
            return history(tg, cache).then(function (h) {
              if (h && h[key]) { sent.push(tg.key); return; }                  // уже прислал другой компьютер
              if (!h && role() === "backup" && age < BACKUP_FORCE) { waiting = true; return; }   // чат не прочитался — подстраховка не рискует повтором
              return sendTo(tg, text).then(function (raw) { sent.push(tg.key); okAny = true; rememberChat(tg, raw); if (h) h[key] = 1; },
                function (e) { errs.push((tg.name ? tg.name + ": " : "") + s(e && e.message || e)); });
            });
          });
        }, Promise.resolve()).then(function () {
          var all = targets().every(function (tg) { return sent.indexOf(tg.key) >= 0; });
          var patch = { sentTo: sent }; if (all) patch.notifiedAt = nowIso();
          return db.collection("alerts").doc(id).update(patch).then(function () { if (!all) delete sending[id]; });
        });
      });
    }, Promise.resolve()).catch(function () {}).then(function () {
      if (okAny) cfg.lastOk = nowIso();
      cfg.lastErr = errs.join("; "); if (errs.length) jlog("не отправилось: " + cfg.lastErr);
      busyFlush = false; save().catch(function () {}); render();
    });
  }
  // подстраховка проверяет отложенное сама, даже без нового сбора
  setInterval(function () { if (role() === "backup") flush(); }, 5 * 60e3);
  /* самоконтроль для дежурного: площадка перестала читаться — одно предупреждение; заработала — одно «снова читается».
     Каждый вечер (первый сбор после 20:00) — короткая сводка, чтобы тишина в чате значила «всё спокойно», а не «программа встала» */
  var busyHealth = false;
  function health(now) {
    now = now || new Date();
    if (!ready() || busyHealth || !window.__otvSrcHealth || role() === "backup") return Promise.resolve();   // предупреждения шлёт только основной — без повторов
    var list = window.__otvSrcHealth() || [], warned = Object.assign({}, cfg.warned || {}), out = [];
    list.forEach(function (x) {
      var okAge = x.okAt ? now - Date.parse(x.okAt) : Infinity, bad = !x.ok && okAge > 12 * 3600e3;
      if (bad && !warned[x.name] && cfg.healthOn !== false) {
        warned[x.name] = now.toISOString();
        out.push("⚠️ Ответошная: " + x.name + " не читается" + (x.needLogin ? " — нужен вход в кабинет" : x.down ? " — сбой на самой площадке" : "") + ". Новые отзывы оттуда сейчас не приходят" + (x.needLogin ? ". Войдите: «Источники» → «Войти: " + x.name + "»." : "."));
      } else if (x.ok && warned[x.name]) delete warned[x.name];   // заработало — молча (10.11: «минимум уведомлений, только самое важное»)
    });
    var day = now.getFullYear() + "-" + (now.getMonth() + 1) + "-" + now.getDate();
    if (cfg.dailyOn === true && now.getHours() >= 20 && cfg.dailyAt !== day) {
      cfg.dailyAt = day;
      var since = now - 864e5, neg = Object.keys(alerts).filter(function (id) { return Date.parse(s(alerts[id].detectedAt)) >= since; }).length;
      var bad = list.filter(function (x) { return !x.ok; }).map(function (x) { return x.name + (x.needLogin ? " (нужен вход)" : ""); });
      out.push("Ответошная работает · сводка за сутки\nНегатив: " + neg + (neg ? " (все отзывы присланы сюда выше)" : " — нового негатива нет") + "\n" +
        (bad.length ? "Не читаются: " + bad.join(", ") : "Все площадки и почта читаются") + "\nСледующие проверки: каждый день в 9:00 и 20:00, в будни ещё каждые 30 минут с 8 до 20.");
    }
    var changed = JSON.stringify(warned) !== JSON.stringify(cfg.warned || {});
    cfg.warned = warned;
    if (!out.length && !changed) return Promise.resolve();
    busyHealth = true;
    return out.reduce(function (p, m) { return p.then(function () { return sendAll(m); }); }, Promise.resolve())
      .catch(function () {}).then(function () { busyHealth = false; return save().catch(function () {}); });
  }
  window.__otvNotify = { flush: function () { return flush().then(function () { return health(); }); }, ready: ready, health: health, flushAt: flush };

  window.claude.use("db").then(function (d) {
    db = d;
    db.collection("settings").onSnapshot(function (sn) {
      sn.docs.forEach(function (x) { if (x.id === "notify") cfg = Object.assign({}, x.data() || {}); });
      render(); flush();
    }, function () {});
    db.collection("alerts").onSnapshot(function (sn) {
      var m = {}; sn.docs.forEach(function (x) { m[x.id] = x.data() || {}; }); alerts = m; flush();
    }, function () {});
  }).catch(function () {});

  /* ---------- привязка: кому писать ---------- */
  function bind() {
    msg = "Ищу ваше сообщение боту…"; msgErr = false; render();
    return invoke("max_updates", { token: cfg.token }).then(function (raw) {
      var j = {}; try { j = JSON.parse(raw || "{}"); } catch (e) {}
      var found = [];
      function add(tg) { if (tg && !found.some(function (x) { return x.key === tg.key; })) found.push(tg); }
      (j.updates || []).forEach(function (u) {
        u = u || {}; var m = u.message || {}, snd = m.sender || {}, rc = m.recipient || {};
        if (/bot_removed|user_removed|chat_title|bot_stopped/.test(s(u.update_type))) return;
        if (m.sender && !snd.is_bot && rc.chat_type && rc.chat_type !== "dialog" && rc.chat_id) add({ key: "c" + rc.chat_id, chat: rc.chat_id, name: "чат «" + s(rc.title || rc.chat_title || rc.chat_id) + "»" });
        else if (m.sender && snd.user_id && !snd.is_bot) add({ key: "u" + snd.user_id, user: snd.user_id, dchat: rc.chat_id || null, name: s(snd.name || [snd.first_name, snd.last_name].filter(Boolean).join(" ")) || "пользователь " + snd.user_id });
        else if (/bot_added/.test(s(u.update_type)) && u.chat_id) add({ key: "c" + u.chat_id, chat: u.chat_id, name: "чат «" + s(u.chat_title || u.chat_id) + "»" });
        else if (/bot_started/.test(s(u.update_type)) && u.user && u.user.user_id) add({ key: "u" + u.user.user_id, user: u.user.user_id, dchat: u.chat_id || null, name: s(u.user.name || u.user.first_name) || "пользователь " + u.user.user_id });
      });
      var cur = targets(), fresh = found.filter(function (tg) { return !cur.some(function (x) { return x.key === tg.key; }); });
      if (!fresh.length) { msg = cur.length ? "Новых получателей нет. Пусть коллега напишет боту «привет» (или добавьте бота в общий чат MAX и напишите там) — и снова «Добавить получателей»." : "Бот пока не видит ваших сообщений. Откройте бота в MAX, нажмите «Начать» или напишите «привет», и снова «Привязать»."; msgErr = !cur.length; render(); return; }
      cfg.targets = cur.concat(fresh); delete cfg.userId; delete cfg.chatId;
      if (!cfg.since) cfg.since = nowIso();
      cfg.enabled = true;
      return save().then(function () {
        return fresh.reduce(function (p, tg) { return p.then(function () { return sendTo(tg, "Ответошная подключена. Сюда будут приходить новые негативные отзывы и жалобы из писем с сайта — каждый один раз.").catch(function () {}); }); }, Promise.resolve());
      }).then(function () { msg = "Добавлено: " + fresh.map(function (x) { return x.name; }).join(", ") + ". Проверьте MAX — там сообщение от бота."; msgErr = false; render(); });
    }).catch(function (e) { msg = s(e && e.message || e); msgErr = true; render(); });
  }

  /* ---------- карточка во вкладке «Источники» ---------- */
  function render() {
    var box = document.getElementById("alertBox"); if (!box) return;
    box.textContent = "";
    var c = el("div", "card ntf");
    c.append(el("h2", null, "Уведомления о негативе в MAX"));
    c.append(el("p", "meta", "Новый негативный отзыв (жалоба или оценка 1–2) и жалоба из писем с сайта приходят в MAX сразу после сбора — вам и коллегам, которых вы добавите, в формате #нампишут. Каждый — один раз. Работает, пока «Ответошная» открыта и компьютер не спит."));
    if (cfg.token && targets().length) {
      var opts = el("div", "actions");
      [["healthOn", "Предупредить один раз, если площадка или почта не читаются больше 12 часов", true], ["dailyOn", "Вечерняя сводка «всё работает» в 20:00", false]].forEach(function (o) {
        var lb = el("label", "ntf-opt"), cb = el("input"); cb.type = "checkbox"; cb.checked = o[2] ? cfg[o[0]] !== false : cfg[o[0]] === true;
        cb.addEventListener("change", function () { cfg[o[0]] = cb.checked; save(); });
        lb.append(cb, document.createTextNode(" " + o[1])); opts.append(lb);
      });
      c.append(opts);
    }
    c.append(el("p", "meta", "Сбор по расписанию: каждый день в 9:00 и 20:00 (если компьютер спал — сразу, как проснётся, в течение 3 часов), а в будни с 8 до 20 — каждые 30 минут."));
    var act = el("div", "actions");
    if (!cfg.token) {
      var ol = el("ol", "ntf-steps");
      ["В MAX: «Сообщества» → «Создать сообщество» (можно закрытое, только для себя).",
       "Настройки сообщества (шестерёнка) → «Для разработчиков» или «API» → создать бота → скопировать токен.",
       "Вставьте токен ниже и нажмите «Сохранить». Токен никому не пересылайте: он хранится только в зашифрованных данных программы.",
       "Откройте бота в MAX, напишите ему «привет» и нажмите здесь «Привязать»."].forEach(function (t) { ol.append(el("li", null, t)); });
      c.append(ol);
      var inp = el("input", "ntf-tok"); inp.type = "password"; inp.placeholder = "Токен бота MAX"; inp.autocomplete = "off"; inp.spellcheck = false;
      var b = el("button", "btn primary", "Сохранить"); b.type = "button";
      b.addEventListener("click", function () {
        var t = inp.value.trim(); if (!t) { msg = "Вставьте токен."; msgErr = true; render(); return; }
        b.disabled = true; msg = "Проверяю токен…"; msgErr = false;
        invoke("max_me", { token: t }).then(function (raw) {
          var j = {}; try { j = JSON.parse(raw || "{}"); } catch (e) {}
          cfg.token = t; cfg.bot = s(j.name || j.username || "бот"); msg = "Токен подходит: " + cfg.bot + ". Теперь напишите боту в MAX «привет» и нажмите «Привязать»."; msgErr = false;
          return save();
        }).catch(function (e) { msg = s(e && e.message || e); msgErr = true; }).then(render);
      });
      act.append(inp, b);
    } else {
      var line = el("p", "mdl-st"), tl = targets();
      line.textContent = !tl.length ? "Бот: " + s(cfg.bot) + ". Осталось привязать: напишите ему в MAX «привет» и нажмите «Привязать»."
        : (cfg.enabled ? "Включено · " : "Выключено · ") + "бот «" + s(cfg.bot) + "»" +
          (cfg.lastOk ? " · последнее уведомление " + new Date(cfg.lastOk).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
      c.append(line);
      if (tl.length) {
        var ul = el("ul", "ntf-who");
        tl.forEach(function (tg) {
          var li = el("li", null, tg.name + " ");
          var rm = el("button", "link", "убрать"); rm.type = "button";
          rm.addEventListener("click", function () { cfg.targets = targets().filter(function (x) { return x.key !== tg.key; }); delete cfg.userId; save().then(render); });
          li.append(rm); ul.append(li);
        });
        c.append(el("p", "meta", "Получают уведомления:"), ul);
        c.append(el("p", "meta", "Чтобы добавить коллегу: дайте ему ссылку на бота, пусть напишет «привет». Или добавьте бота в общий чат MAX и напишите там. Потом нажмите «Добавить получателей»."));
      }
      if (cfg.lastErr && ready()) c.append(el("p", "note", "Не отправилось: " + cfg.lastErr + ". Повторю при следующем сборе."));
      var bb = el("button", "btn" + (tl.length ? "" : " primary"), tl.length ? "Добавить получателей" : "Привязать"); bb.type = "button"; bb.addEventListener("click", bind); act.append(bb);
      if (tl.length) {
        var tb = el("button", "btn", "Отправить пробное"); tb.type = "button";
        tb.addEventListener("click", function () {
          tb.disabled = true;
          sendAll(format({ platform: "Яндекс", date: new Date().toISOString().slice(0, 10), rating: 1, author: "Пробный пользователь", text: "Это пробное уведомление от «Ответошной». Настоящие негативные отзывы будут приходить в таком же виде." }))
            .then(function (r) { msg = r.err ? "Не всем дошло: " + r.err : "Отправлено всем получателям: проверьте MAX."; msgErr = !!r.err; }).then(render);
        });
        var en = el("button", "btn", cfg.enabled ? "Выключить" : "Включить"); en.type = "button";
        en.addEventListener("click", function () { cfg.enabled = !cfg.enabled; if (cfg.enabled && !cfg.since) cfg.since = nowIso(); save().then(render); });
        act.append(tb, en);
      }
      var ch = el("button", "link", "Сменить токен"); ch.type = "button";
      ch.addEventListener("click", function () { cfg = { since: cfg.since }; msg = ""; save().then(render); });
      act.append(ch);
    }
    c.append(act);
    if (msg) { var m = el("p", "ctl-st" + (msgErr ? " err" : " ok"), msg); c.append(m); }
    if (window.__otvFold) { var on = cfg.token && targets().length; c = window.__otvFold(c, "max", on ? "включены" + (cfg.lastErr ? " · не отправилось последнее" : "") : "не настроены"); if (msg) c.open = true; }
    box.append(c);
  }
  window.addEventListener("otv-tab", render);
  document.addEventListener("DOMContentLoaded", render);
})();
