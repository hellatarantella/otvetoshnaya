# «Обезьяний» тест на большой базе (05.11): 300 отзывов к ответу, 1500 ответов в базе, 200 записей реестра; на каждой вкладке и подвкладке нажимаются все видимые кнопки и ссылки-кнопки,
# заполняются поля — программа не должна падать (ошибки страницы, необработанные отказы). Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
TABS = ["pos", "neg", "qa", "check", "deckw", "deckm", "analytics", "thanks", "question", "kb", "appeal", "ethics"]
SKIP = "Отключить|Удалить|Скачать|Начать новый отчёт|Собрать отзывы|PDF|PPTX|Опубликовать"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 1000})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.add_init_script("window.addEventListener('unhandledrejection', e => console.error('REJECT ' + (e.reason && e.reason.message || e.reason)))")
        pg.on('console', lambda m: m.type == 'error' and 'REJECT' in m.text and errs.append(m.text[:200]))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'), S = 'С уважением, администрация 24 Московской больницы';
          for (let i = 0; i < 300; i++) await db.collection('answers').doc('mb' + i).set({ platform: ['Яндекс', 'ПроДокторов', 'Сайт', '2ГИС'][i % 4], page: i % 5 ? 'Карточка больницы' : 'Страница врача: Соколова А.В.', date: '0' + (1 + i % 5) + '.11.2026', author: 'Автор ' + i, status: ['pending', 'approved', 'published', 'fix'][i % 4], rating: i % 7 ? 5 : 1, kind: i % 11 ? '' : 'question', review: (i % 7 ? 'Спасибо врачам за заботу ' : 'Долго ждали, грубили ') + i, answer: 'Здравствуйте!\\nСпасибо за отзыв.\\n' + S });
          for (let i = 0; i < 1500; i++) await db.collection('kb').doc('mk' + i).set({ kind: i % 9 ? 'review' : 'question', status: 'published', edited: i % 4 == 0, situation: 'Отзыв номер ' + i + ' спасибо врачам', answer: 'Здравствуйте!\\nСпасибо за отзыв ' + i + '.\\n' + S, platform: 'Яндекс' });
          for (let i = 0; i < 200; i++) await db.collection('registry').doc('mr' + i).set({ platform: 'Яндекс', text: 'Отзыв реестра ' + i + ' спасибо', date: '2026-11-0' + (1 + i % 4), tone: i % 6 ? 'pos' : 'neg' }); }""")
        clicked = 0
        for t in TABS:
            await pg.evaluate("t => window.__otvShowTab(t)", t); await pg.wait_for_timeout(500)
            n = await pg.evaluate("""(skip) => { const re = new RegExp(skip); const panel = [...document.querySelectorAll('.tab-panel')].find(x => !x.hidden); if (!panel) return 0;
              let k = 0; const btns = [...panel.querySelectorAll('button, summary')].filter(x => x.offsetParent && !x.disabled && !re.test(x.textContent));
              for (const x of btns.slice(0, 60)) { try { x.click(); k++; } catch (e) {} }
              [...panel.querySelectorAll('textarea, input[type=text], input:not([type])')].filter(x => x.offsetParent).slice(0, 10).forEach(x => { x.value = x.value + ' проверка'; x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); });
              return k; }""", SKIP)
            clicked += n; await pg.wait_for_timeout(700)
        await pg.wait_for_timeout(1500)
        ok = not errs
        print(('OK  ' if ok else 'FAIL') + ' нажато ' + str(clicked) + ' кнопок на ' + str(len(TABS)) + ' вкладках на большой базе — без ошибок', '' if ok else json.dumps(errs[:5], ensure_ascii=False))
        await b.close(); print('ALL OK' if ok else 'SOME FAILED')
asyncio.run(main())
