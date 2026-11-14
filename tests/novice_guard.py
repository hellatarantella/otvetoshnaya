# 14.11: всестороннее тестирование — «чтобы любой человек мог сделать работу», «поиск всех ошибок».
# Найденное прогоном всех сценариев: таблица недели теряла НаПоправку (Итого ≠ Всего); программа ругалась на собственный ответ
# (страница врача + «передадим сотрудникам отделения»); «Ещё вариант» стирал правку без возврата; пустой ответ можно было согласовать
# со второго нажатия; отметка наверху молчала о несобранных площадках и несогласованных ответах; «охранник не пустил в реанимацию» —
# ответ про пропуск на территорию. Данные выдуманные
import asyncio, sys, json, re
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1300, 'height': 900}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(2500); res = []
        # отметка наверху — список дел новичка
        chip = await pg.evaluate("() => { window.__otvControl.refresh(); return window.__otvControl.issues().map(i => i.text); }")
        res.append((any('ждут ответа' in x for x in chip) and any('Согласовано, но не опубликовано' in x for x in chip), 'отметка наверху называет обычные шаги: что ждёт ответа и что согласовано, но не опубликовано', chip))
        # таблица недели: НаПоправку и любая добавленная площадка — в своей строке, «Итого» = «Всего»
        T = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'); const d = new Date().toISOString().slice(0, 10);
          await db.collection('registry').doc('np-t1').set({ platform: 'НаПоправку', text: 'Долго ждала приёма.', date: d, report: 'pending', arrivedAt: new Date().toISOString() });
          await db.collection('registry').doc('zz-t1').set({ platform: 'Zoon', text: 'Хорошая больница.', date: d, report: 'pending', arrivedAt: new Date().toISOString() });
          window.__otvShowTab('check'); await new Promise(r => setTimeout(r, 1200));
          const rows = [...document.querySelectorAll('#ckTbl tbody tr')].map(tr => [...tr.children].map(td => td.textContent));
          const tot = [...document.querySelectorAll('#ckTbl tfoot td')].map(td => td.textContent), sum = document.getElementById('ckSum').textContent;
          return { np: rows.find(r => r[0] === 'НаПоправку'), zz: rows.find(r => r[0] === 'Zoon'), tot, all: (sum.match(/Всего (\\d+)/) || [])[1] }; }""")
        res.append((T['np'] and T['np'][1] == '1' and T['zz'] and T['zz'][1] == '1' and T['tot'][1] == T['all'], 'таблица недели: НаПоправку и добавленная площадка в своих строках, «Итого» сходится с «Всего»', T))
        # программа не ругается на собственный ответ: страница врача, благодарят и отделение
        L = await pg.evaluate("""() => { const refs = Object.assign({}, window.__otvReports.refs() || {}); refs.staff = [["Рябов Сергей Александрович", "врач-уролог", "Урологическое отделение"]]; window.__otvReports._setRefs(refs);
          const it = { platform: 'ПроДокторов', page: 'Страница врача: Рябов С.А.', review: 'Обратился к доктору с кистой. Операция прошла успешно. Огромное спасибо доктору за высокий профессионализм, а также всему персоналу урологического отделения за заботу и внимание.', rating: 5, author: 'Алексей' };
          const out = []; for (let i = 0; i < 6; i++) { const t = window.__otvGen.answer(it).text; out.push([t, window.__otvLint(it, t)]); }
          return { out, doc: window.__otvLint(it, 'Здравствуйте, Алексей!\\nСпасибо за отзыв. Передадим ваши слова доктору.\\nС уважением, администрация 24 Московской больницы') }; }""")
        bad = [x for x in L['out'] if x[1] or 'урологического отделения' not in x[0] or 'важны для нас' in x[0] or not re.search(r'отделения\.\s+(Ценим|Желаем|Всегда|Будем)|отделения\.\nС уважением', x[0])]
        res.append((not bad and any('ничего не передаём' in w for w in L['doc']), 'страница врача: слова сотрудникам отделения передаются без замечаний, завершающая фраза — последняя; «передадим доктору» — по-прежнему замечание', bad[:2] or L['doc']))
        # ответы на жалобы: повод — по смыслу
        N = await pg.evaluate("""() => { const f = t => { const a = []; for (let i = 0; i < 5; i++) a.push(window.__otvGen.answer({ platform: 'Яндекс', page: 'Карточка больницы', review: t, rating: 1, author: '' }).text); return a.join(' | '); };
          return { icu: f('Охранник не пустил к отцу в реанимацию, хамил.'), kpp: f('Не пустили на КПП, сказали без пропуска нельзя.'), lost: f('Потеряли мои документы при выписке.'), docs: f('Неделю не могут выдать выписку, безобразие.') }; }""")
        res.append(('пропускам' not in N['icu'] and 'пропускам' in N['kpp'] and 'не выдали вовремя' not in N['lost'] and 'не выдали вовремя' in N['docs'], 'жалобы: «не пустил в реанимацию» — не про пропуск на территорию; «потеряли документы» — не «не выдали вовремя»', N))
        # короткий отзыв — короткий ответ, без «лечащего врача», которого в отзыве нет
        S = await pg.evaluate("""() => { const a = []; for (let i = 0; i < 8; i++) a.push(window.__otvGen.answer({ platform: 'Яндекс', page: 'Карточка больницы', review: 'Лучшие врачи!', rating: 5, author: '' }).text); return a; }""")
        badS = [x for x in S if 'лечащему врачу' in x or len(re.findall(r'[^.!?]+[.!?]+', re.sub(r'^Здравствуйте[^\n]*\n|\nС уважением[\s\S]*$', '', x))) > 3]
        res.append((not badS, 'отзыв в два слова — ответ не длиннее трёх фраз и без «лечащего врача»', badS[:2]))
        # «Ещё вариант» не стирает правку безвозвратно; пустой ответ не согласуется
        V = await pg.evaluate("""async () => { window.__otvShowTab('pos'); await new Promise(r => setTimeout(r, 600)); const ta = document.querySelector('#tab-pos textarea'); let c = ta.parentElement; while (c && !/Согласовать/.test(c.innerText)) c = c.parentElement;
          const mine = ta.value.split('\\n')[0] + '\\nМОЯ ПРАВКА текст.\\nС уважением, администрация 24 Московской больницы'; ta.value = mine; ta.dispatchEvent(new Event('input', { bubbles: true }));
          [...c.querySelectorAll('button')].find(x => /Ещё вариант/.test(x.textContent)).click(); await new Promise(r => setTimeout(r, 2500)); const changed = ta.value !== mine;
          const u = [...c.querySelectorAll('button')].find(x => /Вернуть прежний/.test(x.textContent) && x.offsetParent); if (u) u.click(); await new Promise(r => setTimeout(r, 1500));
          const restored = ta.value === mine, saved = Object.values(window.__otvAll('answers')).some(a => a.answer === mine);
          ta.value = '  '; ta.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 300));
          for (let i = 0; i < 2; i++) { const bt = [...c.querySelectorAll('button')].find(x => /Согласовать|Всё равно/.test(x.textContent)); if (bt) bt.click(); await new Promise(r => setTimeout(r, 500)); }
          return { changed, undo: !!u, restored, saved, emptyOk: Object.values(window.__otvAll('answers')).filter(x => x.status === 'approved' && !String(x.answer || '').trim()).length }; }""")
        res.append((V['changed'] and V['undo'] and V['restored'] and V['saved'] and V['emptyOk'] == 0, '«Ещё вариант»: рядом «Вернуть прежний» — правка возвращается и сохраняется; пустой ответ согласовать нельзя', V))
        # короткая инструкция внутри программы; редкие настройки свёрнуты
        U = await pg.evaluate("""async () => { window.__otvShowTab('sources'); await new Promise(r => setTimeout(r, 600)); const h = document.getElementById('howto');
          return { howto: !!h && /Каждый день/.test(h.textContent) && /Согласовать/.test(h.textContent), folds: [...document.querySelectorAll('#alertBox details.fold, #dutyBox details.fold')].map(d => [d.querySelector('summary').textContent, d.open]) }; }""")
        res.append((U['howto'] and len(U['folds']) == 2 and not any(f[1] for f in U['folds']), 'в программе есть короткая инструкция; уведомления и второй компьютер свёрнуты в строку с состоянием', U))
        # программа не ругается на свой же черновик: черновик прежней версии с замечанием (и без ваших правок) переписывается
        R = await pg.evaluate("""async () => { await window.__otvTidyDrafts(); await new Promise(r => setTimeout(r, 800));
          const A = window.__otvAll('answers'); return Object.entries(A).filter(([id, a]) => a.status === 'pending' && !a.edited && a.kind !== 'question' && a.kind !== 'appeal' && !/-appeal$/.test(id) && window.__otvGen.toneOf({ platform: a.platform, review: a.review, text: a.review, rating: a.rating }) === 'positive' && String(a.answer || '').trim())
            .map(([id, a]) => [id, window.__otvLint({ page: a.page, review: a.review, platform: a.platform }, a.answer)]).filter(x => x[1].length); }""")
        res.append((not R, 'черновики программы без замечаний её же проверки (старые переписаны, ваши правки не тронуты)', R))
        # 14.11: «зачем такие дубли и служебные подписи» — во время сбора нет строки «Сбор отзывов: Собираю…»; когда наверху спрашиваем про вход, строки «Не прочитано» нет
        D = await pg.evaluate("""async () => { const vis = id => { const e = document.getElementById(id); return !!(e && !e.hidden && e.offsetParent); };
          [...document.querySelectorAll('button')].find(x => /^Собрать отзывы/.test(x.textContent.trim())).click();
          let during = []; for (let i = 0; i < 16; i++) { await new Promise(r => setTimeout(r, 500)); if (vis('stopBtn')) during.push(vis('colRun') ? document.getElementById('colRun').textContent : ''); }
          for (let i = 0; i < 40 && vis('stopBtn'); i++) await new Promise(r => setTimeout(r, 500));
          const warnAfter = vis('srcWarn') ? document.getElementById('srcWarn').textContent : '';
          window.__otvBar.show('Почта сайта: нужен вход. Входим или пропускаем?', '', [['Войти', () => {}]]); await new Promise(r => setTimeout(r, 200));
          const warnAsk = vis('srcWarn'); window.__otvBar.hide(); await new Promise(r => setTimeout(r, 200));
          const chip = window.__otvControl.issues().map(i => i.text);
          return { during: during.filter(Boolean), warnAfter, warnAsk, warnBack: vis('srcWarn'), chipDup: chip.filter(x => /Не прочитан/.test(x)) }; }""")
        res.append((not D['during'] and not D['warnAsk'] and not D['chipDup'] and (not D['warnAfter'] or D['warnBack']), 'без дублей: во время сбора нет служебной строки «Сбор отзывов: …»; при вопросе «Входим или пропускаем?» нет строки «Не прочитано»; в «что сделать» «Не прочитано» не повторяется', D))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        ok = True
        for good, name, info in res: print(('OK   ' if good else 'FAIL ') + name + ('' if good else '  ' + json.dumps(info, ensure_ascii=False)[:900])); ok = ok and good
        print('ALL OK' if ok else 'FAILED'); await b.close(); sys.exit(0 if ok else 1)
asyncio.run(main())
