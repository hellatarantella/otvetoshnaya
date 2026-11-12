# 12.11: данные отчёта изменились — презентация недели пересобирается сама, даже когда её вкладка закрыта. Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from pilot import CONNECT
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 1000}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500); await pg.evaluate(CONNECT, False); await pg.wait_for_timeout(5000)
        R = await pg.evaluate("""async () => {
          window.__otvShowTab('deckw'); await new Promise(r => setTimeout(r, 1500));
          const S = () => window.__otvDeckUi._state(); const n0 = S().rebuilds, p0 = S().res && S().res.numbers && S().res.numbers.pos;
          window.__otvShowTab('check'); await new Promise(r => setTimeout(r, 300));   // вкладка презентации закрыта
          const st = window.__otvReports.state(); const d = st.start.split('-').reverse().join('.');
          window.__gsExtraPos = [{ platform: 'Яндекс', num: 9, date: d, dept: 'ГКБ 24', doctor: '—', text: 'Тестовый отзыв Ж41: спасибо всем сотрудникам больницы.', full: 'Тестовый отзыв Ж41: спасибо всем сотрудникам больницы.' }];
          await window.__otvReports.update(); await new Promise(r => setTimeout(r, 1500));
          const rep = window.__otvReports.state().positive.length;
          return { n0, n1: S().rebuilds, p0, p1: S().res && S().res.numbers && S().res.numbers.pos, rep }; }""")
        res = [('отчёт изменился — презентация пересобралась сама при закрытой вкладке', R['n1'] > R['n0'], R),
               ('цифры презентации = отчёт', R['p1'] == R['rep'] and R['p1'] == (R['p0'] or 0) + 1, R),
               ('без ошибок страницы', not errs, errs[:3])]
        for name, ok, info in res: print(('OK  ' if ok else 'FAIL') + ' ' + name, '' if ok else json.dumps(info, ensure_ascii=False))
        await b.close(); print('ALL OK' if all(r[1] for r in res) else 'SOME FAILED')
asyncio.run(main())
