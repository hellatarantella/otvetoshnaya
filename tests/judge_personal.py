# 06.11: на два подробных отзыва о враче программа предложила один и тот же короткий общий ответ.
# Теперь: судья ценит ответ «под повод отзыва»; один текст не выдаётся двум отзывам подряд; «обнаружена» — не «жена»
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""() => { const J = window.__otvJudge, C = window.__otvCompose, G = window.__otvGen;
          const R1 = 'У меня была обнаружена гиперплазия. Врач грамотно объяснил, какие анализы нужно собрать, спокойно рассказал, как будет делать операцию. Всё прошло отлично, восстановился быстро.';
          const R2 = 'Попал на консультацию с кистой. После обследований врач провёл операцию, всё прошло отлично, удалили всё, что доставляло проблем. Врач ежедневно следил за состоянием. Рекомендую.';
          const req = { review: R1, page: 'Страница врача: Алексеев А.А.', platform: 'ПроДокторов' };
          const S = 'С уважением, администрация 24 Московской больницы';
          const gen = 'Здравствуйте!\\nСпасибо за подробный отзыв. Ценим ваше доверие и всегда готовы помочь.\\n' + S;
          const per = 'Здравствуйте!\\nСпасибо за подробный отзыв. Рады, что вам всё понятно объяснили. Желаем здоровья и всего самого доброго.\\n' + S;
          const fg = J.features(gen, req), fp = J.features(per, req);
          const fam = C.persOf(R1, 'doctor', 'positive').map(x => x.id);
          const a1 = G.answer({ platform: 'ПроДокторов', page: 'Страница врача: Алексеев А.А.', rating: 5, review: R1 }, {});
          const a2 = G.answer({ platform: 'ПроДокторов', page: 'Страница врача: Вишняков Д.В.', rating: 5, review: R2 }, {});
          const sar = { platform: 'Яндекс', page: 'Карточка больницы', rating: 2, review: 'Приехал в полуобморочном состоянии, сказали здоров. На следующий день скорая увезла в другую больницу. Спасибо 24-й, что не сдох.' };
          const c1 = G.check('Здравствуйте!\\nСпасибо за отзыв и добрые слова о работе нашей команды. Напишите на gkb24@zdrav.mos.ru.\\n' + S, sar, 'negative');
          const a3 = G.answer(sar, {});
          return { sarOk: !c1.ok && !/добрые слова|тёплые слова/.test((a3 && a3.text) || ''), last: [fg[fg.length - 1], fp[fp.length - 1]], better: J.score(per, req) > J.score(gen, req), n: J.NAMES.length, w: J.weights().length, fam, t1: a1 && a1.text, t2: a2 && a2.text }; }""")
        res = [(r['last'] == [0, 1] and r['better'] and r['n'] == r['w'], 'судья: ответ под повод отзыва выше общего', r),
               ('pp_fam' not in r['fam'], '«обнаружена» не считается упоминанием жены', r['fam']),
               (r['t1'] and r['t2'] and r['t1'] != r['t2'], 'два отзыва подряд — разные ответы', [r['t1'], r['t2']]),
               (r['sarOk'], 'оценка 2 из 5 с сарказмом «спасибо, что не сдох» — без «добрых слов»', r.get('sarOk')),
               (not errs, 'без ошибок страницы', errs[:3])]
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else json.dumps(d, ensure_ascii=False)[:1200])
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
