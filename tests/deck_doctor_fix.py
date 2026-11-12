# 12.11: «не скачивается презентация» — в графе «Врач» фамилия, которой нет в «Списке врачей» (или таких двое):
# раньше выгрузка молча блокировалась замечанием, теперь — вопрос с выбором; после выбора запрос уходит, «Пересмотреть выбор» свёрнут. Данные выдуманные
import asyncio, sys, os, base64, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
SETUP = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'demo', 'deck_setup_week.js'), encoding='utf-8').read().split('\n', 1)[1]
FR = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'rb').read()).decode()
FB = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'rb').read()).decode()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 900}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500); await pg.evaluate(SETUP, [FR, FB])
        await pg.evaluate("window.__otvShowTab('deckw')"); await pg.wait_for_timeout(300)
        await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'); const w = (await db.collection('weeks').doc('2026-10-23').get()).data();
          w.positive.push({ platform: 'Яндекс', date: '24.10.2026', dept: 'Хирургия', doctor: 'Неизвестнова', text: 'Спасибо доктору за внимательное отношение и помощь', full: 'Спасибо доктору за внимательное отношение и помощь' });
          await db.collection('weeks').doc('2026-10-23').set(w); }""")
        await pg.evaluate("window.__otvDeckUi.rebuild()"); await pg.wait_for_timeout(2500)
        res = []
        a = await pg.evaluate("() => { const r = window.__otvDeckUi._state().res; return { need: r.need.filter(n => n.kind === 'doctor').map(n => n.tok), bad: r.checks.filter(c => c.bad).map(c => c.text), sel: !!document.querySelector('#tab-deckw .deck-need select[aria-label^=\"Врач\"]') }; }")
        res.append(('Неизвестнова' in a['need'] and a['sel'] and not any('Списке врачей' in t for t in a['bad']), 'неизвестный врач — вопрос с выбором, а не глухое замечание', a))
        r = await pg.evaluate("""async () => { const row = [...document.querySelectorAll('#tab-deckw .deck-need')].find(x => /Неизвестнова/.test(x.textContent));
          const se = row.querySelector('select'); se.value = '-'; [...row.querySelectorAll('button')].find(b => b.textContent === 'Подтвердить').click();
          await new Promise(r => setTimeout(r, 3000)); const st = window.__otvDeckUi._state().res;
          const ex = document.querySelector('#tab-deckw .deck-extra'); return { left: st.need.filter(n => n.kind === 'doctor').length, open: ex ? ex.open : null }; }""")
        res.append((r['left'] == 0 and not r['open'], 'после выбора запрос ушёл, «Пересмотреть выбор» свёрнут', r))
        # неделя до 12.11: фото «Отделений», загруженные тогда (без отметки недели), подставляются — прошлую презентацию можно скачать
        L = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'), src = window.__otvDeckUi._state().res.D.where.photos[0].src;
          const all = await db.collection('deckPhotos').get(); for (const d of all.docs) { const v = d.data(); if (v.kind === 'dept') { await db.collection('deckPhotos').doc(d.id).set(Object.assign({}, v, { week: '' })); } }
          await new Promise(r => setTimeout(r, 500)); await window.__otvDeckUi.rebuild(); await new Promise(r => setTimeout(r, 2000));
          const st = window.__otvDeckUi._state().res; return { photos: st.D.where.photos.filter(Boolean).length, slots: st.D.where.slots.length, need: st.need.filter(n => n.slot === 'dept').length }; }""")
        res.append((L['photos'] == L['slots'] and L['need'] == 0, 'прошлая неделя (до 12.11): фото «Отделений» того времени на месте, ничего не просит', L))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        ok = True
        for good, name, info in res: print(('OK   ' if good else 'FAIL ') + name + ('' if good else '  ' + json.dumps(info, ensure_ascii=False)[:500])); ok = ok and good
        print('ALL OK' if ok else 'FAILED'); await b.close(); sys.exit(0 if ok else 1)
asyncio.run(main())
