# 04.11: все цитаты презентации недели — из отчёта этой недели и не из прошлых презентаций; своя цитата не из этой недели
# отклоняется сразу с причиной; «Отзыв недели» по умолчанию не забирает единственный отзыв врача из золотых карточек
# (иначе карточке нечем заполнить цитату — пустое поле). Данные выдуманные
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
        res = []
        # прошлая неделя: в её презентации была цитата, которая есть и в этой неделе (отзыв повторился)
        R = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'); const st0 = window.__otvDeckUi._state().res;
          const q0 = st0.D.review.quote; await db.collection('deckPicks').doc('2026-10-16').set({ reviewText: { quote: q0 } });
          await window.__otvDeckUi.rebuild(); await new Promise(r => setTimeout(r, 2500));
          const st = window.__otvDeckUi._state().res, D = st.D;
          const all = [D.review.quote].concat(D.review.voices.map(v => v.quote), D.heroes.cards.map(c => c.quote)).filter(Boolean);
          const opts = st.need.concat(st.choices).filter(n => n.kind === 'quote').flatMap(n => n.options || []);
          return { q0, all, reused: all.includes(q0) || opts.includes(q0) }; }""")
        res.append((not R['reused'], 'цитата из прошлой презентации не попадает ни на слайды, ни в варианты', R))
        F = await pg.evaluate("""async () => { const st = window.__otvDeckUi._state().res; const n = st.choices.find(c => c.kind === 'quote');
          return { other: n.stale('Прекрасный врач из другой недели, всем рекомендую от души'), mine: n.stale(window.__otvDeckUi._state().res.D.heroes.cards[0].quote || '') }; }""")
        res.append((F['other'] == 'не из отчёта этой недели' and F['mine'] == '', 'своя цитата не из этой недели отклоняется с причиной; цитата из отзыва этой недели — нет', F))
        # все цитаты на слайдах есть в отзывах этой недели и не повторяются
        U = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'); const w = (await db.collection('weeks').doc('2026-10-23').get()).data();
          const norm = t => String(t || '').toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9]+/g, ' ').trim();
          const texts = w.positive.map(r => norm(r.full || r.text)), D = window.__otvDeckUi._state().res.D;
          const all = [D.review.quote].concat(D.review.voices.map(v => v.quote), D.heroes.cards.map(c => c.quote)).filter(Boolean);
          return { all, notInWeek: all.filter(q => !texts.some(t => t.includes(norm(q).slice(0, 30)))), dup: all.length - new Set(all.map(q => norm(q).slice(0, 30))).size }; }""")
        res.append((not U['notInWeek'] and U['dup'] == 0, 'все цитаты на слайдах — из отзывов этой недели, без повторов', U))
        # врач из золотых карточек с одним отзывом (дубль на другой площадке) — не «Отзыв недели» по умолчанию
        G = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'); const w = (await db.collection('weeks').doc('2026-10-23').get()).data();
          const st0 = window.__otvDeckUi._state().res, who = st0.D.review.short, rows = w.positive.filter(r => new RegExp(who.split(' ')[0].slice(0, 5)).test(r.doctor));
          // оставляем у врача «Отзыва недели» один отзыв и дублируем его на другой площадке: n = 2, отзыв один
          const keep = rows[0]; w.positive = w.positive.filter(r => rows.indexOf(r) < 0 || r === keep).concat([Object.assign({}, keep, { platform: keep.platform === 'Яндекс' ? 'ПроДокторов' : 'Яндекс' })]);
          await db.collection('weeks').doc('2026-10-23').set(w); await db.collection('deckPicks').doc('2026-10-23').set({});
          await window.__otvDeckUi.rebuild(); await new Promise(r => setTimeout(r, 2500));
          const st = window.__otvDeckUi._state().res, gold = st.D.heroes.cards.map(c => c.short);
          return { who, now: st.D.review.short, gold, emptyCard: st.D.heroes.cards.filter(c => !c.quote).map(c => c.short) }; }""")
        res.append((not G['emptyCard'] and (G['who'] not in G['gold'] or G['now'] != G['who']), 'единственный отзыв врача из золотых карточек не уходит в «Отзыв недели» — у карточки есть цитата', G))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else json.dumps(d, ensure_ascii=False)[:2000])
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
