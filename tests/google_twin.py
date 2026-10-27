# Сбор: отзыв Google, уже собранный и отвеченный, не заводится второй раз в «Новые», когда у автора поменялась служебная строка
import asyncio, sys
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); await pg.goto(P); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""async () => {
          const db = await window.__otvRt.use('db');
          const T = 'Хочу поблагодарить врачей приёмного отделения за быстрый и внимательный приём, всё объяснили';
          const it = (id, au, t, extra) => Object.assign({ id, platform: 'Google', published: true, date: '2026-10-20', text: t, author: au, rating: 5 }, extra || {});
          await window.__otvIngest([it('google-old', '12 отзывов · 3 фото', T, { answered: true, reply: 'Здравствуйте! Спасибо за добрые слова о наших врачах.' })]);
          await new Promise(r => setTimeout(r, 300));
          const res = await window.__otvIngest([it('google-new', 'Анна Петрова', T, { date: '2026-10-21', answered: true, reply: 'Здравствуйте! Спасибо за добрые слова о наших врачах.' })]);
          // другой отзыв с тем же началом, другой автор: это НЕ двойник
          await window.__otvIngest([it('google-other', 'Олег', T.slice(0, 50) + ' и ещё медсёстрам', { rating: 5 })]);
          const reg = window.__otvAll('registry');
          return { added: res.added, hasNew: !!reg['google-new'], oldAu: (reg['google-old'] || {}).author, other: !!reg['google-other'] };
        }""")
        ok = r['added'] == 0 and not r['hasNew'] and r['oldAu'] == 'Анна Петрова' and r['other']
        print(('OK  ' if ok else 'FAIL') + ' двойник Google не заводится, автор исправляется; чужой отзыв с похожим началом заводится', r if not ok else '')
        await b.close(); print('ALL OK' if ok else 'SOME FAILED')
asyncio.run(main())
