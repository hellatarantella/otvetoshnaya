# Презентация недели собирается в программе: цифры = отчёт, без подтверждений выгрузка закрыта,
# после подтверждений получаются PDF и PPTX. Данные и имена выдуманные; шрифт для проверки — свободный DejaVu (не Cera Round)
import asyncio, sys, base64, zipfile, io
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
FR = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'rb').read()).decode()
FB = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'rb').read()).decode()
SETUP = """async ([fr, fb]) => {
  const db = await window.__otvRt.use('db');
  window.__otvReports._setRefs({ staff: [['Белкина Анна Петровна','Врач-хирург','Хирургическое отделение'],['Соколов Иван Ильич','Врач-уролог','Урологическое отделение'],['Лисина Ольга Юрьевна','Врач-терапевт','Терапевтическое отделение']],
    departments: [['Хирургическое отделение','Хирургия','Один к одному'],['Урологическое отделение','Урология','Один к одному'],['Терапевтическое отделение','Терапия','Один к одному']], exceptions: [], categories: ['ГКБ 24','Хирургия','Урология','Терапия'] });
  const R = (pl, d, dep, doc, t) => ({ platform: pl, date: d, dept: dep, doctor: doc, text: t, full: t });
  await db.collection('weeks').doc('2026-10-23').set({ start: '2026-10-23', end: '2026-10-29', period: '23.10–29.10.2026', positive: [
    R('ПроДокторов','23.10.2026','Хирургия','Белкина','Анна Петровна провела операцию бережно и внимательно. Профессионал с золотыми руками и добрым сердцем. Спасибо!'),
    R('Сайт','24.10.2026','Хирургия','Белкина','Благодарю доктора Белкину за чуткость и заботу, восстановление прошло легко и без боли.'),
    R('Яндекс','24.10.2026','Урология','Соколов','Иван Ильич всё подробно объяснил, вселил уверенность и спокойствие перед операцией. Рекомендую этого врача!'),
    R('ПроДокторов','25.10.2026','Терапия','Лисина','Ольга Юрьевна внимательный и грамотный врач, подобрала лечение, которое помогло с первых дней.'),
    R('Яндекс','25.10.2026','ГКБ 24','—','Хорошая больница, чисто и вкусно кормят.')],
    negative: [{ platform: 'Яндекс', date: '26.10.2026', text: 'Долго ждал в приёмном', full: 'Долго ждал в приёмном' }] });
  await db.collection('settings').doc('deckFonts').set({ regular: fr, bold: fb });
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(accept_downloads=True, viewport={'width': 1100, 'height': 900}); pg = await ctx.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        await pg.evaluate(SETUP, [FR, FB]); await pg.wait_for_timeout(300)
        await pg.evaluate("window.__otvShowTab('deckw')"); await pg.wait_for_timeout(300)
        await pg.evaluate("window.__otvDeckUi.rebuild()"); await pg.wait_for_timeout(1500)
        s1 = await pg.evaluate("""() => { const t = document.querySelector('.deck-ui').innerText; const st = window.__otvDeckUi._state(); const n = st.res.numbers;
          return { pos: n.pos, neg: n.neg, need: st.res.need.map(x => x.kind), pdfOff: [...document.querySelectorAll('.deck-ui button')].find(b => b.textContent === 'Скачать PDF').disabled,
                   checksBad: st.res.checks.filter(c => c.bad).map(c => c.text), gold: st.res.D.heroes.cards.map(c => c.short + ' ' + c.n), text: t.slice(0, 200) }; }""")
        ok1 = s1['pos'] == 5 and s1['neg'] == 1 and s1['pdfOff'] and not s1['checksBad'] and s1['gold'] == ['Белкина А.П. 2'] and 'photo' in s1['need'] and 'quote' in s1['need'] and 'review' in s1['need']
        print(('OK  ' if ok1 else 'FAIL') + ' цифры = отчёт (5 и 1), сверка без ошибок, без подтверждений выгрузка закрыта', s1 if not ok1 else '')
        # подтверждения: цитата и отзыв недели — кнопками; фото — как после кадрирования
        await pg.click("text=Подтвердить цитату"); await pg.wait_for_timeout(500)
        await pg.click("text=Выбрать отзыв недели"); await pg.wait_for_timeout(500)
        if await pg.locator("text=Подтвердить голоса").count(): await pg.click("text=Подтвердить голоса"); await pg.wait_for_timeout(500)
        await pg.evaluate("""async () => {
          const db = await window.__otvRt.use('db'), st = window.__otvDeckUi._state(), wk = st.cur.data.start;
          const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#7a9cc6'; g.fillRect(0, 0, 400, 300); g.fillStyle = '#fff'; g.fillRect(150, 80, 100, 120);
          const src = c.toDataURL('image/jpeg', 0.8), put = (key, kind, weekly) => db.collection('deckPhotos').doc(kind + '_' + key.replace(/\\s+/g, '_')).set({ key, kind, week: weekly ? wk : '', src });
          for (const n of st.res.need.filter(n => n.kind === 'photo')) {
            const kind = n.slot === 'cover' ? 'cover' : n.slot === 'end' ? 'end' : n.slot === 'dept' ? 'dept' : n.tall ? 'tall' : 'face';
            await put(n.who, kind, false);
          }
        }""")
        await pg.wait_for_timeout(1500)
        await pg.evaluate("window.__otvDeckUi.rebuild()"); await pg.wait_for_timeout(2500)
        s2 = await pg.evaluate("""() => { const st = window.__otvDeckUi._state(); const bs = [...document.querySelectorAll('.deck-ui button')];
          return { need: st.res.need.map(x => x.text), pdfOn: !bs.find(b => b.textContent === 'Скачать PDF').disabled, layout: document.querySelector('.deck-ui').innerText.includes('Вёрстка проверена'), slides: document.querySelectorAll('.deck-slide').length }; }""")
        ok2 = not s2['need'] and s2['pdfOn'] and s2['layout'] and s2['slides'] == 7
        print(('OK  ' if ok2 else 'FAIL') + ' после подтверждений: 7 слайдов, вёрстка проверена, выгрузка открыта', s2 if not ok2 else '')
        # «Пересмотреть выбор»: цитату карточки можно поменять в любой момент, слайд пересобирается
        rv = await pg.evaluate("""async () => {
          const d = [...document.querySelectorAll('.deck-extra')].find(x => /Пересмотреть выбор/.test(x.textContent)); d.open = true;
          const row = [...d.querySelectorAll('.deck-need')].find(r => /Цитата для карточки Белкина/.test(r.textContent));
          const inp = row.querySelector('input.deck-in'); inp.value = 'Анна Петровна внимательный и чуткий врач, всё объяснила спокойно и подробно'; inp.dispatchEvent(new Event('input'));
          [...row.querySelectorAll('button')].find(b => /Подтвердить цитату/.test(b.textContent)).click();
          await new Promise(r => setTimeout(r, 2500));
          const st = window.__otvDeckUi._state();
          return { quote: st.res.D.heroes.cards[0].quote, onSlide: (document.querySelector('.deck-slide-in section#heroes') || {}).textContent || '', hasRefresh: [...document.querySelectorAll('.deck-ui button')].some(b => b.textContent === 'Обновить презентацию') };
        }""")
        ok6 = rv['quote'].startswith('Анна Петровна внимательный') and 'Анна Петровна внимательный' in rv['onSlide'] and rv['hasRefresh']
        print(('OK  ' if ok6 else 'FAIL') + ' «Пересмотреть выбор» меняет цитату, слайд обновляется; есть «Обновить презентацию»', rv if not ok6 else '')
        # фото обложки постоянное, фото отделения — по названию отделения и переходит на следующую неделю
        s3 = await pg.evaluate("""async () => {
          const db = await window.__otvRt.use('db');
          const w = (await db.collection('weeks').doc('2026-10-23').get()).data();
          await db.collection('weeks').doc('2026-10-30').set(Object.assign({}, w, { start: '2026-10-30', end: '2026-11-05', period: '30.10–05.11.2026' }));
          await new Promise(r => setTimeout(r, 400)); window.__otvDeckUi.rebuild(); await new Promise(r => setTimeout(r, 500));
          const sel = document.querySelector('.deck-ui select'); sel.value = [...sel.options].find(o => o.textContent.includes('30.10')).value; sel.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 800));
          const st = window.__otvDeckUi._state();
          return { week: st.cur.data.start, need: st.res.need.map(n => n.who), slots: st.res.D.where.slots, cover: !!st.res.D.photos.cover };
        }""")
        ok5 = s3['week'] == '2026-10-30' and s3['cover'] and 'Обложка' not in s3['need'] and not any(x in s3['need'] for x in s3['slots']) and s3['slots'][0] == 'Хирургия'
        print(('OK  ' if ok5 else 'FAIL') + ' следующая неделя: обложка и фото отделений (по названию) подставляются сами', s3 if not ok5 else '')
        await pg.evaluate("async () => { const sel = document.querySelector('.deck-ui select'); sel.value = [...sel.options].find(o => o.textContent.includes('23.10')).value; sel.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 1500)); }")
        await pg.wait_for_timeout(1500)
        await pg.click("text=Скачать PDF"); await pg.wait_for_function("(window.__demoFiles||[]).length >= 1", timeout=90000)
        await pg.click("text=Скачать PPTX"); await pg.wait_for_function("(window.__demoFiles||[]).length >= 2", timeout=90000)
        files = await pg.evaluate("() => window.__demoFiles.map(f => [f.filename, f.data])")
        pdf = base64.b64decode(files[0][1]); ppt = base64.b64decode(files[1][1])
        z = zipfile.ZipFile(io.BytesIO(ppt)); slides = [n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml')]
        xml2 = z.read('ppt/slides/slide2.xml').decode('utf-8')
        ok3 = files[0][0] == 'Онлайн-обращения 23.10–29.10.2026.pdf' and files[1][0].endswith('.pptx') and pdf[:4] == b'%PDF' and pdf.count(b'/Type /Page\n') + pdf.count(b'/Type /Page\r') + pdf.count(b'/Type /Page ') >= 7 and len(slides) == 7 and 'Cera Round' in xml2 and '5' in xml2
        print(('OK  ' if ok3 else 'FAIL') + ' PDF (7 страниц) и PPTX (7 слайдов, шрифт Cera Round, текст редактируемый)', (pdf[:8], len(slides)) if not ok3 else '')
        ok4 = not errs
        print(('OK  ' if ok4 else 'FAIL') + ' без ошибок на странице', errs[:3] if errs else '')
        await b.close(); print('ALL OK' if ok1 and ok2 and ok3 and ok4 and ok5 and ok6 else 'SOME FAILED')
asyncio.run(main())
