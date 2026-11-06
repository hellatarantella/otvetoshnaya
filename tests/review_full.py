# 05.11: «отзывы целиком». Длинный отзыв в карточке не сворачивается и без кнопки «Показать полностью» — на всех вкладках
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1100, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(2000)
        r = await pg.evaluate("""() => { const q = [...document.querySelectorAll('blockquote.review')];
          return { n: q.length, clamp: q.filter(x => x.classList.contains('clamp')).length,
                   more: [...document.querySelectorAll('button.link')].filter(x => /Показать полностью/.test(x.textContent) && !x.hidden && x.offsetParent).length,
                   cut: q.filter(x => { const t = x.querySelector('.txt'); return t && t.scrollHeight > t.clientHeight + 2; }).length }; }""")
        res = [(r['n'] > 0 and r['clamp'] == 0 and r['more'] == 0 and r['cut'] == 0, 'отзывы целиком: не свёрнуты, без «Показать полностью»', r),
               (not errs, 'без ошибок страницы', errs[:3])]
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else json.dumps(d, ensure_ascii=False))
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
