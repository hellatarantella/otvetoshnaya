# 12.11: «опять в презентации отзывы очень разного объёма в похожих блоках». Три голоса недели и цитаты золотых
# карточек подбираются близкой длины; сохранённые голоса сильно разной длины подбираются заново и просят подтверждения. Данные выдуманные
import asyncio, sys, os, base64
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
SETUP = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'demo', 'deck_setup_week.js'), encoding='utf-8').read().split('\n', 1)[1]
FR = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'rb').read()).decode()
FB = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'rb').read()).decode()
SPREAD = """() => { const r = window.__otvDeckUi._state().res, D = r.D;
  const sp = a => a.length > 1 ? Math.max(...a) - Math.min(...a) : 0;
  const v = (D.review && D.review.voices || []).map(x => x.quote.length), g = (D.heroes && D.heroes.cards || []).map(x => (x.quote || '').length).filter(Boolean);
  return { v, g, sv: sp(v), sg: sp(g), need: r.need.map(n => n.text) }; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        await pg.evaluate(SETUP, [FR, FB])
        await pg.evaluate("window.__otvShowTab('deckw')"); await pg.wait_for_timeout(300)
        await pg.evaluate("window.__otvDeckUi.rebuild()"); await pg.wait_for_timeout(2500)
        res = []
        a = await pg.evaluate(SPREAD)
        res.append((a['sv'] <= 24 or any('разного объёма' in t for t in a['need']), 'три голоса — близкой длины (или программа прямо просит выбрать)', a))
        res.append((a['sg'] <= 24 or any('разного объёма' in t for t in a['need']), 'цитаты золотых карточек — близкой длины (или просьба выбрать)', a))
        # сохраняем голоса сильно разной длины (как на её скриншоте) — программа подбирает заново и просит подтвердить
        bad = await pg.evaluate("""async () => { const st = window.__otvDeckUi._state().res, vs = st.need.find(n => n.kind === 'voices'); if (!vs) return { skip: 'нет запроса голосов' };
          const opts = vs.options.map(o => ({ short: o.short, key: o.key, qs: o.quotes })).filter(o => o.qs.length);
          let pickL = null, pickS = [];
          for (const o of opts) { const L = o.qs.slice().sort((x, y) => y.length - x.length)[0]; if (!pickL || L.length > pickL.quote.length) pickL = { short: o.short, key: o.key, quote: L }; }
          pickS = opts.filter(o => o.key !== pickL.key).map(o => ({ short: o.short, key: o.key, quote: o.qs.slice().sort((x, y) => x.length - y.length)[0] })).sort((x, y) => x.quote.length - y.quote.length).slice(0, 2);
          const voices = [pickL].concat(pickS); const lens = voices.map(v => v.quote.length);
          if (Math.max(...lens) - Math.min(...lens) <= 28) return { skip: 'в демо нет цитат настолько разной длины', lens };
          const db = await window.__otvRt.use('db'), k = '2026-10-23', cur = (await db.collection('deckPicks').doc(k).get()).data() || {};
          cur.voices = voices; await db.collection('deckPicks').doc(k).set(cur); return { lens }; }""")
        if not bad.get('skip'):
            await pg.evaluate("window.__otvDeckUi.rebuild()"); await pg.wait_for_timeout(2500)
            c = await pg.evaluate(SPREAD)
            res.append((c['sv'] < max(bad['lens']) - min(bad['lens']) and any('сильно разного объёма' in t for t in c['need']), 'сохранённые голоса разной длины — подобраны близкие и просят подтвердить', [bad, c]))
        else: print('  (пропуск:', bad, ')')
        res.append((not errs, 'без ошибок на странице', errs[:3]))
        ok = True
        for good, name, info in res:
            print(('OK   ' if good else 'FAIL ') + name + ('' if good else '  ' + str(info)[:600])); ok = ok and good
        print("ALL OK" if ok else "FAILED"); await b.close(); sys.exit(0 if ok else 1)
asyncio.run(main())
