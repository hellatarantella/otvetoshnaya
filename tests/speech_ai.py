# Умный помощник: разбор отзыва и речевая оценка ответа (Ильяхов) в карточке, загрузка своих ответов
# (вставка, Word, таблица), программа сама берёт хорошие ответы больницы с площадок, генератор выбирает
# вариант с лучшей речью. Данные выдуманные
import asyncio, sys, base64, io, zipfile
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
def docx(paras):
    b = io.BytesIO(); z = zipfile.ZipFile(b, 'w')
    body = ''.join('<w:p><w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>' % p for p in paras)
    z.writestr('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + '</w:body></w:document>')
    z.writestr('[Content_Types].xml', '<Types/>'); z.close(); return base64.b64encode(b.getvalue()).decode()
DOCX = docx(['Отзыв: Спасибо доктору Смирнову за операцию.', 'Ответ: Спасибо, что написали. Передадим ваши слова хирургу и всей команде отделения.', '', 'Отзыв: Долго ждали в приёмном.', 'Ответ: Нам жаль, что пришлось ждать. Напишите на почту, мы разберёмся и ответим.'])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        res = []
        # карточка: разбор отзыва и речевая оценка
        C = await pg.evaluate("""async () => { window.__otvShowTab('pos'); await new Promise(r => setTimeout(r, 500));
          const card = [...document.querySelectorAll('#tab-pos article, #tab-pos .card')].find(c => /Анне Викторовне/.test(c.textContent)); if (!card) return null;
          const an = card.querySelector('.speech.an'), sp = card.querySelector('.speech:not(.an)'), ta = card.querySelector('textarea[aria-label="Текст ответа"]');
          ta.value = 'Здравствуйте, Ирина!\\nВыражаем Вам искреннюю благодарность. Данный отзыв является очень важным для нас.\\nС уважением, администрация 24 Московской больницы';
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          const r = { an: an && an.textContent, anHidden: an && an.hidden, sp: sp && sp.textContent, low: sp && sp.dataset.score };
          ta.value = 'Здравствуйте, Ирина!\\nСпасибо за отзыв. Передадим ваши слова сотрудникам.\\nС уважением, администрация 24 Московской больницы'; ta.dispatchEvent(new Event('input', { bubbles: true }));
          r.cleanHidden = sp.hidden; return r; }""")
        ok = C and C['anHidden'] and C['cleanHidden'] and 'Текст:' in (C['sp'] or '') and 'штамп' in C['sp'] and C['low'] == 'low'
        res.append((ok, 'карточка: подпись про текст — только когда есть замечания (штамп найден); чистый текст и обычная благодарность — без подписей', C))
        # загрузка своих ответов: вставка
        K = await pg.evaluate("""async () => { window.__otvShowTab('kb'); await new Promise(r => setTimeout(r, 500));
          const before = Object.keys(window.__otvAll('kb') || {}).length;
          const btn = [...document.querySelectorAll('#kbBox button')].find(b => b.textContent === 'Вставить свои ответы'); btn.click();
          const ta = document.querySelector('#kbBox .kb-own textarea'); ta.value = 'Спасибо, что поделились. Передадим ваши слова команде отделения.\\n\\nСпасибо за тёплые слова. Сотрудникам будет приятно их прочитать.';
          [...document.querySelectorAll('#kbBox button')].find(b => b.textContent === 'Добавить в обучение').click();
          await new Promise(r => setTimeout(r, 800));
          return { before, after: Object.keys(window.__otvAll('kb') || {}).length, msg: document.getElementById('kbOwnMsg').textContent }; }""")
        res.append((K['after'] - K['before'] >= 2 and 'Добавлено в обучение: 2' in K['msg'], 'вставка своих ответов добавляет их в обучение', K))
        # Word-файл парами «Отзыв / Ответ» и таблица CSV
        W = await pg.evaluate("""async (b64) => {
          const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), O = window.__otvKbOwn;
          const f = new File([bin], 'мои ответы.docx'); const items = await O.readFile(f);
          const csv = await O.readFile(new File(['Отзыв;Ответ\\n"Спасибо врачу";"Спасибо, что написали. Передадим ваши слова врачу."\\n'], 'т.csv'));
          const n = await O.importOwn(items, 'мои ответы.docx');
          const kb = window.__otvAll('kb'), own = Object.values(kb).filter(e => e.source === 'загружено');
          return { items: items.map(x => [x.situation.slice(0, 20), x.answer.slice(0, 20)]), csv: csv.length, n, neg: own.some(e => /ответ на жалобу/.test(e.note)) }; }""", DOCX)
        res.append((len(W['items']) == 2 and W['items'][0][0].startswith('Спасибо доктору') and W['csv'] == 1 and W['n'] == 2, 'Word парами «Отзыв:/Ответ:» и таблица читаются', W))
        # программа сама берёт хорошие ответы больницы с площадок, плохие — нет
        R = await pg.evaluate("""async () => { const db = await window.__otvRt.use('db');
          await db.collection('registry').doc('ya-r2').update({ reply: 'Олег, спасибо, что выбрали нашу больницу. Передадим ваши слова команде кардиологии.' });
          await db.collection('registry').doc('ya-r3').update({ reply: 'Выражаем Вам искреннюю благодарность за Ваш отзыв. Данный отзыв является очень важным. В рамках проверки будут приняты определённые меры.' });
          await new Promise(r => setTimeout(r, 800)); const kb = window.__otvAll('kb') || {};
          return { good: !!kb['site-ya-r2'], bad: !!kb['site-ya-r3'] }; }""")
        res.append((R['good'] and not R['bad'], 'сама учится на хороших ответах с площадок, казённые пропускает', R))
        # генератор: вариант с канцеляритом проигрывает простому
        G = await pg.evaluate("""() => { const S = window.__otvSpeech; return [S.penalty('Выражаем Вам искреннюю благодарность. Данный отзыв является очень важным.'), S.penalty('Спасибо за отзыв. Передадим ваши слова сотрудникам.')]; }""")
        res.append((G[0] > G[1] + 1, 'штраф за казённую речь при выборе варианта', G))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else d)
        await b.close(); print('ALL OK' if all(r[0] for r in res) else 'SOME FAILED')
asyncio.run(main())
