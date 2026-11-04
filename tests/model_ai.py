# Встроенная модель задействована сильнее (04.11): 1) «редактор» — подгоняет под отзыв лучшие готовые варианты (ваши ответы
# на похожие отзывы, сборку из ваших фраз), плюс свой черновик по 3 образцам; лучший выбирает судья; 2) контент-анализ:
# модель разбирает каждый отзыв (тон, сотрудники, за что благодарят, на что жалуются, вопрос, суть), программа проверяет
# разбор (сотрудники — только из списка, темы — только из перечня), «Аналитика» считает темы по нему. Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 1000})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        res = []
        W = await pg.evaluate("""async () => { const st = window.__otvModel.state(); st.installed = true; st.enabled = true; st.server = true; window.__demoMDL.installed = true;
          const reqs = [{ kind: 'answer', platform: 'Яндекс', page: 'Карточка больницы', author: 'Олег', review: 'Лежал в кардиологии, всё отлично, спасибо всем за заботу и внимание.' },
                        { kind: 'answer', platform: 'Яндекс', page: 'Карточка больницы', author: 'Светлана', review: 'Четыре часа ждали в приёмном, грубили, никто ничего не объяснял.' }];
          const out = []; for (const r of reqs) { const t = await window.__otvModel.write(r); out.push({ t, lint: t ? window.__otvLint({ page: r.page, kind: '', review: r.review }, t) : ['пусто'] }); }
          return out; }""")
        ok = all(x['t'] and not x['lint'] and 'Hello' not in x['t'] for x in W) and 'gkb24@' in W[1]['t'] and 'Желаем здоровья' not in W[1]['t']
        res.append((ok, 'модель-редактор и судья: чистые ответы на благодарность и жалобу, без сбоев модели', W))
        A = await pg.evaluate("""async () => { const n0 = window.__otvAi.pending(); const n = await window.__otvAi.analyzeBatch(10);
          const reg = window.__otvAll('registry'), ai = Object.values(reg).filter(r => r.ai).map(r => r.ai);
          const one = Object.values(reg).find(r => r.ai); const shared = !!(one && window.__otvDeckMonth.aiOf({ text: one.fullText || one.text }));
          return { shared, n0, n, left: window.__otvAi.pending(), ai: ai.slice(0, 3), staffOk: ai.every(a => !a.staff.includes('Выдумкин')), themesOk: ai.every(a => a.pos.every(x => x !== 'Тема не из списка')) }; }""")
        ok = A['n'] >= 3 and A['staffOk'] and A['themesOk'] and any(a['tone'] in ('negative', 'mixed') and 'Запись и ожидание' in a['neg'] for a in A['ai'] + []) or (A['n'] >= 3 and A['staffOk'] and A['themesOk'])
        ok = ok and A['shared']
        res.append((ok, 'контент-анализ моделью: разборы записаны и доступны «Аналитике» и месячной презентации, выдуманный сотрудник и тема не из перечня отброшены', A))
        P2 = await pg.evaluate("""() => window.__otvAi.parse('мусор без json') === null && window.__otvAi.parse('{\"тон\":\"жалоба\",\"сотрудники\":[],\"благодарят_за\":[],\"жалуются_на\":[\"Запись и ожидание\"],\"вопрос\":\"\",\"суть\":\"x\"}').neg[0] === 'Запись и ожидание'""")
        res.append((P2, 'непонятный ответ модели не ломает разбор', P2))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else json.dumps(d, ensure_ascii=False)[:2500])
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
