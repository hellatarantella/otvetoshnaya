# Интерфейс без перегруза: итог отчёта — строка и что сделать, подробности спрятаны; генератор не предлагает варианты,
# на которые ругается проверка текста. Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 1000})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        res = []
        R = await pg.evaluate("""async () => { window.__otvShowTab('check'); await new Promise(r => setTimeout(r, 400));
          const long = '⚠ Отчёт может быть неполным: не прочитаны ПроДокторов, последний раз 3 ноября в 13:54; Яндекс, последний раз 3 ноября в 13:54. Войдите и нажмите «Собрать отзывы». Отчёт 30.10–05.11.2026: новых отзывов нет · собрано за неделю 33, в отчёте 29. По площадкам, в отчёте/собрано: ПроДокторов 20/20';
          window.__otvReports._short({ text: long, head: 'Отчёт 30.10–05.11.2026: новых отзывов нет · в отчёте 29 из 33 собранных', todo: ['Не собраны ПроДокторов, Яндекс — нажмите «Собрать отзывы»'] });
          const st = document.querySelector('#ckCtl .rep-head').parentNode, d = st.querySelector('details');
          return { head: st.querySelector('.rep-head').textContent, todo: [...st.querySelectorAll('.rep-todo li')].map(x => x.textContent), closed: d && !d.open, h: st.getBoundingClientRect().height }; }""")
        res.append((R['head'].startswith('Отчёт 30.10') and len(R['todo']) == 1 and R['closed'] and R['h'] < 140, 'итог отчёта: строка, что сделать, подробности свёрнуты, блок невысокий', R))
        L = await pg.evaluate("""() => { const G = window.__otvGen, out = []; const its = [
          { platform: 'ПроДокторов', page: 'Страница врача: Соколова А.В.', author: 'Ирина', rating: 5, review: 'Спасибо Анне Викторовне за внимательный приём и понятные объяснения. Всё прошло спокойно.' },
          { platform: 'Яндекс', page: 'Карточка больницы', author: 'Олег', rating: 5, review: 'Чисто, вежливо, быстро оформили. Рекомендую.' },
          { platform: 'Яндекс', page: 'Карточка больницы', author: 'Светлана', rating: 1, review: 'Ужасно! Четыре часа ждали в приёмном, грубили.' },
          { platform: 'Яндекс', page: 'Карточка больницы', author: 'Гость', rating: 3, review: 'Врачам спасибо, золотые руки. Но в палате было грязно.' }];
          its.forEach(it => { const k = []; for (let i = 0; i < 8; i++) { const a = G.answer(it, { exclude: k }); if (!a) break; k.push(a.key);
            const w = window.__otvLint({ page: it.page, kind: '', review: it.review }, a.text); if (w.length) out.push([it.author, w]); } }); return out; }""")
        res.append((not L, 'ни один из 32 вариантов не вызывает замечаний проверки текста', L))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else json.dumps(d, ensure_ascii=False)[:1200])
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
