# Таблица «Неделя» во вкладке «Отчёты» считает как отчёты: по дате поступления (чт 15:00 — чт 15:00), внесённый в отчёт недели — в своей неделе
import asyncio, sys, datetime
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1100, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""async () => {
          const db = await window.__otvRt.use('db');
          window.__otvShowTab('check'); await new Promise(r => setTimeout(r, 600));
          const before = document.getElementById('ckSum').textContent;
          const pad = n => String(n).padStart(2, '0'), iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
          const t = new Date(); const fri = new Date(t.getFullYear(), t.getMonth(), t.getDate() - ((t.getDay() - 5 + 7) % 7));
          const day = n => { const d = new Date(fri); d.setDate(d.getDate() + n); return d; };
          const at = (n, h) => new Date(iso(day(n)) + 'T' + pad(h) + ':00:00+03:00').toISOString();
          const R = (id, date, arrived, extra) => db.collection('registry').doc(id).set(Object.assign({ platform: 'ПроДокторов', date, text: 'Спасибо врачу ' + id, fullText: 'Спасибо врачу ' + id, report: 'pending', arrivedAt: arrived }, extra || {}));
          await R('wt-old-date', iso(day(-4)), at(0, 10));                 // написан до недели, поступил в эту неделю — в этой неделе
          await R('wt-last-week', iso(day(-2)), at(-2, 10));               // поступил на прошлой неделе — не в этой
          await R('wt-thu-late', iso(day(-1)), at(-1, 16));                // поступил в четверг после 15:00 — уже эта неделя
          await R('wt-in-report-prev', iso(day(1)), at(1, 9), { report: 'positive', reportRef: 'Позитив · ПроДокторов №1', reportWeek: iso(day(-7)) });   // уже сдан в прошлой неделе
          await new Promise(r => setTimeout(r, 600));
          window.__otvShowTab('check'); await new Promise(r => setTimeout(r, 600));
          const wk = [...document.querySelectorAll('#tab-check tr, #tab-check .ck-row, #tab-check [data-id]')].map(x => x.textContent).join(' | ');
          return { before, sum: document.getElementById('ckSum').textContent, rows: wk };
        }""")
        n = None
        import re
        m = re.search(r'Всего (\d+)', r['sum']); m0 = re.search(r'Всего (\d+)', r['before'])
        n = (int(m.group(1)) if m else 0) - (int(m0.group(1)) if m0 else 0)
        ok = n == 2 and not errs
        print(('OK  ' if ok else 'FAIL') + ' неделя по поступлению: 2 отзыва (написан раньше, поступил сейчас; четверг после 15:00), сданный в прошлой неделе не считается', (n, r['before'], r['sum']) if not ok else '')
        await b.close(); print('ALL OK' if ok else 'SOME FAILED')
asyncio.run(main())
