# 14.11 (журнал 13.11): сбор шёл 10644 с — компьютер уснул посреди чтения, таймеры страницы на сне стоят, и ни «страница не ответила»,
# ни сторож сбора не срабатывали до пробуждения. Теперь: проснулся — начатое до сна чтение прерывается без «не вышло» у площадок,
# сбор сразу идёт заново и заканчивается; время сна не считается временем сбора (сторож не срабатывает зря). Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""async () => {
          const lines = window.__demoLog = window.__demoLog || [];
          const btn = [...document.querySelectorAll('button')].find(x => /^Собрать отзывы/.test(x.textContent.trim())); btn.click();
          await new Promise(r => setTimeout(r, 800));
          const busy = () => !![...document.querySelectorAll('button')].find(x => x.offsetParent && /Остановить сбор/.test(x.textContent));
          const was = busy();
          window.__otvGuardTick(Date.now() + 2 * 3600e3);   // «проснулся через два часа»
          let n = 0; while (busy() && n < 60) { await new Promise(r => setTimeout(r, 500)); n++; }
          window.__otvGuardTick(Date.now() + 2 * 3600e3 + 20000);   // следующий тик после сна: сторож не должен счесть сбор зависшим
          const health = window.__otvSrcHealth().filter(h => !h.ok && !h.needLogin).map(h => h.name);
          return { was, endedSec: n / 2, lines: lines.filter(l => /спал|сном|заново|завис/.test(l)), failed: health, bar: document.body.innerText.includes('Сбор завис') };
        }""")
        res = []
        res.append((r['was'] and r['endedSec'] < 25, 'сбор, начатый до сна, после пробуждения заканчивается сам (не висит часами)', r))
        res.append((any('компьютер спал' in l for l in r['lines']) and any('заново после сна' in l for l in r['lines']), 'в журнале: компьютер спал, сбор заново', r['lines']))
        res.append((not r['failed'] and not r['bar'] and not any('завис' in l for l in r['lines']), 'чтение, прерванное сном, — не сбой площадки; сторож не срабатывает из-за времени сна', r))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        ok = True
        for good, name, info in res: print(('OK   ' if good else 'FAIL ') + name + ('' if good else '  ' + json.dumps(info, ensure_ascii=False)[:700])); ok = ok and good
        print('ALL OK' if ok else 'FAILED'); await b.close(); sys.exit(0 if ok else 1)
asyncio.run(main())
