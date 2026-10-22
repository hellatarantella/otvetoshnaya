# Публикация на Яндексе: у отзыва нет кнопки «Ответить» (ответ на модерации) — ответ НЕ должен уйти соседнему отзыву
import asyncio, os, re
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "sources.js"), encoding="utf-8").read()
i = src.index("  async function PUB_CARD("); j = src.index("\n  }\n", i) + 4
FN = src[i:j]
m = re.search(r'"Яндекс": function \(r\) \{.*?(", \{ card: \'\.Review\'.*?\}\)")', src, re.S)
CFG = m.group(1)[3:-2].replace('\\\\', '\\')
PAGE = """<html><body><div id="list">
<div class="Review"><div>Ян 18 октября 2026</div><div>Хорошая больница, жене сделали прививку от бешенства даже в 4 часа утра</div><div>Ответ на модерации</div></div>
<div class="Review"><div>Елизавета 16 октября 2026</div><div>Начитавшись положительных отзывов, я выбрала эту клинику для удаления желчного пузыря.</div>
 <div class="Review-BusinessResponse"><textarea id="t2"></textarea><button aria-label="send"></button></div><button>Ответить</button></div>
</div></body></html>"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); await pg.set_content(PAGE)
        r = await pg.evaluate("async () => { " + FN + " ; try { return await PUB_CARD('Здравствуйте, Ян! Спасибо.', 'Ян', 'Хорошая больница, жене сделали прививку от бешенства даже в 4 часа утра', " + CFG + "); } catch (e) { return { error: String(e.message || e) }; } }")
        other = await pg.evaluate("document.getElementById('t2').value")
        ok1 = other == ""; ok2 = bool(r.get("error"))
        print(("OK  " if ok1 else "FAIL") + " соседний отзыв не получил чужой ответ", "" if ok1 else other)
        print(("OK  " if ok2 else "FAIL") + " публикация остановлена с понятной ошибкой", r)
        print("ALL OK" if ok1 and ok2 else "SOME FAILED"); await b.close()
asyncio.run(main())
