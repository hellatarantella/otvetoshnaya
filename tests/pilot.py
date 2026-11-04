# Самопроверка после обновления (04.11): первое «Обновить отчёт» в новой версии программа проверяет сама
# (пустые тексты, повторы, уже стоящие в таблице, отделения по справочнику, врачи по списку сотрудников, разумное число).
# Всё сходится — пишет без вопросов. Не сходится — ничего не пишет, показывает расхождения и пишет по «Записать». Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
CONNECT = """async (spoil) => { if (spoil) window.__gsCats = ['ГКБ 24', 'Хирургия']; window.__otvShowTab('check'); await new Promise(r => setTimeout(r, 400));
  const inp = document.querySelector('#ckCtl input[placeholder*="script.google.com"]'); inp.value = 'https://script.google.com/macros/s/TEST123/exec';
  [...document.querySelectorAll('#ckCtl button')].find(b => /Подключить/.test(b.textContent)).click(); await new Promise(r => setTimeout(r, 2500));
  if (!window.__otvReports._pilot().pilot.ver && !window.__otvReports._pilot().waiting) { await window.__otvReports.update(); await new Promise(r => setTimeout(r, 500)); } }"""
RUN = """async () => { const inRep = () => Object.values(window.__otvAll('registry') || {}).filter(r => r && r.reportRef).length;
  const r0 = 0;
  const box = document.querySelector('#ckCtl .rep-head'), head = box && box.textContent;
  const todo = box ? [...box.parentNode.querySelectorAll('.rep-todo li')].map(x => x.textContent) : [];
  const btn = box && [...box.parentNode.querySelectorAll('button')].find(b => b.textContent === 'Записать');
  const first = inRep() - r0; let second = 0;
  if (btn) { btn.click(); await new Promise(r => setTimeout(r, 4000)); second = inRep() - r0; }
  return { head, todo, first, second, btn: !!btn, pilot: window.__otvReports._pilot() }; }"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); res = []
        # 1) всё сходится — записывает сама, без вопросов
        pg = await b.new_page(viewport={'width': 1300, 'height': 1000}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500); await pg.evaluate(CONNECT, False)
        R = await pg.evaluate(RUN)
        res.append((R['first'] >= 3 and not R['btn'] and 'расхождения' not in (R['head'] or '') and R['pilot']['pilot'].get('auto'), 'всё сходится: новая версия проверила себя и записала сама, без вопросов', R))
        # 2) расхождения находятся: пустой текст, повтор, уже в таблице, отделения нет в справочнике, врача нет в списке, больше, чем собрано
        C = await pg.evaluate("""() => { const f = window.__otvReports._selfCheck;
          const ok = f([{ platform: 'Яндекс', date: '01.11.2026', dept: 'Кардиология', doctor: 'Соколова', text: 'Спасибо кардиологии за заботу и внимание.' }], [], [], ['Кардиология'], 5);
          const bad = f([{ platform: 'Яндекс', date: '01.11.2026', dept: 'Кардиология', doctor: 'Неизвестнов', text: 'Спасибо кардиологии за заботу и внимание.' },
                         { platform: 'Сайт', date: '01.11.2026', dept: 'Кардиология', doctor: '', text: 'Спасибо кардиологии за заботу и внимание.' },
                         { platform: 'Сайт', date: '01.11.2026', dept: 'Офтальмология', doctor: '', text: 'Отличное отделение, всем спасибо большое.' },
                         { platform: 'Сайт', date: '01.11.2026', dept: '', doctor: '', text: '' }],
                        [{ platform: 'Яндекс', date: '1 ноября', text: 'Долго ждали в приёмном, никто не объяснял.' }], [{ text: 'Долго ждали в приёмном, никто не объяснял.' }], ['Кардиология'], 3);
          return { ok, bad }; }""")
        kinds = ['нет в списке сотрудников', 'дважды', 'нет в справочнике', 'короткий', 'уже стоит в таблице', 'больше отзывов']
        res.append((C['ok'] == [] and all(any(k in x for x in C['bad']) for k in kinds), 'самопроверка находит все виды расхождений и молчит, когда всё в порядке', C))
        await pg.close()
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else json.dumps(d, ensure_ascii=False)[:2500])
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
