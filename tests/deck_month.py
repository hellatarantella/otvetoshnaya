# Презентация месяца: 8 слайдов по утверждённому образцу «сентябрь 2026», цифры = недельные отчёты (со сверкой),
# месяц по дате поступления или по дате размещения (переключатель), сравнение с сентябрём из утверждённой сводки,
# подтверждения (фото и цитаты топ-3 врачей), вёрстка без замечаний, PDF (8 страниц) и PPTX. Данные выдуманные
import asyncio, sys, base64, zipfile, io, subprocess, tempfile, os
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
FR = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'rb').read()).decode()
FB = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'rb').read()).decode()
SETUP = """async ([fr, fb]) => {
  const db = await window.__otvRt.use('db');
  const staff = [['Белкина Анна Петровна','Врач-хирург','Хирургия'],['Соколов Иван Ильич','Врач-уролог','Урология'],['Лисина Ольга Юрьевна','Врач-терапевт','Терапия'],
    ['Громов Пётр Сергеевич','Врач-кардиолог','Кардиология'],['Орлова Нина Викторовна','Врач-гинеколог','Гинекология'],['Корнев Леонид Владимирович','Врач-колопроктолог','Колопроктология 3']];
  const cats = [...new Set(staff.map(x => x[2]))];
  window.__otvReports._setRefs({ staff, departments: cats.map(c => [c, c, 'Один к одному']), exceptions: [], categories: ['ГКБ 24'].concat(cats) });
  const T = { 'Белкина': 'Анна Петровна провела операцию бережно и внимательно, профессионал с золотыми руками и добрым сердцем. Рекомендую!',
    'Соколов': 'Иван Ильич всё подробно объяснил, вселил уверенность и спокойствие перед операцией, спасибо за заботу.',
    'Лисина': 'Ольга Юрьевна внимательный и грамотный врач, подобрала лечение, которое помогло с первых дней.',
    'Громов': 'Пётр Сергеевич чуткий и опытный кардиолог, после лечения стало легче дышать, врач от Бога.',
    'Орлова': 'Нина Викторовна очень внимательная и заботливая, всё прошло быстро и без боли, медсёстры замечательные.',
    'Корнев': 'Леонид Владимирович блестящий хирург, сложная операция прошла успешно, низкий поклон всей команде.' };
  const dep = Object.fromEntries(staff.map(x => [x[0].split(' ')[0], x[2]]));
  const pl = ['ПроДокторов','Сайт','Яндекс','ДокТу','2ГИС'];
  const mk = (n0, days) => { const out = []; Object.keys(T).forEach((k, j) => { const n = Math.max(1, n0 - j); for (let i = 0; i < n; i++) out.push({ platform: pl[(i + j) % 5], date: days[(i + j) % days.length], dept: dep[k], doctor: k, text: T[k] + ' Отзыв ' + n0 + '-' + i + '.' }); }); out.push({ platform: 'Яндекс', date: days[0], dept: 'ГКБ 24', doctor: '—', text: 'Хорошая больница, чисто и вкусно кормят ' + n0 }); return out; };
  const neg = (days, tag) => [{ platform: 'Сайт', date: days[0], text: 'Долго ждал в приёмном, никто не объяснил ' + tag }, { platform: 'Яндекс', date: days[1], text: 'Грубый персонал, но врачу спасибо ' + tag }];
  await db.collection('weeks').doc('2026-10-16').set({ start: '2026-10-16', end: '2026-10-22', period: '16.10–22.10.2026', positive: mk(4, ['17.10.2026','19.10.2026','21.10.2026']), negative: neg(['18.10.2026','20.10.2026'], 'a') });
  await db.collection('weeks').doc('2026-10-23').set({ start: '2026-10-23', end: '2026-10-29', period: '23.10–29.10.2026', positive: mk(3, ['23.10.2026','26.10.2026','28.10.2026']), negative: neg(['24.10.2026','27.10.2026'], 'b') });
  // неделя на стыке месяцев: отзыв размещён 28.10, а поступил 31.10 — в октябрь по обоим способам; размещён 31.10, поступил 02.11 — по поступлению в ноябрь
  await db.collection('weeks').doc('2026-10-30').set({ start: '2026-10-30', end: '2026-11-05', period: '30.10–05.11.2026', positive: [
    { platform: 'ПроДокторов', date: '31.10.2026', dept: 'Хирургия', doctor: 'Белкина', text: 'Поздний отзыв: Анна Петровна внимательный и чуткий врач, всё объяснила спокойно и подробно.' },
    { platform: 'Сайт', date: '02.11.2026', dept: 'Урология', doctor: 'Соколов', text: 'Ноябрьский отзыв: Иван Ильич грамотный и опытный специалист, рекомендую.' }], negative: [] });
  await db.collection('registry').doc('x1').set({ platform: 'ПроДокторов', fullText: 'Поздний отзыв: Анна Петровна внимательный и чуткий врач, всё объяснила спокойно и подробно.', arrivedAt: '2026-11-02T09:00:00.000Z' });
  await db.collection('settings').doc('deckFonts').set({ regular: fr, bold: fb, at: 'x' });
  const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#7a9cc6'; g.fillRect(0, 0, 400, 300); g.fillStyle = '#fff'; g.fillRect(150, 80, 100, 120);
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
        s1 = await pg.evaluate("""() => { const st = window.__otvDeckUiM._state(), r = st.res;
          return { label: st.cur.label, pos: r.numbers.pos, neg: r.numbers.neg, bad: r.checks.filter(c => c.bad).map(c => c.text), need: r.need.map(n => n.kind), top: r.D.doctors.top.map(d => d.short + ' ' + d.n),
                   prev: r.D.kpi.prev, months: r.D.dyn.months.map(m => m.pos), opts: [...document.querySelectorAll('.deck-ui select')].filter(s => s.closest('#tab-deckm')).map(s => [...s.options].map(o => o.textContent))[0] }; }""")
        # по поступлению: 4+3+3+2+1+1 +1(ГКБ) = 15 и 3+2+2+1+1+1+1 = 11, плюс «размещён 31.10, поступил 02.11» не входит → 26 позитивных; «размещён 31.10» без реестра — 31.10 → октябрь (+1) = 27? 
        ok1 = s1['label'] == 'Октябрь 2026' and s1['neg'] == 4 and not s1['bad'] and 'choice' not in s1['need'] and 'photo' in s1['need'] and s1['prev'] and s1['prev']['pos'] == 193 and s1['months'][:9] == [164, 221, 210, 210, 121, 127, 124, 109, 193] and 'Ноябрь 2026' in ' '.join(s1['opts'] or [])
        print(('OK  ' if ok1 else 'FAIL') + ' месяц собран: сверка без ошибок, сентябрь и динамика — из утверждённой сводки, есть ноябрь', s1 if not ok1 else '')
        # способ подсчёта: по дате размещения отзыв «размещён 31.10, поступил 02.11» уходит в октябрь
        s2 = await pg.evaluate("""async () => {
          const posPl = window.__otvDeckUiM._state().res.numbers.pos;
          const pickMode = async (v) => { const row = [...document.querySelectorAll('#tab-deckm .deck-extra .deck-need')].find(r => /Как относить/.test(r.textContent));
            row.querySelector('input[value="' + v + '"]').click(); [...row.querySelectorAll('button')].find(b => b.textContent === 'Подтвердить').click();
            await new Promise(r => setTimeout(r, 2000)); };
          await pickMode('arrival'); const posArr = window.__otvDeckUiM._state().res.numbers.pos;
          await pickMode('placed');
          return { posArr, posPl, back: window.__otvDeckUiM._state().res.numbers.pos, bar: (document.getElementById('otvBar') || {}).textContent || '' };
        }""")
        ok2 = s2['posPl'] == s2['posArr'] + 1 and s2['back'] == s2['posPl'] and 'Сохранено' in s2['bar']
        print(('OK  ' if ok2 else 'FAIL') + ' по умолчанию — дата в строке отчёта (с 1-го по последнее число); по дате поступления на 1 меньше; обратно — как было', s2 if not ok2 else '')
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
        ok3 = not s3['need'] and s3['slides'] == 8 and s3['ok'] and s3['ids'] == ['mcover', 'mdepts', 'mdoctors', 'mthemes', 'mnegative', 'mkpi', 'mdyn', 'mend'] and s3['themes'] == 7 and len(s3['negT']) >= 2
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
            ok4 = pages == 8 and len(sl) == 8 and 'Октябрь в цифрах' in txt and 'к сентябрю' in txt and 'Динамика онлайн-обращений в 2026 году' in txt
            if '--shot' in sys.argv:
                subprocess.run(['pdftoppm', '-r', '40', '-png', fn, '/tmp/claude-0/-home-claude/8b71b450-7313-51fa-9702-f77ccc1a59a9/scratchpad/month'])
        print(('OK  ' if ok4 else 'FAIL') + ' PDF (8 страниц, «к сентябрю») и PPTX (8 слайдов); слайды недели в файл не попадают', [r[0] for r in res] if not ok4 else '')
        ok5 = not errs
        print(('OK  ' if ok5 else 'FAIL') + ' без ошибок на странице', errs[:3] if errs else '')
        await b.close(); print('ALL OK' if all([ok1, ok2, ok3, ok4, ok5]) else 'SOME FAILED')
asyncio.run(main())
