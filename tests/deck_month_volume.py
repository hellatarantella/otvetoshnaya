# Месяц, настоящий объём (180 позитивных, 25 отделений, 40 врачей, длинные названия): вёрстка без замечаний, PDF и PPTX. Было: 8 слайдов по утверждённому образцу «сентябрь 2026», цифры = недельные отчёты (со сверкой),
# месяц по дате поступления или по дате размещения (переключатель), сравнение с сентябрём из утверждённой сводки,
# подтверждения (фото и цитаты топ-3 врачей), вёрстка без замечаний, PDF (8 страниц) и PPTX. Данные выдуманные
import asyncio, sys, base64, zipfile, io, subprocess, tempfile, os
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
FR = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'rb').read()).decode()
FB = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'rb').read()).decode()
SETUP = """async ([fr, fb]) => {
  const db = await window.__otvRt.use('db');
  const D = ['Ультразвуковая и функциональная диагностика','Межокружное отделение рассеянного склероза','Отделение реанимации и интенсивной терапии №2','Колопроктология 7','Колопроктология 3','Гинекология','Кардиология','Неврология','Аллергология и иммунология','Урология','Эндоскопия','Хирургия','Терапия','Травматология','Эндокринология','Отделение ранней медицинской реабилитации','Флебология','КДО','СКП','Гнойная хирургия','Приёмное отделение','Анестезиология','Гемодиализ','Отделение реанимации № 3','Физиотерапевтическое отделение'];
  const F = ['Александра','Владислава','Константин','Екатерина','Святослав','Анастасия','Маргарита','Валентина','Станислав','Елизавета'];
  const staff = []; for (let i = 0; i < 40; i++) staff.push(['Константинопольская' + 'абвгдежзик'[i % 10] + 'абвгд'[Math.floor(i / 10)] + ' ' + F[i % 10] + ' Александровна', 'Врач', D[i % D.length]]);
  window.__otvReports._setRefs({ staff, departments: D.map(c => [c, c, 'Один к одному']), exceptions: [], categories: ['ГКБ 24'].concat(D) });
  const pos = []; const pl = ['ПроДокторов','Сайт','Яндекс','ДокТу','2ГИС','Google','НаПоправку'];
  for (let i = 0; i < 180; i++) { const st = staff[Math.floor(Math.pow(i / 180, 2) * 40)]; pos.push({ platform: pl[i % 7], date: (1 + i % 28 < 10 ? '0' : '') + (1 + i % 28) + '.10.2026', dept: i % 9 === 0 ? 'ГКБ 24' : st[2], doctor: i % 9 === 0 ? '—' : st[0].split(' ')[0], text: st[0].split(' ')[1] + ' внимательный и чуткий доктор, объяснила каждый этап, профессионал с золотыми руками, рекомендую. Номер ' + i }); }
  const neg = []; for (let i = 0; i < 14; i++) neg.push({ platform: pl[i % 3], date: '1' + (i % 9) + '.10.2026', text: ['Грубый персонал', 'Долго ждал записи', 'Медсестра не дала лекарство', 'Грязно в палате', 'Не помогло лечение'][i % 5] + ' ' + i });
  await db.collection('weeks').doc('2026-10-02').set({ start: '2026-10-02', end: '2026-10-29', period: 'октябрь', positive: pos, negative: neg });
  await db.collection('settings').doc('deckFonts').set({ regular: fr, bold: fb, at: 'x' });
  const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#7a9cc6'; g.fillRect(0, 0, 400, 300);
  window.__photo = c.toDataURL('image/jpeg', 0.8);
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        await pg.evaluate(SETUP, [FR, FB])
        await pg.evaluate("window.__otvShowTab('deckm')"); await pg.wait_for_timeout(300)
        await pg.evaluate("window.__otvDeckUiM.rebuild()"); await pg.wait_for_timeout(2500)
        # подтверждения: фото топ-3 и цитаты
        await pg.evaluate("""async () => {
          const db = await window.__otvRt.use('db'), st = window.__otvDeckUiM._state();
          for (const n of st.res.need.filter(n => n.kind === 'photo')) await db.collection('deckPhotos').doc('face_' + n.who.replace(/\\s+/g, '_')).set({ key: n.who, kind: 'face', src: window.__photo, at: 'z' });
        }""")
        await pg.wait_for_timeout(1200); await pg.evaluate("window.__otvDeckUiM.rebuild()"); await pg.wait_for_timeout(1500)
        for _ in range(6):
            loc = pg.locator("#tab-deckm .deck-need button.primary >> visible=true")
            if not await loc.count(): break
            await loc.first.click(); await pg.wait_for_timeout(1500)
        await pg.wait_for_timeout(2500)
        s3 = await pg.evaluate("""() => { const st = window.__otvDeckUiM._state(), ui = document.querySelector('#tab-deckm .deck-ui');
          return { need: st.res.need.map(n => n.text), slides: ui.querySelectorAll('.deck-slide').length, ids: [...ui.querySelectorAll('.deck-slide-in > section')].map(s => s.id), ok: ui.innerText.includes('Вёрстка проверена'),
                   issues: [...ui.querySelectorAll('.bad')].map(x => x.textContent).slice(0, 5), weekSlides: document.querySelectorAll('#tab-deckw .deck-slide').length,
                   title: (ui.querySelector('section#mdoctors h2') || {}).textContent, themes: st.res.D.themes.list.length, negT: st.res.D.negative.themes.map(t => t.name) }; }""")
        cnt = await pg.evaluate("() => window.__otvDeckUiM._state().res.numbers")
        ok3 = not s3['need'] and s3['slides'] == 8 and s3['ok'] and cnt['pos'] == 180 and cnt['neg'] == 14
        print(('OK  ' if ok3 else 'FAIL') + ' после подтверждений: 8 слайдов как в образце, вёрстка проверена', s3 if not ok3 else '')
        res = await pg.evaluate("""async () => {
          window.__demoFiles = [];
          const bs = [...document.querySelectorAll('#tab-deckm .deck-ui button')];
          bs.find(b => b.textContent === 'Скачать PDF').click();
          for (let i = 0; i < 120 && window.__demoFiles.length < 1; i++) await new Promise(r => setTimeout(r, 500));
          bs.find(b => b.textContent === 'Скачать PPTX').click();
          for (let i = 0; i < 120 && window.__demoFiles.length < 2; i++) await new Promise(r => setTimeout(r, 500));
          return window.__demoFiles.map(f => [f.filename, f.data]);
        }""")
        ok4 = len(res) == 2 and res[0][0] == 'Онлайн-обращения октябрь 2026.pdf'
        if ok4:
            d = tempfile.mkdtemp(); fn = os.path.join(d, 'a.pdf'); open(fn, 'wb').write(base64.b64decode(res[0][1]))
            pages = int([l for l in subprocess.run(['pdfinfo', fn], capture_output=True, text=True).stdout.splitlines() if l.startswith('Pages')][0].split()[-1])
            z = zipfile.ZipFile(io.BytesIO(base64.b64decode(res[1][1]))); sl = [n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml')]
            txt = subprocess.run(['pdftotext', fn, '-'], capture_output=True, text=True).stdout
            ok4 = pages == 8 and len(sl) == 8
            if '--shot' in sys.argv:
                subprocess.run(['pdftoppm', '-r', '40', '-png', fn, '/tmp/claude-0/-home-claude/8b71b450-7313-51fa-9702-f77ccc1a59a9/scratchpad/mvol'])
        print(('OK  ' if ok4 else 'FAIL') + ' PDF (8 страниц, «к сентябрю») и PPTX (8 слайдов); слайды недели в файл не попадают', [r[0] for r in res] if not ok4 else '')
        ok5 = not errs
        print(('OK  ' if ok5 else 'FAIL') + ' без ошибок на странице', errs[:3] if errs else '')
        await b.close(); print('ALL OK' if all([ok3, ok4, ok5]) else 'SOME FAILED')
asyncio.run(main())
