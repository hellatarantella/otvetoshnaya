# 12.11: отзыв, пришедший в закрытую неделю, но собранный позже (почта не читалась), идёт в СВОЮ неделю:
# в её снимок (файл и презентация пересоберутся), из текущей таблицы убирается. Неделю не закрываем, если после её
# закрытия источники не прочитаны. Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from pilot import CONNECT
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 1000}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500); await pg.evaluate(CONNECT, False); await pg.wait_for_timeout(6000)
        R = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'); const st = window.__otvReports.state();
          const add = (iso, d) => { const x = new Date(iso + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
          const ps = add(st.start, -7), pe = add(st.start, -1), pd = add(ps, 1);
          await db.collection('weeks').doc(ps).set({ start: ps, end: pe, period: 'прошлая неделя', positive: [], negative: [] });
          const T1 = 'Письмо Ж11: благодарю отделение за заботу и внимание к пациентам, всё было замечательно.';
          const T2 = 'Письмо Ж12: спасибо врачам за помощь и поддержку во время лечения в больнице.';
          await db.collection('mail').doc('site-late1').set({ date: pd, time: '10:00', kind: 'thanks', text: T1, status: 'done' });
          await db.collection('registry').doc('site-late1').set({ platform: 'Сайт', date: pd, time: '10:00', text: T1, fullText: T1, report: 'pending', reportRef: '', reason: '', source: 'auto', arrivedAt: pd + 'T07:00:00.000Z' });
          await db.collection('registry').doc('site-late2').set({ platform: 'Сайт', date: pd, time: '11:00', text: T2, fullText: T2, report: 'positive', reportRef: 'Позитив · Сайт больницы №7', reportWeek: st.start, dept: 'ГКБ 24', doctor: '—', source: 'auto', arrivedAt: pd + 'T08:00:00.000Z' });
          window.__gsExtraPos = [{ platform: 'Сайт больницы', num: 7, date: pd.split('-').reverse().join('.'), dept: 'ГКБ 24', doctor: '—', text: T2, full: T2 }];
          await new Promise(r => setTimeout(r, 500));
          await window.__otvReports.update(); await new Promise(r => setTimeout(r, 1500));
          const w = (await db.collection('weeks').doc(ps).get()).data(); const g = async id => (await db.collection('registry').doc(id).get()).data();
          const r1 = await g('site-late1'), r2 = await g('site-late2');
          const curHas = window.__otvReports.state().positive.some(x => /Ж1[12]/.test(x.text));
          return { snapN: w.positive.length, dirty: !!w.dirty, rw: [r1.reportWeek === ps, r2.reportWeek === ps], removed: (window.__gsRemoved || []).some(x => /Ж12/.test(x.text)), curHas,
                   msg: (document.querySelector('#ckCtl .rep-more p') || {}).textContent || '' }; }""")
        res = [('собранные с опозданием ушли в свою (прошлую) неделю: снимок дополнен и помечен «исправлен»', R['snapN'] == 2 and R['dirty'] and R['rw'] == [True, True], R),
               ('из текущей таблицы такие строки убраны, новых туда не добавлено', R['removed'] and not R['curHas'], R),
               ('в итоге отчёта сказано, что прошлая неделя дополнена', 'Дополнены прошлые недели' in R['msg'], R['msg'][:300])]
        # неделю не закрываем, пока источники не прочитаны после закрытия недели
        G = await pg.evaluate("""async () => { window.__otvSrcHealth = () => [{ name: 'Почта сайта', ok: false, okAt: '2026-10-29T10:00:00Z', needLogin: true }];
          window.__otvShowTab('check'); await new Promise(r => setTimeout(r, 300));
          const b = document.getElementById('newWeekBtn'); b.click(); b.click(); await new Promise(r => setTimeout(r, 500));
          const txt = (document.querySelector('#ckCtl .rep-head') || {}).textContent || ''; const btn = [...document.querySelectorAll('#ckCtl .ctl-st button')].some(x => /Всё равно начать/.test(x.textContent));
          return { txt, btn }; }""")
        res.append(('«Начать новый отчёт» не закрывает неделю, если почта не прочитана после её закрытия (есть «Всё равно начать»)', 'может быть неполной' in G['txt'] and 'Почта сайта' in G['txt'] and G['btn'], G))
        res.append(('без ошибок страницы', not errs, errs[:3]))
        for name, ok, info in res: print(('OK  ' if ok else 'FAIL') + ' ' + name, '' if ok else json.dumps(info, ensure_ascii=False)[:1200])
        await b.close(); print('ALL OK' if all(r[1] for r in res) else 'SOME FAILED')
asyncio.run(main())
