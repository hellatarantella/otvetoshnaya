# 06.11: «если в отзыве упомянут врач или отделение — бери его» и «наращивать массив и разнообразие ответов на благодарности».
# Страница больницы: в ответе врач из списка сотрудников (имя-отчество в дательном) и его отделение, разными словами;
# страница врача — без имени и без «передадим». Ответы разные, без повторов слов. Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
JS = """async () => {
  window.__otvReports._setRefs({ staff: [['Соколова Анна Викторовна','Врач-кардиолог','Кардиологическое отделение'],['Петров Илья Сергеевич','Врач-хирург','Хирургическое отделение']],
    departments: [['Кардиологическое отделение','Кардиология','Один к одному'],['Хирургическое отделение','Хирургия','Один к одному']], exceptions: [], categories: ['ГКБ 24','Кардиология','Хирургия'] });
  const G = window.__otvGen, C = window.__otvCompose, out = {};
  const run = (it, n) => { const res = [], keys = []; for (let i = 0; i < n; i++) { const a = G.answer(it, { exclude: keys.slice() }); if (!a || !a.text) break; keys.push(a.key); res.push(a.text); } return res; };
  const H = { platform: 'Яндекс', page: 'Карточка больницы', author: 'Ольга', rating: 5, review: 'Огромное спасибо Анне Викторовне Соколовой! Лежала в кардиологии, всё объяснила, очень внимательная. Рекомендую.' };
  const D = { platform: 'ПроДокторов', page: 'Страница врача: Соколова А.В.', author: 'Ольга', rating: 5, review: H.review };
  const T = { platform: 'Яндекс', page: 'Карточка больницы', author: 'Ирина', rating: 5, review: 'Спасибо хирургическому отделению, всё прошло отлично, персонал внимательный.' };
  out.h = run(H, 12); out.d = run(D, 8); out.t = run(T, 8);
  out.rep = [].concat(out.h, out.d, out.t).filter(x => C.repeats(x.split('\\n').slice(1, -1).join(' ')));
  return out; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        R = await pg.evaluate(JS)
        import re
        res = []
        h = R['h']; named = [x for x in h if 'Анне Викторовне' in x]
        res.append((len(h) >= 5 and len(named) >= len(h) * 0.7, 'страница больницы: врач по имени-отчеству из списка сотрудников', h))
        withDept = [x for x in named if 'кардиологического отделения' in x]
        res.append((len(withDept) >= len(named) * 0.7, 'и его отделение', named))
        forms = set()
        for x in named:
            m = re.search(r'[^.]*Анне Викторовне[^.]*\.', x); forms.add(re.sub(r'Анне Викторовне и (всей команде|коллективу|сотрудникам) кардиологического отделения', 'X', m.group(0)).strip() if m else '')
        res.append((len(forms) >= 3, 'фраза о враче — разными словами: ' + str(len(forms)), list(forms)))
        res.append((len(set(h)) == len(h), 'все варианты разные', h))
        d = R['d']; bad = [x for x in d if re.search(r'Анн|Викторовн|передад|больниц|отделени', x.split('\n')[1])]
        res.append((len(d) >= 4 and not bad, 'страница врача: без имени, «передадим» и больницы', bad or d))
        t = R['t']; tm = [x for x in t if 'хирургического отделения' in x]
        res.append((len(tm) >= len(t) * 0.6, 'отделение без врача — команда отделения', t))
        res.append((not R['rep'], 'без повторов слов', R['rep'][:3]))
        S = await pg.evaluate("""() => { const R = window.__otvReports; R._setRefs({ staff: [['Соколова Анна Викторовна','Врач','Кардиологическое отделение']], staffTab: 'Октябрь 2020', departments: [], exceptions: [], categories: [] });
          R.refs().at = Date.now(); const a = R.staffStatus(); R.refs().staffTab = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][new Date().getMonth()] + ' ' + new Date().getFullYear();
          const b = R.staffStatus(); R.refs().staffTab = 'Октябрь 2020'; return { a, b, ctl: window.__otvControl.issues().some(i => /Список сотрудников/.test(i.text)) }; }""")
        res.append((S['a']['stale'] and not S['b']['stale'] and S['ctl'], 'список сотрудников: нет вкладки текущего месяца — самоконтроль подсказывает', S))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        for ok, tt, dd in res: print(('OK  ' if ok else 'FAIL') + ' ' + tt, '' if ok else json.dumps(dd, ensure_ascii=False)[:1500])
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
