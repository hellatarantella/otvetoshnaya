# Синхронизация двух компьютеров: два окна программы, общий поддельный Google Диск.
# Проверяем: всё нужное переходит, локальное не переходит, правки в обе стороны, поздняя правка побеждает, удаление,
# публикует только тот, где нажали, файлы зашифрованы (текста отзыва в них нет). Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
DRIVE = {}
def gs(source, action, x):
    x = json.loads(x or '{}')
    if action == 'sput': DRIVE[x['name']] = x['data']; return {'put': x['name']}
    if action == 'sget': return {'files': {n: DRIVE[n] for n in x.get('names', []) if n in DRIVE}}
    if action == 'slist': return {'files': [{'name': n, 'size': len(v), 'at': 0} for n, v in DRIVE.items() if n.startswith(x.get('prefix', ''))]}
    if action == 'sdel': [DRIVE.pop(n, None) for n in x.get('names', [])]; return {'deleted': 1}
    if action == 'duty': return {'duty': {}, 'now': 0}
    raise Exception('нет действия ' + action)
SETUP = """() => { window.__otvReports = Object.assign(window.__otvReports || {}, { ready: () => true, call: (a, x) => window.gsFake(a, JSON.stringify(x || {})) }); }"""
async def open_pc(ctx):
    pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(P); await pg.wait_for_timeout(1200); await pg.evaluate(SETUP); return pg, errs
async def ev(pg, js): return await pg.evaluate("async () => { const db = await window.__otvRt.use('db'); " + js + " }")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(); await ctx.expose_binding('gsFake', gs)
        A, ea = await open_pc(ctx); B, eb = await open_pc(ctx)
        res = []
        await ev(A, """await db.collection('answers').doc('a1').set({ review: 'Хамство в регистратуре, Петрова Анна', answer: 'Черновик А', status: 'pending' });
          await db.collection('kb').doc('k1').set({ situation: 'тест', answer: 'правка А' });
          await db.collection('registry').doc('r1').set({ platform: 'Яндекс', text: 'отзыв r1' });
          await db.collection('settings').doc('refs').set({ staff: [['Иванов Иван Иванович', 'врач', 'Хирургия']] });
          await db.collection('settings').doc('model').set({ installed: true, local: 'A' });
          await window.__otvSync.enable(); await window.__otvSync.run();""")
        key = await A.evaluate("window.__otvSync.key()")
        files = dict(DRIVE)
        plain = any('Хамство' in v or 'Петрова' in v or 'регистратур' in v for v in files.values())
        res.append(('на «Диске» только зашифрованные файлы: текста отзывов и имён в них нет', len(files) >= 2 and not plain and all(n.endswith('.bin') for n in files), list(files)))
        await ev(B, f"await window.__otvSync.enable({json.dumps(key)}); await window.__otvSync.run();")
        got = await ev(B, """const g = async (c, i) => (await db.collection(c).doc(i).get()).data() || null;
          return { a1: (await g('answers', 'a1') || {}).answer, k1: (await g('kb', 'k1') || {}).answer, r1: !!(await g('registry', 'r1')), refs: ((await g('settings', 'refs')) || {}).staff, model: await g('settings', 'model') };""")
        res.append(('второй компьютер получил отзывы, ответы, обучение и справочник; настройки компьютера (модель) не переходят', got['a1'] == 'Черновик А' and got['k1'] == 'правка А' and got['r1'] and got['refs'] and (got['model'] or {}).get('local') != 'A', got))
        # правка на втором — переходит на первый
        await B.wait_for_timeout(20)
        await ev(B, "await db.collection('answers').doc('a1').update({ answer: 'Правка Б' }); await db.collection('kb').doc('k2').set({ situation: 'новое', answer: 'с Б' }); await window.__otvSync.run();")
        await ev(A, "await window.__otvSync.run();")
        ga = await ev(A, "return [((await db.collection('answers').doc('a1').get()).data() || {}).answer, ((await db.collection('kb').doc('k2').get()).data() || {}).answer];")
        res.append(('правки со второго компьютера пришли на первый', ga == ['Правка Б', 'с Б'], ga))
        # одновременные правки: побеждает поздняя
        await ev(A, "await db.collection('answers').doc('a1').update({ answer: 'А раньше' });"); await A.wait_for_timeout(30)
        await ev(B, "await db.collection('answers').doc('a1').update({ answer: 'Б позже' });")
        await ev(A, "await window.__otvSync.run();"); await ev(B, "await window.__otvSync.run();"); await ev(A, "await window.__otvSync.run();")
        c1 = await ev(A, "return ((await db.collection('answers').doc('a1').get()).data() || {}).answer;"); c2 = await ev(B, "return ((await db.collection('answers').doc('a1').get()).data() || {}).answer;")
        res.append(('спор по одной записи: у обоих осталась более поздняя правка', c1 == c2 == 'Б позже', (c1, c2)))
        # удаление
        await ev(A, "await db.collection('registry').doc('r1').delete(); await window.__otvSync.run();"); await ev(B, "await window.__otvSync.run();")
        gone = await ev(B, "return (await db.collection('registry').doc('r1').get()).exists;")
        res.append(('удаление переходит', gone is False, gone))
        # публикация: «Опубликовать» нажато на Б — А сам не публикует
        await ev(B, "await db.collection('answers').doc('a1').update({ status: 'approved', publishRequested: new Date().toISOString() }); await window.__otvSync.run();"); await ev(A, "await window.__otvSync.run();")
        own = await A.evaluate("[window.__otvSync.remoteOwned('answers', 'a1'), true]"); ownB = await B.evaluate("window.__otvSync.remoteOwned('answers', 'a1')")
        res.append(('публикует только компьютер, где нажали «Опубликовать»', own[0] is True and ownB is False, (own, ownB)))
        # слепок: старые файлы первого компьютера удаляются, новый компьютер догоняет со слепка
        devA = await A.evaluate("(async () => (await (await window.__otvRt.use('db')).collection('settings').doc('sync').get()).data().dev)()")
        await A.evaluate("window.__otvSync._resnap()"); await ev(A, "await window.__otvSync.run();")
        logsA = [n for n in DRIVE if n.startswith('log-' + devA)]
        D2, ed = await open_pc(ctx)
        await ev(D2, f"await window.__otvSync.enable({json.dumps(key)}); await window.__otvSync.run();")
        gd = await ev(D2, "return [((await db.collection('answers').doc('a1').get()).data() || {}).answer, (await db.collection('registry').doc('r1').get()).exists, ((await db.collection('kb').doc('k2').get()).data() || {}).answer];")
        res.append(('после слепка старые файлы удалены, третий компьютер догнал всё со слепка', not logsA and gd == ['Б позже', False, 'с Б'], (logsA, gd)))
        # чужой ключ не читает
        C, ec = await open_pc(ctx)
        await ev(C, "await window.__otvSync.enable(btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))); await window.__otvSync.run();")
        stC = await C.evaluate("window.__otvSync.state().err"); hasC = await ev(C, "return (await db.collection('answers').doc('a1').get()).exists;")
        res.append(('с чужим ключом данные не читаются', 'ключ не подходит' in stC and hasC is False, stC))
        res.append(('без ошибок на страницах', not ea and not eb, ea + eb))
        for name, ok, info in res: print(('OK  ' if ok else 'FAIL') + ' ' + name, '' if ok else info)
        await b.close(); print('ALL OK' if all(r[1] for r in res) else 'SOME FAILED')
asyncio.run(main())
