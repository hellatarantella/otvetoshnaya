import asyncio, json
from playwright.async_api import async_playwright
import os
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "sources.js"), encoding="utf-8").read()
i = src.index("  async function MAIL_API(known, opts)"); j = src.index("  /* ---------- почта сайта (owa.mos.ru): запасной способ")
API = src[i:j]

# имитация служебного адреса почты (service.svc): папки, письма, тексты, «Отправленные»
MOCK = r"""
(() => {
  const msk = s => s + '+03:00';
  const F = (id, name, total, cls, parent) => ({ FolderId: { Id: id }, DisplayName: name, TotalCount: total, FolderClass: cls || 'IPF.Note', ParentFolderId: { Id: parent || 'ROOT' } });
  const folders = [F('INBOX', 'Входящие', 50), F('SENT', 'Отправленные', 9), F('DEL', 'Удаленные', 4), F('DRAFT', 'Черновики', 0), F('JUNK', 'Нежелательная почта', 1),
    F('FORM', 'Форма обратной связи', 1), F('CAL', 'Календарь', 3, 'IPF.Appointment'), F('RC', 'Recipient Cache', 900, 'IPF.Contact.RecipientCache'),
    F('SUBDEL', 'Старое', 5, 'IPF.Note', 'DEL'), F('SUBIN', 'Разобрано', 1, 'IPF.Note', 'INBOX')];
  const form = (id, cid, when, subj, body, from) => ({ ItemId: { Id: id }, ConversationId: { Id: cid }, DateTimeReceived: msk(when), Subject: subj, ItemClass: 'IPM.Note',
    From: { Mailbox: { Name: from || 'Форма обратной связи', EmailAddress: 'noreply@gkb-24.ru' } }, _body: body });
  const B = (name, email, type, msg, doc) => 'ВНЕШНЯЯ ПОЧТА: \r\n\r\n\r\nВнимание! Письмо от внешнего отправителя, не переходите по ссылкам.\r\nБудьте осторожны.\r\n\r\n\r\n\r\nИмя: ' + name + '\r\nEmail: ' + email + '\r\nТелефон: +7 (999) 123-45-67\r\nТип обращения: ' + type + '\r\nСообщение: ' + msg + '\r\nЛендинг: https://gkb24.ru/otd\r\nВрач: ' + (doc || 'Не указан') + '\r\n';
  const items = {
    INBOX: [
      form('i1', 'AAQkAGZmNjk+nPyQ=', '2026-10-14T15:52:19', 'Благодарность (Страница: Главная)', B('Иванова Анна', 'anna@mail.ru', 'thanks', 'Спасибо врачам\r\nза заботу! Пишите мне anna@mail.ru или 8 999 111 22 33')),
      form('i2', 'AAQkAGZmNjk/abc/xmZaLU=', '2026-10-12T18:07:49', 'Благодарность (Страница: Хирургия)', B('Петров Пётр', 'petr@ya.ru', 'thanks', 'Благодарю хирургов.')),
      form('i3', 'AAQkAGZmNjkxyzUj+NY=', '2026-10-12T15:33:32', 'Благодарность (Страница: Хирургия)', B('Ступников', 'st@gmail.com', 'thanks', 'Очень заботливый персонал.')),
      form('i3b', 'AAQkAGZmNjkxyzUj+NZ=', '2026-10-12T15:40:00', 'Благодарность (Страница: Хирургия)', B('Ступников', 'st@gmail.com', 'thanks', 'Очень заботливый персонал.')),
      { ItemId: { Id: 'i4' }, ConversationId: { Id: 'ZZZhelp=' }, DateTimeReceived: msk('2026-10-10T03:54:54'), Subject: 'Помощь', ItemClass: 'IPM.Note', From: { Mailbox: { Name: 'Студент', EmailAddress: 'x@rudn.ru' } }, _body: 'Здравствуйте, помогите с практикой.' },
      { ItemId: { Id: 'i5' }, ConversationId: { Id: 'FWDfwd=' }, DateTimeReceived: msk('2026-10-10T09:00:00'), Subject: 'FW: Благодарность (Страница: Главная)', ItemClass: 'IPM.Note', From: { Mailbox: { Name: 'Коллега', EmailAddress: 'c@gkb-24.ru' } }, _body: 'Сообщение: пересланное' },
      form('i6', 'AAQkAGZmNjk+pNemq/ZA4=', '2026-10-10T11:26:16', 'Благодарность (Страница: Хирургия)', B('Быкова Ольга', 'bykova@list.ru', 'thanks', 'Спасибо, очень внимательные.')),
      form('i7', 'AAQkAGZmNjkOLDold=', '2026-10-08T11:34:19', 'Жалоба (Страница: Хирургия)', B('Старый', 'old@x.ru', 'complaint', 'Старое письмо'))
    ],
    JUNK: [ form('j1', 'AAQkJUNKjunk01=', '2026-10-11T10:00:00', 'Жалоба (Страница: Приёмное)', B('Сидоров', 'sid@x.ru', 'complaint', 'Долго ждал в приёмном, никто не подошёл')) ],
    FORM: [],
    SUBIN: [ { ItemId: { Id: 's1' }, ConversationId: { Id: 'SUBINconv01=' }, DateTimeReceived: msk('2026-10-13T12:00:00'), Subject: 'Отзыв о больнице', ItemClass: 'IPM.Note', From: { Mailbox: { Name: 'Сайт ГКБ 24', EmailAddress: 'site@gkb-24.ru' } },
      _body: B('Кузнецова', 'kuz@x.ru', 'Отзыв', 'Хочу поблагодарить персонал отделения.') } ],
    DEL: [
      form('d1', 'AAQkAGZmDELdup1=', '2026-10-14T15:52:30', 'Благодарность (Страница: Главная)', B('Иванова Анна', 'anna@mail.ru', 'thanks', 'Спасибо врачам за заботу! (черновик)')),
      form('d2', 'AAQkAGZmDELuni2=', '2026-10-12T16:12:00', 'Благодарность (Страница: Хирургия)', B('Козлова', 'koz@x.ru', 'thanks', 'Спасибо за лечение.'))
    ],
    SUBDEL: [ form('sd1', 'AAQkSUBDEL01=', '2026-10-13T10:00:00', 'Благодарность', B('Удалённый', 'del@x.ru', 'thanks', 'не должен читаться')) ]
  };
  const sent = [
    { id: 'o1', ts: '2026-10-14T16:10:00', to: ['Anna@Mail.ru'], disp: 'Иванова Анна', body: 'Здравствуйте, Анна!\r\nСпасибо за тёплые слова, передадим врачам.\r\nС уважением, администрация. Тел. 8 (495) 111-22-33, gkb24@zdrav.mos.ru\r\n\r\n________________________________\r\nОт: Иванова Анна <anna@mail.ru>\r\nСпасибо врачам' },
    { id: 'o2', ts: '2026-10-12T17:00:00', to: ['st@gmail.com'], disp: 'st@gmail.com' },
    { id: 'o3', ts: '2026-10-11T09:00:00', to: ['bykova@list.ru'], disp: 'bykova@list.ru' },
    { id: 'o4', ts: '2026-10-13T09:00:00', to: ['koz@x.ru'], disp: 'Козлова' },
    { id: 'o5', ts: '2026-10-12T10:00:00', to: ['petr@ya.ru'], disp: 'petr@ya.ru' },   // раньше письма Петрова: не считается
    { id: 'o6', ts: '2026-10-01T10:00:00', to: ['sid@x.ru'], disp: 'sid@x.ru' }
  ];
  // ответ Кузнецовой в ящике пресс-службы на другой адрес: найти по той же переписке
  const sentConv = [ { id: 'p1', ts: '2026-10-13T15:00:00', to: ['other@box.ru'], disp: 'other@box.ru', cid: 'SUBINconv01=', body: 'Здравствуйте! Спасибо за ваш отзыв, передали персоналу.\r\n\r\nОт: Сайт ГКБ 24\r\nХочу поблагодарить' } ];
  const byId = {}; Object.values(items).flat().forEach(x => byId[x.ItemId.Id] = x);
  window.__calls = [];
  window.fetch = async (url, o) => {
    const action = (url.match(/action=(\w+)/) || [])[1]; const req = JSON.parse(o.body); const b = req.Body;
    window.__calls.push(action); (window.__urls = window.__urls || []).push(url);
    if (o.headers['X-OWA-CANARY'] !== 'CAN123') return new Response('', { status: 440 });
    if (!req.Header || req.__type !== action + 'JsonRequest:#Exchange') return new Response(JSON.stringify({ Body: { ErrorCode: 500, FaultMessage: 'Cannot deserialize' } }), { status: 500 });
    const ok = x => new Response(JSON.stringify({ Body: { ResponseMessages: { Items: x } } }), { status: 200 });
    if (action === 'GetFolder') {
      const map = { inbox: 'Входящие', sentitems: 'Отправленные', deleteditems: 'Удаленные', drafts: 'Черновики', outbox: 'Исходящие', syncissues: 'Ошибки синхронизации', junkemail: 'Нежелательная почта' };
      return ok(b.FolderIds.map(f => ({ ResponseClass: 'Success', Folders: [{ FolderId: { Id: 'AQMk' + f.Id }, DisplayName: map[f.Id] }] })));
    }
    if (action === 'FindFolder') { if (!b.Paging) return new Response(JSON.stringify({ Body: { FaultMessage: 'Cannot deserialize object of type FindFolderJsonRequest' } }), { status: 500 }); return ok([{ ResponseClass: 'Success', RootFolder: { Folders: folders } }]); }
    if (action === 'FindItem') {
      const p = b.ParentFolderIds[0]; const key = p.__type.startsWith('Distinguished') ? { inbox: 'INBOX', junkemail: 'JUNK', deleteditems: 'DEL', sentitems: 'SENT' }[p.Id] : p.Id;
      if (key === 'SENT') {
        const all = sent.concat(sentConv).slice().sort((a, c) => c.ts.localeCompare(a.ts)).map(x => ({ ItemId: { Id: x.id }, DateTimeSent: msk(x.ts), DisplayTo: x.disp, ConversationId: { Id: x.cid || ('c-' + x.id) } }));
        const pg = all.slice(b.Paging.Offset, b.Paging.Offset + 2);          // маленькие страницы: проверяем листание
        return ok([{ ResponseClass: 'Success', RootFolder: { Items: pg, IncludesLastItemInRange: b.Paging.Offset + 2 >= all.length, TotalItemsInView: all.length } }]);
      }
      const all = (items[key] || []).slice().sort((a, c) => c.DateTimeReceived.localeCompare(a.DateTimeReceived)).map(x => { const y = Object.assign({}, x); delete y._body; return y; });
      const pg = all.slice(b.Paging.Offset, b.Paging.Offset + 3);
      return ok([{ ResponseClass: 'Success', RootFolder: { Items: pg, IncludesLastItemInRange: b.Paging.Offset + 3 >= all.length, TotalItemsInView: all.length } }]);
    }
    if (action === 'GetItem') {
      return ok(b.ItemIds.map(r => {
        const s = sent.concat(sentConv).find(x => x.id === r.Id);
        if (s) return { ResponseClass: 'Success', Items: [Object.assign({ ToRecipients: s.to.map(e => ({ EmailAddress: e, RoutingType: 'SMTP' })) }, s.body && JSON.stringify(b.ItemShape).indexOf('Body') >= 0 ? { Body: { BodyType: 'Text', Value: s.body } } : {})] };
        const x = byId[r.Id]; return { ResponseClass: 'Success', Items: [{ Body: { BodyType: 'Text', Value: x._body } }] };
      }));
    }
    return new Response('{}', { status: 500 });
  };
  document.cookie = 'X-OWA-CANARY=CAN123';
})();
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.goto("http://127.0.0.1:9/") if False else await pg.set_content("<html><body>owa</body></html>")
        await pg.evaluate(MOCK.replace("document.cookie = 'X-OWA-CANARY=CAN123';", "Object.defineProperty(document, 'cookie', { get: () => 'a=1; X-OWA-CANARY=CAN123' });"))
        res = await pg.evaluate("async () => { " + API + " ; return await MAIL_API([], {since: '2026-10-09', mbox: 'GB24-press2@zdrav.mos.ru', todo: [{id:'site-OLDTODO', name:'Козлова', eh:'', date:'2026-10-12'}]}); }")
        ok = True
        def check(cond, msg):
            nonlocal ok
            print(("OK  " if cond else "FAIL") + " " + msg)
            ok = ok and cond
        items = {x["id"]: x for x in res["items"]}
        print(json.dumps(res["diag"], ensure_ascii=False))
        for x in res["items"]: print(" ", x["id"], x["date"], x["time"], x["type"], x.get("folder"), "dup=" + str(x.get("dupOf", "")), "del=" + str(x.get("deleted", False)), "rep=" + str(x.get("replied", False)), "|", x["message"][:60].replace("\n", " / "))
        ids = list(items)
        check(all("+" not in i and "/" not in i and "=" not in i for i in ids), "имена писем без + / =")
        import re
        check(all(re.match(r"^site-[A-Za-z0-9_-]{4,40}$", i) for i in ids), "имена писем проходят проверку записи")
        byk = [x for x in res["items"] if x["name"] == "Быкова Ольга"]
        stu = [x for x in res["items"] if x["name"] == "Ступников" and not x.get("dup")]
        check(len(byk) == 1 and byk[0]["date"] == "2026-10-10" and byk[0]["time"] == "11:26", "письмо Быковой 10.10 11:26")
        check(len(stu) == 1 and stu[0]["date"] == "2026-10-12" and stu[0]["time"] == "15:33", "письмо Ступникова 12.10 15:33")
        check(not any(x["date"] < "2026-10-09" for x in res["items"]), "старше периода нет")
        check(not any("Помощь" in x["subject"] or "FW" in x["subject"] for x in res["items"]), "не форма и пересланное не берутся")
        check(any(x["name"] == "Сидоров" and x["folder"] == "Нежелательная почта" for x in res["items"]), "письмо из «Нежелательной почты» найдено")
        check(any(x["name"] == "Кузнецова" for x in res["items"]), "письмо в подпапке «Входящих» от другого отправителя найдено по тексту")
        check(not any(x["name"] == "Удалённый" for x in res["items"]), "подпапка «Удаленных» не читается как активная")
        anna = [x for x in res["items"] if x["name"] == "Иванова Анна"]
        check(len(anna) == 2 and sum(1 for x in anna if x.get("dup")) == 1, "повтор Ивановой в «Удаленных» помечен как повтор")
        a0 = [x for x in anna if not x.get("dup")][0]
        check("[email]" in a0["message"] and "[телефон]" in a0["message"] and "anna@" not in a0["message"], "почта и телефон в тексте скрыты")
        check("\n" in a0["message"] and "ВНЕШНЯЯ" not in a0["message"] and "Лендинг" not in a0["message"], "текст письма без служебных строк, переносы сохранены")
        check(a0["type"] == "Благодарность" and a0["typeRaw"] == "thanks", "тип обращения thanks → Благодарность")
        check(a0.get("replied") is True, "Иванова: ответ найден по адресу без учёта регистра")
        dup3 = [x for x in res["items"] if x["name"] == "Ступников" and x.get("dup")]
        check(len(dup3) == 1 and dup3[0]["dupOf"] == stu[0]["id"], "повтор Ступникова через 7 минут помечен")
        check(stu[0].get("replied") is True, "Ступников отвечен")
        check(byk[0].get("replied") is True, "Быкова отвечена")
        pet = [x for x in res["items"] if x["name"] == "Петров Пётр"][0]
        check(not pet.get("replied"), "Петров: письмо отправлено раньше его письма, значит не отвечен")
        sid = [x for x in res["items"] if x["name"] == "Сидоров"][0]
        check(not sid.get("replied"), "Сидоров: ответ до периода не считается")
        koz = [x for x in res["items"] if x["name"] == "Козлова"]
        check(len(koz) == 1 and koz[0].get("deleted") and not koz[0].get("dup") and koz[0].get("replied"), "Козлова: удалённое письмо без пары, отмечено как удалённое, отвечено")
        check("site-OLDTODO" not in res["answered"], "ответ Козловой не засчитан второй раз старому письму")
        check(res["diag"]["complete"] is True, "чтение полное")
        check("email" not in a0 and "itemId" not in a0, "адрес почты не уходит из окна почты")
        check(set(res["answered"]) == set(x["id"] for x in res["items"] if x.get("replied")), "список отвеченных совпадает")
        rep = res.get("replies", {}).get(a0["id"], "")
        check(rep.startswith("Здравствуйте, Анна!") and "передадим врачам" in rep and "От:" not in rep and "Спасибо врачам" not in rep, "текст настоящего ответа Ивановой взят из «Отправленных» без цитаты")
        check("[телефон]" in rep and "gkb24@zdrav.mos.ru" in rep and "anna@" not in rep, "в ответе телефон скрыт, адрес больницы оставлен")
        kuz = [x for x in res["items"] if x["name"] == "Кузнецова"][0]
        krep = res.get("replies", {}).get(kuz["id"], "")
        check(kuz.get("replied") is True and krep.startswith("Здравствуйте! Спасибо") and "Хочу поблагодарить" not in krep, "ответ на другой адрес найден по переписке, текст без цитаты")
        urls = await pg.evaluate("() => window.__urls || []")
        check(len(urls) > 0 and all(u.startswith("/owa/GB24-press2@zdrav.mos.ru/") for u in urls), "читается только ящик пресс-службы, личный ящик не трогается")
        # вход: без ключа сеанса
        pg2 = await b.new_page(); await pg2.set_content("<html><body><input type=password style='width:100px'></body></html>")
        err = await pg2.evaluate("async () => { " + API + " ; try { await MAIL_API([], {}); return 'нет ошибки'; } catch (e) { return e.message; } }")
        check("нужен вход" in err, "без входа: «нужен вход в почту» (" + err + ")")
        # сессия истекла: 440
        await pg.evaluate("Object.defineProperty(document, 'cookie', { get: () => 'X-OWA-CANARY=OLD' , configurable: true})") if False else None
        pg3 = await b.new_page(); await pg3.set_content("<html><body>owa</body></html>")
        await pg3.evaluate(MOCK.replace("document.cookie = 'X-OWA-CANARY=CAN123';", "Object.defineProperty(document, 'cookie', { get: () => 'X-OWA-CANARY=EXPIRED' });"))
        err = await pg3.evaluate("async () => { " + API + " ; try { await MAIL_API([], {since:'2026-10-09'}); return 'нет ошибки'; } catch (e) { return e.message; } }")
        check("нужен вход" in err, "сессия истекла: «нужен вход в почту» (" + err + ")")
        print("ALL OK" if ok else "SOME FAILED")
        await b.close()
asyncio.run(main())
