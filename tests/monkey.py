# «Обезьяний» тест: на каждой вкладке и подвкладке нажимаются все видимые кнопки и ссылки-кнопки,
# заполняются поля — программа не должна падать (ошибки страницы, необработанные отказы). Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
TABS = ["pos", "neg", "qa", "check", "deckw", "deckm", "analytics", "thanks", "question", "kb", "appeal"]
SKIP = "Отключить|Удалить|Скачать|Начать новый отчёт|Собрать отзывы|PDF|PPTX|Опубликовать"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 1000})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        await pg.add_init_script("window.addEventListener('unhandledrejection', e => console.error('REJECT ' + (e.reason && e.reason.message || e.reason)))")
        pg.on('console', lambda m: m.type == 'error' and 'REJECT' in m.text and errs.append(m.text[:200]))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.dismiss()))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        clicked = 0
        for t in TABS:
            await pg.evaluate("t => window.__otvShowTab(t)", t); await pg.wait_for_timeout(500)
            n = await pg.evaluate("""(skip) => { const re = new RegExp(skip); const panel = [...document.querySelectorAll('.tab-panel')].find(x => !x.hidden); if (!panel) return 0;
              let k = 0; const btns = [...panel.querySelectorAll('button, summary')].filter(x => x.offsetParent && !x.disabled && !re.test(x.textContent));
              for (const x of btns.slice(0, 60)) { try { x.click(); k++; } catch (e) {} }
              [...panel.querySelectorAll('textarea, input[type=text], input:not([type])')].filter(x => x.offsetParent).slice(0, 10).forEach(x => { x.value = x.value + ' проверка'; x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); });
              return k; }""", SKIP)
            clicked += n; await pg.wait_for_timeout(700)
        await pg.wait_for_timeout(1500)
        ok = not errs
        print(('OK  ' if ok else 'FAIL') + ' нажато ' + str(clicked) + ' кнопок на ' + str(len(TABS)) + ' вкладках — без ошибок', '' if ok else json.dumps(errs[:5], ensure_ascii=False))
        await b.close(); print('ALL OK' if ok else 'SOME FAILED')
asyncio.run(main())
