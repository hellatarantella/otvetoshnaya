# 12.11: «очень долго пишет варианты… и не в тему»: на благодарность «никогда не игнорирует пациентов» шёл ответ как на жалобу
# («Пациент не должен оставаться без внимания»), а «Ещё вариант» ждал встроенную модель до 12 с. Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
REV = "Иванов Пётр Сергеевич — хороший врач и просто замечательный человек. Он профессионал в своей области. Никогда не игнорирует пациентов, всегда помнит о нас. Если встречает меня в коридоре, обязательно интересуется, как я себя чувствую. Это приятно и важно."
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        res = []
        r = await pg.evaluate("""async (rev) => {
          const G = window.__otvGen, it = { platform: 'ДокТу', page: 'Карточка врача: Иванов П.С.', author: '', review: rev, rating: null, tone: '' };
          const tone = G.toneOf(it), strong = window.__otvReports.strongNeg(rev), a = G.answer(it);
          // медленная модель: вариант всё равно сразу
          window.__otvModel = { ready: () => true, write: () => new Promise(res => setTimeout(() => res(null), 8000)) };
          const t0 = performance.now(); const vs = [];
          for (let i = 0; i < 4; i++) vs.push(await window.__otvVariant({ kind: 'answer', platform: 'ДокТу', page: it.page, review: rev, author: '', rating: null, tone: 'positive' }));
          const ms = performance.now() - t0;
          const neg = ['Не было никакой грубости, всё объяснили', 'Врач неплохой, спасибо', 'Не пришлось долго ждать, спасибо'].map(x => window.__otvReports.strongNeg(x) || G.toneOf({ platform: 'ДокТу', review: x }) === 'negative');
          const realNeg = ['Медсестра нагрубила и игнорирует звонки', 'Никто не подошёл за весь день, равнодушие полное'].map(x => G.toneOf({ platform: 'ДокТу', review: x }) === 'negative');
          return { tone, strong, ans: a && a.text, ms, vs, neg, realNeg }; }""", REV)
        res.append((r['tone'] == 'positive' and not r['strong'], '«никогда не игнорирует» — благодарность, а не жалоба', r['tone']))
        bad = [v for v in [r['ans']] + r['vs'] if v and ('без внимания' in v or 'gkb24@' in v or 'разобраться' in v)]
        res.append((not bad, 'ответы — как на благодарность (без «разберёмся», «напишите на почту»)', bad[:2]))
        res.append((r['ms'] < 1500, '4 варианта подряд — меньше чем за 1,5 с, даже если модель думает долго', round(r['ms'])))
        res.append((len(set(r['vs'])) >= 3, 'варианты разные', r['vs']))
        res.append((any('внимани' in v or 'человеческ' in v or 'доброго' in v for v in r['vs']), 'в вариантах есть персонализация по отзыву (внимание, человеческое отношение)', r['vs']))
        res.append((not any(r['neg']), '«не было грубости», «неплохой», «не пришлось долго ждать» — не жалоба', r['neg']))
        res.append((all(r['realNeg']), 'настоящие жалобы по-прежнему жалобы', r['realNeg']))
        # уже записанный ответ как на жалобу и ложная тревога: при наведении порядка — ответ как на благодарность, тревога снята
        t = await pg.evaluate("""async (rev) => { const db = await window.__otvRt.use('db');
          await db.collection('answers').doc('ft1').set({ platform: 'ДокТу', page: 'Карточка врача: Иванов П.С.', review: rev, author: '', rating: null, status: 'pending', tone: 'negative',
            answer: 'Здравствуйте.\\nБлагодарим вас за обратную связь. Пациент не должен оставаться без внимания персонала. Пожалуйста, напишите нам на gkb24@zdrav.mos.ru.', date: '07.11.2026' });
          await db.collection('alerts').doc('ft1').set({ platform: 'ДокТу', text: rev, rating: null, status: 'new', detectedAt: new Date().toISOString() });
          await db.collection('answers').doc('ft2').set({ platform: 'ДокТу', page: 'Карточка врача: Иванов П.С.', review: rev, author: '', rating: null, status: 'pending', tone: 'negative', edited: true, answer: 'Моя правка', date: '07.11.2026' });
          await new Promise(r => setTimeout(r, 400)); await window.__otvTidyDrafts(); await new Promise(r => setTimeout(r, 600));
          const a = (await db.collection('answers').doc('ft1').get()).data(), al = (await db.collection('alerts').doc('ft1').get()).data(), b = (await db.collection('answers').doc('ft2').get()).data();
          return { tone: a.tone, ans: a.answer, al: [al.notNeg, al.status], tone2: b.tone, ans2: b.answer }; }""", REV)
        res.append((t['tone'] == 'positive' and 'без внимания' not in t['ans'] and 'gkb24@' not in t['ans'], 'старый ответ как на жалобу переписан как на благодарность', t))
        res.append((t['al'] == [True, 'done'], 'ложная тревога по похвале снята (уведомление не уйдёт)', t['al']))
        res.append((t['tone2'] == 'positive' and t['ans2'] == 'Моя правка', 'ваша правка не тронута, тон исправлен', t))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        ok = True
        for good, name, info in res:
            print(('OK   ' if good else 'FAIL ') + name + ('' if good else '  ' + json.dumps(info, ensure_ascii=False)[:500])); ok = ok and good
        print("ALL OK" if ok else "FAILED"); await b.close(); sys.exit(0 if ok else 1)
asyncio.run(main())
