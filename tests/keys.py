# Клавиши в карточке ответа (05.11): ⌘/Ctrl+Enter — «Согласовать», ⌘/Ctrl+Shift+Enter — «Ещё вариант». Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 900}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        await pg.evaluate("window.__otvShowTab('pos')"); await pg.wait_for_timeout(500)
        ta = pg.locator('#tab-pos textarea[aria-label="Текст ответа"]').first
        before = await ta.input_value(); await ta.focus(); await pg.keyboard.press('Control+Shift+Enter'); await pg.wait_for_timeout(800)
        after = await ta.input_value()
        card = ta.locator('xpath=ancestor::article[1]')
        await ta.focus(); await pg.keyboard.press('Control+Enter'); await pg.wait_for_timeout(800)
        st = await card.text_content()
        ok1 = before != after
        ok2 = 'Согласован' in st or 'согласован' in st
        res = [(ok1, 'Ctrl+Shift+Enter — другой вариант ответа', [before[:60], after[:60]]), (ok2, 'Ctrl+Enter — ответ согласован', st[:300]), (not errs, 'без ошибок страницы', errs[:3])]
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else json.dumps(d, ensure_ascii=False))
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
