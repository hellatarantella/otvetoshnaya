/* Тестовая версия «Ответошной»: выдуманные данные, сбор отзывов имитируется, ничего никуда не уходит. */
(function () {
  var now = Date.now(), H = 3600e3, D = 24 * H;
  function iso(ms) { return new Date(ms).toISOString(); }
  function day(n) { var d = new Date(now - n * D); return d.toISOString().slice(0, 10); }
  function ru(n) { var d = day(n).split("-"); return d[2] + "." + d[1] + "." + d[0]; }
  var SIGN = "С уважением, администрация 24 Московской больницы";
  var data = {
    answers: {
      "pd-9001": { platform: "ПроДокторов", page: "Страница врача: Соколова А.В.", date: ru(1), author: "Ирина", n: 1, status: "pending", link: "https://example.org",
        review: "Спасибо Анне Викторовне за внимательный приём и понятные объяснения. Всё прошло спокойно, без лишних волнений.",
        answer: "Здравствуйте, Ирина!\nСпасибо за отзыв и тёплые слова. Важно и приятно получать такие отзывы. Желаем здоровья и всего самого доброго.\n" + SIGN },
      "ya-demo1": { platform: "Яндекс", page: "Карточка больницы", date: ru(2), author: "Олег", n: 2, status: "pending", rating: 5, threshold: 4, link: "https://example.org",
        review: "Чисто, вежливо, быстро оформили. Рекомендую.",
        answer: "Здравствуйте, Олег!\nСпасибо за высокую оценку. Рады, что вам у нас понравилось. Всегда готовы помочь.\n" + SIGN },
      "dt-demo-1": { platform: "ДокТу", page: "Карточка врача: Лебедев К.С.", date: ru(3), author: "", n: 3, status: "approved", link: "https://example.org",
        review: "Хороший врач, всё объяснил.", answer: "Здравствуйте!\nСпасибо за отзыв. Рады, что смогли помочь. Желаем здоровья и всего самого доброго.\n" + SIGN },
      "2gis-demo-1": { platform: "2ГИС", page: "Карточка больницы", date: ru(5), author: "Мария", n: 4, status: "published", publishedAt: iso(now - 2 * D), link: "https://example.org",
        review: "Спасибо отделению за заботу!", answer: "Здравствуйте, Мария!\nСпасибо за тёплый отзыв. Желаем здоровья вам и вашим близким.\n" + SIGN },
      "pd-9002-appeal": { platform: "ПроДокторов", kind: "appeal", selfSend: true, page: "Страница врача: Морозов Д.А. — обращение на доп. проверку", date: ru(1), author: "", n: 5, status: "pending", link: "https://example.org",
        review: "Врач даже не посмотрел анализы, разговаривал грубо. Больше не приду.",
        answer: "Просим снять отзыв с публикации. Отзыв порочит репутацию больницы и врача Морозова Д.А. Текст эмоционален и субъективен…" },
      "ya-q1": { platform: "Яндекс", kind: "question", page: "Карточка больницы", date: ru(1), author: "Андрей", n: 7, status: "pending", link: "https://example.org",
        review: "Можно ли сделать МРТ по ОМС без направления?",
        answer: "Здравствуйте, Андрей!\nИсследования по ОМС проводятся по направлению лечащего врача поликлиники. Платно МРТ можно пройти без направления, запись по телефону контакт-центра.\n" + SIGN },
      "ya-demo2": { platform: "Яндекс", page: "Карточка больницы", date: ru(0), author: "Светлана", n: 6, status: "pending", rating: 2, threshold: 4, link: "https://example.org",
        review: "Два часа ждали в приёмном, никто ничего не объяснял.",
        answer: "Здравствуйте, Светлана.\nСпасибо за обратную связь. Пожалуйста, напишите нам на gkb24@zdrav.mos.ru дату обращения, и мы разберёмся в ситуации.\n" + SIGN }
    },
    alerts: {
      "pd-9002": { platform: "ПроДокторов", page: "Страница врача", date: day(1), rating: 2, threshold: 4.5, author: "", text: "Врач даже не посмотрел анализы, разговаривал грубо. Больше не приду.", link: "https://example.org", status: "new", detectedAt: iso(now - 20 * H) },
      "ya-demo2": { platform: "Яндекс", page: "Карточка больницы", date: day(0), rating: 2, threshold: 4, author: "Светлана", text: "Два часа ждали в приёмном, никто ничего не объяснял.", link: "https://example.org", status: "new", incident: true, incidentAt: iso(now - 3 * H), detectedAt: iso(now - 5 * H) },
      "site-demo3": { platform: "Сайт", page: "Врач: Петрова Е.Н.", date: day(0), rating: null, author: "Николай Иванович", text: "Медсестра нагрубила при выписке, документы отдали только через три часа.", link: "", status: "new", detectedAt: iso(now - 2 * H) },
      "off-demo2": { platform: "Колл-центр", page: "Звонок", date: day(2), rating: null, author: "", text: "Не могут дозвониться в отделение второй день.", link: "", status: "new", offlineId: "off-demo2", detectedAt: iso(now - 40 * H) },
      "ya-old": { platform: "Яндекс", page: "Карточка больницы", date: day(9), rating: 1, threshold: 4, author: "Гость", text: "Потеряли результаты анализов.", link: "https://example.org", status: "done", incident: true, markAnswered: true, markAppealed: true, detectedAt: iso(now - 9 * D) }
    },
    mail: {
      "site-demo1": { kind: "question", date: day(0), time: "09:40", name: "Елена", page: "Страница: Плановая госпитализация", subject: "Вопрос (Страница: Госпитализация)", text: "Подскажите, какие анализы нужны для плановой госпитализации?", status: "todo",
        draft: "Здравствуйте, Елена!\nСписок обследований для плановой госпитализации есть на сайте больницы в разделе «Пациентам».\n" + SIGN },
      "site-demo2": { kind: "thanks", date: day(1), time: "18:05", name: "Павел", page: "Врач: Соколова А.В.", subject: "Благодарность", text: "Хочу поблагодарить Анну Викторовну за лечение.", status: "todo",
        draft: "Здравствуйте, Павел!\nСпасибо за тёплые слова. Обязательно передадим вашу благодарность Анне Викторовне.\n" + SIGN },
      "site-demo3": { kind: "complaint", date: day(0), time: "11:20", name: "Николай Иванович", page: "Врач: Петрова Е.Н.", subject: "Жалоба", text: "Медсестра нагрубила при выписке, документы отдали только через три часа.", status: "todo",
        draft: "Здравствуйте, Николай Иванович.\nБлагодарим за обратную связь. Пожалуйста, напишите на gkb24@zdrav.mos.ru дату выписки — мы разберёмся в ситуации.\n" + SIGN }
    },
    offline: {
      "off-demo1": { kind: "book", place: "Хирургия", date: day(3), text: "Спасибо всему персоналу отделения за заботу и внимание!", status: "new", report: "positive", reportRef: "Позитив · Книга отзывов №1", analysis: "done", tone: "positive", department: "Хирургия", doctors: [], summary: "Благодарность отделению", createdAt: iso(now - 3 * D) },
      "off-demo2": { kind: "call", place: "", date: day(2), time: "14:10", text: "Звонила дочь пациента: не могут дозвониться в отделение второй день.", status: "new", report: "pending", analysis: "done", tone: "negative", alarm: true, department: "ГКБ 24", doctors: [], summary: "Не дозвониться в отделение", createdAt: iso(now - 2 * D) }
    },
    registry: {
      "pd-r1": { platform: "ПроДокторов", date: day(1), page: "Соколова Анна Викторовна", rating: 5, author: "Ирина", text: "Спасибо Анне Викторовне за внимательный приём.", fullText: "Спасибо Анне Викторовне за внимательный приём.", link: "https://example.org", report: "pending", source: "auto" },
      "ya-r2": { platform: "Яндекс", date: day(2), page: "Карточка больницы", rating: 5, author: "Олег", text: "Лежал в кардиологии, всё отлично, спасибо.", fullText: "Лежал в кардиологии, всё отлично, спасибо.", link: "https://example.org", report: "pending", source: "auto" },
      "ya-demo2": { platform: "Яндекс", date: day(0), page: "Карточка больницы", rating: 2, author: "Светлана", text: "Два часа ждали в приёмном, никто ничего не объяснял.", fullText: "Два часа ждали в приёмном, никто ничего не объяснял.", link: "https://yandex.ru/x", report: "pending", source: "auto" },
      "ya-r3": { platform: "Яндекс", date: day(1), page: "Карточка больницы", rating: 4, author: "Гость", text: "Врачи хорошие, но персонал грубо разговаривает.", fullText: "Врачи хорошие, но персонал грубо разговаривает.", link: "https://yandex.ru/y", report: "pending", source: "auto" },
      "site-demo1": { platform: "Сайт", date: day(0), page: "Страница: Плановая госпитализация", rating: null, text: "Подскажите, какие анализы нужны?", fullText: "Подскажите, какие анализы нужны?", report: "pending", source: "auto" }
    },
    registry_meta: { report: { period: "09.10–15.10.2026" }, __import: { at: iso(now) } },
    requests: { collect: { state: "done", finishedAt: iso(now - 50 * 60e3), message: "Собрано: новых 4, тревог 2 · 38 с\n⚠ Не вышло: Яндекс", lastFinishedAt: iso(now - 50 * 60e3), lastMessage: "Собрано: новых 4, тревог 2 · 38 с\n⚠ Не вышло: Яндекс" } }
  };
  if (location.search.indexOf("exam=pass") >= 0) data.settings = { model: { enabled: false, exam: { at: iso(now), n: 20, model: 8, mine: 6, tie: 6, bad: 0 } } };
  var mem = JSON.stringify(data), handlers = {};
  function emit(name, payload) { (handlers[name] || []).forEach(function (f) { try { f({ payload: payload }); } catch (e) { console.error(e); } }); }
  var FAKE = {
    pd: function () { return { ok: true, items: [{ id: "pd-9100", platform: "ПроДокторов", published: true, page: "Страница больницы", date: day(0), time: "08:15", rating: 5, threshold: 4.5, low: false, author: "", text: "Отличное отделение, спасибо всем!", answered: false, link: "https://example.org" }], seen: 12 }; },
    ya: function () { return { ok: false, needLogin: true }; },
    gis: function () { return { ok: true, items: [], seen: 7 }; },
    dt: function () { return { ok: true, items: [], seen: 25 }; },
    go: function () { return { ok: true, items: [], seen: 4 }; },
    np: function () { return { ok: true, items: [{ id: "np-demo1", platform: "НаПоправку", published: true, page: "Страница", date: day(0), time: "", rating: 3, threshold: 4.5, low: true, author: "", text: "Долго ждала приёма у кабинета.", answered: false, link: "https://example.org" }], seen: 30 }; },
    mail: function () { return { ok: true, items: [], seen: 0 }; },
    pubpd: function () { return { ok: true, items: { ok: true } }; },
    pubya: function () { return { ok: true, items: { ok: true } }; },
    pubgis: function () { return { ok: false, error: "не нашла поле ответа" }; },
    pubgo: function () { return { ok: true, items: { ok: true } }; }
  };
  var timers = {};
  // имитация Google-скрипта отчётов
  var GSD = (function () { var d = new Date(now); var st = new Date(d); st.setDate(d.getDate() - ((d.getDay() - 5 + 7) % 7)); var en = new Date(st); en.setDate(st.getDate() + 6);
    var p2 = function (n) { return ("0" + n).slice(-2); }, isoD = function (x) { return x.getFullYear() + "-" + p2(x.getMonth() + 1) + "-" + p2(x.getDate()); };
    return { period: p2(st.getDate()) + "." + p2(st.getMonth() + 1) + "–" + p2(en.getDate()) + "." + p2(en.getMonth() + 1) + "." + en.getFullYear(), start: isoD(st), end: isoD(en), posTitle: "Позитив 2026_92_тест", negTitle: "Негатив 2026_87_тест", positive: [], negative: [] }; })();
  function GS(q) {
    if (q.action === "pair" || q.action === "state") return { ok: true, version: window.__gsVer || 2, state: GSD };
    if (q.action === "refs") return { ok: true, refs: { departments: [["Кардиологическое отделение", "Кардиология"]], exceptions: [], staff: [["Соколова Анна Викторовна", "Врач-кардиолог", "Кардиологическое отделение"]], categories: ["ГКБ 24", "Кардиология", "Хирургия", "Приёмное отделение"] } };
    if (q.action === "add") { var refs = {};
      (q.positive || []).forEach(function (x) { GSD.positive.push({ platform: x.platform, num: GSD.positive.length + 1, date: x.date, dept: x.dept, text: x.text.slice(0, 120) }); refs[x.id] = "Позитив · " + x.platform + " №" + GSD.positive.length; });
      (q.negative || []).forEach(function (x) { GSD.negative.push({ n: GSD.negative.length + 1, platform: x.platform, date: x.date, text: x.text.slice(0, 120) }); refs[x.id] = "Негатив · блок " + GSD.negative.length; });
      return { ok: true, refs: refs, state: GSD, numbers: { unknown: [] } }; }
    if (q.action === "numbers") return { ok: true, numbers: {} };
    if (q.action === "export") return { ok: true, files: [{ name: GSD.posTitle + ".xlsx", data: "AQID" }, { name: GSD.negTitle + ".docx", data: "AQID" }] };
    if (q.action === "answers") return { ok: true, updated: 0 };
    return { ok: false, error: "в тестовой версии этого нет" };
  }
  var MDL = { installed: false, dl: { active: false, done: 0, total: 0, error: "" }, n: 0 };
  window.__TAURI__ = {
    core: {
      convertFileSrc: function (x) { return x; },
      invoke: function (cmd, a) {
        a = a || {};
        if (cmd === "db_load") return Promise.resolve(mem);
        if (cmd === "db_save") { mem = a.json; return Promise.resolve(null); }
        if (cmd === "app_info") return Promise.resolve({ version: "0.2.8 · тест", keySource: "keychain", backups: 3, backupsKeep: 14, encrypted: true, dataBytes: mem.length, test: false });
        if (cmd === "update_check") return Promise.resolve(null);
        if (cmd === "source_collect") {
          var id = a.id, wait = id === "mail" ? 9000 : /^pub/.test(id) ? 1500 : 2500 + Math.random() * 5000;
          timers[id] = setTimeout(function () { var f = FAKE[id] || function () { return { ok: true, items: [] }; }; emit("source-result", { id: id, payload: JSON.stringify(f()), from: "src-" + id + "-c" }); }, wait);
          return Promise.resolve(null);
        }
        if (cmd === "gs_call") return new Promise(function (res) { setTimeout(function () { res(JSON.stringify(GS(JSON.parse(a.body)))); }, 400); });
        if (cmd === "model_status") return Promise.resolve({ installed: MDL.installed, bytes: MDL.installed ? 2497280000 : 0, server: true, running: false, download: MDL.dl });
        if (cmd === "model_download") {
          MDL.dl = { active: true, done: 0, total: 2497280000, error: "" };
          var tick = setInterval(function () {
            MDL.dl.done += 500000000;
            if (MDL.dl.done >= MDL.dl.total) { clearInterval(tick); MDL.dl = { active: false, done: 0, total: 0, error: "" }; MDL.installed = true; }
            emit("model-progress", {});
          }, 400);
          return Promise.resolve(null);
        }
        if (cmd === "model_delete") { MDL.installed = false; return Promise.resolve(null); }
        if (cmd === "model_generate") {
          var u = a.messages[a.messages.length - 1].content, neg = /ЭТО ЖАЛОБА/.test(a.messages[0].content);
          MDL.n++;
          var txt = neg ? ["Спасибо за обратную связь. Нам важно разобраться в ситуации: пожалуйста, напишите на gkb24@zdrav.mos.ru, указав дату и отделение.",
                           "Благодарим, что рассказали об этом. Чтобы мы могли проверить ситуацию, напишите нам на gkb24@zdrav.mos.ru с датой и названием отделения."][MDL.n % 2]
                        : ["Спасибо за тёплый отзыв. Рады, что вы остались довольны лечением. Желаем здоровья и всего самого доброго.",
                           "Благодарим за добрые слова о работе наших сотрудников. Ценим ваше доверие и всегда готовы помочь. Желаем здоровья и всего самого доброго.",
                           "Hello world"][MDL.n % 3];
          return new Promise(function (r) { setTimeout(function () { r(txt); }, 700); });
        }
        if (cmd === "source_stop") { clearTimeout(timers[a.id]); return Promise.resolve(null); }
        if (cmd === "source_open") { if (window.__otvBar) window.__otvBar.show("В тестовой версии окна кабинетов и почты не открываются.", "", [["Закрыть", window.__otvBar.hide]]); return Promise.resolve(null); }
        return Promise.resolve(null);
      }
    },
    event: { listen: function (name, f) { (handlers[name] = handlers[name] || []).push(f); return Promise.resolve(function () {}); } }
  };
  document.addEventListener("DOMContentLoaded", function () {
    var b = document.createElement("div");
    b.className = "demo-note";
    b.textContent = "Тестовая версия: данные выдуманные, «Собрать отзывы» только изображает сбор. Ничего не публикуется и не сохраняется.";
    var w = document.querySelector(".wrap"); if (w) w.insertBefore(b, w.firstChild);
  });
})();
