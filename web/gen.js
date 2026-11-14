/* «Ответошная» — варианты ответов и обжалований без интернета и без Claude.
   Источники вариантов: «База ответов» (ваши согласованные и опубликованные ответы — растёт сама)
   и документ «Шаблоны ответов». Правила справочника применяются к каждому варианту.
   Самообучение: какие варианты вы пролистываете («Ещё вариант»), а какие оставляете и публикуете —
   запоминается, и в следующий раз первыми идут те, что вам подходят. */
(function () {
  "use strict";
  var SIGN = "С уважением, администрация 24 Московской больницы";
  var TH = { "ПроДокторов": 4, "Яндекс": 4, "ДокТу": 4 };
  function s(v) { return v == null ? "" : String(v); }
  function norm0(t) { return s(t).toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]+/g, " ").trim(); }
  var nMemo = {}, nN = 0;   // нормализация с запоминанием: тексты базы повторяются из вызова в вызов
  function norm(t) { var k = t == null ? "" : String(t), m = nMemo[k]; if (m !== undefined) return m; if (++nN > 8000) { nMemo = {}; nN = 1; } return (nMemo[k] = norm0(k)); }
  // слова текста (первые 6 букв) — с запоминанием: база ответов большая, одни и те же тексты сравниваются тысячи раз
  var wMemo = {}, wN = 0;
  function words(t) {
    t = s(t); var m = wMemo[t]; if (m) return m;
    if (++wN > 6000) { wMemo = {}; wN = 1; }
    var w = {}; norm(t).split(" ").forEach(function (x) { if (x.length > 3) w[x.slice(0, 6)] = 1; }); return (wMemo[t] = w);
  }
  var STOP = { "здравс": 1, "спасиб": 1, "котор": 1, "очень": 1, "можно": 1, "больни": 1, "пожалу": 1, "через": 1, "когда": 1 };
  function shared(a, b) { var A = words(a), B = words(b); for (var k in A) if (B[k] && !STOP[k]) return true; return false; }
  function sim(a, b) {
    var A = words(a), B = words(b), n = 0, u = 0, k;
    for (k in A) { u++; if (B[k]) n++; }
    for (k in B) if (!A[k]) u++;
    return u ? n / u : 0;
  }

  /* ---------- что за ситуация ---------- */
  var NEG_RE = /хамств|хамил|грубил|груб[оы]\b|ужасн|отвратит|безобраз|(?<![а-яё])не рекоменд|(?<![а-яё])не совету|разочаров|кошмар|равнодуш|(?<![а-яё])не помогл|обманул|грязн|(?<![а-яё])не дозвон|нагруб|бардак|халатн|возмутит|позор|жалоб|плохо/;
  function toneOf(it) {
    if (it.kind === "complaint" || it.kind === "appeal") return "negative";
    var r = Number(it.rating);
    var strong = !!(window.__otvReports && window.__otvReports.strongNeg && window.__otvReports.strongNeg(s(it.review)));
    if (it.rating != null && it.rating !== "" && !isNaN(r)) return r < (TH[s(it.platform)] || 4.5) || strong ? "negative" : "positive";
    if (s(it.tone) === "negative" || s(it.tone) === "mixed") return "negative";
    if (s(it.tone) === "positive") return "positive";
    return NEG_RE.test(norm((window.__otvUnneg || String)(it.review))) ? "negative" : "positive";
  }
  function typeOf(it) {
    if (it.kind === "question") return "question";
    if (s(it.platform) === "Сайт") return "letter";
    return /врача/i.test(s(it.page)) ? "doctor" : "hospital";
  }

  /* ---------- шаблоны по ситуации ---------- */
  var TOPICS = [
    [/питани|еда|кормил|диет|пищ/, ["Питание / диета"]],
    [/емиас|медкарт|электронн\w* карт|диагноз в приложен/, ["Технические ошибки в ЕМИАС"]],
    [/омс|дмс|оплат|платн|деньг|касс/, ["ДМС и ОМС"]],
    [/очеред|ожидан|ждал|ждали|долго/, ["Организация процесса", "Долго не могли попасть", "Если пишут, что долгое ожидание"]],
    [/парков|кпп|шлагбаум|машин/, ["Парковка и КПП", "Нет парковочных мест"]],
    [/грязн|чистот|туалет|уборк|душ|белье|бельё|тарака/, ["Чистота и бытовые условия"]],
    [/ремонт|обшарп|старые|разруха|облуп/, ["нет ремонта"]],
    [/кур[ия]т|курени/, ["Курение"]],
    [/хам|груб|наор|орал|кричал/, ["сотрудники хамы"]],
    [/медсестр|медбрат|санитар|младш\w* персонал/, ["средний медперсонал"]],
    [/(^|\s)(умер|смерт|скончал|убил|чуть не|погиб)/, ["чуть не убили", "Про лечение и самочувствие"]],
    [/самочувств|родственник\w* лежит|состояни/, ["Про лечение и самочувствие", "как себя чувствует родственник"]]
  ];
  var Q_TOPICS = [
    [/госпитализ|лечь|положат|направлени/, ["госпитализацию"]],
    [/платн|стоимост|цена|сколько стоит|за деньги/, ["платные услуги", "платный приём"]],
    [/омс|полис|бесплатн/, ["лечению по ОМС"]],
    [/выписк|справк|документ|эпикриз|копи/, ["отправить документ"]],
    [/дозвон|связаться|не отвечают|телефон/, ["никуда не может дозвониться"]],
    [/самочувств|состояни|как себя чувствует/, ["как себя чувствует родственник"]],
    [/рассеян|склероз|морс/, ["рассеянному склерозу"]],
    [/запис|приём|прием/, ["Единый контактный центр"]]
  ];
  function catsFor(it, tone, type) {
    var r = norm(it.review), out = [];
    if (type === "question") {
      Q_TOPICS.forEach(function (t) { if (t[0].test(r)) out = out.concat(t[1]); });
      return { main: out, fallback: ["Единый контактный центр"], section: "Вопросы" };
    }
    if (tone === "negative") {
      TOPICS.forEach(function (t) { if (t[0].test(r)) out = out.concat(t[1]); });
      if (/спасибо|благодар|отличн|профессионал/.test(r)) out.push("Смешанные отзывы", "про персонал хорошо");
      return { main: out, fallback: ["Общая жалоба", "Заглушка"], section: null };
    }
    if (type === "letter") return { main: ["На письма", "Больнице на письма", "Пресс-служба ГКБ"], fallback: [], section: null };
    if (type === "doctor") return { main: ["Доктору"], fallback: [], section: null };
    var m = ["Больнице в целом"];
    if (/медсестр|медбрат|санитар|персонал/.test(r)) m.push("Медперсоналу");
    return { main: m, fallback: ["Доктору"], section: null };
  }

  /* ---------- имя автора: обращаемся только по настоящему имени ---------- */
  var NAMES = {};
  ("Александра Алёна Алена Алина Алиса Алла Альбина Анастасия Ангелина Анжела Анжелика Анна Антонина Арина Ася Валентина Валерия Варвара Василиса Вера Вероника " +
   "Виктория Виолетта Владислава Галина Дарья Диана Дина Динара Евгения Евдокия Екатерина Елена Елизавета Есения Жанна Зарина Зинаида Злата Зоя Изабелла Инга Инна " +
   "Ирина Камила Карина Кира Клавдия Кристина Ксения Лариса Лейла Лиана Лидия Лилия Любовь Людмила Мадина Майя Маргарита Марина Мария Марьям Милана Мирослава Надежда " +
   "Наталья Наталия Нелли Нина Нонна Оксана Олеся Ольга Полина Раиса Регина Римма Роза Светлана Серафима Снежана София Софья Стефания Таисия Тамара Татьяна Ульяна " +
   "Фатима Эвелина Элина Эльвира Эльмира Юлия Яна Ярослава Аня Катя Лена Оля Ира Маша Даша Настя Юля Таня Наташа Света Галя Люда Надя Вика Ксюша Лиза Соня Женя Саша Валя Тоня Люба " +
   "Александр Алексей Альберт Анатолий Андрей Антон Аркадий Арсений Артём Артем Артур Богдан Борис Вадим Валентин Валерий Василий Вениамин Виктор Виталий Владимир " +
   "Владислав Всеволод Вячеслав Геннадий Георгий Герман Глеб Григорий Давид Дамир Даниил Данил Данила Денис Дмитрий Евгений Егор Елисей Ефим Захар Иван Игорь Ильдар Илья " +
   "Камиль Кирилл Константин Лев Леонид Магомед Максим Марат Марк Матвей Мирон Михаил Мурат Никита Николай Олег Павел Пётр Петр Платон Ринат Роберт Родион Роман Ростислав " +
   "Руслан Рустам Савелий Святослав Семён Семен Сергей Станислав Степан Тимофей Тимур Фёдор Федор Филипп Эдуард Эльдар Эмиль Эрик Юрий Ян Яков Ярослав " +
   "Дима Миша Коля Вова Паша Лёша Леша Ваня Петя Костя Юра Витя Слава Толя Гена Боря Серёжа Сережа").split(" ").forEach(function (n) { NAMES[n.replace(/ё/g, "е")] = 1; });
  var GENERIC = /^(пациент|пациентка|гость|аноним|анонимно|анонимный|анонимная|пользователь|клиент|клиентка|посетитель|посетительница|автор|покупатель|житель|жительница|человек|родственник|родственница|скрыто|неизвестный|неизвестная|имя|user|guest)\b/i;
  function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }
  function isName(w) { return !!NAMES[cap(w).replace(/ё/g, "е")]; }
  var PAT = /^[А-ЯЁа-яё]+(вна|вич|ична|ьич|чна)$/;
  function nameOf(author) {
    var a = s(author).replace(/[^А-Яа-яЁё\s-]/g, " ").trim().replace(/\s+/g, " ");
    if (!a || GENERIC.test(a)) return "";
    var p = a.split(" ");
    if (isName(p[0])) return cap(p[0]) + (p[1] && PAT.test(p[1]) ? " " + cap(p[1]) : "");            // «Анна», «Анна Викторовна», «Анна К.»
    if (p[1] && isName(p[1])) return cap(p[1]) + (p[2] && PAT.test(p[2]) ? " " + cap(p[2]) : "");     // «Петрова Анна Викторовна»
    return "";
  }
  function isGeneric(w) { return GENERIC.test(s(w).trim()); }

  /* ---------- приводим вариант к правилам справочника ---------- */
  var NAMED = /[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+(вне|вичу|ичне|ьичу)\b/;
  function greeting(author, tone) {
    var n = nameOf(author), g = n ? "Здравствуйте, " + n + "!" : "Здравствуйте!";
    return tone === "negative" ? g.replace(/!$/, ".") : g;
  }

  /* ---------- кого благодарят: врач из списка врачей и команда его отделения ---------- */
  var DEPT_GEN = {
    "Хирургия": "хирургического отделения", "Гинекология": "гинекологического отделения", "Урология": "урологического отделения",
    "Неврология": "неврологического отделения", "Кардиология": "кардиологического отделения", "Терапия": "терапевтического отделения",
    "Гнойная хирургия": "отделения гнойной хирургии", "Колопроктология 3": "колопроктологического отделения №3", "Колопроктология 7": "колопроктологического отделения №7",
    "МОРС": "межокружного отделения рассеянного склероза", "КДО": "консультативно-диагностического отделения", "Эндоскопия": "эндоскопического отделения",
    "Аллергология и иммунология": "отделения аллергологии и иммунологии", "Анестезиология": "отделения анестезиологии-реанимации",
    "Гемодиализ": "отделения гемодиализа", "Лучевая диагностика": "отделения лучевой диагностики",
    "Ультразвуковая и функциональная диагностика": "отделения ультразвуковой и функциональной диагностики", "Малоинвазивная хирургия": "отделения малоинвазивной хирургии",
    "Отделение Нефрологии": "отделения нефрологии", "Отделение ранней медицинской реабилитации": "отделения ранней медицинской реабилитации",
    "Отделение реабилитации стомированных больных": "отделения реабилитации стомированных больных", "Отделение реанимации № 1": "отделения реанимации №1",
    "Отделение реанимации № 3": "отделения реанимации №3", "Отделение реанимации №2 для кардиологических больных": "отделения реанимации №2",
    "Приёмное отделение": "приёмного отделения", "СКП": "стационара кратковременного пребывания", "Физиотерапевтическое отделение": "физиотерапевтического отделения"
  };
  function dat(name, pat) {
    var fem = /(вна|чна|шна)$/.test(pat);
    var irr = { "Павел": "Павлу", "Лев": "Льву", "Пётр": "Петру", "Петр": "Петру" };
    var n = irr[name] || (fem ? (/ия$/.test(name) ? name.slice(0, -1) + "и" : /ь$/.test(name) ? name.slice(0, -1) + "и" : /[ая]$/.test(name) ? name.slice(0, -1) + "е" : name)
      : (/[ая]$/.test(name) ? name.slice(0, -1) + "е" : /[йь]$/.test(name) ? name.slice(0, -1) + "ю" : name + "у"));
    var p = fem ? pat.replace(/а$/, "е") : pat + "у";
    return n + " " + p;
  }
  function people(it) {
    var R = window.__otvReports, out = { names: [], dept: "" };
    if (!R || !R.people) return out;
    var found = [];
    try { found = R.people(s(it.review), "") || []; } catch (e) { found = []; }
    var cats = [];
    found.forEach(function (x) {
      var p = x.p; if (!p || !p.name || !p.pat) return;
      if (out.names.length < 6) out.names.push(dat(p.name, p.pat));   // 13.11: «опять не все имена» — благодарят четверых и больше
      var c = R.catOf(p); if (c && c.cat && c.sure && DEPT_GEN[c.cat] && cats.indexOf(c.cat) < 0) cats.push(c.cat);
    });
    var main = cats.filter(function (c) { return !/Анестезиология|реанимации|Приёмное|Лучевая|Ультразвуковая/.test(c); });
    if (main.length) cats = main;
    if (cats.length === 1) out.dept = cats[0];
    else if (!cats.length) {
      var td = (R.textDepts ? R.textDepts(s(it.review)) : []).filter(function (d) { return DEPT_GEN[d]; });
      var tm = td.filter(function (d) { return !/Анестезиология|реанимации|Приёмное|Лучевая|Ультразвуковая|Эндоскопия/.test(d); });
      if (tm.length === 1) out.dept = tm[0]; else if (td.length === 1) out.dept = td[0];
    }
    return out;
  }
  // кого благодарят (врач из списка сотрудников и его отделение) — разными словами, чтобы ответы не были под копирку (06.11);
  // seed — от текста варианта: у разных вариантов разные формулировки; rest — остальные фразы ответа, с ними не повторяемся
  var THX = [
    function (x) { return "Обязательно передадим вашу благодарность " + x + "."; },
    function (x) { return "Передадим ваши слова " + x + "."; },
    function (x) { return x.charAt(0).toUpperCase() + x.slice(1) + " будет приятно прочитать ваш отзыв."; },
    function (x) { return "Обязательно расскажем " + x + " о вашем отзыве."; },
    function (x) { return "Ваши тёплые слова обязательно передадим " + x + "."; },
    function (x) { return "Вашу благодарность обязательно передадим " + x + "."; }
  ];
  var TEAM = ["всей команде ", "коллективу ", "сотрудникам "];
  function thanksLine(it, seed, rest) {
    var pp = people(it), rv0 = s(it.review), names = pp.names.slice();
    // 13.11: имя-отчество из самого отзыва («хирургу Татьяне Ильиничне»), если по «Списку врачей» никого не нашли
    if (!names.length) { var dn0 = dativeName(rv0); if (dn0) names.push(dn0); }
    // медсёстры и весь персонал, которых благодарят в отзыве, — в ту же фразу (раньше отдельной фразой «передадим… медсёстрам» и повтор «передадим»)
    var nurses = /медсестрам|медсёстрам|медсестры|медсёстры|медсестер|медсестёр|медицинским с[её]страм|медицинских с[её]стер|медперсонал|сестрички|сестричкам/i.test(rv0), allStaff = /всему персоналу|всем сотрудникам|всему коллективу|всей команде|всем,? кто/i.test(rv0);
    var extra = (rv0.match(/[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+(?:вне|вичу|ичне|ьичу)\b/g) || []).filter(function (x, i, a) { return a.indexOf(x) === i; }).length > names.length && names.length;   // назвали ещё кого-то не из списка
    var tail = [];
    if (nurses) tail.push("медицинским сёстрам");
    if (extra) tail.push("всем, кого вы назвали в отзыве");
    else if (allStaff && !pp.dept) tail.push("всем сотрудникам");
    var all = names.concat(tail), who = all.length ? all.slice(0, -1).join(", ") + (all.length > 1 ? " и " : "") + all[all.length - 1] : "";
    if (tail.length) pp = { names: names, dept: "" };   // «…и медицинским сёстрам и всей команде отделения» — слишком длинно
    if (!who && !pp.dept) return "";
    var h = 0, k6 = function (t) { var o = {}; (norm(t).match(/[а-яa-z]{5,}/g) || []).forEach(function (w) { o[w.slice(0, 5)] = 1; }); return o; };
    for (var i = 0; i < s(seed).length; i++) h = (h * 31 + s(seed).charCodeAt(i)) | 0;
    h = Math.abs(h);
    var R = k6(rest), R4 = {}, best = "", bestN = 1e9;
    (norm(rest).match(/[а-я]{4,}/g) || []).forEach(function (x) { if (!/^(ваш|наш|всег|кото|чтоб|этог)/.test(x)) R4[x.slice(0, 4)] = 1; });
    for (var j = 0; j < THX.length * TEAM.length; j++) {
      var team = pp.dept ? TEAM[((h >> 3) + Math.floor(j / THX.length)) % TEAM.length] + DEPT_GEN[pp.dept] : "";
      var whoT = who && team ? (all.length > 1 ? all.join(", ") : who) + " и " + team : who || team;   // «Павлу Анатольевичу, Ирине Викторовне и всей команде…», без двух «и» подряд
      var line = THX[(h + j) % THX.length](whoT), L = k6(line), n = 0;
      for (var w in L) if (R[w]) n++;
      // 4 буквы — как проверка повторов в карточке («благодарим» / «благодарность», «сотрудников» / «сотрудникам»)
      (norm(line).match(/[а-я]{4,}/g) || []).forEach(function (x) { if (R4[x.slice(0, 4)]) n += 0.5; });
      if (n < bestN) { best = line; bestN = n; if (!n) break; }
    }
    return best;
  }
  var PH = "\u0001", DOT = "\u0002";
  // имя-отчество в дательном падеже из самого отзыва («Спасибо Анне Викторовне») — им можно заполнить «доктору [...]»
  function dativeName(review) { var m = /([А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+(?:вне|вичу|ичне|ьичу))\b/.exec(s(review)); return m ? m[1] : ""; }
  function shape(text, it, tone, type) {
    var body = s(text).replace(/\r/g, "").split("\n").map(function (l) { return l.trim(); }).filter(function (l) {
      return l && l.replace(/\.$/, "") !== SIGN;
    }).join(" ");
    body = body.replace(/\s*С уважением,?\s*администрация[^.]*\.?\s*$/i, "");               // подпись в той же строке (ставим свою)
    body = body.replace(/([a-z0-9])([А-ЯЁ])/g, "$1. $2");                               // «...mos.ruТакже» в документе
    body = body.replace(/\[\s*(https?:\/\/[^\]\s]+)\s*\]\([^)]*\)/g, " $1").replace(/:\s+/g, ": "); // markdown-ссылки из документа
    body = body.replace(/\[\s*(\.{3}|…)?\s*\]/g, PH).replace(/\.{4}|…\./g, PH + ".").replace(/\.{3}|…/g, PH); // незаполненные места
    body = body.replace(/^[^.!?]{0,40}здравствуйте[^.!?]{0,40}[.!?]+\s*/i, "");        // приветствие (своё ставим сами)
    var dn = dativeName(it.review), kind = /спасибо|благодар|отличн|профессионал|молодц|хорош|вежлив|внимательн/i.test(s(it.review));
    body = body.replace(new RegExp("(доктору|врачу) " + PH, "g"), dn ? "$1 " + dn : "лечащему врачу");
    body = body.replace(new RegExp("(доктор[а-я]*|врач[а-я]*|отделени[а-я]*|пациент[а-я]*|организации) " + PH, "g"), "$1");
    body = body.replace(/(\S)\.(?=[^\s.])/g, "$1" + DOT).replace(/([А-ЯЁ])\. (?=[А-ЯЁ]\.)/g, "$1" + DOT + " ");
    var rv = norm(it.review);
    body = body.replace(/(всей команде|сотрудникам|коллективу) ([а-яё]+)(ого|его) отделения/g, function (all, who, adj, end) {
      return rv.indexOf(adj.slice(0, 5)) >= 0 ? all : who + " отделения";
    });
    if (dn && type !== "doctor") body = body.replace(/благодарность (всей команде|сотрудникам) отделения/, "благодарность " + dn + " и $1 отделения");
    var sents = [], dropped = false;
    (body.match(/[^.!?]+[.!?]*/g) || []).forEach(function (x) {
      x = x.trim();
      if (!keepSent(x)) { dropped = true; return; }
      if (dropped || !sents.length) x = x.replace(/^Также,?\s+/, "");                 // «Также…» после выброшенной фразы
      sents.push(x); dropped = false;
    });
    if (tone === "positive" && (type === "hospital" || type === "letter")) {
      // своя фраза вместо общих «передадим…», «лечащему врачу», «команде отделения», «сотрудникам будет приятно»
      var gen0 = sents.filter(function (x) { return /медс[её]стр/i.test(x) || !/передад|переда[её]м|передали|лечащ\S* врач|команд\S* (\S+ )?отделени|сотрудникам отделения|Сотрудникам будет приятно|расскажем/i.test(x); });   // о медсёстрах — оставляем
      var thx = thanksLine(it, text, gen0.join(" "));
      if (thx) {
        sents = gen0;
        if (/с[её]страм/.test(thx)) sents = sents.filter(function (x) { return !/медс[её]стр/i.test(x); });   // медсёстры уже в фразе «передадим…»
        // ответ начинается с благодарности за отзыв, а не с «Передадим…» (13.11)
        if (!sents.length || !/^(Спасибо|Благодарим|Большое спасибо|Огромное спасибо)/i.test(sents[0])) sents.unshift(/т[её]пл|благодар|спасибо/i.test(s(it.review)) ? "Спасибо за тёплый отзыв." : "Спасибо за отзыв.");
        var at = /спасибо|благодар/i.test(sents[0]) ? 1 : 0;
        sents.splice(at, 0, thx);
        // подробный отзыв — развёрнутый ответ (ваше правило): фразы «передадим…» из шаблона ушли — добавляем фразу из ваших шаблонов
        var rl = s(it.review).length, need = rl > 300 ? 4 : rl > 180 ? 3 : 0;
        var FILL = ["Важно и приятно получать такие отзывы.", "Мы очень рады вашей обратной связи.", "Рады, что работа наших сотрудников оставила у вас положительное впечатление.", "Мы стараемся, чтобы пациентам было у нас комфортно.", "Ценим ваше доверие и всегда готовы помочь."];
        for (var fi = 0; sents.length < need && fi < FILL.length * 2; fi++) {
          var f = FILL[(s(text).length + fi) % FILL.length], low = sents.join(" ").toLowerCase();
          if (low.indexOf(f.toLowerCase().slice(0, 18)) >= 0 || (/^Ценим/.test(f) && /ценим/.test(low)) || (/рады/i.test(f) && /\bрады\b/.test(low) && fi < FILL.length)) continue;
          var end = sents.length && /^Желаем|^Ценим ваше доверие|^Всегда готовы/i.test(sents[sents.length - 1]) ? sents.length - 1 : sents.length;
          sents.splice(end, 0, f);
        }
      }
    }
    function keepSent(x) {
      if (!x || x.length < 3) return false;
      if (x.indexOf(PH) >= 0) return false;                                            // осталось пустое место — фразу не берём
      if (/здравствуйте/i.test(x)) return false;
      if (NAMED.test(x) && !(dn && x.indexOf(dn) >= 0)) return false;                  // чужие имена из прошлых ответов
      if (type !== "letter" && /ПроДокторов|prodoctorov|поделиться этим отзывом/i.test(x)) return false;
      if (type === "doctor" && /передад|больниц|стационар|команд\w* отделени/i.test(x)) return false; // правило 11
      if (/помогают нам становиться лучше|работаем над улучшением|помогает нам становиться лучше/i.test(x)) return false; // правило 25
      if (/врач\S* и (другого |младшего |среднего )?(мед)?персонал/i.test(x)) return false;      // п. 11: «сотрудники», не «врачи и персонал»
      if (/сожале|извин|прости|простите/i.test(x)) return false;                      // п. 3: не извиняемся
      if (/Департамент|ДЗМ\b|dzdmos|@dzm/i.test(x)) return false;                     // п. 3: ДЗМ без необходимости не упоминаем
      if (/стало легче|восстановлен|выздоровлен|операция прошла|лечение помогло/i.test(x)) return false; // п. 8: не лезем в лечение
      if (/особенно ценим|то, что мы ценим|очень рады, что это заметно/i.test(x)) return false;        // п. 9, 13
      if (/в надёжных руках|ради чего мы работаем|лучшая поддержка для команды|радостно читать|понятен каждый шаг|гордимся/i.test(x)) return false;   // 13.11: «смотри какую хрень он пишет» — роботизированные фразы не берём ни из базы, ни из обучения
      if (/столица здоровья/i.test(x) && !/област|регион|подмосков|иногород|из другого город/i.test(s(it.review))) return false; // проект — не для москвичей
      if (type === "doctor" && /нам очень приятно их получать|для нас они очень много значат|наш\S* сотрудник/i.test(x)) return false;
      if (/медицинск\S* центр|клиник/i.test(x)) return false;                         // мы — больница
      if (tone === "negative" && type !== "question" && /^Желаем/i.test(x)) return false; // концовка «Желаем здоровья…» — для благодарностей
      if (tone === "negative" && !kind && /добрые слова|тёплые слова|т[её]плый отзыв|положительное впечатление|высокую оценку|рады, что|приятно/i.test(x)) return false; // хвалить не за что
      return true;
    }
    sents = sents.map(function (x) {
      x = x.split(DOT).join(".").replace(/!+/g, ".").replace(/осуществляется/g, "проводится").replace(/осуществляются/g, "проводятся")
        .replace(/([^,\s—–:(-]) пожалуйста,? (?=[а-яё])/g, "$1, пожалуйста, ").replace(/^Пожалуйста (?=[а-яё])/, "Пожалуйста, ").replace(/(\S\s+)В(ам|ас|ы|аш\S*)(?=[\s.,:;])/g, "$1в$2").replace(/\s+([.,:;])/g, "$1").replace(/\s{2,}/g, " ").trim();
      if (!/[.?]$/.test(x)) x += ".";
      return x.charAt(0).toUpperCase() + x.slice(1);
    });
    if (!sents.length) return "";
    // 13.11: «здесь отделение, а в ответе ничего» — на странице врача благодарят и персонал отделения: отвечаем и на это.
    // Врачу со страницы ничего не «передаём» (его страница), а слова сотрудникам отделения — передаём
    if (tone === "positive" && type === "doctor" && /(персонал|медсестр|медсёстр|сотрудник|коллектив|команд)\S*/i.test(s(it.review)) && /отделени|персонал|медсестр|медсёстр/i.test(s(it.review)) && !/отделени|сотрудник/i.test(sents.join(" "))) {
      var Rr = window.__otvReports, dts = (Rr && Rr.textDepts ? Rr.textDepts(s(it.review)) : []).filter(function (d) { return DEPT_GEN[d]; });
      var who2 = dts.length === 1 ? "сотрудникам " + DEPT_GEN[dts[0]] : /медсестр|медсёстр/i.test(s(it.review)) ? "медицинским сёстрам и всем сотрудникам отделения" : "сотрудникам отделения";
      var line2 = "Ваши добрые слова обязательно передадим " + who2 + ".";
      var endI = sents.length; while (endI > 1 && /^(Желаем|Ценим ваше доверие|Всегда готовы|Будем рады|Берегите)/.test(sents[endI - 1])) endI--;   // 14.11: завершающие фразы остаются в конце
      sents.splice(endI, 0, line2);
    }
    if (sents.join(" ").length < 45) return "";
    if (tone === "negative" && type !== "question" && !/gkb24@|свяж|разбер/i.test(sents.join(" "))) {
      sents.push("Если хотите, чтобы мы разобрались подробнее, напишите нам на gkb24@zdrav.mos.ru с указанием даты и отделения.");
    }
    var fam = /мам[аеуы]|пап[аеуы]|муж[аеу]?\b|жен[аеуы]\b|сын|доч|бабушк|дедушк|родствен|близк|семь/i.test(s(it.review));
    var bodyTxt = sents.join(" ").replace(/,? и желаем (вам )?(крепкого )?здоровья[^.]*\./g, ". Желаем здоровья.").replace(/Желаем (вам )?(крепкого )?здоровья( вам)?( и [^.]*)?\./g, fam ? "Желаем здоровья вам и вашим близким." : "Желаем здоровья и всего самого доброго.");
    return greeting(it.author, tone) + "\n" + bodyTxt + "\n" + SIGN;
  }

  /* ---------- память: что подходит, что пролистали ---------- */
  var db = null, stats = {}, statsLoaded = false;
  function loadStats() {
    if (statsLoaded || !window.claude || !window.claude.use) return;
    statsLoaded = true;
    window.claude.use("db").then(function (d) {
      db = d;
      return db.collection("gen_stats").doc("stats").get();
    }).then(function (snap) { if (snap && snap.exists) stats = (snap.data() || {}).keys || {}; }).catch(function () {});
  }
  var saveT = null;
  function saveStats() {
    clearTimeout(saveT);
    saveT = setTimeout(function () { if (db) db.collection("gen_stats").doc("stats").set({ keys: stats, updatedAt: new Date().toISOString() }).catch(function () {}); }, 800);
  }
  function learned1(key) { var v = stats[key]; return v ? (v.p || 0) * 0.6 - (v.s || 0) * 0.25 : 0; }
  // собранный ответ учится по каждой фразе: «cmp:тон:po2.pm5.cl1» → фразы po2, pm5, cl1
  function partsOf(key) { var m = /^cmp:[^:]+:(.+)$/.exec(s(key)); return m ? m[1].split(".") : []; }
  function learned(key) {
    var ps = partsOf(key); if (!ps.length) return learned1(key);
    return learned1(key) + ps.reduce(function (a, p) { return a + learned1("cs:" + p); }, 0) / ps.length;
  }
  function bump(key, f) { var v = stats[key] || (stats[key] = { p: 0, s: 0 }); v[f]++; }
  function noteSkip(key) { if (!key) return; bump(key, "s"); partsOf(key).forEach(function (p) { bump("cs:" + p, "s"); }); saveStats(); }
  function notePick(key) { if (!key) return; bump(key, "p"); partsOf(key).forEach(function (p) { bump("cs:" + p, "p"); }); saveStats(); }

  /* ---------- варианты ответа ---------- */
  var NEG_ANS = /разобрат|разбер|gkb24@|напишите|свяж|дату (обращения|госпитализации)|сожале|учт[её]м|замечани|извин|неудобств|проверим|недопустим|обеспокои/i;
  var POS_ANS = /рады, что|понравил|было комфортно|благодарност|тёпл|тепл\w* слов|добрые слова|высокую оценку/i;
  function tplTone(t) {
    var sec = s(t.section);
    if (/Позитивные/.test(sec)) return "positive";
    if (/Негативные|Ремонт/.test(sec)) return "negative";
    if (/Смешанные|Общая жалоба/.test(s(t.category))) return "negative";
    return NEG_ANS.test(t.text) ? "negative" : POS_ANS.test(t.text) ? "positive" : "any";
  }
  // фразы недавно опубликованных ответов (все площадки): одна и та же фраза подряд — минус к варианту
  var COMMONS = /^(желаем здоровья|пожалуйста, напишите|напишите, пожалуйста|чтобы мы могли разобраться|с уважением)/;
  // фразы недавно опубликованных ответов и черновиков в очереди (все площадки): одна и та же фраза подряд — минус к варианту.
  // Черновики очереди учитываются, чтобы пачка новых отзывов за один сбор не получила одинаковые ответы
  var QUEUE = /^(pending|approved|fix)$/, rsCache = { v: null, own: null, out: null };
  function recentSents(own) {
    var v = window.__otvVer ? window.__otvVer("answers") : null, ok = norm(own).slice(0, 80);
    if (v && rsCache.v === v && rsCache.own === ok) return rsCache.out;
    var all = ((window.__otvAllRO || window.__otvAll) && (window.__otvAllRO || window.__otvAll)("answers")) || {}, pub = [], out = {};
    Object.keys(all).forEach(function (id) {
      var a = all[id]; if (!a || !s(a.answer)) return;
      if (a.status === "published") pub.push(a);
      else if (QUEUE.test(s(a.status)) && norm(a.review).slice(0, 80) !== ok) sentsOf(a.answer).forEach(function (x) { out[x] = (out[x] || 0) + 1; });
    });
    pub.sort(function (a, b) { return s(b.publishedAt || b.date).localeCompare(s(a.publishedAt || a.date)); });
    pub.slice(0, 40).forEach(function (a) { sentsOf(a.answer).forEach(function (x) { out[x] = (out[x] || 0) + 1; }); });
    rsCache = { v: v, own: ok, out: out };
    return out;
  }
  function sentsOf(t) { return (s(t).replace(/^Здравствуйте[^\n]*\n/, "").replace(SIGN, "").match(/[^.!?]+[.!?]*/g) || []).map(norm).filter(function (x) { return x.length > 12 && !COMMONS.test(x); }); }
  // 13.11: «на странице больницы (ПроДокторов и других площадках) ответ не должен повторять предыдущие 3 ответа»:
  // фразы трёх последних ответов на той же странице (кроме приветствия, подписи и пожелания) в новом ответе не повторяются
  function prev3(it) {
    var all = ((window.__otvAllRO || window.__otvAll) && (window.__otvAllRO || window.__otvAll)("answers")) || {}, ok = norm(it.review).slice(0, 80);
    var docPage = /врача/i.test(s(it.page)), list = [];
    Object.keys(all).forEach(function (id) {
      var a = all[id]; if (!a || !s(a.answer).trim() || s(a.platform) !== s(it.platform) || a.kind === "appeal") return;
      if (norm(a.review).slice(0, 80) === ok) return;
      if (docPage ? s(a.page) !== s(it.page) : /врача/i.test(s(a.page))) return;   // страница больницы — все ответы больнице; страница врача — ответы на ней
      if (!(a.status === "published" || QUEUE.test(s(a.status)))) return;
      list.push(a);
    });
    list.sort(function (x, y) { return s(y.publishedAt || y.decidedAt || y.date).localeCompare(s(x.publishedAt || x.decidedAt || x.date)); });
    var out = {}; list.slice(0, 3).forEach(function (a) { sentsOf(a.answer).forEach(function (x) { if (!/^желаем/.test(x)) out[x] = 1; }); });
    return out;
  }
  function recentTexts(platform, own) {
    var all = ((window.__otvAllRO || window.__otvAll) && (window.__otvAllRO || window.__otvAll)("answers")) || {}, out = {}, ok = norm(own).slice(0, 80);
    Object.keys(all).forEach(function (id) {
      var a = all[id]; if (!a || s(a.platform) !== s(platform)) return;
      if (!(a.status === "published" || (QUEUE.test(s(a.status)) && norm(a.review).slice(0, 80) !== ok))) return;
      out[norm(s(a.answer).replace(/^Здравствуйте[^\n]*\n/, ""))] = 1;
    });
    return out;
  }
  var APPROVED = null;
  function approved() {
    if (APPROVED) return APPROVED;
    var out = [];
    function read(id, type0) {
      var n = document.getElementById(id); if (!n) return;
      var txt = n.textContent.split(/ОТКЛОНЁННЫЕ|ШАБЛОНЫ: ВОПРОСЫ/)[0];
      var re = /\[([^\]\n]{3,160})\]\n([\s\S]*?)(?=\n\[|$)/g, m;
      while ((m = re.exec(txt))) {
        var ctx = m[1], body = m[2].trim(); if (!body) continue;
        var type = type0 || (/врача/i.test(ctx) ? "doctor" : "hospital");
        out.push({ id: id + ":" + out.length, context: ctx, text: body, type: type, tone: type0 === "question" ? "any" : "positive" });
      }
    }
    try { read("ref-thanks-examples", ""); read("ref-questions", "question"); } catch (e) {}
    APPROVED = out;
    return out;
  }
  function pool(it) {
    loadStats();
    var tone = toneOf(it), type = typeOf(it), cats = catsFor(it, tone, type), list = [];
    var kb = ((window.__otvAllRO || window.__otvAll) && (window.__otvAllRO || window.__otvAll)("kb")) || {};
    Object.keys(kb).forEach(function (k) {
      var e = kb[k]; if (!e || !s(e.answer).trim()) return;
      var ek = s(e.kind);
      if (type === "question" ? !(ek === "question" || (ek === "mail" && /\?/.test(s(e.situation)))) : !(ek === "review" || ek === "mail" || ek === "thanks")) return;
      if (type !== "question" && (NEG_ANS.test(e.answer) ? "negative" : "positive") !== tone) return;
      if (type === "doctor" && !/врача/i.test(s(e.page))) return;
      if (type === "hospital" && /врача/i.test(s(e.page))) return;
      if (type === "letter" && s(e.platform) !== "Сайт") return;
      if (type === "question" && !shared(it.review, e.situation)) return;              // ответ на вопрос — только про то же
      if (it.kbId && (k === it.kbId || norm(e.situation) === norm(it.review))) return;     // на экзамене — без подсказки своим же ответом
      var SPq = window.__otvSpeech, q = SPq ? (SPq.audit(e.answer).score - 7) * 0.08 : 0;   // хорошо написанные образцы — выше
      list.push({ key: "kb:" + k, raw: e.answer, sit: s(e.situation), edited: !!e.edited, score: 1 + sim(it.review, e.situation) * 2 + (s(e.platform) === s(it.platform) ? 0.3 : 0) + q - (e.source === "площадка" ? 0.2 : 0) + (e.source === "загружено" ? 0.2 : 0) });
    });
    approved().forEach(function (a, i) {
      if (type === "question" ? a.type !== "question" : (a.type === "question" || a.tone !== tone)) return;
      if (type === "doctor" ? a.type !== "doctor" : a.type === "doctor") return;
      if (type === "question" && !shared(it.review, a.context)) return;          // образец на вопрос — только про то же
      list.push({ key: "ok:" + a.id, raw: a.text, score: 1.1 + sim(it.review, a.context) });
    });
    var T = window.__otvTemplates || [];
    T.forEach(function (t, i) {
      var c = s(t.category), sec = s(t.section);
      if (cats.section && sec !== cats.section && sec !== "Новое") return;
      if (!cats.section && sec === "Вопросы") return;
      if (type !== "question") { var tt = tplTone(t); if (tt !== "any" && tt !== tone) return; }
      var main = cats.main.some(function (m) { return c.indexOf(m) >= 0; });
      var fb = cats.fallback.some(function (m) { return c.indexOf(m) >= 0; });
      if (!main && !fb) return;
      list.push({ key: "tpl:" + i, raw: t.text, score: (main ? 0.9 : 0.4) });
    });
    // 13.11: библиотека целых ответов по ситуациям (короткий/подробный, операция и страх, скорая, близкие, рекомендует…) — выше сборщика
    if (window.__otvLibrary && tone === "positive" && type !== "question" && type !== "letter" && !it.kbId) window.__otvLibrary.pick(it, type).forEach(function (c) { list.push({ key: c.key, raw: c.raw, score: c.score + learned(c.key) * 0.5 }); });
    // сборщик: ответ из частей по разбору отзыва (сотни сочетаний, без повторов)
    if (window.__otvCompose && !it.kbId) window.__otvCompose.variants(it, { tone: tone, type: type }, 10).forEach(function (v) {
      var hasFact = type === "question" && /\.f[0-9a-z]+(\.|$)/.test(v.key.replace(/^cmp:[^:]+:/, "."));
      var pers = /[.:]p[pn]_/.test(v.key) ? 0.45 : 0;   // подобран под повод из отзыва — выше общих
      list.push({ key: v.key, raw: v.text, score: (type === "question" ? (hasFact ? 1.3 : 0.7) : 1.15) + pers + learned(v.key) * 0.5 });
    });
    var uniq = {};
    list = list.filter(function (c) { var k = norm(c.raw).replace(/^здравствуйте\S*( \S+)? /, "").slice(0, 200); if (uniq[k]) return false; uniq[k] = 1; return true; });
    return { list: list, tone: tone, type: type };
  }
  /* проверка ответа перед показом: ответ не должен называть людей, которых нет в отзыве,
     и его тон должен совпадать с отзывом (на жалобу не благодарим за «тёплые слова», на благодарность не «разбираемся в ситуации») */
  var THANKS_ONLY = /т[её]пл\S* слов|высок\S* оценк|спасибо за (добрые|т[её]плые|высокую)|благодарим за т[её]пл|передадим (ваши )?(слова )?благодарност/i;
  var COMPLAINT_ONLY = /разобраться в ситуации|разберёмся|сожалеем|прин(осим|ести) извинени|приносим извинения|ответственными подразделениями/i;
  // основа слова без падежного окончания: «Нине» / «Нины» → «нин» (короткие имена раньше не совпадали — 13.11 ответ на отзыв о Ярцевой Нине Дмитриевне не собирался вовсе)
  function stem(w, n) { var x = norm(w); return x.slice(0, Math.min(n, Math.max(3, x.length - 1))); }
  // «Антонова» в отзыве = «Владислава Игоревна» в ответе: по «Списку врачей» (фамилия в любом падеже)
  function staffNamed(raw, first, pat) {
    var R = window.__otvReports; if (!R || !R.person) return false;
    var words = s(raw).match(/[А-ЯЁ][а-яё-]{2,}/g) || [];
    return words.some(function (w) {
      return [w, w.replace(/(ой|ую|е|у)$/, "а"), w.replace(/(ым|ом|у|е|а)$/, "")].some(function (v) {
        var p = R.person(v); return p && !p.ambiguous && stem(p.name, 4) === stem(first, 4) && stem(p.pat, 5) === stem(pat, 5);
      });
    });
  }
  function check(text, it, tone) {
    var t = s(text), review = norm(s(it && it.review)), why = [];
    var body = t.replace(/^\s*(Здравствуйте|Добрый день)[^\n.!]*[.!]?/i, "");   // приветствие с именем автора не проверяем
    var re = /([А-ЯЁ][а-яё]{2,})\s+([А-ЯЁ][а-яё]*(?:вн|вич|ичн)[а-яё]{0,3})(?![а-яё])/g, m;
    while ((m = re.exec(body))) {
      // «Анна Сергеевна» в ответе = «Иванчина А.С.» в отзыве (те же инициалы)
      var ini = new RegExp("[а-яё]{3,}\\s+" + m[1].charAt(0).toLowerCase() + "\\.\\s?" + m[2].charAt(0).toLowerCase() + "\\.").test(s(it && it.review).toLowerCase().replace(/ё/g, "е"));
      if (!ini && (review.indexOf(stem(m[1], 4)) < 0 || review.indexOf(stem(m[2], 5)) < 0) && !staffNamed(it && it.review, m[1], m[2])) why.push("в отзыве нет «" + m[1] + " " + m[2] + "»");
    }
    var re2 = /([А-ЯЁ][а-яё]{3,})\s+[А-ЯЁ]\.\s?[А-ЯЁ]\./g;
    while ((m = re2.exec(body))) { if (review.indexOf(stem(m[1], 5)) < 0) why.push("в отзыве нет «" + m[1] + "»"); }
    if (tone === "negative" && THANKS_ONLY.test(body) && !/спасибо за (обратную связь|добрые слова о)/i.test(body)) why.push("на жалобу ответ как на благодарность");
    if (tone === "negative" && /желаем (вам )?здоровья|рады, что вам|рады, что ваш/i.test(body)) why.push("на жалобу ответ с позитивом («рады», «желаем здоровья»)");
    if (tone === "positive" && COMPLAINT_ONLY.test(body)) why.push("на благодарность ответ как на жалобу");
    // 07.11: на 2 звезды с «Спасибо 24-й, что не сдох» (сарказм) ответ начинался «Спасибо за добрые слова о работе команды»
    var rt = +(it && it.rating) || 0;
    if (rt && rt <= 2 && /добрые слова|тёплые слова|теплые слова|высокую оценку|приятно читать|приятно получать/i.test(body)) why.push("оценка " + rt + " из 5 — без «добрых слов» и «высокой оценки»");
    return { ok: !why.length, why: why };
  }
  var given = {};   // какие тексты уже показаны для отзыва (в этом сеансе)
  // 06.11: два разных отзыва получили один и тот же ответ — черновики пачки ещё не были в базе.
  // Тексты, выданные за последние 30 минут любому отзыву, второй раз не выдаём
  var issued = [];
  function issuedRecently(b) { var t = Date.now() - 30 * 60000; issued = issued.filter(function (x) { return x.at > t; }); return issued.some(function (x) { return x.b === b; }); }
  var BANW = /в надёжных руках|ради чего мы работаем|лучшая поддержка для команды|радостно читать|понятен каждый шаг|гордимся|становиться лучше|особенно ценим/i;
  function scrub(tx) {
    var lines = s(tx).split("\n");
    return lines.map(function (l, i) {
      if (i === 0 && /^Здравствуйте/.test(l)) return l;
      if (/^С уважением/.test(l)) return l;
      var ss = l.match(/[^.!?]+[.!?]*/g) || [l]; var keep = ss.filter(function (x) { return !BANW.test(x.trim()); });
      return keep.length ? keep.join("").replace(/^\s+/, "") : "";
    }).filter(function (l, i) { return l !== "" || i === 0; }).join("\n");
  }
  // концовка благодарности (ваши правила): подробный отзыв — «Желаем здоровья и всего самого доброго.»; в отзыве семья — «…вам и вашим близким.»
  var FAMR = /(^|[^а-яё])(мам[аеуы]|пап[аеуы]|муж[аеу]?|жен[аеуы]|сын[аеу]?|доч[ьи]|отц[аеу]|отец)([^а-яё]|$)|бабушк|дедушк|родствен|внучк|внук[аеу]?([^а-яё]|$)/i;
  function closeFix(tx, it) {
    var rv = s(it.review), fam = FAMR.test(rv), lines = s(tx).split("\n"), bi = -1;
    for (var i = 0; i < lines.length; i++) if (i > 0 && !/^С уважением/.test(lines[i]) && lines[i].trim()) bi = i;
    if (bi < 0) return tx;
    var ss = lines[bi].match(/[^.!?]+[.!?]*/g) || [], li = ss.length - 1, last = (ss[li] || "").trim();
    var W = fam ? "Желаем здоровья вам и вашим близким." : "Желаем здоровья и всего самого доброго.";
    if (fam && /близким/.test(lines[bi])) return tx;
    if (/^Желаем/.test(last)) { if (!fam) return tx; ss[li] = " " + W; }
    else if (fam || rv.length > 250) { if (/^(Ценим ваше доверие|Всегда готовы|Будем рады помочь)/.test(last) && ss.length > 3) ss[li] = " " + W; else ss.push(" " + W); }
    else return tx;
    lines[bi] = ss.join("").trim(); return lines.join("\n");
  }
  function answer(it, opts) {
    opts = opts || {};
    var p = pool(it), ex = {}, cur = norm(s(opts.current).replace(/^Здравствуйте[^\n]*\n/, "")), recent = recentTexts(it.platform, it.review), rs = recentSents(it.review);
    var p3 = prev3(it);
    (opts.exclude || []).forEach(function (k) { ex[k] = 1; });
    // дорогая обработка (оформление, проверки, судья) — только для 80 лучших по предварительной оценке:
    // база ответов растёт, а остальные варианты всё равно не выигрывают
    var pre = p.list.filter(function (c) { return !ex[c.key]; }).sort(function (a, b) { return (b.score + learned(b.key)) - (a.score + learned(a.key)); });
    if (pre.length > 80) {
      var keep = pre.slice(0, 80), cmpN = keep.filter(function (c) { return /^cmp:/.test(c.key); }).length;
      if (cmpN < 10) keep = keep.concat(pre.slice(80).filter(function (c) { return /^cmp:/.test(c.key); }).slice(0, 10 - cmpN));   // сборщик всегда в игре
      pre = keep;
    }
    var cands = pre.map(function (c) {
      var tx = shape(c.raw, it, p.tone, p.type), L = window.__otvLearn, lc = { tone: p.tone, platform: it.platform };
      // обучение на правках: ваши замены слов — сразу в тексте; фразы, которые вы убираете, — вниз; ваши частые фразы — вверх
      if (tx && L && L.rewrite) tx = L.rewrite(tx, lc);
      var SP = window.__otvSpeech;
      if (tx && SP) tx = SP.tidy(tx, L && L.favorites ? L.favorites(lc).map(function (r) { return r.phrase; }) : []);
      if (tx) tx = scrub(tx);   // 13.11: обучение на правках не должно возвращать роботизированные фразы
      if (tx && p.tone === "positive" && p.type !== "question") tx = closeFix(tx, it);
      // речь по Ильяхову и «ответ закрывает части отзыва» влияют на выбор варианта
      var sp = tx && SP ? SP.penalty(tx) + 0.8 * SP.covers(tx, it.review).length : 0;
      var stale = tx ? sentsOf(tx).reduce(function (a, x) { return a + Math.min(2, rs[x] || 0) * 0.25; }, 0) : 0;   // свежесть формулировок
      var LN = window.__otvLint, lintBad = 0; if (tx && LN) { try { lintBad = LN({ page: it.page, kind: it.kind === "question" ? "question" : "", review: it.review }, tx).length; stale += 10 * lintBad; } catch (e) {} }
      if (tx && issuedRecently(norm(tx.replace(/^Здравствуйте[^\n]*\n/, "")))) stale += 4;   // этот текст только что получил другой отзыв
      var CP = window.__otvCompose; if (tx && CP && CP.repeats && CP.repeats(tx.replace(/^Здравствуйте[^\n]*\n/, "").replace(SIGN, ""))) stale += 1.5;   // одно слово в двух фразах
      var rep3 = tx ? sentsOf(tx).filter(function (x) { return p3[x]; }).length : 0;
      var nS = tx ? (tx.replace(/^Здравствуйте[^\n]*\n/, "").replace(SIGN, "").match(/[^.!?]+[.!?]+/g) || []).length : 0;
      if (tx && p.tone === "positive" && s(it.review).trim().length < 40 && nS > 3) stale += 2.5;   // 14.11: на отзыв в два слова — короткий ответ
      if (tx && p.tone === "positive" && /лечащему врачу/.test(tx) && !/врач(?![аеи]м|и\b|ей)|доктор(?!а\b|ам|ов)/i.test(s(it.review).replace(/врачи|врачам|врачей|доктора\b|докторам|докторов/gi, ""))) stale += 3;   // «Лучшие врачи!» — «лечащего врача» в отзыве нет
      if (tx && p.tone === "positive" && s(it.review).length > 300 && nS < 4) stale += 2.5;   // 13.11: на подробный отзыв — не куцый ответ (ваше правило)
      return { rep3: rep3, lint: lintBad, key: c.key, text: tx, score: c.score + learned(c.key) + Math.random() * 0.35 - (tx && L ? L.penalty(tx, lc) : 0) - sp - stale };
    }).filter(function (c) {
      if (!c.text) return false;
      var body = norm(c.text.replace(/^Здравствуйте[^\n]*\n/, ""));
      if (!check(c.text, it, p.tone).ok) return false;   // чужие имена и не тот тон не показываем
      return body && body !== cur && !(cur && sim(body, cur) > 0.8) && !recent[body]; // правило 15: подряд одинаковых не публикуем
    }).sort(function (a, b) { return b.score - a.score; });
    // варианты, на которые ругается проверка текста, не предлагаем, пока есть чистые
    var fresh3 = cands.filter(function (c) { return !c.rep3; }); if (fresh3.length) cands = fresh3;   // повтор фраз трёх предыдущих ответов на странице — только если иначе нечего предложить
    var cleanC = cands.filter(function (c) { return !c.lint; });
    if (cleanC.length || (opts.exclude && opts.exclude.length)) cands = cleanC;   // «ещё вариант» — только чистые; первый черновик — лучший из того, что есть
    // судья (учится на ваших выборах) переставляет первые 10 вариантов
    var J = window.__otvJudge;
    if (J && cands.length > 1) {
      var head = cands.slice(0, 10).map(function (c) { return { c: c, s: c.score + 0.8 * J.score(c.text, it) }; }).sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.c; });
      cands = head.concat(cands.slice(10));
    }
    // тот же текст уже показывали для этого отзыва (другое сочетание дало тот же ответ) — берём следующий
    var gk = norm(it.review).slice(0, 80), was = given[gk] || {};
    var seen = {}, best = null;
    for (var i = 0; i < cands.length; i++) { var b = norm(cands[i].text); if (seen[b] || was[b]) continue; seen[b] = 1; best = cands[i]; break; }
    if (!best && cands.length && !opts.current) best = cands[0];
    if (best) { if (Object.keys(given).length > 300) given = {}; (given[gk] = given[gk] || {})[norm(best.text)] = 1; issued.push({ b: norm(best.text.replace(/^Здравствуйте[^\n]*\n/, "")), at: Date.now() }); if (issued.length > 400) issued.shift(); }
    if (!best && opts.current && p.list.length) return null;
    return best ? { text: best.text, key: best.key, tone: p.tone } : null;
  }

  /* ---------- обжалование (правило 32): цитаты из отзыва дословно ---------- */
  var BAD = /хам|груб|ужас|кошмар|безобраз|отвратит|орал|кричал|издевал|убил|убива|калек|мясник|коновал|халтур|наплевал|плевать|равнодуш|(?<![а-яё])не лечат|(?<![а-яё])не помогл|бездар|некомпетент|позор|бардак|треш|(?<![а-яё])не рекоменд|обходите|деньги|вымогал|грязн|(?<![а-яё])не дай бог|чуть не|угроби|неадекват|свинск|тупо|бездейств/i;
  function quotes(review) {
    var t = s(review).replace(/\s+/g, " ").trim();
    var parts = (t.match(/[^.!?…;]+[.!?…]*/g) || []).map(function (x) { return x.trim().replace(/^[«"“]+|[»"”]+$/g, ""); }).filter(function (x) { return x.length >= 8; });
    var scored = parts.map(function (x, i) {
      var sc = (BAD.test(x) ? 2 : 0) + (/!/.test(x) ? 0.5 : 0) - (x.length > 110 ? 1 : 0) - (/спасибо|благодар/i.test(x) ? 2 : 0);
      return { q: x.length > 110 ? x.slice(0, x.lastIndexOf(" ", 105)).replace(/[,;:\s]+$/, "") : x, sc: sc, i: i };
    }).filter(function (x) { return x.sc > 0 && x.q.length >= 8; });
    scored.sort(function (a, b) { return b.sc - a.sc || a.i - b.i; });
    return scored.map(function (x) { return x.q.replace(/[.!…]+$/, ""); });
  }
  function genitive(sur) {
    if (/(ов|ев|ёв|ин|ын)$/.test(sur)) return sur + "а";
    if (/(ова|ева|ёва|ина|ына)$/.test(sur)) return sur.slice(0, -1) + "ой";
    if (/ский$/.test(sur)) return sur.slice(0, -2) + "ого";
    if (/ская$/.test(sur)) return sur.slice(0, -2) + "ой";
    return sur;
  }
  function doctorOf(page) {
    var m = /врача:\s*([А-ЯЁ][а-яё-]+)(\s+[А-ЯЁ]\.\s?[А-ЯЁ]\.)?/.exec(s(page));
    return m ? genitive(m[1]) + (m[2] || "") : "";
  }
  var P1 = [
    "Просим снять отзыв с публикации. Отзыв порочит репутацию больницы{D}. Текст эмоционален и субъективен.{Q} Это не факты, а оскорбительные оценки и интерпретации в адрес врача и больницы.",
    "Просим снять отзыв с публикации. Текст эмоционален и субъективен и порочит репутацию больницы{D}.{Q} Это не факты, а оскорбительные оценки и интерпретации в адрес врача и больницы.",
    "Просим снять отзыв с публикации. Отзыв порочит репутацию больницы{D}: текст эмоционален и субъективен.{Q} Это не факты, а оскорбительные оценки и интерпретации в адрес врача и больницы."
  ];
  var P2 = [
    "Утверждения автора ничем не подтверждены{Q}. Автор делает медицинские выводы, не имея медицинского образования. Лечение проводится по клиническим рекомендациям, а его правильность может оценить только врачебная комиссия. Это публичное обвинение без проверки, которое нарушает деловую репутацию врача.",
    "Слова{QL} не подкреплены фактами. Оценивать правильность лечения может врачебная комиссия, а не пациент без медицинского образования: назначения делаются по клиническим рекомендациям. Это публичное обвинение без проверки, которое нарушает деловую репутацию врача.",
    "Автор не приводит фактов, которые подтверждали бы его слова{Q}. Медицинские выводы без медицинского образования не могут быть основанием для обвинений: назначения проводятся по клиническим рекомендациям, их правильность оценивает врачебная комиссия. Это публичное обвинение без проверки, которое нарушает деловую репутацию врача."
  ];
  function appeal(it, opts) {
    opts = opts || {};
    loadStats();
    var ex = {}; (opts.exclude || []).forEach(function (k) { ex[k] = 1; });
    var q = quotes(it.review), doc = doctorOf(it.page);
    var combos = [];
    for (var a = 0; a < P1.length; a++) for (var b = 0; b < P2.length; b++) for (var sh = 0; sh < Math.max(1, Math.min(3, q.length - 1)); sh++) combos.push([a, b, sh]);
    combos = combos.filter(function (c) { return !ex["ap:" + c.join("-")]; });
    if (!combos.length) return null;
    combos.sort(function (x, y) { return (learned("ap:" + y.join("-")) - learned("ap:" + x.join("-"))) || (Math.random() - 0.5); });
    var c = combos[0];
    var first = q.slice(c[2], c[2] + 3), second = q.filter(function (x) { return first.indexOf(x) < 0; }).slice(0, 2);
    var fmt = function (arr) { return arr.map(function (x) { return "«" + x + "»"; }).join(", "); };
    var p1 = P1[c[0]].replace("{D}", doc ? " и врача " + doc : "").replace("{Q}", first.length ? " Недопустимы фразы: " + fmt(first) + "." : "");
    var p2 = P2[c[1]].replace("{Q}", second.length ? ": " + fmt(second) : "").replace("{QL}", second.length ? " " + fmt(second) : " автора");
    var text = (p1 + "\n\n" + p2).replace(/\.\./g, ".");
    if (!doc && !/врача/i.test(s(it.page))) text = text.replace(/в адрес врача и больницы/g, "в адрес больницы").replace(/деловую репутацию врача/g, "деловую репутацию больницы");
    return { text: text, key: "ap:" + c.join("-") };
  }

  /* образцы для встроенной модели: лучшие варианты из базы, согласованных образцов и шаблонов */
  function examples(it, n) {
    var p = pool(it), out = [], seen = {};
    var list = p.list.slice().sort(function (a, b) { return (b.score + learned(b.key) + (b.edited ? 0.4 : 0)) - (a.score + learned(a.key) + (a.edited ? 0.4 : 0)); });
    for (var i = 0; i < list.length && out.length < n; i++) {
      var t = shape(list[i].raw, it, p.tone, p.type); if (!t) continue;
      var body = t.split("\n").slice(1, -1).join(" ").trim(), k = norm(body).slice(0, 120);
      if (!body || seen[k]) continue; seen[k] = 1;
      out.push({ key: list[i].key, body: body, situation: list[i].sit || "" });
    }
    return { tone: p.tone, type: p.type, list: out };
  }
  function polish(text, it) { return shape(text, it, toneOf(it), typeOf(it)); }
  window.__otvGen = { learnedOf: function (k) { loadStats(); return learned1(k); }, check: check, answer: answer, appeal: appeal, noteSkip: noteSkip, notePick: notePick, toneOf: toneOf, typeOf: typeOf,
    examples: examples, polish: polish, NEG_ANS: NEG_ANS, nameOf: nameOf, isGeneric: isGeneric, thanksLine: thanksLine };

  /* ---------- связь с карточками: «↻ Ещё вариант» вызывает __otvVariant(req) ---------- */
  var shownFor = {};   // отзыв → какие варианты уже показали
  var keyOfText = {};  // текст варианта → его ключ (чтобы узнать, какой вариант вы оставили)
  function bodyKey(text) { return norm(s(text).replace(/^Здравствуйте[^\n]*\n/, "").replace(SIGN, "")).slice(0, 160); }
  function itemOf(req) {
    return { platform: req.platform, page: req.page, author: req.author, review: req.review, rating: req.rating,
      tone: req.tone, kind: req.kind === "question" ? "question" : req.kind === "appeal" ? "appeal" : "" };
  }
  /* 12.11: «очень долго пишет варианты». Вариант из шаблонов с персонализацией по отзыву показываем сразу (доли секунды).
     Встроенная модель, если включена, пишет свой вариант в фоне — он появится по следующему нажатию, если готов и прошёл
     проверку (тон, чужие имена, правила справочника); ждать её никто не будет. */
  var modelReady = {}, modelBusy = {};
  function prefetch(req, rk, it, hint) {
    if (modelBusy[rk] || (modelReady[rk] || []).length || !window.__otvModel || !window.__otvModel.ready || !window.__otvModel.ready()) return;
    modelBusy[rk] = true;
    var late = new Promise(function (res) { setTimeout(function () { res(null); }, 60000); });
    Promise.race([Promise.resolve(window.__otvModel.write(req, hint)).catch(function () { return null; }), late]).then(function (txt) {
      modelBusy[rk] = false; if (!txt) return;
      var tone = req.kind === "appeal" ? "negative" : toneOf(it);
      if (req.kind !== "appeal" && !check(txt, it, tone).ok) return;   // не в тему или не тот тон — не показываем
      (modelReady[rk] = modelReady[rk] || []).push(txt);
    });
  }
  window.__otvVariant = function (req) {
    req = Object.assign({ kind: "answer" }, req || {});
    var it = itemOf(req), rk = req.kind + "|" + norm(req.review).slice(0, 80);
    var seen = shownFor[rk] || (shownFor[rk] = []);
    if (seen.length) noteSkip(seen[seen.length - 1]);           // пролистали — этот вариант не подошёл
    var ready = modelReady[rk] || [];
    if (ready.length && seen.length % 3 === 2) { var mt = ready.shift(); keyOfText[bodyKey(mt)] = "model"; seen.push("model:" + seen.length); prefetch(req, rk, it, ""); return Promise.resolve(mt); }
    var v = req.kind === "appeal" ? appeal(it, { exclude: seen }) : answer(it, { exclude: seen, current: req.current });
    if (!v) { seen.length = 0; v = req.kind === "appeal" ? appeal(it, {}) : answer(it, { current: req.current }); }
    if (!v) return Promise.reject(new Error("Других вариантов пока нет"));
    seen.push(v.key); keyOfText[bodyKey(v.text)] = v.key;
    prefetch(req, rk, it, v.text);
    return Promise.resolve(v.text);
  };
  // вы согласовали или опубликовали ответ — его вариант получает плюс (самообучение)
  window.addEventListener("otv-write", function (ev) {
    var d = ev.detail || {}, doc = d.doc;
    if (d.name !== "answers" || !doc || (doc.status !== "approved" && doc.status !== "published")) return;
    var k = keyOfText[bodyKey(doc.answer)];
    if (k && k !== "model") { notePick(k); delete keyOfText[bodyKey(doc.answer)]; }
  });
})();
