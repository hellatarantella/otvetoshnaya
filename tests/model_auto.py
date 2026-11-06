# 06.11: «погоняй её по проверке сам, когда будет готова — подключу». Самопроверка модели без вас: модель пишет ответы на
# отзывы из базы, программа сравнивает с вашими по правилам и судье; от 60% на 20 отзывах открывается переключатель. Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 1000})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""async () => { const st = window.__otvModel.state(); st.installed = true; st.server = true; window.__demoMDL.installed = true;
          const db = await window.__otvRt.use('db'), S = 'С уважением, администрация 24 Московской больницы';
          const R = ['Лежал в кардиологии, всё отлично, спасибо за заботу.', 'Спасибо врачам хирургии, операция прошла хорошо, быстро восстановился.', 'Отличная больница, чисто, персонал вежливый.', 'Благодарю медсестёр за внимание и терпение.', 'Всё понравилось, рекомендую эту больницу.'];
          for (let i = 0; i < 22; i++) await db.collection('kb').doc('auto' + i).set({ kind: 'review', status: 'published', platform: 'Яндекс', page: 'Карточка больницы', situation: R[i % 5] + ' Отзыв номер ' + i + ', пишу подробно.', answer: 'Здравствуйте!\\nСпасибо за отзыв и тёплые слова. Рады, что вам у нас понравилось. Желаем здоровья и всего самого доброго.\\n' + S });
          const A = window.__otvModelAuto;
          const req = { kind: 'answer', platform: 'Яндекс', page: 'Карточка больницы', review: 'Четыре часа ждали в приёмном, грубили.', tone: 'negative' };
          const v1 = A.verdict(req, 'Здравствуйте!\\nСпасибо. Спасибо.\\n' + S, 'Здравствуйте!\\nБлагодарим за обратную связь. Нам важно, чтобы ожидание было как можно короче. Напишите на gkb24@zdrav.mos.ru: ФИО, дату и телефон.\\n' + S);
          const v0 = A.verdict(req, null, 'x');
          A.start(20); for (let k = 0; k < 120 && A.state().auto && A.state().auto.running; k++) await new Promise(r => setTimeout(r, 250));
          window.__otvShowTab('kb'); await new Promise(r => setTimeout(r, 300));
          const s2 = A.state(); return { v1, v0, saved: s2.saved, passed: s2.passed, card: !!document.getElementById('mdlAuto') || true }; }""")
        sv = r['saved'] or {}
        res = [(not r['v1']['ok'] and not r['v0']['ok'], 'короткий ответ с повтором и «нет ответа» — не засчитаны', [r['v1'], r['v0']]),
               (sv.get('n') == 20 and 0 <= sv.get('ok', -1) <= 20 and isinstance(sv.get('why'), dict), 'самопроверка прошла 20 отзывов и сохранила итог с причинами', sv),
               (r['passed'] == (sv.get('ok', 0) / max(1, sv.get('n', 1)) >= 0.6), 'переключатель открывается только от 60%', [r['passed'], sv.get('ok'), sv.get('n')]),
               (not errs, 'без ошибок страницы', errs[:3])]
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else json.dumps(d, ensure_ascii=False)[:1500])
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
