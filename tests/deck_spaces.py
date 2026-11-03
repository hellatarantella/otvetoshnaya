# Слипшиеся слова (29.10: «отзывовпозитивные», «среднейнеделе», «благодарностямза», «колопроктология7»): в окне программы
# движок Safari иногда ставит слова вплотную. Пробел в файле ставится по самому тексту: здесь слова прижаты нарочно
# (отрицательный межсловный интервал), а в PDF и PPTX между ними всё равно пробел, остаток строки сдвинут
import asyncio, sys, base64, subprocess, tempfile, os, zipfile, io, re
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
FR = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'rb').read()).decode()
FB = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'rb').read()).decode()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await pg.goto(P); await pg.wait_for_timeout(1000)
        res = await pg.evaluate("""async ([fr, fb]) => {
          const D = window.__otvDeck, tmp = document.createElement('div'); tmp.className = 'deck-measure'; document.body.append(tmp);
          await Promise.all([['Cera Round', fr], ['Cera Round Bold', fb]].map(([n, d]) => new FontFace(n, 'url(data:font/ttf;base64,' + d + ')').load().then(f => document.fonts.add(f))));
          tmp.innerHTML = '<section id="t" style="position:relative;width:1920px;height:1080px;background:#fff">' +
            '<p style="position:absolute;left:80px;top:100px;font-family:\\'Cera Round Bold\\';font-size:28px;word-spacing:-0.32em">отзывов позитивные</p>' +
            '<p style="position:absolute;left:80px;top:200px;font-family:\\'Cera Round Bold\\';font-size:28px">+5% к\\u00a0средней <span style="word-spacing:-0.32em">неделе 2026</span> года</p>' +
            '<p style="position:absolute;left:80px;top:300px;font-family:\\'Cera Round\\';font-size:24px">Валериевну, спасибо</p></section>';
          await document.fonts.ready;
          const sec = tmp.firstElementChild, glued = (() => { const r = document.createRange(), t = sec.querySelector('p').firstChild; r.setStart(t, 7); r.setEnd(t, 8); return r.getBoundingClientRect().width; })();
          const prims = await D.measure(sec);
          const pdf = D.toPdf([prims], { regular: fr, bold: fb }).output('datauristring').split(',')[1];
          const ppt = await D.toPptx([prims], ['']).write({ outputType: 'base64' });
          return { glued, pdf, ppt };
        }""", [FR, FB])
        d = tempfile.mkdtemp(); fn = os.path.join(d, 'a.pdf'); open(fn, 'wb').write(base64.b64decode(res['pdf']))
        txt = subprocess.run(['pdftotext', '-layout', fn, '-'], capture_output=True, text=True).stdout
        xml = zipfile.ZipFile(io.BytesIO(base64.b64decode(res['ppt']))).read('ppt/slides/slide1.xml').decode('utf-8')
        pt = ' '.join(re.findall(r'<a:t>([^<]*)</a:t>', xml)); pt = re.sub(r'\s+', ' ', pt)
        ok0 = res['glued'] < 2
        print(('OK  ' if ok0 else 'FAIL') + ' на макете слова прижаты вплотную (как в окне программы)', res['glued'] if not ok0 else '')
        ok1 = 'отзывов позитивные' in txt and 'неделе 2026' in txt and 'средней неделе' in txt and 'Валериевну, спасибо' in txt and 'Валериевну ,' not in txt
        print(('OK  ' if ok1 else 'FAIL') + ' PDF: между словами пробел, запятая без пробела перед ней', txt if not ok1 else '')
        ok2 = 'отзывов позитивные' in pt and 'неделе 2026' in pt and 'Валериевну, спасибо' in pt
        print(('OK  ' if ok2 else 'FAIL') + ' PPTX: между словами пробел', pt if not ok2 else '')
        await b.close(); print('ALL OK' if ok0 and ok1 and ok2 else 'SOME FAILED')
asyncio.run(main())
