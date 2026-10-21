# Сбор Google: длинный отзыв в кабинете показан началом со ссылкой «Посмотреть весь отзыв» — программа раскрывает и берёт полный текст
import asyncio, os, json
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "sources.js"), encoding="utf-8").read()
i = src.index("  async function GOOGLE() {"); j = src.index("\n  }\n", i) + 4
FN = src[i:j]
FULL = "Здравствуйте!Лежала в гинекологии у врача! Операцию делали три часа.На третий день уже поехала домой. Самые наилучшие впечатления о самой больнице, о заботливом персонале. Спасибо медсёстрам!"
PAGE = """<html><body><c-wiz><article>
<div>OLGA M<span>open_in_new</span></div><div>1 отзыв • 0 фото</div>
<div><span aria-label="Оценка: 5,0 из 5,">★★★★★</span><span>5 дней назад</span> НОВЫЙ ФИЛИАЛ</div>
<div id="t">Здравствуйте!Лежала в гинекологии у врача! Операцию делали три часа.На третий день уже поехала домой.... <a role="button" href="#" id="m1">Посмотреть весь отзыв</a></div>
<div>24 Московская больница</div><div>Владелец</div><div>21 час назад</div>
<div id="r">Здравствуйте!\nСпасибо за отзыв... <a role="button" href="#" id="m2">Посмотреть весь отзыв</a></div>
</article></c-wiz>
<script>
document.getElementById('m1').addEventListener('click', e => { e.preventDefault(); document.getElementById('t').textContent = %s; });
document.getElementById('m2').addEventListener('click', e => { e.preventDefault(); document.getElementById('r').textContent = 'Здравствуйте!\\nСпасибо за отзыв и высокую оценку нашей работы, передадим врачам.'; });
</script></body></html>""" % json.dumps(FULL, ensure_ascii=False)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); await pg.set_content(PAGE)
        res = await pg.evaluate("async () => { " + FN + " ; return await GOOGLE(); }")
        it = (res.get("items") or [{}])[0]
        ok1 = it.get("text", "").strip() == FULL
        ok2 = "высокую оценку" in it.get("reply", "")
        print(("OK  " if ok1 else "FAIL") + " полный текст отзыва Google без «....» и без «Посмотреть весь отзыв»", "" if ok1 else repr(it.get("text")))
        print(("OK  " if ok2 else "FAIL") + " ответ больницы в Google тоже целиком", "" if ok2 else repr(it.get("reply")))
        print("ALL OK" if ok1 and ok2 else "SOME FAILED"); await b.close()
asyncio.run(main())
