# 04.11: «Подтвердить цитату» не срабатывал — отзыв недели дублировался на другой площадке, программа предлагала цитату
# из дубля и потом сама её отбрасывала. Теперь такие цитаты не предлагаются, а впечатанная вручную отклоняется сразу с причиной.
# Каждое «Подтвердить» убирает запрос. Данные выдуманные
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
        await pg.evaluate("window.__otvDeckUi.rebuild()"); await pg.wait_for_timeout(2500)
        # дублируем каждый отзыв на другой площадке (так бывает: один и тот же текст на ПроДокторов и на Яндексе)
        await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'); const w = (await db.collection('weeks').doc('2026-10-23').get()).data();
          w.positive = w.positive.concat(w.positive.map(r => Object.assign({}, r, { platform: r.platform === 'Яндекс' ? 'ПроДокторов' : 'Яндекс' })));
          await db.collection('weeks').doc('2026-10-23').set(w); await db.collection('deckPicks').doc('2026-10-23').set({}); }""")
        await pg.evaluate("window.__otvDeckUi.rebuild()"); await pg.wait_for_timeout(2500)
        res = []
        st = await pg.evaluate("""() => { const r = window.__otvDeckUi._state().res, used = [];
          const qn = r.need.filter(n => n.kind === 'quote');
          return { n: qn.length, bad: qn.filter(n => n.options.some(o => (n.used || []).some(u => u.indexOf(o.toLowerCase().replace(/ё/g,'е').replace(/[^а-яa-z0-9]+/g,' ').trim().slice(0,30)) >= 0))).map(n => n.short) }; }""")
        res.append((not st['bad'], 'в вариантах цитат нет фраз из отзывов, которые уже стоят в другом блоке (в том числе из дублей)', st))
        # нажимаем «Подтвердить цитату» на каждом запросе — каждый раз запрос пропадает
        loops = []
        for i in range(6):
            r = await pg.evaluate("""async () => { const rows = [...document.querySelectorAll('#tab-deckw .deck-need')].filter(x => /Цитата для карточки [^(]*: выберите/.test(x.textContent));
              if (!rows.length) return null; const row = rows[0], who = row.textContent.slice(0, 60);
              const btn = [...row.querySelectorAll('button')].find(b => b.textContent === 'Подтвердить цитату'); btn.click();
              await new Promise(r => setTimeout(r, 2500));
              const still = [...document.querySelectorAll('#tab-deckw .deck-need')].filter(x => x.textContent.slice(0, 60) === who).length;
              return { who, still }; }""")
            if r is None: break
            loops.append(r)
            if r['still']: break
        res.append((loops and all(x['still'] == 0 for x in loops), 'каждое «Подтвердить цитату» срабатывает: запрос пропадает', loops))
        # вписанная вручную цитата из отзыва другого блока — отказ сразу, с причиной
        M = await pg.evaluate("""async () => { await window.__otvDeckUi.rebuild(); await new Promise(r => setTimeout(r, 2500));
          const st = window.__otvDeckUi._state().res, used = []; let txt = '';
          (st.D.review && st.D.review.quote) && (txt = st.D.review.quote);
          const d = [...document.querySelectorAll('#tab-deckw .deck-extra')].find(x => /Пересмотреть выбор/.test(x.textContent)); if (!d) return { skip: true }; d.open = true;
          const row = [...d.querySelectorAll('.deck-need')].find(r => /Цитата для карточки/.test(r.textContent)); if (!row || !txt) return { skip: true };
          const inp = row.querySelector('input.deck-in, textarea'); if (!inp) return { skip: true }; inp.value = txt; inp.dispatchEvent(new Event('input'));
          [...row.querySelectorAll('button')].find(b => /Подтвердить/.test(b.textContent)).click(); await new Promise(r => setTimeout(r, 300));
          const bar = [...document.querySelectorAll('.otv-bar, #otvBar, .bar')].map(x => x.textContent).join(' ');
          return { bar: bar.slice(0, 300) }; }""")
        res.append((M.get('skip') or 'другом блоке' in M.get('bar', ''), 'цитату из отзыва недели в карточку не примет — скажет почему', M))
        # все запросы (кроме фото) по «Подтвердить» пропадают — и в неделе, и в месяце
        for tab, ui in (('deckw', '__otvDeckUi'), ('deckm', '__otvDeckUiM')):
            await pg.evaluate("t => window.__otvShowTab(t)", tab); await pg.wait_for_timeout(300)
            await pg.evaluate("u => window[u].rebuild()", ui); await pg.wait_for_timeout(2500)
            stuck = []
            for i in range(8):
                r = await pg.evaluate("""async (tab) => { const rows = [...document.querySelectorAll('#tab-' + tab + ' .deck-need')].filter(x => !x.closest('details') && !x.querySelector('input[type=file]'));
                  const row = rows.find(x => [...x.querySelectorAll('button')].some(b => /Подтвердить/.test(b.textContent))); if (!row) return null;
                  const head = row.textContent.slice(0, 50); [...row.querySelectorAll('button')].filter(b => /Подтвердить/.test(b.textContent))[0].click();
                  await new Promise(r => setTimeout(r, 2500));
                  return { head, still: [...document.querySelectorAll('#tab-' + tab + ' .deck-need')].filter(x => !x.closest('details') && x.textContent.slice(0, 50) === head).length }; }""", tab)
                if r is None: break
                if r['still']: stuck.append(r); break
            res.append((not stuck, tab + ': каждое «Подтвердить» убирает свой запрос', stuck))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else json.dumps(d, ensure_ascii=False)[:1200])
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
