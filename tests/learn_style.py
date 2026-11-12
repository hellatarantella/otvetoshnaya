# Обучение на вашей редактуре: стиль (длина, любимое начало, обращение по имени), копилка ваших фраз по местам ответа
# (без имён и подробностей пациентов), сборщик подмешивает ваши фразы и пишет по-вашему; убранное вами не возвращается. Данные выдуманные
import asyncio, sys, json
from playwright.async_api import async_playwright
P = "file://" + sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1100, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(P); await pg.wait_for_timeout(1500)
        r = await pg.evaluate("""async () => {
          const db = await window.__otvRt.use('db'), S = 'С уважением, администрация 24 Московской больницы';
          let i = 0; const put = (o) => db.collection('kb').doc('st-' + (++i)).set(Object.assign({ kind: 'review', platform: 'Яндекс', edited: true, status: 'published', updatedAt: new Date(Date.now() + i).toISOString() }, o));
          for (let k = 0; k < 6; k++) await put({ situation: 'Спасибо всем, всё отлично ' + k, draft: 'Здравствуйте!\\nБлагодарим за отзыв. Ваше мнение очень важно для нас. Желаем здоровья.\\n' + S,
            answer: 'Здравствуйте, Анна!\\nСпасибо, что выбрали нас. Ваши слова греют сердце всей команды. Будем рады видеть вас здоровыми. Желаем здоровья и всего самого доброго.\\n' + S });
          // фраза с именем пациента и датой — в копилку не идёт
          await put({ situation: 'Спасибо', answer: 'Здравствуйте!\\nСпасибо за отзыв. Передадим слова Ивану Петровичу Сидорову, который лечил вас 12.10. Ваша поддержка помогает команде.\\n' + S });
          await new Promise(r => setTimeout(r, 300));
          const L = window.__otvLearn, st = L.style();
          const it = { platform: 'Яндекс', page: 'Карточка больницы', author: 'Олег', rating: 5, review: 'Лежал в отделении неделю, всё понравилось, спасибо большое всему коллективу за внимание и терпение, рекомендую всем.' };
          const V = window.__otvCompose.variants(it, { tone: 'positive', type: 'hospital' }, 30);
          const mine = V.filter(v => /греют сердце|выбрали нас|будем рады видеть/i.test(v.text)).length;
          const bad = V.filter(v => /мнение очень важно|Иван|Сидоров/i.test(v.text)).length;
          const lens = V.map(v => (v.text.match(/[.!?]/g) || []).length);
          window.__otvShowTab('kb'); await new Promise(r => setTimeout(r, 600));
          const ui = (document.getElementById('kbLearn') || {}).textContent || '';
          return { total: st.total, posLen: st.posLen, open: st.open[0], byName: st.byName, phr: st.phrases.map(p => p.slot + ':' + p.text), mine, bad, n: V.length, lens, ui: ui.slice(0, 400) };
        }""")
        res = []
        res.append((r['total'] >= 7 and r['posLen'] == 4 and r['open']['word'] == 'спасибо' and r['byName'] >= 75, 'стиль: обычно 4 предложения, начинаете со «Спасибо», обращаетесь по имени', r))
        res.append((any('греют сердце' in x for x in r['phr']) and any(x.startswith('open:Спасибо, что выбрали') for x in r['phr']) and not any('Иван' in x or '12.10' in x for x in r['phr']), 'копилка: ваши фразы по местам ответа, без имён и дат пациента', r['phr']))
        res.append((r['mine'] >= r['n'] * 0.25 and r['bad'] == 0, 'сборщик подмешивает ваши фразы часто; убранное вами и имена — никогда', [r['mine'], r['n'], r['bad']]))   # 07.11: банки выросли вдвое — из 30 РАЗНЫХ вариантов ваши фразы в трети и больше; в выбранном ответе их поднимает судья (признак «Ваши фразы»)
        res.append((sum(r['lens']) / max(1, len(r['lens'])) >= 3, 'длина ответов — по вашему стилю', r['lens']))
        res.append(('Ваш стиль' in r['ui'] and 'Ваши фразы в копилке' in r['ui'], 'в «Базе ответов» видно ваш стиль и копилку', r['ui']))
        res.append((not errs, 'без ошибок страницы', errs[:3]))
        for ok, t, d in res: print(('OK  ' if ok else 'FAIL') + ' ' + t, '' if ok else json.dumps(d, ensure_ascii=False)[:1200])
        await b.close(); print('ALL OK' if all(x[0] for x in res) else 'SOME FAILED')
asyncio.run(main())
