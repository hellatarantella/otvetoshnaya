# Разнообразие (05.11): пачка похожих отзывов за один сбор получает разные ответы — программа учитывает черновики в очереди,
# а не только опубликованные; на одной площадке одинаковых ответов нет, фразы почти не повторяются. Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        R = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'), G = window.__otvGen, out = [];
          const revs = ['Спасибо всем, всё отлично!', 'Большое спасибо больнице, всё хорошо.', 'Спасибо за лечение, всё понравилось.', 'Всё отлично, спасибо персоналу.',
                        'Хорошая больница, спасибо.', 'Спасибо, остались довольны.', 'Благодарю всех сотрудников, всё отлично.', 'Всё хорошо, спасибо большое.'];
          for (let i = 0; i < revs.length; i++) {
            const it = { platform: 'ПроДокторов', page: 'Страница больницы', author: 'Гость', rating: 5, review: revs[i] };
            const a = G.answer(it, {}); out.push(a.text);
            await db.collection('answers').doc('vb' + i).set({ platform: 'ПроДокторов', page: 'Страница больницы', author: 'Гость', date: '05.11.2026', status: 'pending', rating: 5, review: revs[i], answer: a.text, draft: a.text });
          }
          const body = t => t.split('\\n').slice(1, -1).join(' ');
          const sents = out.flatMap(t => body(t).match(/[^.!?]+[.!?]*/g) || []).map(x => x.trim().toLowerCase()).filter(x => x.length > 12 && !/^желаем здоровья/.test(x));
          const cnt = {}; sents.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
          return { uniqTexts: new Set(out.map(body)).size, n: out.length, maxRepeat: Math.max(...Object.values(cnt)), uniqShare: Object.keys(cnt).length / sents.length, sample: out.map(body) }; }""")
        ok = not any('близким' in t for t in R['sample']) and R['uniqTexts'] == R['n'] and R['maxRepeat'] <= 3 and R['uniqShare'] >= 0.55 and not errs
        print(('OK  ' if ok else 'FAIL') + ' 8 похожих отзывов за один сбор: %d разных ответов, фраза повторяется не больше %d раз, уникальных фраз %d%%' % (R['uniqTexts'], R['maxRepeat'], round(R['uniqShare'] * 100)), '' if ok else json.dumps([R, errs[:2]], ensure_ascii=False))
        await b.close(); print('ALL OK' if ok else 'SOME FAILED')
asyncio.run(main())
