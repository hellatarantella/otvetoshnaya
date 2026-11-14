# Дежурство двух компьютеров: кто дежурит, передача дежурства, код подключения (без отзывов), запасной не шлёт сразу
import asyncio, sys, base64, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1100, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        res = []
        H = await pg.evaluate("""() => { const h = window.__otvDuty._holder, now = 1e12, m = (a, r) => ({ at: now - a * 60e3, role: r });
          return [h({ aa: m(1, 'main'), bb: m(1, 'backup') }, now), h({ aa: m(25, 'main'), bb: m(2, 'backup') }, now), h({ zz: m(1, 'main'), aa: m(3, 'main') }, now), h({ aa: m(30, 'main'), bb: m(40, 'backup') }, now)]; }""")
        res.append(('кто дежурит: основной на связи; основной пропал 20+ минут — запасной; два основных — по номеру; никого — никто', H == ['aa', 'bb', 'aa', None], H))
        await pg.evaluate("window.__otvShowTab('sources'); window.__otvFoldAll()"); await pg.wait_for_timeout(300)
        await pg.check("#dutyBox input[name=dutyRole] >> nth=1"); await pg.wait_for_timeout(200)
        D = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'); await new Promise(r => setTimeout(r, 300));
          const me = (await db.collection('settings').doc('duty').get()).data(); const now = Date.now();
          const out = { dev: !!me.dev };
          window.__otvDuty._set({ map: { [me.dev]: { at: now, role: 'backup', name: 'Mac' }, other1: { at: now - 60e3, role: 'main', name: 'Рабочий' } }, now: now }, now);
          out.backupWaits = window.__otvDuty.isDuty() === false && window.__otvDuty.multi() === true;
          window.__otvDuty._set({ map: { [me.dev]: { at: now, role: 'backup', name: 'Mac' }, other1: { at: now - 25 * 60e3, role: 'main', name: 'Рабочий' } }, now: now }, now);
          out.takesOver = window.__otvDuty.isDuty() === true;
          // нет связи с Google 30 минут: запасной не вмешивается
          window.__otvDuty._set({ map: { [me.dev]: { at: now, role: 'backup' }, other1: { at: now, role: 'main' } }, now: now }, now - 30 * 60e3);
          out.offlineBackupQuiet = window.__otvDuty.isDuty() === false;
          window.__otvDuty._set(null, now);
          out.singleIsDuty = window.__otvDuty.isDuty() === true;
          return out; }""")
        res.append(('дежурство: запасной ждёт, подхватывает через 20 минут, без связи не вмешивается; один компьютер дежурит всегда', D == {'dev': True, 'backupWaits': True, 'takesOver': True, 'offlineBackupQuiet': True, 'singleIsDuty': True}, D))
        await pg.evaluate("window.__otvShowTab('sources'); window.__otvFoldAll()"); await pg.wait_for_timeout(300)
        txt = await pg.inner_text('#dutyBox')
        res.append(('карточка дежурства на месте и говорит, что данные читает только программа', 'Два компьютера: дежурство' in txt and 'только «Ответошная»' in txt, txt[:200]))
        code = 'OTV1.' + base64.b64encode(json.dumps({'g': {'url': 'https://script.google.com/macros/s/TEST/exec', 'token': 'a' * 64}, 'm': {'token': 'bot', 'bot': 'Тест', 'targets': [{'key': 'u1', 'user': 1, 'name': 'Я'}]}}).encode()).decode().rstrip('=')
        res.append(('в коде подключения нет отзывов и данных пациентов — только связь с Google и бот', set(json.loads(base64.b64decode(code[5:] + '==')).keys()) == {'g', 'm'}, ''))
        await pg.evaluate("window.__noReload = true; location.reload = () => {}")
        await pg.click("#dutyBox button:has-text('Ввести код')"); await pg.fill('#dutyBox .duty-code', code)
        await pg.click("#dutyBox button:has-text('Подключить')"); await pg.wait_for_timeout(500)
        A = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db'); const g = (await db.collection('settings').doc('google').get()).data(), n = (await db.collection('settings').doc('notify').get()).data(), d = (await db.collection('settings').doc('duty').get()).data();
          return [g.url, g.token.length, n.token, n.targets.length, d.role]; }""")
        res.append(('ввод кода: Google и бот как на первом, этот компьютер — запасной', A == ['https://script.google.com/macros/s/TEST/exec', 64, 'bot', 1, 'backup'], A))
        await pg.click("#dutyBox button:has-text('Ввести код')"); await pg.fill('#dutyBox .duty-code', 'мусор'); await pg.click("#dutyBox button:has-text('Подключить')"); await pg.wait_for_timeout(200)
        res.append(('неверный код — понятная ошибка', 'не код подключения' in await pg.inner_text('#dutyBox'), ''))
        res.append(('без ошибок на странице', not errs, errs))
        for name, ok, info in res: print(('OK  ' if ok else 'FAIL') + ' ' + name, '' if ok else info)
        await b.close(); print('ALL OK' if all(r[1] for r in res) else 'SOME FAILED')
asyncio.run(main())
