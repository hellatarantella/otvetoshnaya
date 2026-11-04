# Самоконтроль (04.11): программа сама следит, всё ли верно, — одна отметка наверху: «✓ Всё в порядке» или «⚠ N — что сделать»;
# находит жалобы без ответа больше суток, ответы на площадке, не совпадающие с согласованными, задачи отчёта, сбой сохранения. Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 900}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(4000)
        res = []
        R = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'), S = 'С уважением, администрация 24 Московской больницы';
          const old = new Date(Date.now() - 3 * 864e5), ru = d => String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
          await db.collection('answers').doc('c-neg').set({ platform: 'Яндекс', page: 'Карточка больницы', date: ru(old), author: 'Ольга', status: 'new', rating: 1, review: 'Ужасно, грубили и долго ждали в приёмном.', answer: '' });
          await db.collection('answers').doc('c-pub').set({ platform: 'Яндекс', page: 'Карточка больницы', date: ru(old), author: 'Пётр', status: 'published', rating: 5, review: 'Спасибо!', answer: 'Здравствуйте, Пётр!\\nСпасибо за отзыв. Желаем здоровья и всего самого доброго.\\n' + S });
          await db.collection('registry').doc('c-pub').set({ platform: 'Яндекс', text: 'Спасибо!', reply: 'Здравствуйте! Совсем другой ответ, опубликованный не тот. ' + S });
          window.__otvControl.refresh(); const chip = document.getElementById('ctrlChip'); chip.click(); await new Promise(r => setTimeout(r, 200));
          const items = [...document.querySelectorAll('#ctrlPop li')].map(x => x.textContent);
          const btn = [...document.querySelectorAll('#ctrlPop li button')][0]; btn && btn.click(); await new Promise(r => setTimeout(r, 300));
          const tab = [...document.querySelectorAll('.tab-panel')].find(x => !x.hidden); 
          window.__otvSaveErr = 'нет места на диске'; window.__otvControl.refresh(); const withSave = window.__otvControl.issues().some(i => /не сохраняются/.test(i.text)); window.__otvSaveErr = '';
          return { chip: chip.textContent, items, tab: tab && tab.id, withSave }; }""")
        ok = R['chip'].startswith('⚠') and any('Жалобы без ответа больше суток' in x for x in R['items']) and any('не совпадает с согласованным' in x for x in R['items']) and R['tab'] == 'tab-neg' and R['withSave']
        res.append((ok, 'самоконтроль: жалоба без ответа, другой текст на площадке, сбой сохранения; «Открыть» ведёт на вкладку', R))
        C = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'); await db.collection('answers').doc('c-neg').update({ status: 'done' }); await db.collection('answers').doc('c-pub').update({ status: 'done' });
          window.__otvControl.refresh(); return window.__otvControl.issues().map(i => i.text); }""")
        import re
        n0 = int(re.search(r'суток: (\d+)', ' '.join(R['items'])).group(1)); m = re.search(r'суток: (\d+)', ' '.join(C)); n1 = int(m.group(1)) if m else 0
        res.append((n1 == n0 - 1 and not any('не совпадает' in x for x in C), 'после ответа замечания сами исчезают', [n0, C]))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else json.dumps(d, ensure_ascii=False)[:1500])
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
