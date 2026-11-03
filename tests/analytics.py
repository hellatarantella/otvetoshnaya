# Вкладка «Аналитика»: период, отделения/врачи/площадки/темы, суммы сходятся, прошлый период, год по месяцам
# (до программы — утверждённая сводка), отзывы по клику, способ подсчёта по дате. Данные выдуманные
import asyncio, sys
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
SETUP = """async () => {
  const db = await window.__otvRt.use('db');
  const staff = [['Белкина Анна Петровна','Врач-хирург','Хирургия'],['Соколов Иван Ильич','Врач-уролог','Урология']];
  window.__otvReports._setRefs({ staff, departments: [['Хирургия','Хирургия','Один к одному'],['Урология','Урология','Один к одному']], exceptions: [], categories: ['ГКБ 24','Хирургия','Урология'] });
  await db.collection('weeks').doc('2026-10-16').set({ start: '2026-10-16', end: '2026-10-22', positive: [
    { platform: 'ПроДокторов', date: '17.10.2026', dept: 'Хирургия', doctor: 'Белкина', text: 'Анна Петровна профессионал, золотые руки, спасибо.' },
    { platform: 'Сайт', date: '18.10.2026', dept: 'Хирургия', doctor: 'Белкина', text: 'Внимательный и чуткий врач Анна Петровна.' },
    { platform: 'Яндекс', date: '19.10.2026', dept: 'Урология', doctor: 'Соколов, Неизвестнов', text: 'Иван Ильич всё объяснил и успокоил.' },
    { platform: 'Яндекс', date: '20.10.2026', dept: 'ГКБ 24', doctor: '—', text: 'Чисто, вкусно кормят.' }],
    negative: [{ platform: 'Сайт', date: '21.10.2026', dept: 'Хирургия', text: 'Долго ждал в очереди, грубый персонал.' }] });
  await db.collection('weeks').doc('2026-10-30').set({ start: '2026-10-30', end: '2026-11-05', positive: [
    { platform: 'Сайт', date: '02.11.2026', dept: 'Урология', doctor: 'Соколов', text: 'Ноябрь: Иван Ильич грамотный специалист.' }], negative: [] });
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        await pg.evaluate(SETUP)
        res = []
        A = await pg.evaluate("""() => { const rows = window.__otvDeckMonth.allRows(window.__snapsAn || {}); return null; }""")
        # расчёт напрямую: октябрь 2026
        A = await pg.evaluate("""async () => {
          const db = await window.__otvRt.use('db'); const sn = await new Promise(r => db.collection('weeks').onSnapshot(r)); const snaps = {};
          sn.docs.forEach(x => { const v = x.data(); snaps[v.start] = v; });
          const rows = window.__otvDeckMonth.allRows(snaps), A = window.__otvAnalytics.compute(rows, { start: '2026-10-01', end: '2026-10-31' }, 'arrival');
          return { pos: A.pos, neg: A.neg, depts: A.depts.map(d => d.name + ':' + d.pos + '/' + d.neg), docs: A.docs.map(d => d.name + ':' + d.pos + (d.note ? '!' : '')),
            plats: A.plats.map(d => d.name + ':' + d.pos + '/' + d.neg), bad: A.checks.filter(c => c.bad).map(c => c.text), prof: A.themes.find(t => /Профессионализм/.test(t.name)).n,
            negT: A.negT.map(t => t.name + ':' + t.n), sep: A.months[8], oct: A.months[9], prev: A.prev };
        }""")
        ok = A['pos'] == 4 and A['neg'] == 1 and 'Хирургия:2/1' in A['depts'] and 'О больнице в целом:1/0' in A['depts'] and 'Белкина Анна Петровна:2' in A['docs'] and any(d.startswith('Неизвестнов') and d.endswith('!') for d in A['docs'])
        res.append((ok, 'октябрь: 4 благодарности и 1 жалоба, отделения и врачи посчитаны, неизвестный врач отмечен', A))
        ok = len(A['bad']) == 1 and 'Неизвестнов' in A['bad'][0] and A['prof'] == 1 and 'Запись и ожидание:1' in A['negT']
        res.append((ok, 'сверка сумм без ошибок (кроме неизвестного врача), темы посчитаны', A['bad']))
        ok = A['sep'] == {'label': 'сентябрь', 'pos': 193, 'neg': 13, 'seed': True, 'cur': False} and A['oct']['pos'] == 4 and A['prev'] is None
        res.append((ok, 'год по месяцам: сентябрь из сводки, октябрь из отчётов; прошлого периода в данных нет', [A['sep'], A['oct'], A['prev']]))
        # вкладка: открывается, свой период, клик по отделению показывает отзывы
        T = await pg.evaluate("""async () => {
          localStorage.setItem('otv-an', JSON.stringify({ preset: 'own', mode: 'arrival', own: { start: '2026-10-01', end: '2026-11-30' } }));
          window.__otvShowTab('analytics'); await new Promise(r => setTimeout(r, 900));
          const root = document.querySelector('#tab-analytics .an'); if (!root) return null;
          const ps = document.getElementById('anPreset'); ps.value = 'own'; ps.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 200));
          const ins = root.querySelectorAll('input[type=date]'); ins[0].value = '2026-10-01'; ins[0].dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 100));
          const ins2 = document.querySelectorAll('#tab-analytics input[type=date]'); ins2[1].value = '2026-11-30'; ins2[1].dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 200));
          const kv = [...document.querySelectorAll('#tab-analytics .an-kv')].map(x => x.textContent);
          const row = [...document.querySelectorAll('#tab-analytics .an-row')].find(r => /Урология/.test(r.textContent)); row.click(); await new Promise(r => setTimeout(r, 200));
          const rev = [...document.querySelectorAll('#tab-analytics .an-ri')].map(x => x.textContent);
          const over = [...document.querySelectorAll('#tab-analytics .an-card')].filter(c => c.scrollWidth > c.clientWidth + 1).length;
          return { kv, rev: rev.length, nov: rev.some(t => /Ноябрь/.test(t)), over };
        }""")
        ok = T and T['kv'][0] == '5' and T['kv'][1] == '1' and T['rev'] == 2 and T['nov'] and T['over'] == 0
        res.append((ok, 'вкладка: свой период 01.10–30.11 — 5 благодарностей, по клику на «Урология» её 2 отзыва, ничего не вылезает', T))
        # по дате размещения ноябрьский отзыв не меняет месяц (размещён 02.11) — проверяем переключатель
        M = await pg.evaluate("""async () => { const ms = document.getElementById('anMode'); ms.value = 'placed'; ms.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 200));
          return [...document.querySelectorAll('#tab-analytics .an-kv')].map(x => x.textContent)[0]; }""")
        res.append((M == '5', 'переключатель «по дате размещения» работает', M))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else d)
        await b.close(); print('ALL OK' if all(r[0] for r in res) else 'SOME FAILED')
asyncio.run(main())
