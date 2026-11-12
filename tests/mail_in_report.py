# 12.11: письмо, которое программа внесла в отчёт, видно в «Позитиве» программы. Пересмотр вида письма
# (после обновления правил) больше не сбрасывает запись «в отчёте» и не уводит письмо из «Позитива». Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 1000}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        R = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'); const d = new Date().toISOString().slice(0, 10);
          // письмо в отчёте как благодарность, а вид письма — «вопрос» (так бывало после смены правил)
          const T = 'Тестовое письмо Ж21: хочу выразить огромную благодарность хирургу, всё прошло хорошо. Можно ли передать спасибо?';
          await db.collection('mail').doc('site-r1').set({ date: d, time: '10:00', kind: 'question', text: T, status: 'todo', name: 'Тест' });
          await db.collection('registry').doc('site-r1').set({ platform: 'Сайт', date: d, text: T, fullText: T, report: 'positive', reportRef: 'Позитив · Сайт больницы №4', reportWeek: '', source: 'auto' });
          await window.__otvTidyDrafts(); await new Promise(r => setTimeout(r, 400));
          const m = (await db.collection('mail').doc('site-r1').get()).data(), r = (await db.collection('registry').doc('site-r1').get()).data();
          window.__otvShowTab('answers'); await new Promise(r => setTimeout(r, 600));
          const box = document.getElementById('mailbox'); const shown = box && !box.hidden && /Ж21/.test(box.textContent);
          return { kind: m.kind, ref: r.reportRef, rep: r.report, shown }; }""")
        F = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db');
          const T = 'Тестовое письмо Ж22: благодарю врачей отделения за внимательное отношение и помощь.';
          await db.collection('weeks').doc('2026-10-30').set({ start: '2026-10-30', end: '2026-11-05', period: '30.10–05.11.2026', positive: [{ platform: 'Сайт больницы', date: '31.10.2026', text: T, full: T }], negative: [] });
          await db.collection('registry').doc('site-r2').set({ platform: 'Сайт', date: '2026-10-31', text: T, fullText: T, report: 'pending', reportRef: '', reportWeek: '2026-10-30', source: 'auto' });
          await new Promise(r => setTimeout(r, 400)); const n = await window.__otvPastWeeks.repair(); const r = (await db.collection('registry').doc('site-r2').get()).data(); return [n, r.report, r.reportRef]; }""")
        res0 = [('стёртое «в отчёте» восстановлено по снимку закрытой недели', F[0] >= 1 and F[1] == 'positive' and 'Позитив' in F[2], F)]
        res = res0 + [('пересмотр не сбрасывает «в отчёте»', R['ref'] == 'Позитив · Сайт больницы №4' and R['rep'] == 'positive', R),
               ('вид письма приведён к отчёту — благодарность', R['kind'] == 'thanks', R),
               ('письмо из отчёта видно в «Позитиве» программы', R['shown'], R),
               ('без ошибок страницы', not errs, errs[:3])]
        for name, ok, info in res: print(('OK  ' if ok else 'FAIL') + ' ' + name, '' if ok else json.dumps(info, ensure_ascii=False))
        await b.close(); print('ALL OK' if all(r[1] for r in res) else 'SOME FAILED')
asyncio.run(main())
