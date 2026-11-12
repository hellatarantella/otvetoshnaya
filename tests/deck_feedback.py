# 05.11: «нажимаю в блоке презы подтвердить — ниче не меняется, выглядит глючно». Теперь нажатие сразу видно в строке
# («Сохраняю…»), после пересборки — «✓ Сохранено · обновился слайд N» и подсветка слайда; отказ — причина прямо в строке.
# Данные выдуманные
import asyncio, sys, os, base64, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
SETUP = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'demo', 'deck_setup_week.js'), encoding='utf-8').read().split('\n', 1)[1]
FR = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'rb').read()).decode()
FB = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'rb').read()).decode()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        await pg.evaluate(SETUP, [FR, FB])
        await pg.evaluate("window.__otvShowTab('deckw')"); await pg.wait_for_timeout(300)
        await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'); await db.collection('deckPicks').doc('2026-10-23').set({}); }""")
        await pg.evaluate("window.__otvDeckUi.rebuild()"); await pg.wait_for_timeout(2500)
        res = []
        st = await pg.evaluate("""() => { const rows = [...document.querySelectorAll('#tab-deckw .deck-needs > .deck-need')];
          const n = document.querySelectorAll('#tab-deckw .deck-slide[data-n]').length;
          return { rows: rows.length, keyed: rows.filter(r => r.dataset.k).length, slidesNumbered: n }; }""")
        res.append((st['rows'] > 0 and st['keyed'] == st['rows'], 'запросы — карточками, у каждого свой ключ', st))
        res.append((st['slidesNumbered'] > 0, 'у слайдов в предпросмотре есть номер', st))
        # нажатие: сразу «Сохраняю…» в строке, кнопки неактивны
        r = await pg.evaluate("""async () => { const row = [...document.querySelectorAll('#tab-deckw .deck-needs > .deck-need')].find(x => [...x.querySelectorAll('button')].some(b => /Подтвердить|Выбрать отзыв/.test(b.textContent)));
          if (!row) return null; const k = row.dataset.k; const bt = [...row.querySelectorAll('button')].find(b => /Подтвердить|Выбрать отзыв/.test(b.textContent)); bt.click();
          await new Promise(r => requestAnimationFrame(r));
          const now = { saving: row.classList.contains('is-saving'), msg: (row.querySelector('.deck-need-msg') || {}).textContent || '', dis: bt.disabled };
          await new Promise(r => setTimeout(r, 2500));
          const done = document.querySelector('#tab-deckw .deck-done');
          const left = [...document.querySelectorAll('#tab-deckw .deck-needs > .deck-need')].filter(x => x.dataset.k === k).length;
          return { k, now, done: done ? done.textContent : '', left, lit: document.querySelectorAll('#tab-deckw .deck-slide.just-changed').length }; }""")
        res.append((r and r['now']['saving'] and r['now']['dis'] and 'Сохраняю' in r['now']['msg'], 'нажатие видно сразу: «Сохраняю…», кнопка неактивна', r))
        res.append((r and r['done'].startswith('✓') and ('слайд' in r['done']) and r['left'] == 0, 'после пересборки: «✓ Сохранено · слайд N», запрос закрыт', r))
        res.append((r and (r['lit'] > 0 or 'так и стоит' in r['done']), 'изменившийся слайд подсвечен (или сказано, что так и стоит)', r))
        # отказ: причина прямо в строке
        bad = await pg.evaluate("""async () => { const row = [...document.querySelectorAll('#tab-deckw .deck-need')].find(x => x.querySelector('input.deck-in') && [...x.querySelectorAll('button')].some(b => b.textContent === 'Подтвердить цитату'));
          if (!row) { const d = document.querySelector('#tab-deckw .deck-extra'); d.open = true; await new Promise(r => setTimeout(r, 50)); }
          const row2 = row || [...document.querySelectorAll('#tab-deckw .deck-extra .deck-need')].find(x => x.querySelector('input.deck-in') && [...x.querySelectorAll('button')].some(b => b.textContent === 'Подтвердить цитату'));
          if (!row2) return { skip: true }; const inp = row2.querySelector('input.deck-in'); inp.value = 'Коротко'; inp.dispatchEvent(new Event('input'));
          [...row2.querySelectorAll('button')].find(b => b.textContent === 'Подтвердить цитату').click(); await new Promise(r => setTimeout(r, 100));
          const m = row2.querySelector('.deck-need-msg'); return { msg: m ? m.textContent : '', cls: m ? m.className : '' }; }""")
        res.append((bad.get('skip') or ('bad' in bad['cls'] and 'не принята' in bad['msg']), 'отказ — с причиной прямо в строке', bad))
        # «Пересмотреть выбор»: строка остаётся — в ней «✓ Сохранено»
        ex = await pg.evaluate("""async () => { await window.__otvDeckUi.rebuild(); await new Promise(r => setTimeout(r, 2000));
          const d = document.querySelector('#tab-deckw .deck-extra'); if (!d) return { skip: true }; d.open = true; d.dispatchEvent(new Event('toggle'));
          const row = [...d.querySelectorAll('.deck-need')].find(x => [...x.querySelectorAll('button')].some(b => /^(Подтвердить|Подтвердить голоса|Выбрать отзыв недели)$/.test(b.textContent))); if (!row) return { skip: true };
          const k = row.dataset.k; [...row.querySelectorAll('button')].find(b => /^(Подтвердить|Подтвердить голоса|Выбрать отзыв недели)$/.test(b.textContent)).click();
          await new Promise(r => setTimeout(r, 2500));
          const again = [...document.querySelectorAll('#tab-deckw .deck-extra .deck-need')].find(x => x.dataset.k === k);
          return { k, open: !!(document.querySelector('#tab-deckw .deck-extra') || {}).open, msg: again && again.querySelector('.deck-need-msg') ? again.querySelector('.deck-need-msg').textContent : '' }; }""")
        res.append((ex.get('skip') or (not ex['open'] and ex['msg'].startswith('✓')), '«Пересмотреть выбор»: после сохранения — «✓ Сохранено», блок свёрнут (12.11: «не убираются блоки редактора после решений»)', ex))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else json.dumps(d, ensure_ascii=False)[:1200])
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
