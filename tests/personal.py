# Персонализация (05.11): ответ подбирается под повод в отзыве — рекомендует, снова с нами, впервые, лечились близкие,
# скорая/ночь, медсёстры, питание, чистота; в жалобе — ожидание, грубость, питание, грязь, документы, оплата.
# На странице врача ничего не «передаём»; отзыв не пересказываем; все варианты проходят проверку текста. Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
CASES = [
  ("рекомендует", "Карточка больницы", 5, "Отличная больница, всем рекомендую!", r"рекомендуете нас|вашу рекомендацию"),
  ("снова с нами", "Карточка больницы", 5, "Лечусь у вас уже не первый раз, всё как всегда хорошо, спасибо.", r"снова выбрали|возвращаетесь"),
  ("близкие", "Карточка больницы", 5, "Моя мама лежала в терапии, спасибо за отношение, всё хорошо.", r"родном человеке"),
  ("скорая ночью", "Карточка больницы", 5, "Привезли на скорой ночью, всё сделали быстро, спасибо.", r"непростой момент|помощь пришла вовремя|без лишнего ожидания|организовано удобно"),
  ("медсёстры", "Карточка больницы", 5, "Отдельное спасибо медсёстрам, очень заботливые.", r"медсёстрам|Медсёстрам"),
  ("питание", "Карточка больницы", 5, "Кормили вкусно, палаты чистые, спасибо.", r"пищеблока|следят за чистотой|комфортно в палате"),
  ("врач: рекомендует", "Страница врача: Соколова А.В.", 5, "Прекрасный доктор, рекомендую!", r"при выборе специалиста|с выбором врача"),   # 06.11: на странице врача — без «нас»
  ("жалоба: ожидание", "Карточка больницы", 1, "Четыре часа ждали в приёмном, ужасно.", r"ожидание было как можно короче"),
  ("жалоба: грубость", "Карточка больницы", 1, "Медсестра нагрубила, никакого уважения.", r"Уважительное отношение"),
  ("жалоба: документы", "Карточка больницы", 2, "Неделю не могут выдать выписку, безобразие.", r"документы не выдали"),
]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        res = []
        for name, page, rating, review, rx in CASES:
            R = await pg.evaluate("""([page, rating, review, rx]) => { const G = window.__otvGen, it = { platform: 'Яндекс', page, author: 'Олег', rating, review }, out = [], keys = [];
              for (let i = 0; i < 5; i++) { const a = G.answer(it, { exclude: keys }); if (!a) break; keys.push(a.key); out.push(a.text); }
              const re = new RegExp(rx), lint = out.map(t => window.__otvLint({ page, kind: '', review }, t)).filter(w => w.length);
              return { hit: out.filter(t => re.test(t)).length, top: re.test(out[0] || ''), n: out.length, lint, doctorPass: /врача/.test(page) ? out.filter(t => /передад/i.test(t.replace(/С уважением.*$/, ''))).length : 0, sample: out[0] }; }""", [page, rating, review, rx])
            ok = (R["hit"] >= 2 or (R["top"] and "врача" in page)) and not R['lint'] and not R['doctorPass']
            res.append((ok, name + ': подобрано в ' + str(R['hit']) + ' из ' + str(R['n']) + ' вариантов' + (' (первый — подобранный)' if R['top'] else ''), R))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else json.dumps(d, ensure_ascii=False)[:900])
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
