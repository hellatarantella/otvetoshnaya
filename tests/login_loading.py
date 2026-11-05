# 05.11: кабинет ДокТу грузит свой сценарий до 2 минут — окно входа стояло пустым («чёрный экран»).
# Сценарий окна входа (DIAG_INIT из src-tauri/src/lib.rs) показывает плашку «Страница ещё загружается — N с», пока на
# странице нет текста, и убирает её, как только страница отрисовалась. Плашка не попадает в текст страницы.
import asyncio, sys, os, re, json
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, 'src-tauri', 'src', 'lib.rs'), encoding='utf-8').read()
INIT = re.search(r'const DIAG_INIT: &str = r#"(.*?)"#;', src, re.S).group(1)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script(INIT)
        await pg.set_content('<html><body><div id="app"></div></body></html>')
        await pg.evaluate(INIT)   # set_content не перезапускает init-скрипты: запускаем вручную
        res = []
        await pg.wait_for_timeout(3500)
        a = await pg.evaluate("() => { const x = document.getElementById('otv-loading'); return { shown: !!x, text: x ? x.textContent : '', body: document.body.innerText.trim().length }; }")
        res.append((a['shown'] and 'загружается' in a['text'] and a['body'] == 0, 'пустая страница: видна плашка «ещё загружается», в текст страницы она не попадает', a))
        await pg.evaluate("document.getElementById('app').innerText = 'Имя пользователя: Пароль: Войти Забыли пароль Зарегистрироваться'")
        await pg.wait_for_timeout(1500)
        g = await pg.evaluate("() => !!document.getElementById('otv-loading')")
        res.append((not g, 'страница отрисовалась — плашка убрана', g))
        # страница с текстом сразу — плашки нет вовсе
        pg2 = await b.new_page(); await pg2.set_content('<html><body><p>Отзывы о больнице: много текста на странице сразу видно.</p></body></html>'); await pg2.evaluate(INIT)
        await pg2.wait_for_timeout(3000)
        c = await pg2.evaluate("() => !!document.getElementById('otv-loading')")
        res.append((not c, 'обычная страница — без плашки', c))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else json.dumps(d, ensure_ascii=False)[:600])
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
