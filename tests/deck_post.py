# Пост в канал «Онлайн-обращения: итоги недели» (04.11): текст собирается сам по отчёту недели в утверждённом формате,
# цифры сходятся (позитив, негатив, доля, отделения + о больнице = позитив), «Скопировать текст» и визуал PNG 1920×1080. Данные выдуманные
import asyncio, sys, os, base64, json, io, re
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
SETUP = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'demo', 'deck_setup_week.js'), encoding='utf-8').read().split('\n', 1)[1]
FR = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 'rb').read()).decode()
FB = base64.b64encode(open('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 'rb').read()).decode()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 1300, 'height': 900}); await ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
        pg = await ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        await pg.evaluate(SETUP, [FR, FB])
        await pg.evaluate("window.__otvShowTab('deckw')"); await pg.wait_for_timeout(300)
        await pg.evaluate("window.__otvDeckUi.rebuild()"); await pg.wait_for_timeout(3000)
        R = await pg.evaluate("""async () => { const st = window.__otvDeckUi._state().res, db = await window.__otvRt.use('db'), w = (await db.collection('weeks').doc('2026-10-23').get()).data();
          const pos = w.positive.filter(r => String(r.text || r.full || '').trim()).length, neg = w.negative.filter(r => String(r.text || r.full || '').trim()).length;
          return { post: st.D.post, pos, neg, bad: st.checks.filter(c => c.bad && /Пост/.test(c.text)).map(c => c.text), ui: !!document.querySelector('#tab-deckw .deck-post textarea') }; }""")
        t = R['post'] or ''
        lines = t.split('\n')
        nums = [int(x) for x in re.findall(r'🔹 [^:\n]*: (?:по )?(\d+)', t)]
        dept_lines = [l for l in lines[lines.index('Распределение благодарностей по отделениям:') + 1:] if l.startswith('🔹')] if 'Распределение благодарностей по отделениям:' in lines else []
        total = 0
        for l in dept_lines:
            m = re.match(r'🔹 (.+): (по )?(\d+)', l); k = len(m.group(1).split(', ')) if m.group(2) else 1; total += k * int(m.group(3))
        gen = re.search(r'🔹 (\d+) отзыв\S* о больнице в целом', t); total += int(gen.group(1)) if gen else 0
        ok = t.startswith('Онлайн-обращения: итоги недели (23–29 октября 2026)') and ('🔹 %d позитивн' % R['pos']) in t and total == R['pos'] and 'Источники отзывов:' in t and not R['bad'] and R['ui']
        res = [(ok, 'текст поста собран по отчёту недели: формат, цифры, отделения + о больнице = позитив (%d)' % R['pos'], R)]
        res.append((re.search(r'\d+ негатив|Негативных отзывов нет', t) is not None and 'сотрудник' in t, 'негатив с площадками и число сотрудников с благодарностями', t[:600]))
        C = await pg.evaluate("""async () => { const d = document.querySelector('#tab-deckw .deck-post'); d.open = true; [...d.querySelectorAll('button')].find(b => b.textContent === 'Скопировать текст').click();
          await new Promise(r => setTimeout(r, 400)); let clip = ''; try { clip = await navigator.clipboard.readText(); } catch (e) {}
          window.__demoFiles = []; [...d.querySelectorAll('button')].find(b => /Скачать визуал/.test(b.textContent)).click();
          for (let i = 0; i < 60 && !window.__demoFiles.length; i++) await new Promise(r => setTimeout(r, 200));
          const f = window.__demoFiles[0]; return { clip: clip.slice(0, 60), name: f && f.filename, data: f && String(f.data).replace(/^data:[^,]*,/, '').slice(0, 2000000) }; }""")
        from PIL import Image
        img = Image.open(io.BytesIO(base64.b64decode(C['data']))) if C['data'] else None
        ok = C['clip'].startswith('Онлайн-обращения: итоги недели') and C['name'] and C['name'].endswith('.png') and img and img.size == (1920, 1080) and len(set(img.convert('L').resize((64, 36)).get_flattened_data() if hasattr(img, "get_flattened_data") else img.convert("L").resize((64, 36)).getdata())) > 20
        res.append((ok, '«Скопировать текст» и «Скачать визуал»: PNG 1920×1080 с обложкой', {k: v for k, v in C.items() if k != 'data'}))
        if img: img.save(os.path.join(os.path.dirname(sys.argv[1]), 'post_cover.png'))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        for ok, t2, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t2, '' if ok else json.dumps(d, ensure_ascii=False)[:1500])
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
