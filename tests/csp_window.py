# Проверка в условиях окна программы: файлы отдельно (как в сборке) и точная политика безопасности из tauri.conf.json,
# в которую окно Tauri само дописывает nonce. С nonce браузер отбрасывает стили, вставленные внутри HTML (27.10: превью
# презентации развалилось, выгрузка не работала). Здесь: презентация недели собирается, слайды сверстаны, PDF и PPTX выгружаются.
import asyncio, sys, os, json, shutil, tempfile, threading, functools, base64, http.server
from playwright.async_api import async_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
conf = json.load(open(os.path.join(ROOT, 'src-tauri', 'tauri.conf.json')))
csp = conf['app']['security']['csp']
# как делает Tauri: nonce в script-src и style-src
if '--no-attr' in sys.argv: csp = csp.replace(" style-src-attr 'unsafe-inline';", "")   # и без разрешения стилей элементов слайды должны собираться
csp = csp.replace("script-src 'self'", "script-src 'self' 'nonce-tauri1'").replace("style-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline' 'nonce-tauri1'")
tmp = tempfile.mkdtemp(); site = os.path.join(tmp, 'site'); shutil.copytree(os.path.join(ROOT, 'dist'), site)
shutil.copy(os.path.join(ROOT, 'tests', 'demo', 'stub.js'), os.path.join(site, 'stub.js'))
h = open(os.path.join(site, 'index.html'), encoding='utf-8').read()
import re
h = re.sub(r'<script(?![^>]*\bsrc=)', '<script nonce="tauri1"', h)   # Tauri ставит nonce своим встроенным скриптам и стилям
h = re.sub(r'<style', '<style nonce="tauri1"', h)
h = h.replace('<head>', '<head>\n<meta http-equiv="Content-Security-Policy" content="' + csp.replace('"', '&quot;') + '">\n<script src="stub.js"></script>', 1)
open(os.path.join(site, 'index.html'), 'w', encoding='utf-8').write(h)
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=site))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv.RequestHandlerClass = functools.partial(Q, directory=site)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d/index.html' % srv.server_address[1]
FR = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'rb').read()).decode()
FB = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'rb').read()).decode()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + (e.blockedURI || '') + ' ' + (e.sample || '').slice(0, 40)));")
        await pg.goto(URL); await pg.wait_for_timeout(2000)
        await pg.evaluate("""async ([fr, fb]) => {
          const db = await window.claude.use('db');
          window.__otvReports._setRefs({ staff: [['Белкина Анна Петровна','Врач-хирург','Хирургическое отделение'],['Соколов Иван Ильич','Врач-уролог','Урологическое отделение']],
            departments: [['Хирургическое отделение','Хирургия','Один к одному'],['Урологическое отделение','Урология','Один к одному']], exceptions: [], categories: ['ГКБ 24','Хирургия','Урология'] });
          const R = (pl, d, dep, doc, t) => ({ platform: pl, date: d, dept: dep, doctor: doc, text: t, full: t });
          await db.collection('weeks').doc('2026-10-23').set({ start: '2026-10-23', end: '2026-10-29', period: '23.10–29.10.2026', positive: [
            R('ПроДокторов','23.10.2026','Хирургия','Белкина','Анна Петровна провела операцию бережно и внимательно. Профессионал с золотыми руками и добрым сердцем.'),
            R('Сайт','24.10.2026','Хирургия','Белкина','Благодарю доктора Белкину за чуткость и заботу, восстановление прошло легко и без боли.'),
            R('Яндекс','24.10.2026','Урология','Соколов','Иван Ильич всё подробно объяснил, вселил уверенность и спокойствие перед операцией.')], negative: [] });
          await db.collection('settings').doc('deckFonts').set({ regular: fr, bold: fb, at: 'x' });
          await db.collection('deckPicks').doc('2026-10-23').set({ quote: { 'Белкина А.П.': 'Профессионал с золотыми руками и добрым сердцем' }, voices: [{ short: 'Соколов И.И.', quote: 'Вселил уверенность и спокойствие перед операцией' }] });
          const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#7a9cc6'; g.fillRect(0, 0, 400, 300);
          const src = c.toDataURL('image/jpeg', 0.8);
          for (const [key, kind] of [['Белкина Анна Петровна','face'],['Белкина Анна Петровна','tall'],['Соколов Иван Ильич','tall'],['Хирургия','dept'],['Урология','dept'],['ГКБ 24','dept']])
            await db.collection('deckPhotos').doc(kind + '_' + key.replace(/\\s+/g, '_')).set({ key, kind, src, at: '2026-10-27' });
        }""", [FR, FB])
        await pg.evaluate("window.__otvShowTab('deckw')"); await pg.wait_for_timeout(500)
        await pg.evaluate("window.__otvDeckUi.rebuild()"); await pg.wait_for_timeout(1500)
        # подтверждаем всё, что просит программа, как сделала бы сотрудница
        for _ in range(6):
            done = True
            for label in ["Выбрать отзыв недели", "Подтвердить цитату", "Подтвердить голоса"]:
                if await pg.locator("text=" + label).count(): await pg.locator("text=" + label).first.click(); await pg.wait_for_timeout(1200); done = False
            if done: break
        await pg.wait_for_timeout(2000)
        st = await pg.evaluate("""() => {
          const s = window.__otvDeckUi._state(), first = document.querySelector('.deck-slide-in section#week img');
          const fr = document.querySelector('.deck-slide'), inner = document.querySelector('.deck-slide-in');
          return { need: s.res.need.map(n => n.text), logoW: first ? first.getBoundingClientRect().width / (fr.clientWidth / 1920) : 0,
                   frameW: fr.clientWidth, innerW: inner.getBoundingClientRect().width, h2: getComputedStyle(document.querySelector('.deck-slide-in section#week h2')).position,
                   ui: document.querySelector('.deck-ui').innerText.includes('Вёрстка проверена') };
        }""")
        ok1 = abs(st['logoW'] - 202) < 3 and st['h2'] == 'absolute' and abs(st['innerW'] - st['frameW']) < 3
        print(('OK  ' if ok1 else 'FAIL') + ' в окне программы слайды сверстаны (стили на месте) и превью вписано в ширину', st if not ok1 else '')
        ok2 = st['ui'] and not st['need']
        print(('OK  ' if ok2 else 'FAIL') + ' самопроверка вёрстки пройдена, подтверждать нечего', st['need'] if not ok2 else '')
        res = await pg.evaluate("""async () => {
          window.__demoFiles = [];
          const bs = [...document.querySelectorAll('.deck-ui button')];
          bs.find(b => b.textContent === 'Скачать PDF').click();
          for (let i = 0; i < 120 && window.__demoFiles.length < 1; i++) await new Promise(r => setTimeout(r, 500));
          bs.find(b => b.textContent === 'Скачать PPTX').click();
          for (let i = 0; i < 120 && window.__demoFiles.length < 2; i++) await new Promise(r => setTimeout(r, 500));
          return { files: window.__demoFiles.map(f => [f.filename, f.data.length]), st: [...document.querySelectorAll('.deck-ui .ctl-st')].map(x => x.textContent) };
        }""")
        ok3 = len(res['files']) == 2 and res['files'][0][0].endswith('.pdf') and res['files'][1][0].endswith('.pptx') and res['files'][0][1] > 10000
        print(('OK  ' if ok3 else 'FAIL') + ' PDF и PPTX выгружаются в окне программы', res if not ok3 else '')
        csp_v = await pg.evaluate("window.__csp")
        # без разрешения стилей элементов прочие места программы дают предупреждения политики, слайды при этом должны работать
        ok4 = not errs and ('--no-attr' in sys.argv or not [v for v in csp_v if 'style-src' in v or 'script-src' in v])
        if '--shot' in sys.argv: await pg.evaluate("document.querySelector('.deck-preview').scrollIntoView()"); await pg.screenshot(path='/tmp/claude-0/csp_shot.png')
        print(('OK  ' if ok4 else 'FAIL') + ' без ошибок и без нарушений политики безопасности', (errs[:3], csp_v[:5]) if not ok4 else '')
        await b.close(); srv.shutdown(); shutil.rmtree(tmp, ignore_errors=True)
        print('ALL OK' if all([ok1, ok2, ok3, ok4]) else 'SOME FAILED')
asyncio.run(main())
