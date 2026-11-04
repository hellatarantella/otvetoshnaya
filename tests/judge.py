# Судья ответов: учится на ваших выборах и правках; лучший вариант — тот, что похож на ваши ответы, а не казённый. Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""async () => {
          const db = await window.__otvRt.use('db'), S = '\\nС уважением, администрация 24 Московской больницы', J = window.__otvJudge;
          let i = 0; const put = (o) => db.collection('kb').doc('j-' + (++i)).set(Object.assign({ kind: 'review', platform: 'Яндекс', status: 'published', updatedAt: new Date(Date.now() + i).toISOString() }, o));
          for (let k = 0; k < 6; k++) await put({ edited: true, situation: 'Спасибо кардиологии за лечение и заботу, всё было отлично ' + k, answer: 'Здравствуйте!\\nСпасибо, что выбрали нас. Ваши слова греют нам сердце. Желаем здоровья и всего самого доброго.' + S });
          await new Promise(r => setTimeout(r, 200));
          const req = { platform: 'Яндекс', review: 'Огромное спасибо кардиологии за заботу и лечение, всё отлично', tone: 'positive' };
          const her = 'Здравствуйте!\\nСпасибо, что выбрали нас. Ваши слова греют нам сердце. Желаем здоровья и всего самого доброго.' + S;
          const kaz = 'Здравствуйте!\\nВыражаем Вам искреннюю благодарность за Ваш отзыв. Данный отзыв является очень важным для нас. Желаем здоровья.' + S;
          const pick1 = J.best([kaz, her], req) === her;
          // генератор ставит первым вариант по вашему стилю
          const G = window.__otvGen, it = { platform: 'Яндекс', page: 'Карточка больницы', author: 'Олег', rating: 5, review: 'Спасибо кардиологии за заботу и лечение, всё было замечательно' };
          const a = G.answer(it, {});
          // правка черновика учит судью; веса меняются и сохраняются
          const w0 = J.weights();
          const gen = 'Здравствуйте!\\nБлагодарим за отзыв. Желаем здоровья и всего самого доброго.' + S;
          for (let k = 0; k < 3; k++) J.learn(gen, her, req);   // будто вы трижды выбрали короткий вариант — веса сдвигаются
          await db.collection('kb').doc('j-edit').set({ kind: 'review', platform: 'Яндекс', status: 'approved', edited: true, situation: 'Спасибо!', draft: gen, answer: her });
          const w1 = J.weights(), saved = (await db.collection('settings').doc('judge').get()).data();
          return { pick1, changed: JSON.stringify(w0) !== JSON.stringify(w1), saved: !!(saved && saved.w && saved.pairs >= 3), top: a && a.text, why: J.explain(her, req) };
        }""")
        res = []
        res.append((r['pick1'], 'судья выбирает ответ в вашем стиле, а не казённый', r))
        res.append((r['changed'] and r['saved'], 'судья учится на выборах и правках, веса сохраняются', r))
        res.append(('греют сердце' in (r['top'] or '') or 'выбрали нас' in (r['top'] or ''), 'первый вариант генератора — по-вашему', r['top']))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else json.dumps(d, ensure_ascii=False)[:1200])
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
