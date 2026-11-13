# 13.11: «если отзыв на странице больницы на ПроДокторов или ещё где — ответ не должен повторять предыдущие 3 ответа».
# Три последних ответа на странице больницы занимают ходовые фразы; новый ответ (черновик и «Ещё вариант») их не повторяет. Данные выдуманные
import asyncio, sys, json, re
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(2000)
        r = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'), S = '\\nС уважением, администрация 24 Московской больницы';
          const prev = ['Здравствуйте!\\nСпасибо за тёплый отзыв. Рады, что вам у нас понравилось. Ценим ваше доверие и всегда готовы помочь.' + S,
                        'Здравствуйте!\\nСпасибо за отзыв и доверие к нашей больнице. Мы стараемся, чтобы пациентам было у нас комфортно. Желаем здоровья и всего самого доброго.' + S,
                        'Здравствуйте!\\nСпасибо за добрые слова. Рады, что всё прошло хорошо. Всегда готовы помочь.' + S];
          for (let i = 0; i < 3; i++) await db.collection('answers').doc('pp' + i).set({ platform: 'ПроДокторов', page: 'Страница больницы', review: 'Отзыв номер ' + i + ' о больнице, всё понравилось, спасибо', status: 'published', publishedAt: '2026-11-1' + i + 'T10:00:00Z', answer: prev[i] });
          await new Promise(r => setTimeout(r, 400));
          const it = { platform: 'ПроДокторов', page: 'Страница больницы', review: 'Лежала в отделении, всё понравилось, спасибо врачам и медсёстрам.', rating: 5, author: '' };
          const outs = [window.__otvGen.answer(it).text]; for (let i = 0; i < 5; i++) outs.push(await window.__otvVariant({ kind: 'answer', platform: it.platform, page: it.page, review: it.review, author: '', rating: 5 }));
          const sents = t => (t.replace(/^Здравствуйте[^\\n]*\\n/, '').replace(/С уважением.*$/, '').match(/[^.!?]+[.!?]*/g) || []).map(x => x.trim().toLowerCase()).filter(x => x.length > 12 && !/^желаем/.test(x));
          const used = new Set(prev.flatMap(sents)); return outs.map(o => ({ o, rep: sents(o).filter(x => used.has(x)) })); }""")
        bad = [x for x in r if x['rep']]
        res = [(not bad, 'черновик и варианты не повторяют фраз трёх предыдущих ответов на странице больницы', bad[:2])]
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        ok = True
        for good, name, info in res: print(('OK   ' if good else 'FAIL ') + name + ('' if good else '  ' + json.dumps(info, ensure_ascii=False)[:600])); ok = ok and good
        print('ALL OK' if ok else 'FAILED'); await b.close(); sys.exit(0 if ok else 1)
asyncio.run(main())
