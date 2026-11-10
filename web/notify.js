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
  var PF = { "Google": "Google Карты" };
  /* текст уведомления строго по образцу */
  function format(a) {
    var r = a.rating == null || a.rating === "" ? null : +a.rating;
    var txt = s(a.text).trim(); if (txt.length > 3500) txt = txt.slice(0, 3500) + "…";
    return "#нампишут\n" +
      "Площадка: " + (PF[s(a.platform)] || s(a.platform) || "не указана") + "\n" +
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
  window.__otvNotifyFmt = { format: format, due: due };

  var db = null, cfg = {}, alerts = {}, sending = {}, msg = "", msgErr = false;
  function save() { cfg.updatedAt = nowIso(); return db ? db.collection("settings").doc("notify").set(cfg) : Promise.resolve(); }
  function ready() { return !!(cfg.enabled && cfg.token && (cfg.userId || cfg.chatId)); }
  function send(text) { return invoke("max_send", { token: cfg.token, userId: cfg.userId || null, chatId: cfg.userId ? null : cfg.chatId || null, text: text }); }

  var busyFlush = false;
  function flush() {
    if (!db || !ready() || busyFlush) return Promise.resolve();
    var list = Object.keys(alerts).filter(function (id) { return !sending[id] && due(alerts[id], cfg); })
      .sort(function (a, b) { return s(alerts[a].detectedAt).localeCompare(s(alerts[b].detectedAt)); });
    if (!list.length) return Promise.resolve();
    busyFlush = true;
    return list.reduce(function (p, id) {
      return p.then(function () {
        sending[id] = 1;
        return send(format(alerts[id])).then(function () {
          cfg.lastOk = nowIso(); cfg.lastErr = "";
          return db.collection("alerts").doc(id).update({ notifiedAt: nowIso() });
        }, function (e) {
          delete sending[id];
          cfg.lastErr = s(e && e.message || e); jlog("не отправилось: " + cfg.lastErr);
          throw e;
        });
      });
    }, Promise.resolve()).catch(function () {}).then(function () { busyFlush = false; save().catch(function () {}); render(); });
  }
  window.__otvNotify = { flush: flush, ready: ready };

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
      var ups = (j.updates || []).slice().reverse(), who = null;
      for (var i = 0; i < ups.length && !who; i++) {
        var u = ups[i] || {};
        if (u.message && u.message.sender && u.message.sender.user_id && !u.message.sender.is_bot)
          who = { userId: u.message.sender.user_id, name: s(u.message.sender.name || u.message.sender.first_name), chatId: u.message.recipient && u.message.recipient.chat_id || null };
        else if (u.user && u.user.user_id && /bot_started|user_added/.test(s(u.update_type)))
          who = { userId: u.user.user_id, name: s(u.user.name || u.user.first_name), chatId: u.chat_id || null };
      }
      if (!who) { msg = "Бот пока не видит ваших сообщений. Откройте бота в MAX, нажмите «Начать» или напишите «привет», и снова «Привязать»."; msgErr = true; render(); return; }
      cfg.userId = who.userId; cfg.chatId = who.chatId; cfg.who = who.name;
      if (!cfg.since) cfg.since = nowIso();
      cfg.enabled = true;
      return save().then(function () { return send("Ответошная подключена. Сюда будут приходить новые негативные отзывы — каждый один раз."); })
        .then(function () { msg = "Готово: проверьте MAX, там сообщение от бота."; msgErr = false; render(); });
    }).catch(function (e) { msg = s(e && e.message || e); msgErr = true; render(); });
  }

  /* ---------- карточка во вкладке «Источники» ---------- */
  function render() {
    var box = document.getElementById("alertBox"); if (!box) return;
    box.textContent = "";
    var c = el("div", "card ntf");
    c.append(el("h2", null, "Уведомления о негативе в MAX"));
    c.append(el("p", "meta", "Новый негативный отзыв (жалоба или оценка 1–2) приходит вам в MAX сразу после сбора, в формате #нампишут. Каждый — один раз. Работает, пока «Ответошная» открыта и компьютер не спит."));
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
      var line = el("p", "mdl-st");
      line.textContent = !(cfg.userId || cfg.chatId) ? "Бот: " + s(cfg.bot) + ". Осталось привязать: напишите ему в MAX «привет» и нажмите «Привязать»."
        : (cfg.enabled ? "Включено · " : "Выключено · ") + "бот «" + s(cfg.bot) + "» пишет " + (s(cfg.who) || "вам") +
          (cfg.lastOk ? " · последнее уведомление " + new Date(cfg.lastOk).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
      c.append(line);
      if (cfg.lastErr && ready()) c.append(el("p", "note", "Не отправилось: " + cfg.lastErr + ". Повторю при следующем сборе."));
      var bb = el("button", "btn" + (cfg.userId ? "" : " primary"), cfg.userId ? "Привязать заново" : "Привязать"); bb.type = "button"; bb.addEventListener("click", bind); act.append(bb);
      if (cfg.userId || cfg.chatId) {
        var tb = el("button", "btn", "Отправить пробное"); tb.type = "button";
        tb.addEventListener("click", function () {
          tb.disabled = true;
          send(format({ platform: "Яндекс", date: new Date().toISOString().slice(0, 10), rating: 1, author: "Пробный пользователь", text: "Это пробное уведомление от «Ответошной». Настоящие негативные отзывы будут приходить в таком же виде." }))
            .then(function () { msg = "Отправлено: проверьте MAX."; msgErr = false; }, function (e) { msg = s(e && e.message || e); msgErr = true; }).then(render);
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
    box.append(c);
  }
  window.addEventListener("otv-tab", render);
  document.addEventListener("DOMContentLoaded", render);
})();
