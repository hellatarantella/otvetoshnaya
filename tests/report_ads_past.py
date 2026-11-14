# 12.11: реклама вместо отзыва не попадает в программу и в отчёт; уже попавшая — убирается из отчёта и из снимков недель
# (презентации пересобираются сами); отчёты прошлых недель скачиваются (неделя собирается заново из снимка, без рекламы). Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from pilot import CONNECT
P = "file://" + sys.argv[1]
AD = "Помогаем бизнесу усиливать репутацию в Яндекс и 2ГИС.  2ГИС — 50 отзывов: 3 700 ₽... Ответить"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 1000}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        res = []
        r1 = await pg.evaluate("""async (AD) => { const db = await window.__otvRt.use('db'); const d = new Date().toISOString().slice(0, 10);
          await window.__otvIngest([{ id: '2gis-ad1', platform: '2ГИС', published: true, date: d, text: AD, rating: 5 }]);
          return (await db.collection('registry').doc('2gis-ad1').get()).exists; }""", AD)
        res.append(('реклама при сборе не записывается в программу', r1 is False, r1))
        await pg.evaluate(CONNECT, False); await pg.wait_for_timeout(6000)
        # реклама уже стоит в текущем отчёте и в снимке прошлой недели
        R = await pg.evaluate("""async (AD) => { const db = await window.__otvRt.use('db'); const st = window.__otvReports.state();
          const prev = new Date(st.start + 'T00:00:00'); prev.setDate(prev.getDate() - 7); const ps = prev.toISOString().slice(0, 10); const pe = new Date(prev); pe.setDate(pe.getDate() + 6);
          await db.collection('weeks').doc(ps).set({ start: ps, end: pe.toISOString().slice(0, 10), period: 'прошлая', positive: [{ platform: '2ГИС', num: 1, date: '04.11.2026', dept: 'ГКБ 24', doctor: '—', text: AD, full: AD }, { platform: 'Яндекс', num: 1, date: '04.11.2026', dept: 'ГКБ 24', doctor: '—', text: 'Все нормально, спасибо персоналу.', full: 'Все нормально, спасибо персоналу.' }], negative: [] });
          window.__gsAddAd = true; return ps; }""", AD)
        await pg.evaluate("""(AD) => { /* реклама в таблице текущей недели */ }""", AD)
        await pg.wait_for_timeout(4500)
        snap = await pg.evaluate(f"async () => {{ const db = await window.__otvRt.use('db'); const w = (await db.collection('weeks').doc('{R}').get()).data(); return [w.positive.length, !!w.dirty]; }}")
        res.append(('реклама убрана из снимка прошлой недели (презентация пересоберётся без неё)', snap == [1, True], snap))
        # текущий отчёт: реклама в таблице — сверка убирает
        await pg.evaluate("""(AD) => { window.__gsExtraPos = [{ platform: '2ГИС', num: 9, date: '04.11.2026', dept: 'ГКБ 24', text: AD.slice(0, 120), full: AD }]; }""", AD)
        rm = await pg.evaluate("""async () => { await window.__otvReports.update(); await new Promise(r => setTimeout(r, 1500)); return (window.__gsRemoved || []).map(x => x.platform); }""")
        res.append(('реклама в таблице текущей недели убирается при обновлении отчёта', '2ГИС' in rm, rm))
        # «в отчёте есть, в программе нет»: строка письма, вписанная в таблицу, — кнопкой становится записью программы
        O = await pg.evaluate("""async () => { const st = window.__otvReports.state(); const d = st.start.split('-').reverse().join('.');
          window.__gsExtraPos = [{ platform: 'Сайт больницы', num: 3, date: d, dept: 'Хирургия', doctor: 'Соколова', text: 'Тестовое письмо Ж9: благодарю хирургию за внимательное отношение.', full: 'Тестовое письмо Ж9: благодарю хирургию за внимательное отношение.' }];
          await window.__otvReports.update(); await new Promise(r => setTimeout(r, 800));
          const todo = [...document.querySelectorAll('#ckRecon .rc-row.warn')].map(x => x.textContent).join(' | ');
          const btn = [...document.querySelectorAll('#ckRecon button')].find(b => /Добавить в программу/.test(b.textContent));
          if (btn) { btn.click(); await new Promise(r => setTimeout(r, 3500)); }
          const reg = window.__otvAll('registry') || {}; const got = Object.keys(reg).filter(k => reg[k].fromReport && /Ж9/.test(reg[k].fullText));
          const todo2 = [...document.querySelectorAll('#ckRecon .rc-row.warn')].map(x => x.textContent).join(' | ');
          return { todo, btn: !!btn, got: got.length, plat: got.length ? reg[got[0]].platform : '', after: /в программе нет/.test(todo2) }; }""")
        res.append(('сверка: строка отчёта без записи в программе найдена и одной кнопкой добавлена; потом расхождения нет', 'в программе нет' in O['todo'] and O['btn'] and O['got'] == 1 and O['plat'] == 'Сайт' and not O['after'], O))
        # прошлые недели: список и скачивание
        await pg.evaluate("window.__otvShowTab('check')"); await pg.wait_for_timeout(500)
        has = await pg.locator('#ckPast summary').count()
        await pg.evaluate("document.getElementById('ckPast').open = true")
        await pg.locator('#ckPast button:has-text("Скачать")').first.click(); await pg.wait_for_timeout(2500)
        D = await pg.evaluate("({ files: (window.__demoFiles || []).map(f => f.filename), rb: (window.__gsRebuilt || []).map(q => ({ pos: q.posTitle, n: q.positive.length, force: q.force, ad: q.positive.some(x => /Помогаем/.test(x.text)) })), msg: (document.querySelector('#ckPast .ctl-st') || {}).textContent })")
        ok = has == 1 and D['rb'] and D['rb'][0]['n'] == 1 and not D['rb'][0]['ad'] and D['rb'][0]['force'] is True and len(D['files']) == 2 and 'Сохранено' in (D['msg'] or '') and D['rb'][0]['pos'].startswith('Позитив 2026_91_')
        res.append(('прошлая неделя скачивается: собрана заново из снимка, без рекламы, с верным номером', ok, D))
        res.append(('без ошибок страницы', not errs, errs[:3]))
        for name, ok, info in res: print(('OK  ' if ok else 'FAIL') + ' ' + name, '' if ok else json.dumps(info, ensure_ascii=False)[:1500])
        await b.close(); print('ALL OK' if all(r[1] for r in res) else 'SOME FAILED')
asyncio.run(main())
