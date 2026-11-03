# Все вкладки программы открываются без ошибок страницы, в каждой видимые кнопки нажимаются без ошибок
# (кнопки, которые шлют что-то наружу или удаляют, не нажимаем). Данные выдуманные
import asyncio, sys, os
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
TABS = ["pos", "neg", "check", "sources", "kb", "model", "appeal", "ethics", "thanks", "question", "qa", "deckw", "deckm"]
SKIP = r"Опубликовать|Удалить|Сбросить|Начать нов|Отправить|Подключить|Выгрузить|Перенести|Скачать|Загрузить|Вставить|Войти|Обновить отч|Собрать|Сохранить|Отключить|Скопировать"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        report = []
        for t in TABS:
            n0 = len(errs)
            ok = await pg.evaluate("t => { try { window.__otvShowTab(t); return true; } catch (e) { return String(e); } }", t)
            await pg.wait_for_timeout(400)
            clicked = await pg.evaluate("""([t, skip]) => {
              const panel = document.getElementById('tab-' + t); if (!panel) return -1;
              const re = new RegExp(skip, 'i'); let n = 0;
              for (const b of [...panel.querySelectorAll('button')]) {
                if (!b.offsetParent || b.disabled || re.test(b.textContent)) continue;
                try { b.click(); n++; } catch (e) {}
                if (n >= 12) break;
              }
              return n;
            }""", [t, SKIP])
            await pg.wait_for_timeout(600)
            report.append((t, ok, clicked, errs[n0:]))
        bad = [r for r in report if r[1] is not True or r[3]]
        for r in report: print(('OK  ' if r[1] is True and not r[3] else 'FAIL') + ' вкладка ' + r[0] + ': нажато кнопок ' + str(r[2]), r[3][:2] if r[3] else '')
        await b.close(); print('ALL OK' if not bad else 'SOME FAILED')
asyncio.run(main())
