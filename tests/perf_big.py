# Скорость на большой базе (04.11): 1500 ответов в «Базе ответов» — вариант ответа быстрее 400 мс
# (было 1,4 с: перебор всей коллекции на каждой проверке «изменилась ли», обработка всех вариантов подряд). Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'); const words = 'спасибо врачу отделению кардиологии заботу внимание лечение палата чисто персонал вежливый операция хирург ждали долго приёмный'.split(' ');
          for (let i = 0; i < 1500; i++) { const t = Array.from({ length: 20 }, (_, k) => words[(i * 7 + k * 3) % words.length]).join(' ');
            await db.collection('kb').doc('p' + i).set({ kind: i % 7 ? 'review' : 'question', status: 'published', edited: i % 3 == 0, situation: t, answer: 'Здравствуйте!\\nСпасибо за отзыв ' + i + '. Ценим ваше доверие. Желаем здоровья и всего самого доброго.\\nС уважением, администрация 24 Московской больницы', platform: 'Яндекс' }); }
          await new Promise(r => setTimeout(r, 500)); const G = window.__otvGen;
          const its = [{ platform: 'Яндекс', page: 'Карточка больницы', author: 'Олег', rating: 5, review: 'Спасибо кардиологии за заботу и внимание, всё отлично' },
                       { platform: 'Яндекс', page: 'Карточка больницы', author: 'Анна', rating: 1, review: 'Долго ждали в приёмном, грубый персонал' }];
          G.answer(its[0], {}); let t0 = performance.now(), n = 0; for (let i = 0; i < 6; i++) { if (G.answer(its[i % 2], {})) n++; }
          return { ms: Math.round((performance.now() - t0) / 6), n }; }""")
        ok = r['ms'] < 400 and r['n'] == 6 and not errs
        print(('OK  ' if ok else 'FAIL') + ' вариант ответа на базе из 1500 ответов: ' + str(r['ms']) + ' мс', '' if ok else json.dumps([r, errs[:2]], ensure_ascii=False))
        # 300 новых отзывов за один сбор: интерфейс не пересобирается 300 раз (было 12 с), вкладка открывается быстро
        u = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'), S = 'С уважением, администрация 24 Московской больницы';
          window.__otvShowTab('pos'); const t0 = performance.now();
          for (let i = 0; i < 300; i++) await db.collection('answers').doc('x' + i).set({ platform: ['Яндекс', 'ПроДокторов', 'Сайт'][i % 3], page: 'Карточка больницы', date: '2026-11-02', author: 'Автор ' + i, n: i, status: 'pending', rating: 5, link: 'https://example.org', review: 'Спасибо врачам за заботу и внимание, всё было хорошо. Отзыв ' + i, answer: 'Здравствуйте!\\nСпасибо за отзыв. Желаем здоровья и всего самого доброго.\\n' + S });
          await new Promise(r => setTimeout(r, 0)); await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
          return { ms: Math.round(performance.now() - t0), cards: document.querySelectorAll('#tab-pos textarea').length }; }""")
        ok2 = u['ms'] < 3000 and u['cards'] >= 300
        print(('OK  ' if ok2 else 'FAIL') + ' 300 новых отзывов за сбор: интерфейс готов за ' + str(u['ms']) + ' мс', '' if ok2 else json.dumps(u))
        await b.close(); print('ALL OK' if ok and ok2 else 'SOME FAILED')
asyncio.run(main())
