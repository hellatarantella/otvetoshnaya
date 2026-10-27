# Сбор не висит бесконечно: если шаг не закончился, сторож завершает сбор сам, пишет в журнал шаг и даёт собрать ещё раз
import asyncio, sys
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); await pg.goto(P); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""async () => {
          const db = await window.__otvRt.use('db');
          const orig = db.collection.bind(db); let hang = true;
          db.collection = (c) => { const col = orig(c); if (c !== 'requests') return col;
            return { doc: (id) => { const d = col.doc(id); return { get: () => hang ? new Promise(() => {}) : d.get(), set: (x) => d.set(x), update: (x) => d.update(x), delete: () => d.delete() }; } }; };
          window.__otvSetCollectMax(1500);
          document.getElementById('collectBtn2').click();
          await new Promise(r => setTimeout(r, 2500));
          const bar = document.body.innerText;
          return { bar: /Сбор завис на шаге «запуск»/.test(bar), again: /Собрать ещё раз/.test(bar)};
        }""")
        ok = r['bar'] and r['again']
        print(('OK  ' if ok else 'FAIL') + ' зависший сбор завершается сам и пишет шаг', r if not ok else '')
        await b.close(); print('ALL OK' if ok else 'SOME FAILED')
asyncio.run(main())
