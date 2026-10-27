/* «Ответошная» — обжалование отзыва и письмо в этический комитет без онлайн-сервиса.
   Отзыв разбирается по основаниям для снятия (как в форме Яндекса и других площадок), к каждому основанию — точные цитаты.
   Текст собирается строго по утверждённой схеме сотрудницы (образцы 22.10.2026):
   абзац 1 — просьба один раз, порочит репутацию, названный специалист, дискриминация/мат, «Текст эмоционален и субъективен»,
   «Недопустимы фразы: …», «Это не факты, а оскорбительные оценки и интерпретации…»;
   абзац 2 — персональные данные, приписанные фразы, со слов третьих лиц, медицинские выводы без образования,
   кто вправе оценивать (клинические рекомендации и врачебная комиссия), итог. */
(function () {
  "use strict";
  function s(x) { return x == null ? "" : String(x); }
  function low(x) { return s(x).toLowerCase().replace(/ё/g, "е"); }

  // основания из формы площадок (Яндекс и др.) — пишем все, что есть в отзыве
  var FORM = {
    noexp: "Отсутствие личного опыта", wrong: "Ошибочная организация", rude: "Нецензурная лексика, оскорбления, мат или угрозы",
    spam: "Спам, реклама", pd: "Персональные данные", fake: "Признаки накрутки", law: "Нарушение законов РФ (клевета, разжигание ненависти, дискриминация)"
  };
  var RE = {
    obscene: /(^|[^а-яё])(х[уy][йяеёи]|п[иi]зд|бля[дт]?|[её]б[ауеио]|сук[аи]|муд[ао]к|говн|дерьм|сран)/i,
    threat: /(убью|поплатит|пожалеете|разнесу|порву|достану вас|сожгу|ответите за)/i,
    discr: /(ближнего зарубежья|национальност|нерусск|по-русски (не|плохо)|плохо говорит по-русски|с акцентом|акцент\S*|приезж(ий|ие|их|ая|ему|ими)|мигрант|понаехав|гастарбайт|чурк|хач|азиат|кавказ\S*|узбек|таджик|киргиз)/i,
    third: /(сказали,? что|якобы|со слов|говорят,? что|слышал[аи]?,? что|рассказал[аи]?,? что|по словам|мне передали|знакомые)/i,
    nocome: /(не попал[аи]?|попасть нереально|так и не (смог|смогла|смогли) (попасть|записаться|дозвониться)|не дозвонил|до вас не дозвонишься)/i,
    date: /(\d{1,2}[.\/]\d{1,2}([.\/]\d{2,4})?|\d{1,2}\s+(январ|феврал|март|апрел|ма[яй]|июн|июл|август|сентябр|октябр|ноябр|декабр)|вчера|сегодня|позавчера)/i,
    med: /(неэффектив|не назначил|не назначили|назначени|лечени|выписа|выписк|диагноз|капельниц|обезболив|санитарн|перчатк|без маски|осложнени|инфекц|не лечат|залечил|анализ|операци|наркоз|терапи|препарат|обострени|недостаточност|узи|экг)/i,
    death: /(убил[аи]?|угробил[аи]?|довел[аи]? до смерти|на тот свет|смерть|умер(ла)?|погиб)/i,
    relative: /(мо(я|ей|ю|его|й|ему|им)\s+(мам|мат|пап|от[еэ]ц|отц|муж|жен|бабушк|дедушк|сын|доч|ребен|ребён|брат|сестр)|(^|[^а-яё])(маму|мамы|мама|мать|матери|папу|папы)([^а-яё]|$))/i,
    health3: /(диагноз|недостаточност|язв|инсульт|инфаркт|онколог|рак|опухол|давлени|диабет|пневмони|перелом)/i,
    ad: /(промокод|скидк[аиу] \d|акци[яи] до|переходите по ссылке|подписывайтесь|https?:\/\/(?!(www\.)?(gkb24|mos\.ru))|t\.me\/|whatsapp|репутаци\S* в (яндекс|2гис)|\d+\s*отзыв\S*\s*:\s*\d|₽|руб\.? за|заказывайте|предлагаем (услуг|ремонт|достав))/i,
    phone: /(\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/,
    otherHosp: /(больниц\S*|гкб|поликлиник\S*|клиник\S*)\s*(№|n|номер)?\s*(\d{1,3})/gi
  };
  // оценочные и обвинительные слова: из таких фрагментов берём «Недопустимы фразы»
  var EVAL = /(кошмар|ужас|шок|адск|агони|сбежал|игнорир|неэффектив|хам|груб|наор|орал|кричал|ультимат|как заведенн|не врач|якобы|нормой|бороться за|нервов|слез|нормально лечить|безобраз|отвратит|издева|равнодуш|наплева|бардак|позор|убива|угроб|мясник|коновал|халтур|не лечат|бросил|цинизм|беспредел|скотск|клоун|фабрик\S* смерти|дыр(ок|ки)|ни души|гражданин|данный|недоумени|не помогал|мучил|издевател|плевать|не смутил|в шоке|никому не нужн|бездушн|некомпетентн|ужасн|отвратительн|не рекоменду|не советую|обходите|бегите|развод|вымога|деньги|платн|тупо|быдл|зажрал|лентя|пофиг|наплев|ноль внимания|не допросишься|не дождешься|не дождёшься|по барабану)/i;
  var GOODW = /(спасибо|благодар|отличн|грамотн|внимательн|понимающ|прекрасн|хорош|претензий нет|всё отлично|все отлично)/i;

  // предложения: точка после инициала («Е.Н.»), в дате («9.10.26») и в «г-н» предложение не заканчивает
  function sentences(t) {
    var x = s(t).replace(/\s+/g, " ").replace(/([А-ЯЁ])\.(?=\s?[А-ЯЁ]\.)/g, "$1\u2024").replace(/([А-ЯЁ]\u2024\s?[А-ЯЁ])\./g, "$1\u2024").replace(/(\d)\.(?=\d)/g, "$1\u2024");
    return (x.match(/[^.!?…]+[.!?…]*/g) || []).map(function (y) { return y.replace(/\u2024/g, ".").trim(); }).filter(Boolean);
  }
  function clauses(sen) { return sen.split(/\s*(?:[,;:]|\s—\s|\s-\s|\sно\s|\sа\s)\s*/).map(function (x) { return x.trim().replace(/[.!?…]+$/, ""); }).filter(function (x) { return x.split(/\s+/).length >= 2; }); }
  function clip(x, n) { var w = x.split(/\s+/); return w.length <= n ? x : w.slice(0, n).join(" "); }
  // фрагмент вокруг совпадения, не длиннее n слов, по границам предложения
  function around(text, re, n) {
    var out = [];
    sentences(text).forEach(function (sen) {
      var r = new RegExp(re.source, "i"), m = r.exec(sen); if (!m) return;
      out.push(fragment(sen, m.index, m[0].length, n || 10));
    });
    return out;
  }
  // фрагмент вокруг слова: до 3 слов перед ним и до конца части предложения, без вложенных цитат
  function fragment(sen, at, len, n) {
    var STOP = /^(и|но|а|что|который|которая|которые|после|чтобы|когда|потому|так|я|он|она|они|мне|меня)$/i;
    var left = sen.slice(0, at), right = sen.slice(at);
    var lb = Math.max(left.lastIndexOf(","), left.lastIndexOf(";"), left.lastIndexOf(":"), left.lastIndexOf("«"), left.lastIndexOf("»"), left.lastIndexOf("("), left.lastIndexOf(")"));
    var lw = left.slice(lb + 1).trim().split(/\s+/).filter(Boolean), keep = [];
    for (var i = lw.length - 1; i >= 0 && keep.length < 5; i--) { if (STOP.test(lw[i])) break; keep.unshift(lw[i]); }
    var rEnd = right.slice(len).search(/[,;:«»()]|[.!?…]\s|[.!?…]$/), rr = rEnd < 0 ? right : right.slice(0, len + rEnd);
    // после двух слов за ключевым словом фразу обрываем на союзе: «не менял перчатки», а не «…и в это время»
    var tail = rr.slice(len), cj = tail.search(/\s(и|а|но|потом|после чего|в это время)\s/i);
    if (cj >= 0 && tail.slice(0, cj).trim().split(/\s+/).length >= 1) rr = rr.slice(0, len + cj);
    var w = (keep.join(" ") + " " + rr).trim().split(/\s+/);
    w = w.slice(0, n); while (w.length > 2 && /^(и|но|а|в|на|с|к|по|из|от|для|что|его|ее|её|их)$/i.test(w[w.length - 1].replace(/[,.;:]+$/, ""))) w.pop();
    return w.join(" ").replace(/[\s,;:.!?…—-]+$/, "").replace(/^[«"„(\s]+|[»"“)\s]+$/g, "").trim();
  }

  /* ---------- названный сотрудник ---------- */
  function staffSur(tok) {
    var P = window.__otvReports && window.__otvReports.person; if (!P) return null;
    var cands = [tok, tok.replace(/(а|у|ым|ом|е)$/, ""), tok.replace(/(ой|ую|ей)$/, "а"), tok.replace(/ого$/, "ий"), tok.replace(/(ого|ому)$/, "")];
    for (var i = 0; i < cands.length; i++) { var p = P(cands[i]); if (p && !p.ambiguous) return p; }
    return null;
  }
  // кого обвиняют: из всех названных сотрудников — тот, кто чаще упомянут в негативных предложениях; кого благодарят — пропускаем
  function namedOf(text) {
    var t = s(text), found = [], m, re;
    var push = function (txt, how, at) { found.push({ text: txt, how: how, at: at }); };
    re = /([А-ЯЁ][а-яё-]{2,})\s+([А-ЯЁ][а-яё]+)\s+([А-ЯЁ][а-яё]+(?:вич|вна|ична|ович|овна|евич|евна|ьич))(?![а-яё])/g;
    while ((m = re.exec(t))) push(m[1] + " " + m[2] + " " + m[3], "по фамилии, имени и отчеству", m.index);
    re = /([А-ЯЁ][а-яё-]{2,})\s+([А-ЯЁ])\.\s?([А-ЯЁ])\./g;
    while ((m = re.exec(t))) push(m[1] + " " + m[2] + "." + m[3] + ".", "по фамилии и инициалам", m.index);
    re = /([Гг]-н|[Гг]-жа|[Гг]осподин|[Гг]оспожа|[Дд]октор|[Вв]рач|[Хх]ирург|[Зз]аведующ\S*|[Зз]авотделением|[Мм]едсестра)\s+([А-ЯЁ][а-яё-]{3,})/g;
    while ((m = re.exec(t))) { var p = staffSur(m[2]); if (!found.some(function (f) { return f.text.indexOf(m[2].slice(0, 4)) === 0; })) push(p ? p.sur : m[2], "по фамилии", m.index); }
    if (!found.length) return null;
    var sens = sentences(t);
    found.forEach(function (f) {
      var stem = f.text.split(/\s+/)[0].slice(0, Math.max(4, f.text.split(/\s+/)[0].length - 2));
      f.neg = 0; f.pos = 0;
      sens.forEach(function (x) { if (x.indexOf(stem) < 0) return; if (GOODW.test(x) && !EVAL.test(x)) f.pos++; if (EVAL.test(x) || /не |отказ|выписа|потребовал/i.test(x)) f.neg++; });
      // благодарность прямо перед именем («благодарность Иванчиной А.С.») — этого сотрудника хвалят, а не обвиняют
      if (/(благодар\S*|спасибо|отличн\S*|прекрасн\S*|грамотн\S*|золот\S*)[^.!?]{0,25}$/i.test(t.slice(Math.max(0, f.at - 40), f.at))) f.praised = true;
    });
    var acc = found.filter(function (f) { return !f.praised && f.neg > 0 && !(f.pos > 0 && f.neg <= f.pos); });
    if (!acc.length) return null;
    acc.sort(function (a, b) { return b.neg - a.neg || a.at - b.at; });
    var all = found.filter(function (f) { return /инициалам|отчеству/.test(f.how); }).map(function (f) { return f.text; });
    return { text: acc[0].text, how: acc[0].how, all: all };
  }
  // фразы в кавычках после «сказал», «потребовал» — приписанные сотруднику
  function attributed(text) {
    var out = [], re = /(сказал\S*|ответил\S*|заявил\S*|потребовал\S*|повторял\S*|сообщил\S*|крикнул\S*|орал\S*|бросил\S*|выдал\S*|произн[её]с\S*)[^«"„]{0,60}[«"„]([^»"“]{3,120})[»"“]/gi, m;
    while ((m = re.exec(s(text)))) out.push(m[2].trim());
    return out;
  }

  /* ---------- разбор отзыва ---------- */
  function analyze(text, opt) {
    opt = opt || {};
    var t = s(text), L = low(t), g = [], named = namedOf(t), attr = attributed(t);
    var add = function (id, form, ev) { g.push({ id: id, form: FORM[form], evidence: (ev || []).filter(Boolean) }); };
    if (RE.ad.test(t) && !/лечени|операци|врач|больниц[аеу] (помог|леч)/i.test(t)) add("spam", "spam", around(t, RE.ad, 10));
    if (RE.ad.test(t) || (RE.phone.test(t) && !/495[\s)-]*685/.test(t))) { if (!g.some(function (x) { return x.id === "spam"; }) && RE.ad.test(t)) add("spam", "spam", around(t, RE.ad, 10)); }
    if (RE.discr.test(t)) add("discr", "law", around(t, RE.discr, 9));
    if (RE.obscene.test(t)) add("obscene", "rude", around(t, RE.obscene, 8));
    if (RE.threat.test(t)) add("threat", "rude", around(t, RE.threat, 8));
    var nocome = RE.nocome.test(t), third = RE.third.test(t);
    if (nocome || /пишу (за|от имени)|не был[аи]? (у вас|пациент)/i.test(t)) add("noexp", "noexp", around(t, RE.nocome, 8));
    if (third) add("third", "noexp", around(t, RE.third, 8));
    var wrong = [], m; RE.otherHosp.lastIndex = 0;
    while ((m = RE.otherHosp.exec(t))) if (+m[3] !== 24 && +m[3] < 300) wrong.push(m[0]);
    if (wrong.length) add("wrong", "wrong", wrong);
    var pdEv = [];
    if (named) pdEv.push(named.text);
    if (RE.relative.test(t) && RE.health3.test(t)) pdEv.push("сведения о здоровье третьего лица");
    if (RE.phone.test(t) && !/495[\s)-]*685/.test(t)) pdEv.push("номер телефона");
    if (pdEv.length) add("pd", "pd", pdEv);
    if (named) add("named", "law", [named.text]);
    if (attr.length) add("attr", "law", attr.slice(0, 3));
    var MEDJ = /(неэффектив|не назначил\S*|не помогал\S*|неправильн\S*|не лечил\S*|нормально лечить|без маски|не менял перчатки|залечил\S*|с обострением|экстренн\S* выписк|выписал\S* с|не оказал\S*|не обезболил\S*)/i;
    if (RE.med.test(t)) add("med", "law", around(t, MEDJ, 10).filter(function (x) { return !GOODW.test(x); }).slice(0, 2));
    if (RE.death.test(t) && /(врач|больниц|персонал|они|их)/i.test(t)) add("death", "law", around(t, RE.death, 10));
    if (!RE.date.test(t)) add("nodate", null, []);
    // недопустимые фразы: оценочные фрагменты по порядку текста, без благодарностей и без уже приведённых цитат
    var used = {}; attr.forEach(function (a) { used[low(a)] = 1; });
    var ins = [];
    sentences(t).forEach(function (sen) {
      var plain = sen.replace(/[«"„][^»"“]*[»"“]/g, function (z) { return z.replace(/[^\s]/g, "\u2063"); });   // цитаты внутри не берём
      var r = new RegExp(EVAL.source, "gi"), m2, last = -1;
      while ((m2 = r.exec(plain))) {
        if (m2.index < last) continue;
        var f = fragment(sen, m2.index, m2[0].length, 12).replace(/\u2063/g, "");
        if (!f || /[«»]/.test(f) || f.length < 6 || (GOODW.test(f) && !/не врач|якобы/i.test(f))) continue;
        var k = low(f); if (used[k] || ins.some(function (x) { return low(x).indexOf(k) >= 0 || k.indexOf(low(x)) >= 0; })) continue;
        used[k] = 1; ins.push(f); last = m2.index + f.length;
      }
    });
    if (ins.length) add("insult", "rude", ins.slice(0, 4));
    var relative = RE.relative.test(t) && !/^я\s/i.test(t);
    // обвиняют сотрудника, даже если без фамилии («гражданин (сказали что якобы врач)»)
    var staffAcc = sentences(t).some(function (x) { return /(врач|доктор|медсестр|сотрудник|хирург|заведующ|персонал)/i.test(x) && (EVAL.test(x) || /без маски|не менял|отказ/i.test(x)) && !(GOODW.test(x) && !EVAL.test(x)); });
    return { grounds: g, named: named, staffAcc: staffAcc, attributed: attr, insults: ins, relative: relative, reanim: sentences(t).some(function (x) { return /в реанимаци/i.test(x) && /(маск|перчат|осматривал|отключал)/i.test(x); }), doctorPage: /врача?:/i.test(s(opt.page)) };
  }
  function has(an, id) { return an.grounds.filter(function (x) { return x.id === id; })[0] || null; }
  function q(list) { return list.map(function (x) { return "«" + x + "»"; }).join(", "); }

  /* ---------- обжалование ---------- */
  function compose(text, opt) {
    opt = opt || {};
    var an = analyze(text, opt), v = opt.variant || 0, spam = has(an, "spam");
    var form = []; an.grounds.forEach(function (x) { if (x.form && form.indexOf(x.form) < 0) form.push(x.form); });
    if (spam && !/лечени|операци|врач/i.test(text)) {
      var ad = "Здравствуйте! Просим снять публикацию: это не отзыв о получении медицинской помощи, а реклама сторонних услуг (" + q(spam.evidence.slice(0, 2)) + "). Автор не был пациентом больницы и не делится личным опытом.";
      if (form.indexOf(FORM.noexp) < 0) form.push(FORM.noexp);
      return { text: ad, short: ad, form: form, grounds: an.grounds, note: "Похоже на рекламу: в форме площадки отметьте «" + FORM.spam + "» и «" + FORM.noexp + "»." };
    }
    var named = an.named, doc = !!named || an.doctorPage || an.staffAcc;
    // абзац 1
    var p1 = "Здравствуйте! Просим снять отзыв с публикации: он порочит репутацию больницы";
    var discr = has(an, "discr");
    if (named) p1 += ", а также содержит публичное обвинение конкретного специалиста, названного " + named.how + " (" + named.text + ")";
    if (discr) p1 += (named ? " и дискриминацию по национальному признаку" : " и содержит дискриминацию по национальному признаку");
    p1 += ".";
    if (discr) p1 += " Автор связывает предполагаемые нарушения с происхождением сотрудника (" + q(discr.evidence.slice(0, 1)) + "), что недопустимо и нарушает законодательство РФ.";
    if (has(an, "obscene")) p1 += " Отзыв содержит нецензурную лексику.";
    if (has(an, "threat")) p1 += " Отзыв содержит угрозы в адрес сотрудников (" + q(has(an, "threat").evidence.slice(0, 1)) + ").";
    var ins = (has(an, "insult") || { evidence: [] }).evidence;
    if (v % 2 === 1 && ins.length > 3) ins = ins.slice(1).concat(ins.slice(0, 1));
    p1 += " Текст эмоционален и субъективен.";
    if (ins.length) p1 += " Недопустимы фразы: " + q(ins.slice(0, 3)) + " и т.д.";
    p1 += " Это не факты, а оскорбительные оценки и интерпретации в адрес " + (doc ? "врача и больницы" : "больницы") + ".";
    // абзац 2
    var p2 = [];
    var pd = has(an, "pd");
    if (pd) {
      var what = [];
      if (pd.evidence.some(function (x) { return named && x === named.text; })) what.push(named.all && named.all.length > 1 ? "фамилии и инициалы врачей" : /инициалам/.test(named.how) ? "фамилию и инициалы врача" : "фамилию врача");
      if (pd.evidence.indexOf("сведения о здоровье третьего лица") >= 0) what.push("сведения о здоровье третьего лица");
      if (pd.evidence.indexOf("номер телефона") >= 0) what.push("номер телефона");
      if (what.length) p2.push("Отзыв публикует без согласия персональные данные: " + what.join(" и ") + ".");
    }
    var attr = has(an, "attr");
    if (attr) p2.push((attr.evidence.length > 1 ? "Врачу приписаны фразы " + q(attr.evidence.slice(0, 2)) + ", подлинность которых" : "Отзыв также приписывает врачу фразу " + q(attr.evidence.slice(0, 1)) + ", подлинность которой") + " подтвердить невозможно.");
    var third = has(an, "third"), nodate = has(an, "nodate");
    if (third || nodate) {
      var parts = [];
      if (nodate) parts.push("Отзыв не содержит даты и данных пациента");
      if (third) parts.push((nodate ? "а " : "Автор передаёт ") + (nodate ? "сведения автор передаёт" : "сведения") + " со слов третьих лиц (" + q(third.evidence.slice(0, 1)) + ")");
      p2.push(parts.join(", ") + ", поэтому проверить описанное невозможно.");
    }
    var noexp = has(an, "noexp");
    if (noexp && noexp.evidence.length) p2.push("Автор сам указывает, что помощь в больнице не получал (" + q(noexp.evidence.slice(0, 1)) + "), и не может её оценивать.");
    var wrong = has(an, "wrong");
    if (wrong) p2.push("Отзыв относится к другому учреждению (" + q(wrong.evidence.slice(0, 1)) + ").");
    var med = has(an, "med"), death = has(an, "death");
    if (death && death.evidence.length) p2.push("Отзыв голословно обвиняет сотрудников в причинении вреда (" + q(death.evidence.slice(0, 1)) + ") без экспертизы и официальной проверки.");
    if (med) {
      p2.push("Автор делает медицинские выводы без специального образования" + (med.evidence.length ? " (" + q(med.evidence.slice(0, 1)) + ")" : "") + ".");
      p2.push((an.reanim ? "Порядок работы в отделении реанимации определяют санитарные нормы и клинические рекомендации, а оценку действий персонала даёт" : "Лечение, выписку и оценку действий врача определяют клинические рекомендации и") + " врачебная комиссия по медицинской документации, а не " + (an.relative ? "родственник пациента" : "пациент") + ".");
    }
    p2.push(doc ? "Это публичное обвинение специалиста без проверки, которое нарушает деловую репутацию врача." : "Это голословные обвинения без проверки, которые порочат репутацию больницы и вводят пациентов в заблуждение.");
    var full = p1 + "\n\n" + p2.join(" ");
    // короткая версия для площадок с лимитом ~450 знаков
    var short = "Здравствуйте! Просим снять отзыв с публикации: он порочит репутацию больницы" + (named ? " и врача (" + named.text + ")" : "") + (discr ? " и содержит дискриминацию по национальному признаку" : "") + ". Текст эмоционален и субъективен." +
      (ins.length ? " Недопустимы фразы: " + q(ins.slice(0, 3)) + "." : "") + " Оценить действия " + (doc ? "врача" : "персонала") + " может только врачебная комиссия по медицинской документации.";
    while (short.length > 450 && ins.length > 1) { ins = ins.slice(0, -1); short = short.replace(/Недопустимы фразы: [^.]*\./, "Недопустимы фразы: " + q(ins) + "."); }
    var note = "Основания для формы площадки: " + form.join("; ") + "." + (form.indexOf(FORM.fake) < 0 ? " «" + FORM.fake + "» ставим, только если есть факты (например, пациента в этот день не было)." : "");
    return { text: full, short: short, form: form, grounds: an.grounds, note: note };
  }

  /* ---------- письмо в этический комитет ПроДокторов ---------- */
  var MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  function dateWords(d) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s(d)) || /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s(d)); if (!m) return s(d); return m[1].length === 4 ? (+m[3]) + " " + MON[+m[2] - 1] + " " + m[1] + " года" : (+m[1]) + " " + MON[+m[2] - 1] + " " + m[3] + " года"; }
  var NUMW = ["", "одного отзыва", "двух отзывов", "трёх отзывов", "четырёх отзывов", "пяти отзывов"];
  function ethics(reviews, opt) {
    opt = opt || {};
    var list = (reviews || []).filter(function (r) { return s(r.text).trim(); });
    var n = list.length, allIns = [];
    var blocks = list.map(function (r) {
      var an = analyze(r.text, {}), g = [], ins = (has(an, "insult") || { evidence: [] }).evidence;
      ins.forEach(function (x) { if (allIns.length < 6) allIns.push(x); });
      if (ins.length) g.push("Отзыв содержит оскорбительные формулировки в адрес медицинского персонала: " + q(ins.slice(0, 4)) + ". Такие высказывания являются не выражением недовольства качеством помощи, а оскорблением чести и деловой репутации сотрудников и организации.");
      if (has(an, "discr")) g.push("Отзыв содержит дискриминацию по национальному признаку (" + q(has(an, "discr").evidence.slice(0, 1)) + "), что недопустимо и нарушает законодательство РФ.");
      if (has(an, "named")) g.push("Отзыв содержит публичное обвинение конкретного специалиста, названного " + an.named.how + " (" + an.named.text + "), без каких-либо документальных оснований и вне рамок официального разбирательства.");
      if (has(an, "attr")) g.push("Отзыв приписывает сотрудникам фразы " + q(has(an, "attr").evidence.slice(0, 2)) + ", подлинность которых подтвердить невозможно.");
      if (has(an, "death") && has(an, "death").evidence.length) g.push("Отзыв голословно обвиняет сотрудников в причинении вреда (" + q(has(an, "death").evidence.slice(0, 1)) + "). Причинно-следственная связь не установлена и не может быть установлена автором без специального медицинского образования и экспертизы документации.");
      if (has(an, "med")) g.push("Отзыв содержит неподтверждённые медицинские утверждения, сделанные без специального образования" + (has(an, "med").evidence.length ? " (" + q(has(an, "med").evidence.slice(0, 1)) + ")" : "") + ". Оценка правильности и полноты оказанной медицинской помощи находится в компетенции врачебной комиссии и требует экспертизы качества медицинской помощи.");
      if (has(an, "third")) g.push("Автор передаёт сведения со слов третьих лиц (" + q(has(an, "third").evidence.slice(0, 1)) + "), поэтому проверить их невозможно.");
      if (!g.length) g.push("Отзыв содержит субъективные оценки без фактов, которые можно проверить, и порочит репутацию учреждения.");
      var head = "Отзыв " + dateWords(r.date) + (s(r.topic).trim() ? ", " + s(r.topic).trim() : "") + (s(r.link).trim() ? " (" + s(r.link).trim() + ")" : "") + ":";
      return head + "\n\nОснования обжалования:\n\n" + g.map(function (x, i) { return (i + 1) + ". " + x; }).join("\n") +
        (has(an, "death") ? "\n\nМы с пониманием относимся к тяжести утраты, которую пережил автор отзыва, однако считаем недопустимым, чтобы переживание выражалось в форме публичных оскорблений в адрес сотрудников и учреждения без документально подтверждённых фактов ненадлежащего оказания медицинской помощи." :
          "\n\nСотрудники учреждения действуют строго в рамках утверждённых регламентов и клинических рекомендаций, и публичное обвинение персонала без проведения официальной проверки недопустимо.");
    });
    var one = n === 1;
    return "Здравствуйте, уважаемые члены этического комитета!\n\nОбращаемся с просьбой рассмотреть возможность снятия с публикации " + (NUMW[n] || n + " отзывов") + ":\n\n" + blocks.join("\n\n") +
      "\n\nТаким образом, " + (one ? "отзыв содержит" : "во всех " + (n < 5 ? ["", "", "двух", "трёх", "четырёх"][n] : n) + " отзывах содержатся") + (allIns.length ? " оскорбительные формулировки в адрес персонала (" + q(allIns.slice(0, 5)) + "), а также" : "") + " голословные обвинения без проверки. " +
      "Подобные публикации наносят репутационный ущерб учреждению и его сотрудникам. Просим рассмотреть " + (one ? "указанный отзыв" : "указанные отзывы") + " на предмет соответствия правилам платформы и принять решение об " + (one ? "его" : "их") + " снятии с публикации." +
      "\n\n-- \nС уважением, администрация 24 Московской больницы\nГБУЗ «ГКБ № 24 ДЗМ»\ngb24-press2@zdrav.mos.ru\ngkb24@zdrav.mos.ru\n" + (opt.phone || "[телефон]");
  }

  window.__otvAppeal = { analyze: analyze, compose: compose, ethics: ethics, FORM: FORM };
})();

/* Окна «Обжалование», «Этический комитет», «Написать спасибо», «Ответить на вопрос» без онлайн-сервиса:
   те же правила и образцы, что в программе; «Ещё вариант» даёт другой вариант. */
(function () {
  "use strict";
  function s(x) { return x == null ? "" : String(x); }
  var seen = {};
  function pick(kind, it, n) {
    var G = window.__otvGen; if (!G) return [];
    var ex = seen[kind] = seen[kind] || [], out = [];
    for (var i = 0; i < n * 3 && out.length < n; i++) {
      var v = G.answer(it, { exclude: ex }); if (!v) { ex.length = 0; v = G.answer(it, {}); }
      if (!v) break;
      ex.push(v.key);
      if (out.indexOf(v.text) < 0) out.push(v.text);
    }
    return out;
  }
  var PAGE = { "Страница врача": "Страница врача", "Страница больницы": "Страница больницы" };
  window.__otvLocalGen = {
    appeal: function (v, round) {
      var r = window.__otvAppeal.compose(v.review, { variant: round || 0, page: v.page });
      return { variants: [r.text, r.short], labels: ["Обжалование целиком", "Короткое, до 450 знаков (" + r.short.length + ")"], note: r.note + (v.facts ? " Учтите вручную: " + v.facts : "") };
    },
    ethics: function (v) {
      return { text: window.__otvAppeal.ethics(v.reviews || [], {}), note: "Проверьте даты и ссылки в заголовках блоков и впишите телефон в подписи." };
    },
    thanks: function (v) {
      var page = PAGE[v.page] || (/врач/i.test(v.page) ? "Страница врача" : "Страница больницы");
      var it = { platform: "", page: page, author: "", review: s(v.review), rating: 5, tone: "positive", kind: "" };
      var list = pick("thanks", it, 3);
      return { variants: list, note: list.length ? "Варианты из ваших утверждённых шаблонов и базы ответов." : "" };
    },
    question: function (v) {
      var it = { platform: "Сайт", page: "Письмо с сайта", author: s(v.author), review: s(v.question), kind: "question", tone: "question" };
      var list = pick("question", it, 1);
      return { text: list[0] || "", note: "Ответ по шаблонам вопросов. Проверьте факты (телефоны, порядок) перед отправкой." + (v.facts ? " Учтите: " + v.facts : "") };
    }
  };
})();
