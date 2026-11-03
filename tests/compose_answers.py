# Умные ответы на всё: благодарность (больница и страница врача), жалоба, смешанный отзыв, вопрос —
# варианты проходят правила справочника и речевую проверку, разные между собой, учатся по фразам. Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
CASES = [
  ("благодарность больнице", {"platform": "Яндекс", "page": "Карточка больницы", "author": "Олег", "rating": 5, "review": "Лежал в отделении две недели. Всё чисто, персонал вежливый и внимательный, кормили хорошо. Огромное спасибо всем сотрудникам за заботу и терпение, рекомендую."}),
  ("благодарность на странице врача", {"platform": "ПроДокторов", "page": "Страница врача: Соколова А.В.", "author": "Ирина", "rating": 5, "review": "Анна Викторовна внимательный врач, всё объяснила спокойно и подробно. Спасибо!"}),
  ("жалоба", {"platform": "Яндекс", "page": "Карточка больницы", "author": "Светлана", "rating": 1, "review": "Ужасно! Четыре часа ждали в приёмном, никто ничего не объяснял, грубили. Никому не рекомендую!"}),
  ("смешанный", {"platform": "Яндекс", "page": "Карточка больницы", "author": "Гость", "rating": 3, "review": "Врачам огромное спасибо, золотые руки. Но в палате было грязно и холодно, на просьбы никто не реагировал."}),
  ("вопрос", {"platform": "Сайт", "page": "Письмо с сайта", "author": "Мария", "kind": "question", "review": "Здравствуйте! Подскажите, как записаться на консультацию к неврологу?"}),
]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        res = []
        for name, it in CASES:
            R = await pg.evaluate("""(it) => { const G = window.__otvGen, S = window.__otvSpeech, out = [], keys = [];
              for (let i = 0; i < 8; i++) { const a = G.answer(it, { exclude: keys, current: out[out.length - 1] || '' }); if (!a) break; keys.push(a.key); out.push(a.text); }
              const tone = G.toneOf(it);
              return { n: out.length, uniq: new Set(out).size, cmp: keys.filter(k => k.startsWith('cmp:')).length,
                bad: out.map(t => G.check(t, it, tone)).filter(c => !c.ok).map(c => c.why), score: Math.min(...out.map(t => S.audit(t).score)),
                miss: out.map(t => S.covers(t, it.review)).filter(m => m.length), sample: out.slice(0, 2),
                forbidden: out.filter(t => /сожале|извин|клиник|медицинск\\S* центр/i.test(t)).length,
                docRule: it.page.includes('врача') ? out.filter(t => /передад|больниц/i.test(t.replace(/С уважением.*$/, ''))).length : 0,
                negHealth: tone === 'negative' && it.kind !== 'question' ? out.filter(t => /Желаем здоровья/.test(t)).length : 0 }; }""", it)
            ok = R['n'] >= 5 and R['uniq'] == R['n'] and R['cmp'] >= 1 and not R['bad'] and R['score'] >= 7 and not R['forbidden'] and not R['docRule'] and not R['negHealth'] and (name == 'вопрос' or not R['miss'])
            res.append((ok, name + ': ' + str(R['n']) + ' разных вариантов, правила и речь (мин. ' + str(R['score']) + ' из 10) соблюдены', R))
        # учится по фразам: оставленный собранный вариант поднимает свои фразы
        L = await pg.evaluate("""() => { const G = window.__otvGen, it = { platform: 'Яндекс', page: 'Карточка больницы', author: 'Олег', rating: 5, review: 'Спасибо всем, всё хорошо.' };
          let a = null; for (let i = 0; i < 30 && !(a && a.key.startsWith('cmp:')); i++) a = G.answer(it, {});
          if (!a || !a.key.startsWith('cmp:')) return null; const part = a.key.split(':')[2].split('.')[0];
          for (let i = 0; i < 3; i++) G.notePick(a.key);
          const v = window.__otvCompose.variants(it, { tone: 'positive', type: 'hospital' }, 40).filter(x => x.parts.includes(part)).length;
          return { key: a.key, part, withPart: v }; }""")
        res.append((L is not None and L['withPart'] >= 1, 'оставленный вариант запоминается по фразам', L))
        # справка: программа сама собирает факты из ваших ответов на вопросы и берёт их в ответ по смыслу
        F = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db');
          await db.collection('kb').doc('q-test').set({ kind: 'question', status: 'published', situation: 'Как получить выписку из истории болезни?', answer: 'Здравствуйте! Выписку можно получить в окне справочной в корпусе 1 по будням с 9:00 до 16:00. При себе нужен паспорт. С уважением, администрация 24 Московской больницы' });
          await new Promise(r => setTimeout(r, 7500));
          const fx = Object.values(window.__otvFacts.all()).map(f => f.text);
          await window.__otvFacts.addOwn('Посещения пациентов в стационаре — ежедневно с 17:00 до 19:00.', 'посещение часы посещения навестить');
          const G = window.__otvGen, it = { platform: 'Сайт', page: 'Письмо с сайта', kind: 'question', review: 'Подскажите, как получить выписку из истории болезни после лечения?' };
          const a = G.answer(it, {}), it2 = { platform: 'Сайт', kind: 'question', review: 'В какие часы посещения можно навестить маму в стационаре?' }, b = G.answer(it2, {});
          const c = G.answer({ platform: 'Сайт', kind: 'question', review: 'Есть ли парковка у больницы?' }, {});
          await new Promise(r => setTimeout(r, 300));
          return { fx, a: a && a.text, b: b && b.text, c: c && c.text, block: !!document.getElementById('kbFacts') || true }; }""")
        ok = any('окне справочной' in x for x in F['fx']) and 'окне справочной' in (F['a'] or '') and '17:00' in (F['b'] or '') and '17:00' not in (F['c'] or '') and 'справочной' not in (F['c'] or '')
        res.append((ok, 'справка: факт из вашего ответа найден сам и попал в ответ на похожий вопрос; ваш факт — тоже; на чужой вопрос факты не лезут', F))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else json.dumps(d, ensure_ascii=False)[:1500])
        await b.close(); print('ALL OK' if all(r[0] for r in res) else 'SOME FAILED')
asyncio.run(main())
