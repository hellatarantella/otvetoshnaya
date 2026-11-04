# Пробный сбор после обновления (04.11): первое «Обновить отчёт» после обновления программы ничего не пишет в Google,
# показывает, что добавится, и пишет только по «Записать»; дальше в этой версии — как обычно. Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 1000})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        res = []
        R = await pg.evaluate("""async () => {
          const inRep = () => Object.values(window.__otvAll('registry') || {}).filter(r => r && r.reportRef).length, log = [];
          window.__otvShowTab('check'); await new Promise(r => setTimeout(r, 400));
          const inp = document.querySelector('#ckCtl input[placeholder*="script.google.com"]'); inp.value = 'https://script.google.com/macros/s/TEST123/exec';
          [...document.querySelectorAll('#ckCtl button')].find(b => /Подключить/.test(b.textContent)).click();
          await new Promise(r => setTimeout(r, 2500));
          const r0 = inRep(); await window.__otvReports.update(); await new Promise(r => setTimeout(r, 500));
          const first = inRep() - r0, box = document.querySelector('#ckCtl .rep-head');
          const head = box && box.textContent, btn = box && [...box.parentNode.querySelectorAll('button')].find(b => b.textContent === 'Записать');
          const todo = box ? [...box.parentNode.querySelectorAll('.rep-todo li')].map(x => x.textContent) : [];
          if (btn) btn.click(); await new Promise(r => setTimeout(r, 4000));
          const second = inRep() - r0;
          await window.__otvReports.update(); await new Promise(r => setTimeout(r, 300));
          const third = document.querySelector('#ckCtl .rep-head').textContent;
          return { first, head, todo, second, third, btn: !!btn, pilot: window.__otvReports._pilot(), st: (document.querySelector('#ckCtl .rep-head')||{}).textContent }; }""")
        ok = R['head'] and 'Пробный сбор' in R['head'] and R['first'] == 0 and any('Позитив» добавится' in t for t in R['todo'])
        res.append((ok, 'первое «Обновить отчёт» после обновления: в Google ничего не пишет, показывает, что добавится', R))
        res.append((R['second'] >= 3 and R['pilot']['pilot']['ver'], '«Записать» — пишет и запоминает версию', R))
        res.append(('Пробный' not in R['third'], 'дальше в этой версии отчёт обновляется как обычно, без пробы', R['third']))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else json.dumps(d, ensure_ascii=False)[:3000])
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
