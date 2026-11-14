# 12.11: строка в отчёте есть, а запись программы потеряла «в отчёте» (была исключена как «вопрос») — восстанавливается
# по тексту строки, а не показывается как «лишняя»; «Ждут решения» = ровно то, что в списке «Нужна проверка». Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from pilot import CONNECT
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 1000}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500); await pg.evaluate(CONNECT, False); await pg.wait_for_timeout(5000)
        R = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'); const st = window.__otvReports.state();
          const T = 'Тестовое письмо Ж61: благодарю врачей отделения за чуткость, внимательность и профессионализм.';
          const add = (iso, d) => { const x = new Date(iso + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
          const dd = add(st.start, -5);
          await db.collection('registry').doc('site-lost1').set({ platform: 'Сайт', date: dd, text: T, fullText: T, report: 'excluded', reason: 'Не отзыв: вопрос', reportRef: '', reportWeek: st.start, source: 'auto', arrivedAt: dd + 'T08:00:00.000Z' });
          window.__gsExtraPos = [{ platform: 'Сайт больницы', num: 1, date: dd.split('-').reverse().join('.'), dept: 'ГКБ 24', doctor: '—', text: T, full: T }];
          await window.__otvReports.update(); await new Promise(r => setTimeout(r, 1200));
          const r = (await db.collection('registry').doc('site-lost1').get()).data();
          const todo = [...document.querySelectorAll('#ckRecon .rc-row.warn')].map(x => x.textContent).join(' | ');
          const m = /ждут решения в «Нужна проверка» \\(ниже\\): (\\d+)/.exec(todo); const cnt = m ? +m[1] : 0;
          const cards = document.querySelectorAll('#ckCheck .ck-card').length;
          return { rep: r.report, ref: r.reportRef, orphan: /Ж61|в программе нет/.test(todo) && /Сайт больницы №1/.test(todo), cnt, cards }; }""")
        res = [('запись восстановлена по строке отчёта (Позитив), а не названа лишней', R['rep'] == 'positive' and 'Позитив' in R['ref'] and not R['orphan'], R),
               ('«Ждут решения» = число карточек в «Нужна проверка»', R['cnt'] == R['cards'], R),
               ('без ошибок страницы', not errs, errs[:3])]
        for name, ok, info in res: print(('OK  ' if ok else 'FAIL') + ' ' + name, '' if ok else json.dumps(info, ensure_ascii=False))
        await b.close(); print('ALL OK' if all(r[1] for r in res) else 'SOME FAILED')
asyncio.run(main())
