# Договорённость (12.11): отзыв без текста (на модерации, «текст появится после публикации») нигде не фиксируем:
# не записывается в реестр, ответы и тревоги, старые такие записи убираются, на экране не показываются. Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1200, 'height': 900}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        R = await pg.evaluate("""async () => {
          const db = await window.__otvRt.use('db'); const has = async (c, id) => (await db.collection(c).doc(id).get()).exists;
          const d = new Date().toISOString().slice(0, 10);
          await window.__otvIngest([{ id: 'pd-tl1', platform: 'ПроДокторов', published: true, date: d, text: '', rating: 1, low: true },
                                     { id: 'pd-tl2', platform: 'ПроДокторов', published: false, date: d, text: '   ', rating: 5 }]);
          const skipped = !(await has('registry', 'pd-tl1')) && !(await has('registry', 'pd-tl2')) && !(await has('alerts', 'pd-tl1'));
          // старые записи без текста: не в отчёте — убираются; уже в отчёте — остаются
          await db.collection('registry').doc('pd-old1').set({ platform: 'ПроДокторов', date: d, text: '', fullText: '', report: 'pending', reportRef: '', source: 'auto' });
          await db.collection('answers').doc('pd-old1').set({ platform: 'ПроДокторов', review: '', status: 'pending' });
          await db.collection('registry').doc('pd-old2').set({ platform: 'ПроДокторов', date: d, text: '', fullText: '', report: 'positive', reportRef: 'Позитив · ПроДокторов №3', source: 'auto' });
          const n = await window.__otvPurgeTextless();
          const purged = !(await has('registry', 'pd-old1')) && !(await has('answers', 'pd-old1')) && (await has('registry', 'pd-old2'));
          // появился текст — записывается как обычный отзыв
          await window.__otvIngest([{ id: 'pd-tl1', platform: 'ПроДокторов', published: true, date: d, text: 'Теперь текст опубликован: спасибо врачу за помощь.', rating: 5 }]);
          const later = await has('registry', 'pd-tl1');
          return { skipped, n, purged, later }; }""")
        res = [('отзыв без текста не записывается ни в реестр, ни в тревоги', R['skipped'], R),
               ('старые записи без текста убраны (кроме уже внесённых в отчёт)', R['purged'] and R['n'] == 1, R),
               ('появился текст — отзыв записан как обычный', R['later'], R)]
        await pg.evaluate("window.__otvShowTab('check')"); await pg.wait_for_timeout(600)
        body = await pg.inner_text('body')
        res.append(('на экране нет «Текст появится после публикации»', 'Текст появится после публикации' not in body, ''))
        res.append(('без ошибок страницы', not errs, errs[:3]))
        for name, ok, info in res: print(('OK  ' if ok else 'FAIL') + ' ' + name, '' if ok else json.dumps(info, ensure_ascii=False))
        await b.close(); print('ALL OK' if all(r[1] for r in res) else 'SOME FAILED')
asyncio.run(main())
