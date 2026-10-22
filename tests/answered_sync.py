# «Ответ дан» сверяется с площадкой при каждом сборе в обе стороны; кнопку можно отжать; счётчик «Инциденты» — только открытые
import asyncio, sys
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); await pg.goto(P); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""async () => {
          const db = await window.__otvRt.use('db'); const get = async (c, id) => ((await db.collection(c).doc(id).get()).data() || {});
          const it = ans => ({ id: 'ya-del1', platform: 'Яндекс', published: true, date: '2026-10-20', text: 'Плохое отношение в отделении, никто не подошёл', author: 'Павел', rating: 1, low: true,
                               answered: ans, reply: ans ? 'Здравствуйте. Мы разберёмся в ситуации, напишите нам.' : '' });
          await window.__otvIngest([it(true)]);
          const a1 = await get('alerts', 'ya-del1'), r1 = await get('registry', 'ya-del1');
          await db.collection('alerts').doc('ya-del1').update({ status: 'done' });
          await window.__otvIngest([it(false)]);                  // ответ на площадке удалили
          await new Promise(r => setTimeout(r, 300));
          const a2 = await get('alerts', 'ya-del1'), r2 = await get('registry', 'ya-del1');
          await window.__otvIngest([it(true)]);                   // ответ снова появился
          const a3 = await get('alerts', 'ya-del1');
          return { a1: a1.answered, r1: r1.reply, a2: a2.answered, m2: a2.markAnswered, st2: a2.status, r2: r2.reply, a3: a3.answered, m3: a3.markAnswered };
        }""")
        ok = []
        ok.append((r["a1"] is True and bool(r["r1"]), "ответ на площадке есть: тревога «отвечено», ответ в реестре"))
        ok.append((r["a2"] is False and r["m2"] is False and r["r2"] == "", "ответ удалили на площадке: «Ответ дан» снят, старый ответ не показывается"))
        ok.append((r["st2"] == "new", "закрытая тревога снова открыта, раз ответа больше нет"))
        ok.append((r["a3"] is True and r["m3"] is True, "ответ снова появился: «Ответ дан» стоит"))
        src = open(sys.argv[1].replace("index.html", "") + "page.html" if False else __file__.replace("tests/answered_sync.py", "web/page.html"), encoding="utf-8").read()
        ok.append(('r.markAnswered === false ? false' in src, "кнопку «Ответ дан» можно отжать: ваше «нет» сильнее отметок"))
        ok.append(('!!r.incident && r.status !== "done"' in src, "в счётчике «Инциденты» только открытые"))
        for c, m in ok: print(("OK  " if c else "FAIL") + " " + m)
        if not all(c for c, _ in ok): print(r)
        print("ALL OK" if all(c for c, _ in ok) else "SOME FAILED"); await b.close()
asyncio.run(main())
