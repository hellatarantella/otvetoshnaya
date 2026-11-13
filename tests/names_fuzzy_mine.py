# 13.11: «опять не все имена в ответе» (четверо названных — в ответе трое); «люди часто неверно называют сотрудников —
# надо понимать, кто это, по списку, корректно отвечать и вносить в отчёты»; «мои правки должны учитываться и идти в дело».
# Данные выдуманные
import asyncio, sys, json, re
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
ST = [["Эшматов Хафиз Искандарович", "врач-хирург", "Хирургическое отделение 1"], ["Гуськова Алёна Александровна", "медицинская сестра", "Хирургическое отделение 1"],
      ["Немыкина Инна Васильевна", "медицинская сестра", "Хирургическое отделение 1"], ["Сорокина Елена Ивановна", "врач-анестезиолог-реаниматолог", "Отделение анестезиологии-реанимации"],
      ["Лебедев Константин Павлович", "врач-уролог", "Урологическое отделение"], ["Захарова Марина Олеговна", "врач-кардиолог", "Кардиологическое отделение 2"]]
FOUR = ("Хочу поблагодарить хирурга Эшматова Хафиза Искандаровича за операцию, анестезиолога Сорокину Елену Ивановну, "
        "медсестру Гуськову Алёну Александровну и медсестру Немыкину Инну Васильевну за заботу. Всё прошло отлично, спасибо!")
FUZZ = [("Огромное спасибо врачу Лебедеву Константину Петровичу, всё объяснил и помог.", "Лебедев Константин Павлович"),   # перепутано отчество
        ("Спасибо кардиологу Захаровой Марине Алеговне за лечение.", "Захарова Марина Олеговна"),   # опечатка в отчестве при полном ФИО
        ("Спасибо доктору Лебедеву К.П. и доктору Лебедову за помощь в урологии.", "Лебедев Константин Павлович"),   # опечатка в фамилии
        ("Спасибо Марине Олеговне Захаровой, лучший кардиолог.", "Захарова Марина Олеговна"),
        ("Отдельное спасибо Константину Павловечу — очень внимательный уролог.", "Лебедев Константин Павлович")]   # опечатка в отчестве
MY = "Спасибо, что поделились впечатлениями о лечении. Очень приятно знать, что забота наших сотрудников помогла вам спокойно пройти обследование. Желаем вам крепкого здоровья и всего самого доброго."
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(2500)
        r = await pg.evaluate("""async ([ST, FOUR, FUZZ, MY]) => { const refs = Object.assign({}, window.__otvReports.refs() || {}); refs.staff = ST; window.__otvReports._setRefs(refs);
          const it = { platform: 'ПроДокторов', page: 'Страница больницы', review: FOUR, rating: 5, author: 'Ирина' };
          const four = [window.__otvGen.answer(it).text]; for (let i = 0; i < 4; i++) four.push(await window.__otvVariant({ kind: 'answer', platform: it.platform, page: it.page, review: FOUR, author: 'Ирина', rating: 5 }));
          const fz = FUZZ.map(([t, who]) => ({ who, got: (window.__otvReports.people(t, 'Страница больницы') || []).map(x => x.fio || x.name || (x.p && x.p.fio) || JSON.stringify(x)) }));
          const fixA = window.__otvGen.answer({ platform: 'Яндекс', page: 'ГКБ 24', review: 'Лечился в урологии. Отдельное спасибо Константину Павловечу — очень внимательный врач, всё объяснил.', rating: 5, author: '' }).text;
          const db = await window.__otvRt.use('db');
          await db.collection('answers').doc('my1').set({ platform: 'Яндекс', page: 'ГКБ 24', review: 'Проходила обследование в больнице, персонал очень заботливый, всё спокойно и понятно объяснили.', status: 'published', edited: true, tone: 'positive', answer: 'Здравствуйте, Ольга!\\n' + MY + '\\nС уважением, администрация 24 Московской больницы' });
          await new Promise(r => setTimeout(r, 400));
          const mine = window.__otvLibrary.mine({ review: 'Была на обследовании, сотрудники заботливые, всё спокойно объяснили, спасибо.' }, 'hospital');
          const other = window.__otvLibrary.mine({ review: 'Отличная больница!' }, 'doctor');
          return { four, fz, mine, other, fixA }; }""", [ST, FOUR, FUZZ, MY])
        res = []
        miss = [(v, [n for n in ['Хафизу Искандаровичу', 'Елене Ивановне', 'Алёне Александровне', 'Инне Васильевне'] if n not in v]) for v in r['four'][:1]]
        miss = [m for m in miss if m[1]]
        res.append((not miss, 'четверо названных в отзыве — все в ответе (в том числе Инна Васильевна)', miss))
        bad = [(FUZZ[i][0], x) for i, x in enumerate(r['fz']) if not any(x['who'] in g for g in x['got'])]
        res.append((not bad, 'сотрудник назван с ошибкой (отчество, буква в фамилии или отчестве) — узнан по списку', bad))
        res.append(('Константину Павловичу' in r['fixA'] and 'Павловечу' not in r['fixA'], 'в ответе имя — как в списке сотрудников, а не с ошибкой из отзыва', r['fixA']))
        ok_m = r['mine'] and r['mine'][0]['key'] == 'my:my1' and 'Ольга' not in r['mine'][0]['raw'] and 'обследование' in r['mine'][0]['raw']
        res.append((ok_m, 'ваш исправленный ответ — среди целых ответов для похожего отзыва (без имени и подписи)', r['mine'][:1]))
        res.append((not r['other'], 'ответ со страницы больницы не идёт на страницу врача', r['other']))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        ok = True
        for good, name, info in res: print(('OK   ' if good else 'FAIL ') + name + ('' if good else '  ' + json.dumps(info, ensure_ascii=False)[:700])); ok = ok and good
        print('ALL OK' if ok else 'FAILED'); await b.close(); sys.exit(0 if ok else 1)
asyncio.run(main())
