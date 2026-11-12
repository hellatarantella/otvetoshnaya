# «Нужна проверка» (12.11): решающая кнопка говорит, что будет сделано. Выбрали «Не вносить» — кнопка «Не вносить»,
# причина необязательна; «Позитив»/«Негатив» — «Внести в …». Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from pilot import CONNECT
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 1000}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500); await pg.evaluate(CONNECT, False); await pg.wait_for_timeout(6000)   # дождаться, пока первое обновление отчёта закончится
        await pg.evaluate("""async () => { const st = window.__otvReports.state(); const db = await window.__otvRt.use('db');
          await db.collection('registry').doc('ck1').set({ platform: 'Яндекс', date: st.start, report: 'pending', reason: 'Нужна проверка: врача нет в списке сотрудников', text: 'Тестовый отзыв Ж7: Зиновию Аркадьевичу признательна за консультацию в среду, всё объяснил толково.', suggest: { tone: 'positive', dept: '', doctor: '' } });
          window.dispatchEvent(new CustomEvent('otv-write', { detail: { name: 'registry', id: 'ck1' } })); await new Promise(r => setTimeout(r, 800)); }""")
        res = []
        card = pg.locator('#ckCheck .ck-card', has_text='Ж7')
        res.append(('карточка «Нужна проверка» показана', await card.count() == 1, ''))
        lab = lambda: card.locator('.ck-row > button.btn').inner_text()
        await card.locator("button.chip:has-text('Позитив')").click(); l1 = await lab()
        await card.locator("button.chip:has-text('Негатив')").click(); l2 = await lab()
        await card.locator("button.chip:has-text('Не вносить')").click()
        await pg.evaluate("window.dispatchEvent(new CustomEvent('otv-write', { detail: { name: 'registry', id: 'x' } }))"); await pg.wait_for_timeout(600)   # фоновая перерисовка
        card = pg.locator('#ckCheck .ck-card', has_text='Ж7'); l3 = await lab()
        res.append(('кнопка: «Внести в «Позитив»» → «Внести в «Негатив»» → «Не вносить»', [l1, l2, l3] == ['Внести в «Позитив»', 'Внести в «Негатив»', 'Не вносить'], [l1, l2, l3]))
        await card.locator('.ck-row > button.btn').click()
        await pg.wait_for_timeout(1500)
        d = await pg.evaluate("async () => { const db = await window.__otvRt.use('db'); const r = (await db.collection('registry').doc('ck1').get()).data(); return [r.report, r.reason, r.decision && r.decision.tone]; }")
        res.append(('«Не вносить» без причины — решение записано сразу', d[0] == 'excluded', d))
        res.append(('без ошибок страницы', not errs, errs[:3]))
        for name, ok, info in res: print(('OK  ' if ok else 'FAIL') + ' ' + name, '' if ok else json.dumps(info, ensure_ascii=False))
        await b.close(); print('ALL OK' if all(r[1] for r in res) else 'SOME FAILED')
asyncio.run(main())
