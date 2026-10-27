# Окна «Обжалование», «Этический комитет», «Написать спасибо», «Ответить на вопрос» работают в программе без онлайн-сервиса.
# Обжалование — по утверждённой схеме: просьба один раз, цитаты, основания для формы площадки, короткая версия до 450 знаков. Тексты выдуманные
import asyncio, sys, re
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
REV = ("Лежала в хирургии 3.10. Доктор Петров на мои вопросы отвечал в грубой форме, как заведенный повторял «идите в палату и не мешайте». "
       "Лечение было неэффективно, мне не назначили обезболивание. Медсестра пояснила, что она из ближнего зарубежья и по-русски плохо понимает. Ужасное отношение, никому не советую!")
AD = "Помогаем бизнесу усиливать репутацию в Яндекс и 2ГИС. 2ГИС — 50 отзывов: 3 700 ₽. Пишите в t.me/reput"
async def gen(pg, tab, fill):
    await pg.evaluate("t => window.__otvShowTab(t)", tab); await pg.wait_for_timeout(200)
    for sel, val in fill: await pg.fill("#tab-" + tab + " " + sel, val)
    await pg.click("#tab-" + tab + " button:has-text('Сформировать')"); await pg.wait_for_timeout(500)
    return await pg.evaluate("t => ({texts: [...document.querySelectorAll('#tab-' + t + ' .res-ta')].map(x => x.value), heads: [...document.querySelectorAll('#tab-' + t + ' .res-h')].map(x => x.textContent), note: document.querySelector('#tab-' + t + ' .note').textContent, err: (document.querySelector('#tab-' + t + ' .gen-status:not([hidden])') || {}).textContent || ''})", tab)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1100, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        a = await gen(pg, "appeal", [("[data-k=review]", REV)])
        full, short = (a['texts'] + ['', ''])[:2]
        ok1 = (full.startswith("Здравствуйте! Просим снять отзыв с публикации: он порочит репутацию больницы") and full.count("Просим") == 1
               and "Петров" in full and "дискриминацию по национальному признаку" in full and "Недопустимы фразы: «" in full
               and "врачебная комиссия по медицинской документации" in full and "\n\n" in full and len(short) <= 450
               and "Нарушение законов РФ" in a['note'] and "Нецензурная лексика, оскорбления" in a['note']
               and not re.search(r"сожалеем|извините|в целом|нарушает правила площадки|и удалить", full))
        print(('OK  ' if ok1 else 'FAIL') + ' обжалование по утверждённой схеме, основания для формы, короткое до 450 знаков', a if not ok1 else '')
        ad = await gen(pg, "appeal", [("[data-k=review]", AD)])
        ok2 = ad['texts'] and "реклама сторонних услуг" in ad['texts'][0] and "Спам, реклама" in ad['note']
        print(('OK  ' if ok2 else 'FAIL') + ' реклама: обжалование как спам, без личного опыта', ad if not ok2 else '')
        await pg.evaluate("window.__otvShowTab('ethics')"); await pg.wait_for_timeout(200)
        await pg.fill("#tab-ethics [data-list=reviews] .rev textarea", REV)
        await pg.click("#tab-ethics button:has-text('Сформировать')"); await pg.wait_for_timeout(500)
        e = await pg.evaluate("() => (document.querySelector('#tab-ethics .res-ta') || {}).value || ''")
        ok3 = e.startswith("Здравствуйте, уважаемые члены этического комитета!") and "Основания обжалования:" in e and "gb24-press2@zdrav.mos.ru" in e and "сожалеем" not in e
        print(('OK  ' if ok3 else 'FAIL') + ' письмо в этический комитет по образцу', e[:300] if not ok3 else '')
        t = await gen(pg, "thanks", [("[data-k=review]", "Огромное спасибо врачам хирургического отделения за операцию и заботу!")])
        ok4 = len(t['texts']) >= 2 and all(x.startswith("Здравствуйте") and "С уважением, администрация 24 Московской больницы" in x for x in t['texts'])
        print(('OK  ' if ok4 else 'FAIL') + ' «Спасибо»: несколько вариантов из шаблонов', t if not ok4 else '')
        q = await gen(pg, "question", [("[data-k=question]", "Подскажите, как записаться на плановую госпитализацию в хирургию?")])
        ok5 = q['texts'] and len(q['texts'][0]) > 40 and not q['err']
        print(('OK  ' if ok5 else 'FAIL') + ' «Ответить на вопрос» по шаблонам', q if not ok5 else '')
        k = await pg.evaluate("""async () => {
          const n = await window.__otvKbImportTraining({ 'правила': { 'ответы': ['Негатив: не отвечаем позитивом'] }, 'разборы_22_10_2026': { items: [
            { platform: 'Яндекс', date: '2026-10-20', review: 'Врачи хорошие, но в приёмном долго ждали', reply: 'Здравствуйте.\\n\\nСпасибо за обратную связь.\\n\\nС уважением, администрация 24 Московской больницы', appeal: 'Здравствуйте! Просим снять отзыв с публикации: он порочит репутацию больницы.' } ] },
            'утверждённые_примеры': [{ 'тип': 'обжалование', 'площадка': 'ПроДокторов', 'текст': 'Здравствуйте! Просим снять отзыв с публикации: текст эмоционален и субъективен.' }] });
          await new Promise(r => setTimeout(r, 300));
          const kb = window.__otvAll('kb'), rows = Object.keys(kb).filter(x => x.indexOf('train-') === 0).map(x => kb[x]);
          const again = await window.__otvKbImportTraining({ 'утверждённые_примеры': [{ 'тип': 'обжалование', 'текст': 'Здравствуйте! Просим снять отзыв с публикации: текст эмоционален и субъективен.' }] });
          return { n, rows: rows.length, kinds: rows.map(r => r.kind).sort().join(','), edited: rows.every(r => r.edited), again };
        }""")
        ok7 = k['n'] == 3 and k['rows'] == 3 and k['kinds'] == 'appeal,appeal,review' and k['edited'] and k['again'] == 0
        print(('OK  ' if ok7 else 'FAIL') + ' база обучения загружается в «Базу ответов» как ваши правки, повторно не дублируется', k if not ok7 else '')
        ok6 = not errs
        print(('OK  ' if ok6 else 'FAIL') + ' без ошибок на странице', errs[:3] if errs else '')
        await b.close(); print('ALL OK' if all([ok1, ok2, ok3, ok4, ok5, ok6, ok7]) else 'SOME FAILED')
asyncio.run(main())
