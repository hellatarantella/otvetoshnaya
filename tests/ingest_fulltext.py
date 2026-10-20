# Сбор: полный текст отзыва никогда не заменяется обрезанным началом; новый более полный текст принимается
import asyncio, sys
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
FULL = "Добрый день! Меня зовут Мария. " + "Очень благодарна доктору за внимание и заботу. " * 40 + "Сама больница чистая, всем рекомендую."
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); await pg.goto(P); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""async (FULL) => {
          const db = await window.__otvRt.use('db'); const get = async id => (await db.collection('registry').doc(id).get()).data();
          const it = (id, t) => ({ id, platform: 'ПроДокторов', published: true, date: '2026-10-18', text: t, author: 'М', rating: 5 });
          await window.__otvIngest([it('pd-x1', FULL)]);
          const a = (await get('pd-x1')).fullText.length;
          await window.__otvIngest([it('pd-x1', FULL.slice(0, 1500))]);           // площадка отдала начало
          const b = (await get('pd-x1')).fullText.length;
          await window.__otvIngest([it('pd-x1', FULL.slice(0, 300) + '…')]);      // начало с многоточием
          const c = (await get('pd-x1')).fullText.length;
          await window.__otvIngest([it('pd-x2', FULL.slice(0, 1500))]);
          await window.__otvIngest([it('pd-x2', FULL)]);                          // потом дочитался целиком
          const d = (await get('pd-x2')).fullText.length;
          await window.__otvIngest([it('pd-x3', 'Старый текст отзыва, который пациент потом исправил полностью')]);
          await window.__otvIngest([it('pd-x3', 'Исправленный')]);                // другой текст, не начало: принимаем
          const e = (await get('pd-x3')).fullText;
          return { a, b, c, d, e, full: FULL.length };
        }""", FULL)
        ok = r['a'] == r['full'] and r['b'] == r['full'] and r['c'] == r['full'] and r['d'] == r['full'] and r['e'] == 'Исправленный'
        print(('OK  ' if ok else 'FAIL') + ' полный текст сохраняется, обрезанное начало его не заменяет', r if not ok else '')
        await b.close(); print('ALL OK' if ok else 'SOME FAILED')
asyncio.run(main())
