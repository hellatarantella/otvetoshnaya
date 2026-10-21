# Сбор: полный текст отзыва никогда не заменяется обрезанным началом; новый более полный текст принимается
import asyncio, sys
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
FULL = "Добрый день! Меня зовут Мария. " + "Очень благодарна доктору за внимание и заботу. " * 40 + "Сама больница чистая, всем рекомендую."
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); await pg.goto(P); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""async (FULL) => {
          const db = await window.__otvRt.use('db'); const get = async id => (await db.collection('registry').doc(id).get()).data();
          const it = (id, t) => ({ id, platform: 'ПроДокторов', published: true, date: '2026-10-18', text: t, author: 'М', rating: 5 });
          await window.__otvIngest([it('pd-x1', FULL)]);
          const a = (await get('pd-x1')).fullText.length;
          await window.__otvIngest([it('pd-x1', FULL.slice(0, 1500))]);           // площадка отдала начало
          const b = (await get('pd-x1')).fullText.length;
          await window.__otvIngest([it('pd-x1', FULL.slice(0, 300) + '…')]);      // начало с многоточием
          const c = (await get('pd-x1')).fullText.length;
          await window.__otvIngest([it('pd-x2', FULL.slice(0, 1500))]);
          await window.__otvIngest([it('pd-x2', FULL)]);                          // потом дочитался целиком
          const d = (await get('pd-x2')).fullText.length;
          await window.__otvIngest([it('pd-x3', 'Старый текст отзыва, который пациент потом исправил полностью')]);
          await window.__otvIngest([it('pd-x3', 'Исправленный')]);                // другой текст, не начало: принимаем
          const e = (await get('pd-x3')).fullText;
          return { a, b, c, d, e, full: FULL.length };
        }""", FULL)
        q = await pg.evaluate("""async () => {
          const db = await window.__otvRt.use('db'); const get = async (c, id) => ((await db.collection(c).doc(id).get()).data() || {});
          await window.__otvIngest([{ id: 'ya-rep1', platform: 'Яндекс', published: true, date: '2026-10-18', text: 'Плохо обслужили в приёмном отделении', rating: 1, answered: true, reply: 'Здравствуйте. Ответ больницы на Яндексе.' }]);
          await window.__otvIngest([{ id: 'ya-rep1', platform: 'Яндекс', published: true, date: '2026-10-18', text: 'Плохо обслужили в приёмном отделении', rating: 1, answered: true, reply: '' }]);
          await db.collection('mail').doc('site-rep1').set({ date: '2026-10-18', text: 'Жалоба на грубость в приёмном отделении', status: 'todo', kind: 'complaint', name: 'Тест' });
          await db.collection('registry').doc('site-rep1').set({ platform: 'Сайт', date: '2026-10-18', text: 'Жалоба', fullText: 'Жалоба' });
          await db.collection('alerts').doc('site-rep1').set({ platform: 'Сайт', date: '2026-10-18', text: 'Жалоба на грубость в приёмном отделении', status: 'new', author: 'Тест' });
          await window.__otvSaveReplies({ 'site-rep1': 'Здравствуйте. Ответ из Отправленных.' });
          await db.collection('mail').doc('site-fw1').set({ date: '2026-10-19', text: 'Жалоба', status: 'done', reply: 'Здравствуйте! Просим зарегистрировать обращение.' });
          await db.collection('registry').doc('site-fw1').set({ platform: 'Сайт', date: '2026-10-19', text: 'Жалоба', fullText: 'Жалоба', reply: 'Здравствуйте! Просим зарегистрировать обращение.' });
          await window.__otvSaveReplies({ 'site-rep1': 'Здравствуйте. Ответ из Отправленных.' }, ['site-rep1', 'site-fw1']);
          await new Promise(r => setTimeout(r, 1500));
          const fw = (await get('registry', 'site-fw1')).reply;
          const m = await get('mail', 'site-rep1'), al = await get('alerts', 'site-rep1');
          return { ya: (await get('registry', 'ya-rep1')).reply, m: m.reply, r: (await get('registry', 'site-rep1')).reply, mst: m.status, mans: m.answered, ast: al.status,
            fw, ui: document.body.innerText.indexOf('Отвечено из почты пресс-службы') >= 0 || document.documentElement.innerHTML.indexOf('Ваш ответ из «Отправленных» пресс-службы') >= 0 };
        }""")
        ok2 = q['ya'] == 'Здравствуйте. Ответ больницы на Яндексе.' and q['m'] == q['r'] == 'Здравствуйте. Ответ из Отправленных.'
        print(('OK  ' if ok2 else 'FAIL') + ' настоящий ответ с площадки и из почты сохраняется и не стирается пустым', q if not ok2 else '')
        ok3 = q['mst'] == 'done' and q['mans'] is True and q['ast'] == 'done' and q['ui'] and q['fw'] == ''
        print(('OK  ' if ok3 else 'FAIL') + ' найденный ответ: письмо «Отвечено», тревога закрыта, карточка показывает ваш ответ; ошибочный «ответ» стёрт', q if not ok3 else '')
        ok2 = ok2 and ok3
        ok = ok2 and r['a'] == r['full'] and r['b'] == r['full'] and r['c'] == r['full'] and r['d'] == r['full'] and r['e'] == 'Исправленный'
        print(('OK  ' if ok else 'FAIL') + ' полный текст сохраняется, обрезанное начало его не заменяет', r if not ok else '')
        await b.close(); print('ALL OK' if ok else 'SOME FAILED')
asyncio.run(main())
