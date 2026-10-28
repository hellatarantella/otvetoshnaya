# Слайды 4 и 5 (28.10): правка цитаты на слайде не ломает размер шрифта (вставка с оформлением, Enter),
# старая подтверждённая цитата-рассказ («Процедура … длилась 30 минут») отсеивается и программа просит выбрать заново,
# своя фраза сохраняется, у отзыва недели и голосов есть выбор цитаты, места на «Отделениях» — отдельными плашками
import asyncio, sys, os, base64
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
SETUP = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'demo', 'deck_setup_week.js'), encoding='utf-8').read().split('\n', 1)[1]
FR = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'rb').read()).decode()
FB = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'rb').read()).decode()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        await pg.evaluate(SETUP, [FR, FB])
        # прежние решения недели: голос Ялымова с рассказом о процедуре; своя фраза для Соколова
        await pg.evaluate("""async () => { const db = await window.__otvRt.use('db');
          await db.collection('deckPicks').doc('2026-10-23').set({ voices: [{ short: 'Ялымов А.А.', quote: 'Процедура проводилась в реанимационном отделении и длилась 30 минут' }, { short: 'Соколов И.И.', quote: 'Иван Ильич нашёл время для каждого вопроса нашей семьи' }],
            own: ['Иван Ильич нашёл время для каждого вопроса нашей семьи'] }); }""")
        await pg.evaluate("window.__otvShowTab('deckw')"); await pg.wait_for_timeout(300)
        await pg.evaluate("window.__otvDeckUi.rebuild()"); await pg.wait_for_timeout(2500)
        s1 = await pg.evaluate("""() => { const st = window.__otvDeckUi._state(), r = st.res;
          const v = r.need.filter(n => n.kind === 'voices')[0], rv = r.choices.filter(c => c.kind === 'review')[0];
          const slide = (document.querySelector('.deck-slide-in section#review') || {}).textContent || '';
          return { voicesNeed: v && v.text, onSlide: /длилась 30 минут/.test(slide), voices: r.D.review.voices.map(x => x.quote),
                   revVariants: rv.options.filter(o => o.key === rv.current)[0].quotes.length, voiceVariants: r.choices.filter(c => c.kind === 'voices')[0].options.map(o => o.quotes.length) }; }""")
        ok1 = s1['voicesNeed'] and 'не благодарность' in s1['voicesNeed'] and not s1['onSlide']
        print(('OK  ' if ok1 else 'FAIL') + ' старая цитата-рассказ отсеяна, программа просит подтвердить голоса заново', s1 if not ok1 else '')
        ok2 = s1['revVariants'] >= 2 and max(s1['voiceVariants']) >= 2
        print(('OK  ' if ok2 else 'FAIL') + ' у отзыва недели и голосов несколько вариантов цитаты', s1 if not ok2 else '')
        firsts = [q.split()[0].lower() for q in s1['voices']]
        ok3 = len(set(firsts)) == len(firsts)
        print(('OK  ' if ok3 else 'FAIL') + ' цитаты голосов начинаются по-разному', s1['voices'] if not ok3 else '')
        # «Пересмотреть выбор»: у голоса — выбор цитаты; своя фраза проходит перепроверку
        s2 = await pg.evaluate("""async () => {
          const d = [...document.querySelectorAll('.deck-extra')].find(x => /Пересмотреть выбор/.test(x.textContent)); d.open = true;
          const row = [...d.querySelectorAll('.deck-need')].find(r => /голоса недели/.test(r.textContent));
          const slots = row.querySelectorAll('.deck-voice'), sel0 = slots[0].querySelector('select'), opts = window.__otvDeckUi._state().res.choices.filter(c => c.kind === 'voices')[0].options;
          const k = opts.findIndex(o => o.short === 'Соколов И.И.'); sel0.value = String(k); sel0.dispatchEvent(new Event('change'));
          const inp = slots[0].querySelector('input.deck-in'); inp.value = 'Иван Ильич нашёл время для каждого вопроса нашей семьи'; inp.dispatchEvent(new Event('input'));
          const qsel = slots[0].querySelector('.deck-qp select');
          [...row.querySelectorAll('button')].find(b => /Подтвердить голоса/.test(b.textContent)).click();
          await new Promise(r => setTimeout(r, 2500));
          const st = window.__otvDeckUi._state();
          return { hasQuoteSelect: !!qsel, slots: slots.length, v0: st.res.D.review.voices[0] && st.res.D.review.voices[0].quote, need: st.res.need.filter(n => n.kind === 'voices').length };
        }""")
        ok4 = s2['hasQuoteSelect'] and s2['slots'] == 3 and s2['v0'] == 'Иван Ильич нашёл время для каждого вопроса нашей семьи' and s2['need'] == 0
        print(('OK  ' if ok4 else 'FAIL') + ' голос: выбор врача и цитаты, своя фраза сохраняется', s2 if not ok4 else '')
        # правка на слайде: вставка с оформлением и Enter не меняют размер шрифта
        await pg.evaluate("""() => { const t = [...document.querySelectorAll('.deck-slide-in section#review p')].find(x => x.textContent.startsWith('«')); t.scrollIntoView(); t.focus();
          const r = document.createRange(); r.selectNodeContents(t); r.collapse(false); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); }""")
        await pg.evaluate("""() => { const t = [...document.querySelectorAll('.deck-slide-in section#review p')].find(x => x.textContent.startsWith('«')); const dt = new DataTransfer();
          dt.setData('text/html', '<span style="font-size:13px;font-family:Times">за профессионализм, чуткость и мастерство</span>'); dt.setData('text/plain', ' за профессионализм, чуткость и мастерство');
          t.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }""")
        await pg.evaluate("document.execCommand('insertText', false, ' и опыт')")
        rest = await pg.evaluate("() => document.querySelectorAll('.deck-slide-in [contenteditable]').length")
        await pg.keyboard.press('Enter'); await pg.keyboard.type(' ещё'); await pg.wait_for_timeout(300)
        await pg.evaluate("document.activeElement && document.activeElement.blur()"); await pg.wait_for_timeout(800)
        s3 = await pg.evaluate("""() => { const t = [...document.querySelectorAll('.deck-slide-in section#review p')].find(x => x.textContent.startsWith('«'));
          const sizes = new Set(); const w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.textContent.trim()) sizes.add(getComputedStyle(n.parentElement).fontSize);
          return { rest: document.querySelectorAll('.deck-slide-in [contenteditable]').length, text: t.textContent, kids: t.children.length, sizes: [...sizes], saved: JSON.stringify((window.__otvDeckUi._state().picks['2026-10-23'] || {}).edits || {}).includes('font-size:13px') }; }""")
        ok5 = rest == 1 and s3['rest'] == 0 and 'и\u00a0опыт' in s3['text'] and 'мастерство' in s3['text'] and s3['kids'] == 0 and s3['sizes'] == ['50px'] and not s3['saved']
        print(('OK  ' if ok5 else 'FAIL') + ' правка на слайде: текст вставлен, шрифт один, после «и» неразрывный пробел, вне правки слайд не редактируемый', s3 if not ok5 else '')
        # правка переживает пересборку и тоже без чужого оформления
        await pg.evaluate("window.__otvDeckUi.rebuild()"); await pg.wait_for_timeout(2000)
        s4 = await pg.evaluate("""() => { const t = [...document.querySelectorAll('.deck-slide-in section#review p')].find(x => x.textContent.startsWith('«')); return { text: t.textContent, kids: t.children.length, size: getComputedStyle(t).fontSize }; }""")
        ok6 = 'мастерство' in s4['text'] and s4['kids'] == 0 and s4['size'] == '50px'
        print(('OK  ' if ok6 else 'FAIL') + ' правка сохранена и после пересборки', s4 if not ok6 else '')
        # «Отделения»: каждое отделение — своя плашка, вёрстка без замечаний
        s5 = await pg.evaluate("""() => { const sec = document.querySelector('.deck-slide-in section#where'); const chips = [...sec.querySelectorAll('[data-fit="chip"]')].map(x => x.textContent);
          const st = window.__otvDeckUi._state();
          return { heads: /Место/.test(sec.textContent) && /Благодарностей/.test(sec.textContent), roles: st.res.D.review.voices.map(v => v.role).concat([st.res.D.review.lineAfter]), chips, panels: sec.querySelectorAll('[data-fit="gold"]').length, ui: document.querySelector('.deck-ui').innerText.includes('Вёрстка проверена') }; }""")
        ok7 = s5['heads'] and not any(('зав.' in r or 'хирург' in r or 'невролог,' in r) for r in s5['roles']) and s5['panels'] == 1 and 'ОРИТ №2' in [c.replace(' ', ' ') for c in s5['chips']] and len(s5['chips']) >= 5 and not any('·' in c for c in s5['chips'])
        print(('OK  ' if ok7 else 'FAIL') + ' «Отделения»: таблица мест с заголовками, отделения плашками; на слайде 4 подписи — фамилия и отделение', s5 if not ok7 else '')
        ok8 = not errs
        print(('OK  ' if ok8 else 'FAIL') + ' без ошибок на странице', errs[:3] if errs else '')
        await b.close(); print('ALL OK' if all([ok1, ok2, ok3, ok4, ok5, ok6, ok7, ok8]) else 'SOME FAILED')
asyncio.run(main())
