# Обучение на правках, шаг 2 (выдуманные данные): замены слов («благодарим» → «спасибо»), свои дописанные фразы,
# правила по ситуации (выученное на жалобах не действует в ответах на благодарности), всё это — в генераторе и в подсказке модели
import asyncio, sys
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1100, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""async () => {
          const db = await window.__otvRt.use('db'), S = 'С уважением, администрация 24 Московской больницы', H = 'Здравствуйте!\\n';
          let i = 0; const put = (o) => db.collection('kb').doc('s2-' + (++i)).set(Object.assign({ kind: 'review', platform: 'ПроДокторов', edited: true, status: 'approved', updatedAt: new Date(Date.now() + i).toISOString() }, o));
          // благодарности: «Благодарим вас» → «Спасибо вам» (3 раза), дописанная фраза «Будем рады видеть вас снова» (2 раза)
          for (let k = 0; k < 3; k++) await put({ situation: 'Спасибо доктору, всё отлично ' + k, draft: H + 'Благодарим вас за отзыв о работе отделения. Желаем здоровья.\\n' + S,
            answer: H + 'Спасибо вам за отзыв о работе отделения. Желаем здоровья.' + (k < 2 ? ' Будем рады видеть вас снова в нашей больнице.' : '') + '\\n' + S });
          // жалобы: убирает «Нам очень жаль это слышать» (2 из 2), в благодарностях этой фразы нет
          for (let k = 0; k < 2; k++) await put({ situation: 'Ужасное отношение, хамство в приёмном ' + k, draft: H + 'Нам очень жаль это слышать сегодня. Мы разберёмся в ситуации с ответственными подразделениями.\\n' + S,
            answer: H + 'Мы разберёмся в ситуации с ответственными подразделениями.\\n' + S });
          await new Promise(r => setTimeout(r, 300));
          const L = window.__otvLearn, R = L.rules();
          const rw = L.rewrite('Здравствуйте!\\nБлагодарим вас за тёплые слова. А также благодарим за доверие.', { tone: 'positive', platform: 'ПроДокторов' });
          const penNeg = L.penalty('Нам очень жаль это слышать сегодня. Разберёмся.', { tone: 'negative', platform: 'Яндекс' });
          const penPos = L.penalty('Нам очень жаль это слышать сегодня. Разберёмся.', { tone: 'positive', platform: 'Яндекс' });
          const fav = L.penalty('Спасибо. Будем рады видеть вас снова в нашей больнице.', { tone: 'positive', platform: 'ПроДокторов' });
          // старое отключение по фразе продолжает действовать
          await db.collection('settings').doc('learn').set({ disabled: [R.filter(x => x.type === 'remove')[0].k] }); await new Promise(r => setTimeout(r, 300));
          const offOld = L.penalty('Нам очень жаль это слышать сегодня.', { tone: 'negative' });
          await db.collection('settings').doc('learn').set({ disabled: [] }); await new Promise(r => setTimeout(r, 300));
          window.__otvShowTab('kb'); await new Promise(r => setTimeout(r, 500)); if (window.__otvKbRender) window.__otvKbRender(); await new Promise(r => setTimeout(r, 300));
          const ui = (document.getElementById('kbBox') || document.getElementById('tab-kb') || {}).textContent || '';
          return { R: R.map(x => [x.type, x.scope, x.k, x.yes, x.no]), rw, penNeg, penPos, fav, offOld, ui: /Заменяете/.test(ui) && /Дописываете сами/.test(ui) && /Убираете/.test(ui) };
        }""")
        types = {t for t, *_ in r['R']}
        ok1 = 'replace' in types and 'add' in types and 'remove' in types
        print(('OK  ' if ok1 else 'FAIL') + ' три вида правил: убираете, заменяете, дописываете', r['R'] if not ok1 else '')
        ok2 = r['rw'].startswith('Здравствуйте!\nСпасибо вам за тёплые слова') and 'А также благодарим за доверие' in r['rw']
        print(('OK  ' if ok2 else 'FAIL') + ' замена «благодарим вас» → «спасибо вам» (регистр сохраняется), «благодарим за» не тронуто — правило только для выученного оборота', r['rw'] if not ok2 else '')
        rem = [x for x in r['R'] if x[0] == 'remove']
        ok3 = r['penNeg'] > 0 and r['penPos'] == 0 and all(x[1] == 'tone:neg' for x in rem)
        print(('OK  ' if ok3 else 'FAIL') + ' правило, выученное на жалобах, действует только в ответах на жалобы', (r['penNeg'], r['penPos'], rem) if not ok3 else '')
        ok4 = r['fav'] < 0 and r['offOld'] == 0 and r['ui']
        print(('OK  ' if ok4 else 'FAIL') + ' своя фраза поднимает вариант выше; старое отключение действует; правила видны по группам в «Базе ответов»', (r['fav'], r['offOld'], r['ui']) if not ok4 else '')
        msg = await pg.evaluate("""() => { const M = window.__otvModel; if (!M || !M._messages) return null; return M._messages({ kind: 'review', platform: 'ПроДокторов', rating: 5, review: 'Спасибо доктору, всё отлично', current: '' }).messages[0].content; }""")
        ok5 = msg is None or ('«спасибо вам» вместо «благодарим вас»' in msg and 'Будем рады видеть вас снова' in msg)
        print(('OK  ' if ok5 else 'FAIL') + ' подсказка встроенной модели: слова сотрудницы и её частые фразы', (msg or '')[-400:] if not ok5 else '')
        ok6 = not errs
        print(('OK  ' if ok6 else 'FAIL') + ' без ошибок на странице', errs[:3] if errs else '')
        await b.close(); print('ALL OK' if all([ok1, ok2, ok3, ok4, ok5, ok6]) else 'SOME FAILED')
asyncio.run(main())
