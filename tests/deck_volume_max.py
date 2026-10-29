# Предельный объём (29.10, как в настоящей неделе): 23 сотрудника в строке «Ещё…», 20+ отделений «по одной» — список встаёт в две колонки, без замечаний
# Расположение блоков то же, текст при необходимости уменьшается ступенями (не больше чем на 20%), самопроверка без замечаний
import asyncio, sys, base64
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
FR = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'rb').read()).decode()
FB = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'rb').read()).decode()
SETUP = """async ([fr, fb]) => {
  const db = await window.__otvRt.use('db');
  const D = ['Отоларингология','Офтальмология','Пульмонология','Нефрология','Ревматология','Гастроэнтерология','Онкология','Гематология','Дерматология','Ультразвуковая и функциональная диагностика','Межокружное отделение рассеянного склероза','Отделение реанимации и интенсивной терапии №2','Колопроктология 7','Колопроктология 3','Гинекология','Кардиология','Неврология','Аллергология и иммунология','Урология','Эндоскопия','Хирургия','Терапия','Травматология','Эндокринология','Ранняя реабилитация','Флебология','КДО'];
  const F = ['Анна','Ирина','Олег','Павел','Нина','Вера','Борис','Глеб','Инна','Александра','Владислава','Константин','Екатерина','Святослав','Анастасия','Маргарита','Валентина','Станислав','Елизавета','Виктория','Ярослав','Людмила','Григорий','Леонид','Софият','Таисия','Роман'];
  const S = ['Орлова','Кузнецова','Смирнов','Попов','Васильева','Петрова','Соколов','Михайлов','Новикова','Константинопольская','Преображенская','Вознесенский','Христорождественская','Благовещенский','Тимофеева','Парамонова','Голованова','Мирошниченко','Колесникова','Белозерская','Ярославцев','Хорошилова','Григорьева','Лебедев','Султанова','Зарецкая','Романов'];
  const staff = S.map((s, i) => [s + ' ' + F[i] + ' ' + (i % 2 ? 'Александровна' : 'Владимирович').replace(/вич$/, s.endsWith('а') ? 'вна' : 'вич'), 'Врач', D[i]]);
  window.__otvReports._setRefs({ staff, departments: D.map(d => [d, d, 'Один к одному']), exceptions: [], categories: ['ГКБ 24'].concat(D) });
  const L = 'внимательный и чуткий доктор, подробно объяснила каждый этап до операции, во время неё и после, спасибо за заботу. ';
  const pos = []; const pl = ['ПроДокторов','Сайт','Яндекс','ДокТу','2ГИС'];
  staff.forEach((x, i) => { const n = i < 4 ? 4 + (i % 2) : 1; for (let k = 0; k < n; k++) pos.push({ platform: pl[(i + k) % 5], date: (23 + k) + '.10.2026', dept: x[2], doctor: x[0].split(' ')[0], text: x[0].split(' ')[1] + ' ' + L + 'Профессионал с золотыми руками и добрым сердцем, всем рекомендую этого замечательного врача.', full: x[0].split(' ')[1] + ' ' + L + 'Профессионал с золотыми руками и добрым сердцем, всем рекомендую этого замечательного врача.' }); });
  for (let k = 0; k < 4; k++) pos.push({ platform: 'Яндекс', date: '25.10.2026', dept: 'ГКБ 24', doctor: '—', text: 'Хорошая больница, чисто, вкусно кормят и персонал внимательный.', full: 'Хорошая больница, чисто, вкусно кормят и персонал внимательный.' });
  await db.collection('weeks').doc('2026-10-23').set({ start: '2026-10-23', end: '2026-10-29', period: '23.10–29.10.2026', positive: pos, negative: [] });
  await db.collection('settings').doc('deckFonts').set({ regular: fr, bold: fb, at: 'x' });
  const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#7a9cc6'; g.fillRect(0, 0, 400, 300);
  const src = c.toDataURL('image/jpeg', 0.8);
  for (const x of staff) for (const kind of ['face', 'tall']) await db.collection('deckPhotos').doc(kind + '_' + x[0].replace(/\\s+/g, '_')).set({ key: x[0], kind, src, at: '2026-10-27' });
  const st0 = window.__otvDeck;
  for (const d of D.concat(['ГКБ 24', 'ГКБ 24 (2)', 'ГКБ 24 (3)']).map(x => window.__otvDeck.slideDept ? window.__otvDeck.slideDept(x) : x)) await db.collection('deckPhotos').doc('dept_' + d.replace(/\\s+/g, '_')).set({ key: d, kind: 'dept', src, at: '2026-10-27' });
  // самые длинные допустимые цитаты (верхняя граница полосы), свои фразы
  const q85 = 'Объяснила буквально каждый этап до операции, во время неё и после, спасибо за заботу!!';
  const q110 = 'Спасибо Вам большое за профессионализм, чуткость и мастерство, за внимание к каждому вопросу до и после операции';
  const q100 = 'Огромное спасибо за профессионализм, внимательность и деликатный подход, всё объяснили до мелочей ок';
  const quote = {}; staff.slice(0, 4).forEach(x => { const p = x[0].split(' '); quote[p[0] + ' ' + p[1][0] + '.' + p[2][0] + '.'] = q85.slice(0, 85); });
  const sh = i => { const p = staff[i][0].split(' '); return p[0] + ' ' + p[1][0] + '.' + p[2][0] + '.'; };
  await db.collection('deckPicks').doc('2026-10-23').set({ quote, reviewText: { quote: q110 }, voices: [4, 5, 6].map(i => ({ short: sh(i), quote: q100.slice(0, 100) })), own: [q85.slice(0, 85), q110, q100.slice(0, 100)] });
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        await pg.evaluate(SETUP, [FR, FB])
        await pg.evaluate("window.__otvShowTab('deckw')"); await pg.wait_for_timeout(300)
        await pg.evaluate("window.__otvDeckUi.rebuild()"); await pg.wait_for_timeout(3000)
        for _ in range(8):
            loc = pg.locator(".deck-need button.primary >> visible=true")
            if not await loc.count(): break
            await loc.first.click(); await pg.wait_for_timeout(1500)
        await pg.wait_for_timeout(2500)
        r = await pg.evaluate("""() => { const st = window.__otvDeckUi._state(); const ui = document.querySelector('.deck-ui');
          const sizes = id => { const sec = document.querySelector('.deck-slide-in section#' + id); return sec ? [...sec.querySelectorAll('p[data-fs0]:not([data-fitw])')].map(e => parseFloat(e.style.fontSize) / +e.getAttribute('data-fs0')).filter(k => k < 0.999) : []; };
          return { ok: ui.innerText.includes('Вёрстка проверена'), bad: [...ui.querySelectorAll('.bad')].map(x => x.textContent).slice(0, 6), cards: st.res.D.heroes.cards.length, rest: st.res.D.heroes.rest.length,
                   rq: st.res.D.review.quote.length, sur: [...document.querySelectorAll('.deck-slide-in section#heroes [data-fitw="sur"]')].map(e => parseFloat(e.style.fontSize)), shrink: { heroes: sizes('heroes'), review: sizes('review') }, need: st.res.need.map(n => n.text) }; }""")
        if '--dbg' in sys.argv:
            print(await pg.evaluate("""() => { const sec = document.querySelector('.deck-slide-in section#where'); const tmp = document.createElement('div'); tmp.className = 'deck-measure'; document.body.append(tmp);
              const c = sec.cloneNode(true); c.querySelectorAll('[data-fs0]').forEach(e => { e.style.fontSize = e.getAttribute('data-fs0') + 'px'; }); tmp.append(c); window.__otvDeck.fitSlide(c); const r = window.__otvDeck.layoutIssues(c); tmp.remove(); return r; }"""))
        ok1 = r['ok'] and not r['bad'] and r['cards'] == 4 and r['rest'] >= 10 and r['rq'] >= 80
        print(('OK  ' if ok1 else 'FAIL') + ' большой объём: 4 карточки, ' + str(r['rest']) + ' в строке «Ещё», длинные цитаты — вёрстка без замечаний', r if not ok1 else '')
        allk = [k for v in r['shrink'].values() for k in v]
        ok2 = len(set(r['sur'])) == 1 and r['sur'][0] >= 24 and all(k >= 0.799 for k in allk) and len(set(round(k, 3) for k in r['shrink']['heroes'])) <= 1
        print(('OK  ' if ok2 else 'FAIL') + ' текст уменьшен не больше чем на 20% и одинаково по слайду; фамилии в карточках одного размера', r['shrink'] if not ok2 else '')
        if '--shot' in sys.argv:
            for i in (2, 3, 4):
                el = pg.locator('.deck-slide').nth(i); await el.scroll_into_view_if_needed(); await el.screenshot(path='/tmp/claude-0/-home-claude/8b71b450-7313-51fa-9702-f77ccc1a59a9/scratchpad/vol_%d.png' % (i + 1))
        # две колонки читаются слева направо: левая сверху вниз, потом правая — по убыванию, как список
        oo = await pg.evaluate("""() => { const sec = document.querySelector('.deck-slide-in section#where'), list = sec.querySelector('[data-fit="list"]');
          const names = window.__otvDeckUi._state().res.D.where.one.map(x => x.name), rows = [...list.children].slice(1);
          const pos = names.map(n => { const r = rows.find(x => x.querySelector('p').textContent.replace(/\\u00a0/g, ' ') === n); const b = r.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top)]; });
          return { cols: list.getAttribute('data-cols'), pos }; }""")
        half = (len(oo['pos']) + 1) // 2
        L, Rr = oo['pos'][:half], oo['pos'][half:]
        ok4 = oo['cols'] == '2' and len(set(x for x, _ in L)) == 1 and len(set(x for x, _ in Rr)) == 1 and L[0][0] < Rr[0][0] and all(L[i][1] < L[i + 1][1] for i in range(len(L) - 1)) and all(Rr[i][1] < Rr[i + 1][1] for i in range(len(Rr) - 1))
        print(('OK  ' if ok4 else 'FAIL') + ' «Отделения», две колонки: сначала левая сверху вниз, потом правая', oo if not ok4 else '')
        ok3 = not errs and ok4
        print(('OK  ' if ok3 else 'FAIL') + ' без ошибок на странице', errs[:3] if errs else '')
        await b.close(); print('ALL OK' if ok1 and ok2 and ok3 else 'SOME FAILED')
asyncio.run(main())
