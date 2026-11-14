# 12.11: «Сверка всех данных» — площадки → программа → отчёт → презентация → ответы; ✓/⚠ с цифрами и кнопкой. Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from pilot import CONNECT
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 1000}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500); await pg.evaluate(CONNECT, False); await pg.wait_for_timeout(6000)
        R = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'); await window.__otvReports.update(); await new Promise(r => setTimeout(r, 1200)); const st = window.__otvReports.state(); const d = st.start;
          const T = 'Тестовое письмо Ж31: благодарю врачей за помощь и внимание, всё прекрасно.';
          await db.collection('mail').doc('site-rc1').set({ date: d, time: '10:00', kind: 'thanks', text: T, status: 'todo', name: 'Тест' });
          await db.collection('registry').doc('site-rc1').set({ platform: 'Сайт', date: d, text: T, fullText: T, report: 'positive', reportRef: 'Позитив · Сайт больницы №1', reportWeek: st.start, source: 'auto' });
          window.__otvRecon.render(); await new Promise(r => setTimeout(r, 300));
          const rows = () => [...document.querySelectorAll('#ckRecon .rc-row')].map(x => (x.classList.contains('ok') ? 'ok' : 'warn') + ' ' + x.textContent);
          const a = rows();
          await db.collection('mail').doc('site-rc1').update({ status: 'done' });
          window.dispatchEvent(new CustomEvent('otv-write', { detail: { name: 'mail', id: 'site-rc1' } })); await new Promise(r => setTimeout(r, 1000));
          const b2 = rows();
          return { a, b: b2 }; }""")
        A, B = R['a'], R['b']
        ans_a = [x for x in A if 'Ответы:' in x]; ans_b = [x for x in B if 'Ответы:' in x]
        import re as _re
        cnt = lambda s: int((_re.search(r'без отметки «Ответ дан» (\d+)', s) or [0, 0])[1])
        res = [('сверка показывает 4 связки: площадки, отчёт, презентация, ответы', len(A) == 4 and any('Сбор отзывов' in x for x in A) and any('Отчёт в Google' in x for x in A) and any('Презентация' in x for x in A), A),
               ('письмо в отчёте без отметки «Ответ дан» — ⚠ в ответах', ans_a and ans_a[0].startswith('warn') and 'без отметки «Ответ дан»' in ans_a[0], ans_a),
               ('отметили «Ответ дан» — строка ответов пересчиталась', ans_a and ans_b and cnt(ans_b[0]) == cnt(ans_a[0]) - 1, (ans_a, ans_b)),
               ('без ошибок страницы', not errs, errs[:3])]
        for name, ok, info in res: print(('OK  ' if ok else 'FAIL') + ' ' + name, '' if ok else json.dumps(info, ensure_ascii=False)[:1500])
        await b.close(); print('ALL OK' if all(r[1] for r in res) else 'SOME FAILED')
asyncio.run(main())
