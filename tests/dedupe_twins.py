# 13.11: «2 раза попал отзыв в согласованные» — один отзыв Google под двумя номерами (у второй записи имя автора и другая дата).
# Новый сбор такой отзыв второй раз не заводит; уже записанный дубль — «не отвечаем: дубль», не публикуется и в отчёт не идёт. Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
T = "Попала по плановой операции в отделение. Была приятно удивлена уважительным и внимательным отношением к пациентам, начиная с врачей и заканчивая младшим персоналом. Огромное спасибо всем!"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(2000)
        r = await pg.evaluate("""async (T) => { const db = await window.__otvRt.use('db'), now = new Date().toISOString();
          await db.collection('registry').doc('google-a1').set({ platform: 'Google', date: '2026-11-05', author: '', rating: 5, text: T.slice(0, 300), fullText: T, report: 'positive', reportRef: 'Google!5', arrivedAt: now });
          await db.collection('registry').doc('google-b2').set({ platform: 'Google', date: '2026-11-06', author: 'Ольга Б.', rating: 5, text: T.slice(0, 300), fullText: T, report: 'pending', reportRef: '', arrivedAt: now });
          await db.collection('answers').doc('google-a1').set({ platform: 'Google', review: T, status: 'approved', answer: 'Здравствуйте!\\nСпасибо.\\nС уважением, администрация 24 Московской больницы' });
          await db.collection('answers').doc('google-b2').set({ platform: 'Google', review: T, status: 'approved', answer: 'Здравствуйте, Ольга!\\nСпасибо.\\nС уважением, администрация 24 Московской больницы' });
          await new Promise(r => setTimeout(r, 400)); const n = await window.__otvDedupe(); await new Promise(r => setTimeout(r, 400));
          const a = (await db.collection('answers').doc('google-b2').get()).data(), k = (await db.collection('answers').doc('google-a1').get()).data(), g = (await db.collection('registry').doc('google-b2').get()).data();
          return { n, b2: a.status, a1: k.status, rep: g.report }; }""", T)
        res = [(r['b2'] == 'skip' and r['a1'] == 'approved' and r['rep'] == 'dup', 'уже записанный дубль: второй — «не отвечаем: дубль», первый остаётся, в отчёт дубль не идёт', r)]
        # уже отмеченный дубль, стоящий в отчёте, не находится снова (раньше публикация зацикливалась на поиске дублей)
        r2 = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'); await db.collection('registry').doc('google-b2').update({ report: 'positive', reportRef: 'Google!6' });
          await new Promise(r => setTimeout(r, 300)); const n1 = await window.__otvDedupe(); await new Promise(r => setTimeout(r, 300)); const n2 = await window.__otvDedupe(); return { n1, n2 }; }""")
        res.append((r2['n2'] == 0, 'повторный поиск дублей ничего не находит — публикация не зацикливается', r2))
        # публикация идёт: одобренный ответ с «Опубликовать» уходит в работу, а не висит
        r3 = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db');
          await db.collection('answers').doc('google-a1').update({ publishRequested: new Date().toISOString(), publishError: '' }); window.__otvPubNow();
          for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 500)); const a = (await db.collection('answers').doc('google-a1').get()).data(); if (!a.publishRequested || a.status === 'published') return { done: true, a: [a.status, a.publishError] }; }
          return { done: false }; }""")
        res.append((r3['done'], 'после поиска дублей публикация запускается и доходит до площадки', r3))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        ok = True
        for good, name, info in res: print(('OK   ' if good else 'FAIL ') + name + ('' if good else '  ' + json.dumps(info, ensure_ascii=False))); ok = ok and good
        print('ALL OK' if ok else 'FAILED'); await b.close(); sys.exit(0 if ok else 1)
asyncio.run(main())
