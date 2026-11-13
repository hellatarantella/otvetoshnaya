# 13.11: «гугл тоже не опубликовал» («у этого отзыва нет кнопки «Ответить»», а ответа на Google нет). У Google блок отзыва —
# вложенные div, кнопка «Ответить» далеко от текста и с иконкой внутри. Программа поднималась на 1 уровень и останавливалась на любом div.
# Проверяем на разметке «как у Google»: ответ уходит в свой отзыв, чужой не трогает. Данные выдуманные
import asyncio, os, re, sys
from playwright.async_api import async_playwright
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "sources.js"), encoding="utf-8").read()
i = src.index("  async function PUB_CARD("); j = src.index("\n  }\n", i) + 4
FN = src[i:j]
m = re.search(r'"Google": function \(r\) \{.*?(", \{ card: \'div\'.*?\}\)")', src, re.S)
CFG = m.group(1)[3:-2].replace('\\\\', '\\')
REV = lambda n, who, txt: f"""<div class="r"><div class="hd"><div><div><span>{who}</span></div><div><span>Местный эксперт · 12 отзывов</span></div></div></div>
 <div class="bd"><div><span>★★★★★</span><span>неделю назад</span></div><div><div><span>{txt}</span></div></div></div>
 <div class="ft"><div><div role="button" aria-label="Ответить на отзыв" id="b{n}"><span><svg></svg></span><span><span>Ответить</span></span></div></div></div>
 <div class="ans" id="a{n}"></div></div>"""
PAGE = "<html><body><div id=list>" + REV(1, "Мария", "Отличное отделение, спасибо врачам и медсёстрам за заботу и внимание, всё прошло хорошо!") + REV(2, "Ольга", "Попала по плановой операции в гинекологическое отделение, приятно удивлена уважительным отношением!") + """</div>
<script>for (const n of [1, 2]) document.getElementById('b' + n).addEventListener('click', () => {
  const a = document.getElementById('a' + n); a.innerHTML = '<form><textarea></textarea><button type=button class=s>Ответить</button></form>';
  a.querySelector('.s').addEventListener('click', () => { const v = a.querySelector('textarea').value; setTimeout(() => { a.innerHTML = '<div>Владелец · только что</div><div>' + v + '</div>'; document.getElementById('b' + n).remove(); }, 300); }); });</script></body></html>"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(); await pg.set_content(PAGE)
        r = await pg.evaluate("async () => { " + FN + " ; try { return await PUB_CARD('Здравствуйте! Спасибо за тёплый отзыв.', '', 'Попала по плановой операции в гинекологическое отделение, приятно удивлена уважительным отношением!', " + CFG + "); } catch (e) { return { error: String(e.message || e) }; } }")
        a1 = await pg.evaluate("document.getElementById('a1').innerText"); a2 = await pg.evaluate("document.getElementById('a2').innerText")
        res = [(r.get('ok') and 'Спасибо за тёплый' in a2 and not a1.strip(), 'Google (автор не записан): ответ опубликован в свой отзыв, соседний не тронут', [r, a1, a2])]
        r2 = await pg.evaluate("async () => { " + FN + " ; try { return await PUB_CARD('Здравствуйте, Ольга!', 'Ольга', 'Попала по плановой операции в гинекологическое отделение, приятно удивлена уважительным отношением!', " + CFG + "); } catch (e) { return { error: String(e.message || e) }; } }")
        res.append((r2.get('already'), 'уже отвеченный отзыв второй раз не отвечается', r2))
        ok = True
        for good, name, info in res: print(('OK   ' if good else 'FAIL ') + name + ('' if good else '  ' + str(info)[:500])); ok = ok and good
        print('ALL OK' if ok else 'FAILED'); await b.close(); sys.exit(0 if ok else 1)
asyncio.run(main())
