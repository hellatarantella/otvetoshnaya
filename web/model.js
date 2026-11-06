/* «Ответошная» — встроенная модель (Qwen3 4B, llama.cpp) прямо на этом компьютере.
   Скачивается один раз (около 2,5 ГБ), работает без интернета; тексты никуда не уходят.
   Пишет варианты для «↻ Ещё вариант»: правила справочника + лучшие образцы из вашей базы ответов
   (то, что вы согласовали и исправили, — в первую очередь). Итог проходит ту же проверку правил,
   что и шаблоны; если модель ошиблась — вариант берётся из шаблонов.
   Вкладка «Ответы → Модель»: скачать, включить, проверка вслепую. */
(function () {
  "use strict";
  if (!window.__OTV_APP) return;
  var T = window.__TAURI__, invoke = T && T.core && T.core.invoke;
  if (!invoke) return;
  var SIGN = "С уважением, администрация 24 Московской больницы";
  var SIZE = "2,5 ГБ";
  function s(v) { return v == null ? "" : String(v); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function gb(b) { return (b / 1e9).toFixed(1).replace(".", ",") + " ГБ"; }

  /* ---------- состояние ---------- */
  var st = { installed: false, server: false, running: false, bytes: 0, download: {}, enabled: false, exam: null, busy: false };
  var db = null;
  function refresh() {
    return invoke("model_status").then(function (r) {
      r = r || {};
      st.installed = !!r.installed; st.server = !!r.server; st.running = !!r.running; st.bytes = r.bytes || 0; st.download = r.download || {};
      render(); return st;
    }, function () { return st; });
  }
  function saveSettings() {
    if (db) db.collection("settings").doc("model").set({ enabled: st.enabled, exam: st.exam || null, auto: st.auto || null, updatedAt: new Date().toISOString() }).catch(function () {});
  }
  window.claude.use("db").then(function (d) {
    db = d;
    return db.collection("settings").doc("model").get();
  }).then(function (snap) {
    if (snap && snap.exists) { var v = snap.data() || {}; st.enabled = !!v.enabled; st.exam = v.exam || null; st.auto = v.auto || null; }
    render();
  }).catch(function () {});
  try { T.event.listen("model-progress", function () { refresh(); }); } catch (e) {}
  refresh();

  /* ---------- запрос к модели ---------- */
  function ref(id) { var n = document.getElementById(id); return n ? n.textContent.trim() : ""; }
  function styleRules() {
    // правила справочника без пункта о подписи (подпись и приветствие ставит программа)
    return ref("ref-style").replace(/^1\.[^\n]*\n/m, "").replace(/\n{3,}/g, "\n\n");
  }
  var BASE_RULES = "Пиши «вы» со строчной. Не «врачи и персонал», а «сотрудники». Не оценивай своих врачей от лица больницы. Не обсуждай лечение и болезнь. " +
    "Каждое предложение с подлежащим и сказуемым; не повторяй слова и однокоренные в соседних предложениях. По имени обращаемся, только если автор подписан обычным полным именем, а не ником. ";
  var COMMON = "Мы — больница: не пиши «клиника» и «медицинский центр». Не пересказывай, что именно понравилось или не понравилось пациенту (еда, чистота, парковка, вежливость, обследования), — пиши общими словами. ";
  function situationRules(tone, type) {
    if (type === "question") return "ЭТО ВОПРОС. Отвечай только по фактам выше и по образцам. Ничего не выдумывай: телефоны, сроки, имена, порядок. " +
      "Если фактов не хватает — дай номер Единого контактного центра 8-495-685-17-94 и почту gkb24@zdrav.mos.ru. Не пересказывай вопрос.";
    // правила из базы обучения (согласованы сотрудницей 22.10.2026)
    if (tone === "mixed") return "ЭТО СМЕШАННЫЙ ОТЗЫВ: есть благодарность и есть жалоба. Сначала поблагодари за обратную связь и добрые слова о названных сотрудниках (передадим им), " +
      "затем отдельно ответь на жалобу: ситуация требует внимательного рассмотрения; попроси написать на gkb24@zdrav.mos.ru, указав ФИО, дату и время; мы свяжемся с ответственными подразделениями и после проверки дадим ответ. " +
      "БЕЗ пожеланий здоровья и без «рады, что вам понравилось». Не пересказывай отзыв. 3–4 предложения.";
    if (tone === "negative") return "ЭТО ЖАЛОБА. Позитивом на негатив не отвечаем: никаких пожеланий здоровья и «рады». Структура: благодарим, что поделились произошедшим; " +
      "ситуация требует рассмотрения или нас обеспокоила; просим написать на gkb24@zdrav.mos.ru с данными (ФИО, даты, телефон); свяжемся с ответственными подразделениями, затем дадим ответ и предложим дальнейшие шаги. " +
      "Не спорь, не оправдывайся, не извиняйся, не пиши «сожалеем», «простите», «извините». Не пересказывай жалобу, не обсуждай лечение и болезнь, не обещай наказаний, не упоминай приказы и согласования. 2–4 предложения.";
    var r = "ЭТО БЛАГОДАРНОСТЬ. Короткий отзыв — короткий ответ, подробный — развёрнутый и тёплый, но сдержанный. Концовка: «Желаем здоровья и всего самого доброго.»";
    if (type === "doctor") r += " Отзыв на странице ВРАЧА: ничего «не передаём», врача по имени не называем, о больнице и стационаре не пишем, слова отзыва себе не присваиваем.";
    else r += " Если в отзыве назван врач по имени и отчеству, можно написать, что передадим ему благодарность (так, как он назван в отзыве) и команде отделения.";
    return r;
  }
  // жалоба с благодарностью названным сотрудникам — смешанный отзыв (своя схема ответа)
  function mixedOf(req, tone) {
    if (tone !== "negative") return tone;
    var r = s(req.review);
    if (window.__otvSpeech && window.__otvSpeech.analyze(r).tone === "mixed") return "mixed";
    return /(спасибо|благодар|отдельн\S* благодарн|врачи (грамотн|внимательн|хорош)|все отлично|всё отлично|претензий нет)/i.test(r) ? "mixed" : tone;
  }
  function itemOf(req) {
    return { platform: s(req.platform), page: s(req.page), author: s(req.author), review: s(req.review), rating: req.rating,
      tone: req.tone, kind: req.kind === "question" ? "question" : "", kbId: req.kbId || "" };
  }
  function bodyOf(text) {
    return s(text).replace(/\r/g, "").split("\n").map(function (l) { return l.trim(); }).filter(function (l) {
      return l && !/^Здравствуйте/i.test(l) && l.replace(/\.$/, "") !== SIGN;
    }).join(" ");
  }
  function messagesFor(req) {
    var G = window.__otvGen, it = itemOf(req), ex = G.examples(it, 4);
    var sys = "Ты пишешь ответы на отзывы и вопросы пациентов от имени администрации ГКБ №24 (24 Московская больница).\n" +
      "Пиши только основной текст ответа по-русски: 1–4 предложения, без приветствия и без подписи — их добавит программа. Только текст ответа, без пояснений и кавычек.\n\n" +
      styleRules() + "\n\n" + BASE_RULES + COMMON + situationRules(mixedOf(req, ex.tone), ex.type);
    var FX = req.kind === "question" && window.__otvFacts ? window.__otvFacts.forQuestion(s(req.review), 4) : [];
    if (FX.length) sys += "\n\nФАКТЫ ДЛЯ ОТВЕТА (бери только их, ничего не добавляй от себя):\n" + FX.map(function (f) { return "— " + f.text; }).join("\n");
    var SP = window.__otvSpeech;
    if (SP) { sys += "\n\n" + SP.PROMPT; var br = SP.brief(req.review).text; if (br) sys += "\n\n" + br; }
    var L = window.__otvLearn, lc = { tone: ex.tone, platform: req.platform };
    var bans = L ? L.active(lc).slice(0, 10) : [], reps = L && L.replaces ? L.replaces(lc).slice(0, 10) : [], favs = L && L.favorites ? L.favorites(lc).slice(0, 5) : [];
    if (bans.length) sys += "\n\nНЕ ПИШИ фразы, которые сотрудница регулярно убирает из ответов: " + bans.map(function (r) { return "«" + r.phrase + "»"; }).join("; ") + ".";
    if (reps.length) sys += "\n\nСЛОВА СОТРУДНИЦЫ — пиши так, как она исправляет: " + reps.map(function (r) { return "«" + r.to + "» вместо «" + r.from + "»"; }).join("; ") + ".";
    if (favs.length) sys += "\n\nФРАЗЫ, КОТОРЫЕ СОТРУДНИЦА ЧАСТО ДОБАВЛЯЕТ САМА (уместно — используй): " + favs.map(function (r) { return "«" + r.phrase + "»"; }).join("; ") + ".";
    var ST = L && L.style ? L.style() : null;
    if (ST && ST.total >= 5) {
      var tn = ex.tone === "negative" ? "neg" : "pos", ln = tn === "neg" ? ST.negLen : ST.posLen;
      var mine = ST.phrases.filter(function (p) { return p.tone === tn; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 6);
      sys += "\n\nСТИЛЬ СОТРУДНИЦЫ (по её ответам): " + (ln ? "обычно " + ln + " предложения; " : "") + (ST.open[0] ? "чаще начинает с «" + ST.open[0].word + "…»; " : "") + (ST.excl ? "" : "без восклицательных знаков; ") +
        (mine.length ? "её фразы (можно брать, меняя порядок): " + mine.map(function (p) { return "«" + p.text + "»"; }).join("; ") : "");
    }
    if (ex.list.length) {
      sys += "\n\nОБРАЗЦЫ, КОТОРЫЕ СОТРУДНИЦА СОГЛАСОВАЛА (повторяй стиль, длину и тон, но не копируй дословно):\n" +
        ex.list.map(function (e) { return (e.situation ? "Отзыв: «" + e.situation.slice(0, 300) + "»\nОтвет: " : "— ") + e.body; }).join("\n");
    }
    var where = [s(req.platform), s(req.page)].filter(Boolean).join(", ");
    var r = Number(req.rating);
    var user = (req.kind === "question" ? "Вопрос" : "Отзыв") + (where ? " (" + where + (req.rating != null && req.rating !== "" && !isNaN(r) ? ", оценка " + r + " из 5" : "") + ")" : "") +
      (req.author ? ", автор: " + s(req.author) : "") + ":\n«" + s(req.review).slice(0, 1500) + "»";
    var cur = bodyOf(req.current);
    if (cur) user += "\n\nЭтот вариант уже есть, напиши другой, своими словами:\n" + cur;
    user += "\n\nНапиши ответ.";
    return { messages: [{ role: "system", content: sys }, { role: "user", content: user }], it: it, tone: ex.tone, type: ex.type };
  }
  /* Маленькая модель лучше правит, чем сочиняет. Поэтому:
     1) короткая подсказка — 3 ваших ответа на самые похожие отзывы + 5–6 главных правил (остальные правила проверяет программа);
     2) «редактор»: модель подгоняет под отзыв лучший готовый вариант программы (ваш ответ на похожий отзыв или сборку из ваших фраз). */
  function shortRules(tone, type) {
    if (type === "question") return "Это вопрос. Отвечай только фактами из справки и образцов; если фактов нет — дай телефон Единого контактного центра 8-495-685-17-94 и почту gkb24@zdrav.mos.ru. Ничего не выдумывай.";
    if (tone === "mixed") return "Отзыв смешанный: сначала спасибо за добрые слова о сотрудниках (передадим), затем отдельно про жалобу — разберёмся, просим написать на gkb24@zdrav.mos.ru с ФИО, датой и телефоном. Без пожеланий здоровья.";
    if (tone === "negative") return "Это жалоба: поблагодари, что сообщили; скажи, что разберёмся; попроси написать на gkb24@zdrav.mos.ru с ФИО, датой и телефоном; после проверки ответим. Не извиняйся, не спорь, без пожеланий здоровья.";
    return "Это благодарность. Концовка: «Желаем здоровья и всего самого доброго.»" + (type === "doctor" ? " Отзыв на странице врача: ничего не «передаём», о больнице не пишем." : "");
  }
  function compactMessages(req) {
    var G = window.__otvGen, it = itemOf(req), ex = G.examples(it, 3), tone = mixedOf(req, ex.tone);
    var sys = "Ты пишешь ответы на отзывы пациентов от имени 24 Московской больницы. Пиши как в образцах: просто, тепло, коротко (2–4 предложения), «вы» со строчной, " +
      "не пересказывай отзыв, не оценивай врачей, не обсуждай лечение, не пиши «клиника». Без приветствия и подписи — только текст ответа.\n" + shortRules(tone, ex.type);
    var FX = req.kind === "question" && window.__otvFacts ? window.__otvFacts.forQuestion(s(req.review), 3) : [];
    if (FX.length) sys += "\nСправка: " + FX.map(function (f) { return f.text; }).join(" ");
    var msgs = [{ role: "system", content: sys }];
    ex.list.forEach(function (e) { if (e.situation) { msgs.push({ role: "user", content: "Отзыв: «" + e.situation.slice(0, 400) + "»" }); msgs.push({ role: "assistant", content: e.body }); } });
    msgs.push({ role: "user", content: "Отзыв: «" + s(req.review).slice(0, 1200) + "»" });
    return { messages: msgs, it: it, tone: ex.tone, type: ex.type };
  }
  function adaptMessages(req, draft) {
    var G = window.__otvGen, it = itemOf(req), ex = G.examples(it, 0), tone = mixedOf(req, ex.tone);
    var sys = "Ты редактор ответов 24 Московской больницы на отзывы пациентов. Тебе дают отзыв и готовый черновик ответа. " +
      "Отредактируй черновик под этот отзыв: сохрани его стиль, тон и длину, меняй не больше одного-двух предложений. " +
      "Если в отзыве есть вопрос или жалоба, а в черновике нет ответа на них — добавь одно предложение. Не добавляй телефонов, имён и фактов, которых нет в черновике или отзыве. " +
      "Не пересказывай отзыв. «вы» со строчной. Выведи только текст ответа, без приветствия и подписи.\n" + shortRules(tone, ex.type);
    return { messages: [{ role: "system", content: sys }, { role: "user", content: "Отзыв: «" + s(req.review).slice(0, 1200) + "»\n\nЧерновик: " + bodyOf(draft) }], it: it, tone: ex.tone, type: ex.type };
  }
  var PHONES = ["84956851794", "84956136310"], MAILS = ["gkb24@zdrav.mos.ru", "gkb24-pmu@zdrav.mos.ru"];
  function valid(t) {
    if (t.length < 40 || t.length > 1400) return false;
    if (/<|>|\bthink\b/i.test(t)) return false;
    var rest = t.replace(/\S+@\S+|https?:\/\/\S+/g, "");
    if (/[a-z]{4,}/i.test(rest)) return false;                                       // латиница — сбой модели
    var phones = (t.match(/\+?\d[\d\s()\-]{8,}\d/g) || []).map(function (x) { return x.replace(/\D/g, "").replace(/^7/, "8"); });
    var FP = window.__otvFacts ? PHONES.concat(window.__otvFacts.phones()) : PHONES, FM = window.__otvFacts ? MAILS.concat(window.__otvFacts.mails()) : MAILS;
    if (phones.some(function (p) { return !FP.some(function (a) { return p.indexOf(a) === 0; }); })) return false; // выдуманный телефон
    var mails = t.match(/[\w.+-]+@[\w.-]+\w/g) || [];
    if (mails.some(function (m) { return FM.indexOf(m.toLowerCase()) < 0; })) return false;
    return true;
  }
  function same(a, b) {
    var w = function (x) { var o = {}; s(x).toLowerCase().replace(/ё/g, "е").split(/[^а-яa-z0-9]+/).forEach(function (y) { if (y.length > 3) o[y.slice(0, 6)] = 1; }); return o; };
    var A = w(a), B = w(b), n = 0, u = 0, k;
    for (k in A) { u++; if (B[k]) n++; } for (k in B) if (!A[k]) u++;
    return u ? n / u > 0.8 : true;
  }
  function generate(messages, temperature) {
    return invoke("model_generate", { messages: messages, maxTokens: 360, temperature: temperature });
  }
  function write(req) {
    if (!window.__otvGen || req.kind === "appeal") return Promise.resolve(null);
    var m = compactMessages(req);
    var tryOnce = function (temp, mm) {
      mm = mm || m;
      return generate(mm.messages, temp).then(function (out) {
        var t = bodyOf(s(out).replace(/<think>[\s\S]*?<\/think>/g, "")).replace(/^[«"]+|[»"]+$/g, "").trim();
        if (!valid(t)) return null;
        var p = window.__otvGen.polish(t, m.it), SP = window.__otvSpeech, L = window.__otvLearn;
        if (p && SP) p = SP.tidy(p, L && L.favorites ? L.favorites({ tone: m.tone, platform: req.platform }).map(function (r) { return r.phrase; }) : []);
        if (!p || bodyOf(p).length < 40) return null;
        if (req.current && same(bodyOf(p), bodyOf(req.current))) return null;          // тот же вариант — не годится
        return p;
      });
    };
    st.running = true; render();
    /* ансамбль: два черновика модели + лучшие варианты программы (ваши ответы на похожие отзывы, ваши фразы, сборщик);
       судья, обученный на ваших выборах, берёт тот, который вы, скорее всего, оставите */
    var G = window.__otvGen, J = window.__otvJudge, it = m.it, own = [], keys = [];
    for (var k = 0; k < 6; k++) {
      var a = null; try { a = G.answer(it, { exclude: keys, current: req.current || "" }); } catch (e) { a = null; }
      if (!a) break; keys.push(a.key);
      if (!(req.current && same(bodyOf(a.text), bodyOf(req.current)))) own.push(a.text);
    }
    var safe = function (p) { return p.then(null, function () { return null; }); };
    // редактор: модель подгоняет под отзыв два лучших готовых варианта (по оценке судьи) + один свой черновик по образцам
    var ranked = J ? own.slice().sort(function (a, b) { return J.score(b, req) - J.score(a, req); }) : own.slice();
    var jobs = ranked.slice(0, 2).map(function (d, i) { return function () { return safe(tryOnce(0.3 + i * 0.25, adaptMessages(req, d))); }; });
    jobs.push(function () { return safe(tryOnce(0.7)); });
    return jobs.reduce(function (p, job) { return p.then(function (acc) { return job().then(function (r) { return acc.concat([r]); }); }); }, Promise.resolve([])).then(function (llm) {
      var all = llm.concat(own).filter(Boolean);
      var pick = J ? J.best(all, req) : (llm[0] || llm[1] || own[0] || null);
      refresh(); return pick;
    }, function (e) { refresh(); throw e; });
  }
  // модель пишет варианты, только если проверка вслепую показала «не хуже» хотя бы в 60% (не меньше 10 отзывов)
  var PASS = 0.6;
  function passed() { var r = st.exam, a = st.auto; return !!((r && r.n >= 10 && (r.model + r.tie) / r.n >= PASS) || (a && a.n >= 20 && a.ok / a.n >= PASS)); }
  /* ---------- контент-анализ моделью: разбор каждого отзыва (тон, сотрудники, за что благодарят, на что жалуются, вопрос, суть).
     Модель отвечает строго по спискам; программа проверяет ответ (сотрудники — только из списка, темы — только из перечня)
     и пишет разбор в отзыв. «Аналитика» и месячная презентация считают темы по нему. Работает пачками по 10, когда модель включена */
  function themeLists() { var M = window.__otvDeckMonth; return { pos: M ? M.THEMES.map(function (t) { return t[0]; }) : [], neg: M ? M.NEG_THEMES.map(function (t) { return t[0]; }) : [] }; }
  function anMessages(text) {
    var T = themeLists();
    var sys = "Ты аналитик отзывов пациентов больницы. Разбери отзыв и ответь строго одним JSON без пояснений:\n" +
      '{"тон":"благодарность|жалоба|смешанный|вопрос|другое","сотрудники":["фамилии сотрудников, как в тексте"],"благодарят_за":["темы из списка А"],"жалуются_на":["темы из списка Б"],"вопрос":"вопрос автора или пусто","суть":"суть отзыва одной фразой до 15 слов"}\n' +
      "Список А: " + T.pos.join("; ") + "\nСписок Б: " + T.neg.join("; ") + "\nБери темы только из списков, дословно. Если темы нет — пустой список.";
    return [{ role: "system", content: sys }, { role: "user", content: "Отзыв: «" + s(text).slice(0, 1500) + "» /no_think" }];
  }
  function parseAn(out) {
    var t = s(out).replace(/<think>[\s\S]*?<\/think>/g, ""), a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a < 0 || b <= a) return null;
    var j; try { j = JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
    var T = themeLists(), TONES = { "благодарность": "positive", "жалоба": "negative", "смешанный": "mixed", "вопрос": "question", "другое": "other" };
    var arr = function (x) { return Array.isArray(x) ? x.map(s) : x ? [s(x)] : []; };
    var pick = function (list, allowed) { return arr(list).map(function (x) { x = x.trim(); return allowed.filter(function (a) { return a === x || a.toLowerCase().indexOf(x.toLowerCase().replace(/[«»"]/g, "").slice(0, 12)) === 0; })[0]; }).filter(Boolean).filter(function (x, i, A) { return A.indexOf(x) === i; }); };
    var R = window.__otvReports, staff = arr(j["сотрудники"]).map(function (x) { var p = R && R.person ? R.person(x.trim()) : null; return p && !p.ambiguous ? p.short : null; }).filter(Boolean);
    return { v: 1, tone: TONES[s(j["тон"]).trim().toLowerCase()] || "other", staff: staff.filter(function (x, i, A) { return A.indexOf(x) === i; }),
      pos: pick(j["благодарят_за"], T.pos), neg: pick(j["жалуются_на"], T.neg), q: s(j["вопрос"]).trim().slice(0, 300), gist: s(j["суть"]).trim().slice(0, 160), at: new Date().toISOString() };
  }
  function analyzeOne(text) { return generate(anMessages(text), 0.1).then(parseAn); }
  var anBusy = false, anStat = { done: 0, failed: 0 };
  function anPending() {
    var reg = ((window.__otvAllRO || window.__otvAll) && (window.__otvAllRO || window.__otvAll)("registry")) || {}, cut = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
    return Object.keys(reg).filter(function (id) { var r = reg[id]; return r && !r.ai && !r.aiFail && s(r.fullText || r.text).trim().length > 20 && s(r.date) >= cut; })
      .sort(function (a, b) { return s(reg[b].date).localeCompare(s(reg[a].date)); });
  }
  function analyzeBatch(n) {
    if (anBusy || !st.installed || !st.enabled || !db) return Promise.resolve(0);
    var ids = anPending().slice(0, n || 10); if (!ids.length) return Promise.resolve(0);
    anBusy = true; var done = 0;
    return ids.reduce(function (p, id) {
      return p.then(function () {
        var r = window.__otvGet ? window.__otvGet("registry", id) : null; if (!r) return;
        return analyzeOne(s(r.fullText || r.text)).then(function (a) {
          if (a) { done++; anStat.done++; return db.collection("registry").doc(id).update({ ai: a }); }
          anStat.failed++; return db.collection("registry").doc(id).update({ aiFail: (r.aiFail || 0) + 1 });
        }, function () { anStat.failed++; });
      });
    }, Promise.resolve()).then(function () { anBusy = false; refresh(); return done; }, function () { anBusy = false; return done; });
  }
  setInterval(function () { analyzeBatch(10); }, 10 * 60 * 1000);

  /* ---------- новые формулировки: модель перефразирует фразы ответов, программа проверяет, вы согласуете ---------- */
  // источники — фразы сборщика и ваша копилка (вступления и середина благодарностей, фразы ответа на жалобу); концовки и просьбы с почтой — не трогаем
  var PH_SLOTS = { pOpen: ["pos", "open"], pMid: ["pos", "mid"], nOpen: ["neg", "nOpen"], nConcern: ["neg", "concern"], nPromise: ["neg", "promise"] };
  function phraseSources() {
    var C = window.__otvCompose, L = window.__otvLearn, out = [];
    Object.keys(PH_SLOTS).forEach(function (b) {
      var m = PH_SLOTS[b];
      (C && C.banks[b] || []).forEach(function (x) { out.push({ text: x[1], tone: m[0], slot: m[1] }); });
      if (L && L.myPhrases) L.myPhrases(m[0], m[1]).forEach(function (p) { out.push({ text: p.text, tone: m[0], slot: m[1] }); });
    });
    return out;
  }
  function phKey(t) { var h = 0; t = s(t).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/g, " ").trim(); for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return "ph" + (h >>> 0).toString(36); }
  function phOk(v, src) {
    var SP = window.__otvSpeech, C = window.__otvCompose, t = s(v).trim().replace(/^[«"—-]\s*|[»"]$/g, "");
    if (t.length < 15 || t.length > Math.max(160, src.text.length * 1.6) || !/[.!?]$/.test(t)) return "";
    if (/[A-Za-z]|\d|gkb24|@|[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+(вна|вич)/.test(t)) return "";                 // без латиницы, цифр, почты, имён
    if (src.tone === "neg" && /извин|сожале|прост(ите|и)\b/i.test(t)) return "";                     // правило: без извинений
    if (/клиник|помога\S* нам станов|врачи и персонал|особенно ценим/i.test(t)) return "";            // запреты справочника
    if (SP && SP.audit(t).score < 8) return "";
    if (C && C.repeats && C.repeats(t)) return "";
    if (t.toLowerCase() === src.text.toLowerCase()) return "";
    return t;
  }
  var phBusy = false;
  function paraphraseBatch(n) {
    if (phBusy || !st.installed || !st.enabled || !db) return Promise.resolve(0);
    var have = ((window.__otvAllRO || window.__otvAll) && (window.__otvAllRO || window.__otvAll)("phrases")) || {}, done = {};
    Object.keys(have).forEach(function (k) { if (have[k] && have[k].from) done[phKey(have[k].from)] = 1; });
    var todo = phraseSources().filter(function (x) { return !done[phKey(x.text)]; }).slice(0, n || 4); if (!todo.length) return Promise.resolve(0);
    phBusy = true; var added = 0;
    return todo.reduce(function (p, src) {
      return p.then(function () {
        var msgs = [{ role: "system", content: "Перефразируй фразу из ответа больницы на отзыв пациента: 3 разных варианта с тем же смыслом и тоном, так же коротко, просто, по-человечески, «вы» со строчной, без канцелярита и штампов" + (src.tone === "neg" ? ", без извинений" : "") + ". Ответь строго JSON-массивом из 3 строк." },
                    { role: "user", content: "Фраза: «" + src.text + "» /no_think" }];
        return generate(msgs, 0.8).then(function (out) {
          var t = s(out).replace(/<think>[\s\S]*?<\/think>/g, ""), a = t.indexOf("["), b = t.lastIndexOf("]"), arr = [];
          try { arr = JSON.parse(t.slice(a, b + 1)); } catch (e) { arr = []; }
          var jobs = [db.collection("phrases").doc(phKey(src.text) + "-src").set({ from: src.text, src: true, at: new Date().toISOString() })];   // отметка: фраза обработана
          (Array.isArray(arr) ? arr : []).map(function (x) { return phOk(x, src); }).filter(Boolean).forEach(function (v) {
            var id = phKey(v); if (have[id]) return; added++;
            jobs.push(db.collection("phrases").doc(id).set({ text: v, from: src.text, tone: src.tone, slot: src.slot, status: "proposed", at: new Date().toISOString() }));
          });
          return Promise.all(jobs);
        }, function () {});
      });
    }, Promise.resolve()).then(function () { phBusy = false; return added; }, function () { phBusy = false; return added; });
  }
  setInterval(function () { if (!anBusy) paraphraseBatch(3); }, 15 * 60 * 1000);
  window.__otvPhrases = { batch: paraphraseBatch, ok: phOk, sources: phraseSources };
  window.__otvAi = { analyzeBatch: analyzeBatch, parse: parseAn, pending: function () { return anPending().length; }, busy: function () { return anBusy; }, stat: function () { return anStat; } };

  window.__otvModel = {
    ready: function () { return st.installed && st.server && st.enabled && passed(); },
    passed: passed,
    write: function (req) { return write(req); },
    state: function () { return st; }
  };

  /* ---------- проверка вслепую ---------- */
  var exam = null; // {items:[{req, mine, model, swap, pick}], i, n}
  function examPool() {
    var kb = (window.__otvAll && window.__otvAll("kb")) || {};
    var out = Object.keys(kb).map(function (k) { var e = kb[k]; e.id = k; return e; }).filter(function (e) {
      return e.kind === "review" && (e.status === "published" || e.status === "approved") && s(e.situation).trim().length > 25 && bodyOf(e.answer).length > 40;
    });
    for (var i = out.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = out[i]; out[i] = out[j]; out[j] = x; }
    return out;
  }
  function reqOfKb(e) {
    var m = /^Здравствуйте,\s*([^!.\n]+)[!.]/.exec(s(e.answer));
    var neg = window.__otvGen && window.__otvGen.NEG_ANS.test(s(e.answer));
    return { kind: "answer", platform: s(e.platform), page: s(e.page), review: s(e.situation), author: m ? m[1].trim() : "", tone: neg ? "negative" : "positive", kbId: e.id };
  }
  function startExam(n) {
    var list = examPool().slice(0, n);
    if (!list.length) { examMsg = "В базе пока нет опубликованных ответов на отзывы. Проверять не на чем."; render(); return; }
    exam = { items: list.map(function (e) { return { req: reqOfKb(e), mine: s(e.answer), model: null, failed: false, swap: Math.random() < 0.5, pick: null }; }), i: 0 };
    examMsg = ""; render(); pump();
  }
  var pumping = false;
  function pump() { // пишет ответы модели заранее, по одному
    if (pumping || !exam) return;
    var next = exam.items.filter(function (x) { return x.model == null && !x.failed; })[0];
    if (!next) return;
    pumping = true;
    write(next.req).then(function (t) { if (t) next.model = t; else next.failed = true; }, function () { next.failed = true; })
      .then(function () { pumping = false; render(); pump(); });
  }
  function finishExam() {
    var done = exam.items.filter(function (x) { return x.pick; });
    var res = { at: new Date().toISOString(), n: done.length, model: 0, mine: 0, tie: 0, bad: 0 };
    done.forEach(function (x) { res[x.pick]++; });
    st.exam = res; exam = null; saveSettings(); render();
  }
  function examLine(r) {
    if (!r || !r.n) return "";
    var ok = r.model + r.tie;
    return "Проверка " + new Date(r.at).toLocaleDateString("ru-RU") + ": модель не хуже ваших ответов в " + ok + " из " + r.n +
      " (" + Math.round(ok * 100 / r.n) + "%). Лучше модель: " + r.model + ", лучше ваш: " + r.mine + ", одинаково: " + r.tie + (r.bad ? ", оба плохие: " + r.bad : "") + ".";
  }

  /* ---------- самопроверка (06.11: «погоняй её по проверке сам, когда будет готова — подключу») ----------
     Без вас: модель пишет ответ на отзыв из базы (ваш же ответ ей не виден), программа сравнивает его с вашим
     опубликованным по вашим правилам и судье, обученному на ваших выборах. «Не хуже» — если нет замечаний проверки,
     не пропущена жалоба или вопрос, нет чужих имён и оценка судьи не ниже вашей больше чем на 0,3.
     Результат ≥ 60% на 20 отзывах открывает переключатель «Ещё вариант пишет модель» — включаете вы */
  var auto = null;
  function autoVerdict(req, model, mine) {
    var why = [], LN = window.__otvLint, G = window.__otvGen, SP = window.__otvSpeech, J = window.__otvJudge;
    if (!model) return { ok: false, why: ["модель не написала ответ"] };
    var lint = []; try { lint = LN ? LN({ page: req.page, review: req.review }, model) : []; } catch (e) {}
    if (lint.length) why.push("замечание проверки: " + (lint[0].text || lint[0].msg || lint[0]));
    if (G && G.check && !G.check(model, { platform: req.platform, page: req.page, review: req.review, author: req.author }, req.tone).ok) why.push("чужое имя или не тот тон");
    if (SP && req.tone === "negative") { var mm = SP.covers(model, req.review).length, hm = SP.covers(mine, req.review).length; if (mm > hm) why.push("пропущена часть жалобы"); }
    if (bodyOf(model).length < 50) why.push("слишком коротко");
    var sm = J ? J.score(model, req) : 0, sh = J ? J.score(mine, req) : 0;
    if (J && sm < sh - 0.3) why.push("судья ставит ваш выше (" + sm.toFixed(1) + " < " + sh.toFixed(1) + ")");
    return { ok: !why.length, why: why, sm: sm, sh: sh };
  }
  function startAuto(n) {
    if (auto && auto.running) return;
    var list = examPool().slice(0, n || 20);
    if (!list.length) { examMsg = "В базе пока нет опубликованных ответов на отзывы. Проверять не на чем."; render(); return; }
    auto = { running: true, items: list.map(function (e) { return { req: reqOfKb(e), mine: s(e.answer), model: null, v: null }; }), i: 0 };
    render();
    var step = function () {
      if (!auto || !auto.running) return;
      var x = auto.items[auto.i]; if (!x) return finishAuto();
      write(x.req).then(function (t) { x.model = t || null; }, function () { x.model = null; }).then(function () {
        x.v = autoVerdict(x.req, x.model, x.mine); auto.i++; render(); setTimeout(step, 50);
      });
    };
    step();
  }
  function finishAuto() {
    var it = auto.items.filter(function (x) { return x.v; }), ok = it.filter(function (x) { return x.v.ok; }).length;
    var why = {}; it.forEach(function (x) { if (!x.v.ok) x.v.why.forEach(function (w) { var k = w.replace(/\s*\(.*$/, "").replace(/:.*$/, ""); why[k] = (why[k] || 0) + 1; }); });
    st.auto = { at: new Date().toISOString(), n: it.length, ok: ok, why: why, lost: it.filter(function (x) { return !x.v.ok; }).slice(0, 3).map(function (x) { return { review: x.req.review.slice(0, 200), model: x.model || "", mine: x.mine, why: x.v.why }; }) };
    auto.running = false; saveSettings(); render();
  }
  function autoLine(a) {
    if (!a || !a.n) return "";
    var w = Object.keys(a.why || {}).sort(function (x, y) { return a.why[y] - a.why[x]; }).map(function (k) { return k + " — " + a.why[k]; }).join("; ");
    return "Самопроверка " + new Date(a.at).toLocaleDateString("ru-RU") + ": модель не хуже ваших ответов в " + a.ok + " из " + a.n + " (" + Math.round(a.ok * 100 / a.n) + "%)." + (w ? " Где проиграла: " + w + "." : "");
  }
  function autoCard() {
    var c = el("div", "card"); c.id = "mdlAuto";
    c.append(el("h2", null, "Самопроверка"));
    c.append(el("p", "meta", "Программа сама сравнивает ответы модели с вашими опубликованными — по вашим правилам и по судье, обученному на ваших выборах. От 60% на 20 отзывах можно включить модель."));
    if (auto && auto.running) {
      var done = auto.items.filter(function (x) { return x.v; }), okN = done.filter(function (x) { return x.v.ok; }).length;
      c.append(el("p", "mdl-st", "Идёт: " + done.length + " из " + auto.items.length + " · не хуже: " + okN + ". Модель пишет ответ…"));
      var pr = el("progress", "mdl-pr"); pr.max = auto.items.length; pr.value = done.length; c.append(pr);
      var stop = el("button", "btn ghost", "Остановить и посчитать"); stop.type = "button";
      stop.addEventListener("click", function () { finishAuto(); });
      var a0 = el("div", "actions"); a0.append(stop); c.append(a0);
      return c;
    }
    if (st.auto) {
      c.append(el("p", "mdl-st", autoLine(st.auto)));
      (st.auto.lost || []).forEach(function (l) {
        var d = el("details", "mdl-lost"); d.append(el("summary", null, "Проиграла: " + l.why.join("; ")));
        d.append(el("p", "meta", "Отзыв: " + l.review), el("div", "mdl-ans", "Модель:\n" + l.model), el("div", "mdl-ans", "Ваш:\n" + l.mine)); c.append(d);
      });
    }
    var a = el("div", "actions"), go = el("button", "btn primary", st.auto ? "Проверить ещё раз · 20 отзывов" : "Запустить · 20 отзывов"); go.type = "button";
    go.addEventListener("click", function () { startAuto(20); });
    a.append(go); c.append(a);
    return c;
  }
  window.__otvModelAuto = { verdict: autoVerdict, start: startAuto, state: function () { return { auto: auto, saved: st.auto, passed: passed() }; } };

  /* ---------- вкладка «Модель» ---------- */
  var examMsg = "";
  function render() {
    var box = document.getElementById("modelBox"); if (!box) return;
    box.textContent = "";
    var top = el("div", "card");
    top.append(el("h2", null, "Встроенная модель"));
    top.append(el("p", "meta", "Пишет варианты ответов прямо на этом компьютере, без интернета: по правилам справочника и по вашим согласованным ответам. Чем больше ответов в базе, тем точнее."));
    var line = el("p", "mdl-st"), act = el("div", "actions");
    var d = st.download || {};
    if (!st.server) {
      line.textContent = "В этой версии программы модели нет. Она появится после обновления.";
    } else if (d.active) {
      line.textContent = "Скачивается: " + (d.total ? gb(d.done) + " из " + gb(d.total) + " (" + Math.round(d.done * 100 / d.total) + "%)" : "начинаю…") + ". Можно работать дальше.";
      var pr = el("progress", "mdl-pr"); pr.max = d.total || 1; pr.value = d.done || 0; top.append(pr);
    } else if (!st.installed) {
      line.textContent = d.error ? "Не скачалась: " + d.error : "Не скачана · " + SIZE + ".";
      var dl = el("button", "btn primary pawbtn", d.error ? "Скачать ещё раз" : "Скачать модель"); dl.type = "button";
      dl.addEventListener("click", function () { dl.disabled = true; invoke("model_download").then(function () { setTimeout(refresh, 600); }, function (e) { st.download = { error: s(e) }; render(); }); });
      act.append(dl);
    } else {
      line.textContent = "Готова · " + gb(st.bytes) + (st.running ? " · работает" : "") + ".";
      top.append(line);
      if (passed()) {
        var tg = el("label", "mdl-tg"), cb = el("input"); cb.type = "checkbox"; cb.checked = st.enabled;
        cb.addEventListener("change", function () { st.enabled = cb.checked; saveSettings(); render(); });
        tg.append(cb, document.createTextNode(" «Ещё вариант» пишет модель"));
        top.append(tg);
        top.append(el("p", "meta", st.enabled ? "Если модель ошибётся или задумается дольше 12 секунд, вариант возьмётся из шаблонов и базы ответов." : "Сейчас варианты берутся из шаблонов и базы ответов, мгновенно."));
      } else {
        top.append(el("p", "meta", "Варианты сейчас берутся из шаблонов и базы ответов, мгновенно. Модель подключится к «Ещё вариант», когда самопроверка или проверка вслепую покажет «не хуже» хотя бы в 60% ответов" +
          (st.auto && st.auto.n ? " (самопроверка: " + Math.round(st.auto.ok * 100 / st.auto.n) + "%)" : "") + (st.exam && st.exam.n ? " (вслепую: " + Math.round((st.exam.model + st.exam.tie) * 100 / st.exam.n) + "%)" : "") + "."));
      }
      var del = el("button", "btn ghost", "Удалить модель"); del.type = "button";
      del.addEventListener("click", function () {
        if (del.dataset.armed !== "1") { del.dataset.armed = "1"; del.textContent = "Точно удалить?"; setTimeout(function () { del.dataset.armed = ""; del.textContent = "Удалить модель"; }, 4000); return; }
        st.enabled = false; saveSettings(); invoke("model_delete").then(refresh, refresh);
      });
      act.append(del);
      top.append(act); box.append(top);
      box.append(autoCard());
      box.append(examCard());
      return;
    }
    top.append(line); if (act.childNodes.length) top.append(act);
    box.append(top);
  }
  function examCard() {
    var c = el("div", "card");
    c.append(el("h2", null, "Проверка вслепую"));
    if (!exam) {
      c.append(el("p", "meta", "Модель пишет ответы на отзывы из вашей базы, а вы сравниваете их с вашими опубликованными ответами, не зная, где чей. Включайте модель, если она не хуже."));
      if (st.exam) c.append(el("p", "mdl-st", examLine(st.exam)));
      var Jd = window.__otvJudge;
      if (Jd && Jd.pairs()) c.append(el("p", "meta", "Лучший вариант выбирает судья, обученный на ваших выборах: " + Jd.pairs()));
      if (examMsg) c.append(el("p", "mdl-st err", examMsg));
      var a = el("div", "actions");
      var go = el("button", "btn primary", st.exam ? "Проверить ещё раз · 20 отзывов" : "Начать · 20 отзывов"); go.type = "button";
      go.addEventListener("click", function () { startExam(20); });
      a.append(go); c.append(a);
      return c;
    }
    var items = exam.items, it = items[exam.i];
    var answered = items.filter(function (x) { return x.pick; }).length;
    c.append(el("p", "meta", "Отзыв " + (exam.i + 1) + " из " + items.length + " · оценено: " + answered));
    var rv = el("blockquote", "review"); rv.textContent = it.req.review; c.append(rv);
    if (it.model == null && !it.failed) {
      c.append(el("p", "mdl-st", "Модель пишет ответ… (первый раз дольше: модель загружается)"));
    } else if (it.failed) {
      c.append(el("p", "mdl-st err", "Модель не справилась с этим отзывом. Он засчитан как «лучше ваш»."));
      if (!it.pick) it.pick = "mine";
    } else {
      var A = it.swap ? it.model : it.mine, B = it.swap ? it.mine : it.model;
      [["А", A], ["Б", B]].forEach(function (p) {
        var b = el("div", "mdl-ans"); b.append(el("div", "label", "Ответ " + p[0])); b.append(el("div", "rev", p[1])); c.append(b);
      });
      var row = el("div", "actions");
      [["Лучше А", it.swap ? "model" : "mine"], ["Лучше Б", it.swap ? "mine" : "model"], ["Одинаково хорошо", "tie"], ["Оба плохие", "bad"]].forEach(function (o) {
        var b = el("button", "btn" + (it.pick === o[1] ? " primary" : ""), o[0]); b.type = "button";
        b.addEventListener("click", function () {
          it.pick = o[1];
          // судья учится: что вы выбрали — лучше того, что не выбрали
          var J = window.__otvJudge; if (J && it.model) { if (o[1] === "mine") J.learn(it.mine, it.model, it.req); else if (o[1] === "model") J.learn(it.model, it.mine, it.req); }
          if (exam.i < items.length - 1) exam.i++; render();
        });
        row.append(b);
      });
      c.append(row);
    }
    var nav = el("div", "actions");
    var prev = el("button", "btn ghost", "← Назад"); prev.type = "button"; prev.disabled = exam.i === 0;
    prev.addEventListener("click", function () { exam.i--; render(); });
    var next = el("button", "btn ghost", "Дальше →"); next.type = "button"; next.disabled = exam.i >= items.length - 1;
    next.addEventListener("click", function () { exam.i++; render(); });
    var fin = el("button", "btn", answered ? "Закончить и посчитать" : "Отменить"); fin.type = "button";
    fin.addEventListener("click", function () { if (answered) finishExam(); else { exam = null; render(); } });
    nav.append(prev, next, fin); c.append(nav);
    return c;
  }
  window.addEventListener("otv-tab", function () { if (document.getElementById("modelBox")) refresh(); });
  document.addEventListener("DOMContentLoaded", render);
})();
