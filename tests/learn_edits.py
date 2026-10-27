# Обучение на правках: фраза, которую сотрудница убирает из черновиков регулярно, становится правилом (выдуманные данные)
import asyncio, sys
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1100, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""async () => {
          const db = await window.__otvRt.use('db'), S = 'С уважением, администрация 24 Московской больницы';
          const mk = (i, keep) => db.collection('kb').doc('le-' + i).set({ kind: 'review', platform: 'ПроДокторов', situation: 'Спасибо врачу ' + i,
            draft: 'Здравствуйте!\\nСпасибо за отзыв и тёплые слова о враче. Нам очень приятно читать такие слова. Желаем здоровья и всего самого доброго.\\n' + S,
            answer: 'Здравствуйте!\\nСпасибо за отзыв и тёплые слова о враче.' + (keep ? ' Нам очень приятно читать такие слова.' : '') + ' Желаем здоровья и всего самого доброго.\\n' + S, edited: true, status: 'approved', updatedAt: new Date(Date.now() + i).toISOString() });
          await mk(1); await mk(2); await mk(3); await mk(4, true);
          await new Promise(r => setTimeout(r, 300));
          const L = window.__otvLearn, rules = L.rules();
          const bad = 'Здравствуйте!\\nСпасибо. Нам очень приятно читать такие слова. Желаем здоровья.\\n' + S, good = 'Здравствуйте!\\nСпасибо за отзыв. Желаем здоровья.\\n' + S;
          const pen = [L.penalty(bad), L.penalty(good)];
          await L.setDisabled(rules[0].key, true); await new Promise(r => setTimeout(r, 300));
          const off = L.penalty(bad);
          await L.setDisabled(rules[0].key, false); await new Promise(r => setTimeout(r, 300));
          window.__otvShowTab('kb'); await new Promise(r => setTimeout(r, 500));
          return { rules: rules.map(x => [x.phrase, x.removed, x.kept]), pen, off, ui: (document.getElementById('kbBox') || {}).textContent || '' };
        }""")
        ok1 = len(r['rules']) == 1 and r['rules'][0][0].startswith('Нам очень приятно читать такие слова') and r['rules'][0][1] == 3 and r['rules'][0][2] == 1
        print(('OK  ' if ok1 else 'FAIL') + ' фраза, убранная 3 раза из 4, стала правилом; «Желаем здоровья» (оставляли) — нет', r['rules'] if not ok1 else '')
        ok2 = r['pen'][0] > 0 and r['pen'][1] == 0 and r['off'] == 0
        print(('OK  ' if ok2 else 'FAIL') + ' варианты с этой фразой уходят вниз; отменённое правило не действует', (r['pen'], r['off']) if not ok2 else '')
        ok3 = 'Чему программа научилась на ваших правках' in r['ui'] and not errs
        print(('OK  ' if ok3 else 'FAIL') + ' правило видно в «Базе ответов»', (r['ui'][:200], errs[:2]) if not ok3 else '')
        await b.close(); print('ALL OK' if ok1 and ok2 and ok3 else 'SOME FAILED')
asyncio.run(main())
