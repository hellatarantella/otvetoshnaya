# Публикация на Яндексе: Яндекс прячет текст ответа и показывает «Ответ компании 22 октября 2026» — это успех; уже отвеченный отзыв не отвечаем второй раз
import asyncio, os, re
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "sources.js"), encoding="utf-8").read()
i = src.index("  async function PUB_CARD("); j = src.index("\n  }\n", i) + 4
FN = src[i:j]
m = re.search(r'"Яндекс": function \(r\) \{.*?(", \{ card: \'\.Review\'.*?\}\)")', src, re.S)
CFG = m.group(1)[3:-2]   # объект настроек Яндекса как в программе
CFG = CFG.replace('\\\\', '\\')
PAGE = """<html><body>
<div class="Review"><div>Пётр 20 октября 2026</div><div>Спасибо врачам терапии за внимательное отношение и лечение.</div>
 <div class="Review-BusinessResponse"><div>Ответ компании</div><textarea></textarea><button id="s" aria-label="send"></button></div></div>
<div class="Review"><div>Анна 19 октября 2026</div><div>Хорошая больница, всё понравилось, рекомендую всем знакомым.</div>
 <div class="Review-BusinessResponse"><div>Ответ компании 22 октября 2026</div></div></div>
<script>document.getElementById('s').addEventListener('click', () => { setTimeout(() => { document.querySelector('.Review-BusinessResponse').innerHTML = '<div>Ответ компании 22 октября 2026</div>'; }, 300); });</script>
</body></html>"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); await pg.set_content(PAGE)
        r1 = await pg.evaluate("async () => { " + FN + " ; return await PUB_CARD('Здравствуйте, Пётр! Спасибо за отзыв.', 'Пётр', 'Спасибо врачам терапии за внимательное отношение и лечение.', " + CFG + "); }")
        r2 = await pg.evaluate("async () => { " + FN + " ; return await PUB_CARD('Здравствуйте, Анна!', 'Анна', 'Хорошая больница, всё понравилось, рекомендую всем знакомым.', " + CFG + "); }")
        ok1 = r1.get("ok") is True; ok2 = r2.get("already") is True
        print(("OK  " if ok1 else "FAIL") + " Яндекс спрятал текст ответа, показал «Ответ компании 22 октября 2026»: публикация успешна", "" if ok1 else r1)
        print(("OK  " if ok2 else "FAIL") + " уже отвеченный отзыв второй раз не отвечается", "" if ok2 else r2)
        print("ALL OK" if ok1 and ok2 else "SOME FAILED"); await b.close()
asyncio.run(main())
