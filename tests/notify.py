# Уведомления о негативе в MAX: токен → привязка → формат #нампишут, каждый отзыв один раз, старые не шлём,
# без сети — повтор позже; позитив не шлём. Данные выдуманные, MAX поддельный
import asyncio, sys
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1100, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        res = []
        f = await pg.evaluate("""() => window.__otvNotifyFmt.format({ platform: 'Яндекс', date: '2026-11-07', rating: 1, author: 'Иван П.', text: 'Долго ждали в приёмном, никто не подошёл.' })""")
        ok = f == "#нампишут\nПлощадка: Яндекс\nДата отзыва: 7 ноября\nОценка 1/5\nНик пользователя: Иван П.\n\nДолго ждали в приёмном, никто не подошёл."
        res.append(('формат строго по образцу', ok, f))
        f2 = await pg.evaluate("""() => window.__otvNotifyFmt.format({ platform: 'Сайт', date: '2026-10-26', author: 'Иванова Анна Петровна', contactEmail: 'a@example.com', contactPhone: '+7 (900) 111-22-33', text: 'Выписку не выдали.' })""")
        res.append(('письмо с сайта — строго по образцу', f2 == "#нампишут\nПлощадка: Сайт\nДата отзыва: 26 октября\n\nИмя: Иванова Анна Петровна\nEmail: a@example.com\nТелефон: +7 (900) 111-22-33\n\nВыписку не выдали.", f2))
        await pg.evaluate("window.__otvShowTab('sources')"); await pg.wait_for_timeout(300)
        await pg.fill('#alertBox .ntf-tok', 'bad'); await pg.click("#alertBox button:has-text('Сохранить')"); await pg.wait_for_timeout(300)
        t = await pg.inner_text('#alertBox')
        res.append(('плохой токен — понятная ошибка', 'не принял токен' in t and await pg.locator('#alertBox .ntf-tok').count() == 1, t[-200:]))
        await pg.fill('#alertBox .ntf-tok', 'tok123'); await pg.click("#alertBox button:has-text('Сохранить')"); await pg.wait_for_timeout(400)
        t = await pg.inner_text('#alertBox')
        res.append(('токен принят, на экране его нет', 'Тестовый бот' in t and 'tok123' not in await pg.inner_html('#alertBox'), t[-200:]))
        await pg.click("#alertBox button:has-text('Привязать')"); await pg.wait_for_timeout(300)
        t = await pg.inner_text('#alertBox')
        res.append(('без сообщения боту — подсказка', 'напишите «привет»' in t, t[-200:]))
        await pg.evaluate("window.__maxUpdates = { updates: [{ update_type: 'message_created', message: { sender: { user_id: 777, name: 'Анастасия' }, recipient: { chat_id: 55 }, body: { text: 'привет' } } }] }")
        await pg.click("#alertBox button:has-text('Привязать')"); await pg.wait_for_timeout(500)
        t = await pg.inner_text('#alertBox'); sent = await pg.evaluate("window.__maxSent || []")
        res.append(('привязка: бот пишет ей, приветствие ушло', 'Включено' in t and len(sent) == 1 and sent[0]['userId'] == 777, (t[-200:], sent)))
        # отзывы: свежий негатив, старый негатив (до включения), свежий, но 30-дневной давности, уже отправленный
        await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'); const now = new Date().toISOString(), old = '2020-01-01T00:00:00Z', d = now.slice(0, 10);
          await db.collection('alerts').doc('ya-1').set({ platform: 'Яндекс', date: d, rating: 1, author: 'А. Б.', text: 'Хамство в регистратуре', detectedAt: now, status: 'new' });
          await db.collection('alerts').doc('ya-old').set({ platform: 'Яндекс', date: d, rating: 2, author: 'В', text: 'старое', detectedAt: old, status: 'new' });
          await db.collection('alerts').doc('ya-30').set({ platform: '2ГИС', date: '2026-01-01', rating: 1, author: 'Г', text: 'давний', detectedAt: now, status: 'new' }); }""")
        await pg.wait_for_timeout(800)
        sent = await pg.evaluate("window.__maxSent")
        texts = [x['text'] for x in sent[1:]]
        res.append(('ушёл только свежий негатив, один раз', len(texts) == 1 and 'Хамство в регистратуре' in texts[0] and texts[0].startswith('#нампишут\nПлощадка: Яндекс'), texts))
        await pg.evaluate("window.__otvNotify.flush()"); await pg.wait_for_timeout(400)
        n1 = len(await pg.evaluate("window.__maxSent"))
        res.append(('повторно не шлёт', n1 == 2, n1))
        await pg.evaluate("""async () => { window.__maxDown = true; const db = await window.__otvRt.use('db');
          await db.collection('alerts').doc('dt-2').set({ platform: 'ДокТу', date: new Date().toISOString().slice(0, 10), rating: null, author: '', text: 'Не дозвониться', detectedAt: new Date().toISOString(), status: 'new' }); }""")
        await pg.wait_for_timeout(600)
        t = await pg.inner_text('#alertBox')
        await pg.evaluate("window.__maxDown = false; window.__otvNotify.flush()"); await pg.wait_for_timeout(600)
        sent = await pg.evaluate("window.__maxSent")
        res.append(('нет сети — предупреждение и повтор', 'Не отправилось' in t and len(sent) == 3 and 'Оценка не указана' in sent[2]['text'] and 'Ник пользователя: не указан' in sent[2]['text'], (t[-160:], sent[-1:])))
        await pg.evaluate("window.__maxUpdates = { updates: [ { update_type: 'message_created', message: { sender: { user_id: 777, name: 'Анастасия' }, recipient: { chat_id: 55, chat_type: 'dialog' } } }, { update_type: 'message_created', message: { sender: { user_id: 888, name: 'Коллега' }, recipient: { chat_id: 56, chat_type: 'dialog' } } }, { update_type: 'bot_added', chat_id: -100, chat_title: 'Отзывы ГКБ', user: { user_id: 777 } } ] }")
        await pg.click("#alertBox button:has-text('Добавить получателей')"); await pg.wait_for_timeout(500)
        t = await pg.inner_text('#alertBox'); n0 = len(await pg.evaluate("window.__maxSent"))
        await pg.evaluate("""async () => { const db = await window.__otvRt.use('db');
          await db.collection('alerts').doc('site-9').set({ platform: 'Сайт', date: new Date().toISOString().slice(0, 10), rating: null, author: 'Петрова Ольга Ивановна', contactEmail: 'test@example.com', contactPhone: '+7 (900) 000-00-00', text: 'Жалоба на регистратуру', detectedAt: new Date().toISOString(), status: 'new' }); }""")
        await pg.wait_for_timeout(800)
        sent = await pg.evaluate("window.__maxSent"); last = sent[n0:]
        import re as _re
        want_site = "\n\nИмя: Петрова Ольга Ивановна\nEmail: test@example.com\nТелефон: +7 (900) 000-00-00\n\nЖалоба на регистратуру"
        res.append(('несколько получателей: коллега и общий чат; письмо с сайта — по образцу с именем, email и телефоном', 'Коллега' in t and 'Отзывы ГКБ' in t and len(last) == 3 and all(_re.match(r'#нампишут\nПлощадка: Сайт\nДата отзыва: \d{1,2} [а-я]+$', x['text'].split('\n\n')[0]) and x['text'].endswith(want_site) for x in last) and sorted(str(x['userId']) for x in last) == ['777', '888', 'None'], (t[-300:], last)))
        kept = await pg.evaluate("async () => { const db = await window.__otvRt.use('db'); const d = (await db.collection('alerts').doc('site-9').get()).data(); return [d.contactEmail, d.contactPhone, !!d.notifiedAt]; }")
        res.append(('контакты автора письма стёрты после отправки', kept == ['', '', True], kept))
        n0 = len(await pg.evaluate("window.__maxSent"))
        await pg.evaluate("""async () => { const old = new Date(Date.now() - 13 * 3600e3).toISOString(), recent = new Date(Date.now() - 5 * 3600e3).toISOString();
          window.__otvSrcHealth = () => [{ name: 'Яндекс', ok: false, okAt: old, needLogin: true }, { name: '2ГИС', ok: false, okAt: recent }];
          const d = new Date(); d.setHours(20, 30, 0, 0);
          await window.__otvNotify.health(d); await window.__otvNotify.health(d);
          window.__dailyBefore = (window.__maxSent || []).filter(x => /сводка/.test(x.text)).length;
          window.__otvSrcHealth = () => [{ name: 'Яндекс', ok: true, okAt: new Date().toISOString() }, { name: '2ГИС', ok: true, okAt: new Date().toISOString() }];
          await window.__otvNotify.health(d); }""")
        h = [x['text'] for x in (await pg.evaluate("window.__maxSent"))[n0:]]
        warn = [x for x in h if 'Яндекс не читается — нужен вход' in x]; back = [x for x in h if 'Яндекс снова читается' in x]; daily = [x for x in h if 'сводка за сутки' in x]
        g2 = [x for x in h if '2ГИС не читается' in x]
        res.append(('минимум уведомлений: «не читается» только после 12 часов и один раз, без «снова читается» и без вечерней сводки по умолчанию', len(warn) == 3 and not back and not daily and not g2, h))
        sch = await pg.evaluate("""() => { const D = (s) => new Date(s), f = window.__otvAutoDue, L = 0, now = (s) => D(s).getTime();
          return {
            satMorning: !!f(D('2026-11-14T09:05:00'), L, ''),
            satMorningDone: !!f(D('2026-11-14T09:40:00'), now('2026-11-14T09:05:00'), '2026-11-14@9'),
            satNoon: !!f(D('2026-11-14T13:00:00'), L, ''),
            sunEvening: !!f(D('2026-11-15T20:10:00'), L, ''),
            sunLateCatchup: !!f(D('2026-11-15T22:30:00'), L, ''),
            sunNight: !!f(D('2026-11-15T23:30:00'), L, ''),
            wedEvery30: !!f(D('2026-11-11T14:00:00'), now('2026-11-11T13:20:00'), ''),
            wedTooSoon: !!f(D('2026-11-11T14:00:00'), now('2026-11-11T13:50:00'), ''),
            wedMorningSlot: !!f(D('2026-11-11T09:01:00'), now('2026-11-11T08:50:00'), '') }; }""")
        want = {'satMorning': True, 'satMorningDone': False, 'satNoon': False, 'sunEvening': True, 'sunLateCatchup': True, 'sunNight': False, 'wedEvery30': True, 'wedTooSoon': False, 'wedMorningSlot': True}
        res.append(('автосбор: каждый день 9:00 и 20:00 (догоняет 3 часа) + будни каждые 30 минут', sch == want, sch))
        await pg.evaluate("""() => window.__demoEmit('source-diag', { id: 'mail', diag: JSON.stringify({ url: 'https://owa.mos.ru/owa/auth/expiredpassword.aspx?url=x', text: 0, errs: [] }) })""")
        await pg.wait_for_timeout(300)
        t = await pg.inner_text('#srcBox'); w = await pg.evaluate("(document.getElementById('srcWarn') || {}).innerText || ''")
        res.append(('почта на странице смены пароля — прямо говорим «смените пароль»', 'Смените пароль' in t and 'истёк срок пароля' in t and 'смените пароль' in w, (t[-300:], w)))
        res.append(('без ошибок на странице', not errs, errs))
        for name, ok, info in res: print(('OK  ' if ok else 'FAIL') + ' ' + name, '' if ok else info)
        await b.close(); print('ALL OK' if all(r[1] for r in res) else 'SOME FAILED')
asyncio.run(main())
