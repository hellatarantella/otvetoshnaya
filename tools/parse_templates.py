"""Разбор документа «Шаблоны ответов» (выгрузка в markdown) в web/templates.js.
Персональные данные вырезаются: шаблоны с телефонами, адресами почты сотрудников и подписями людей не берём."""
import json, re, sys
src, out = sys.argv[1], sys.argv[2]
c = open(src, encoding='utf-8').read()
SIGN = "С уважением, администрация 24 Московской больницы"
def clean(s):
    s = s.replace('\u200e', '').replace('\xa0', ' ')
    s = re.sub(r'\\([\[\]!\-_.*()#+])', r'\1', s)
    s = re.sub(r'<(https?://[^>]+|[\w.+-]+@[\w.-]+)>', r'\1', s)
    s = re.sub(r'\*\*', '', s)
    s = re.sub(r'[ \t]+\n', '\n', s)
    s = re.sub(r'\n{2,}', '\n', s)
    return s.strip()
sections = re.split(r'^# \*\*(.+?)\*\*.*$', c, flags=re.M)
items = []
sec = ''
for i in range(1, len(sections), 2):
    name0 = clean(sections[i]).strip('*').strip()
    body = sections[i + 1]
    if not name0.startswith('Шаблоны'):
        sec = name0
    parts = re.split(r'^(?:#{2,6} |\*\*)(.+?)(?:\*\*)?\s*$', body, flags=re.M)
    cat = ''
    chunks = [(cat, parts[0])]
    for j in range(1, len(parts), 2):
        name = clean(parts[j]).strip('*').strip()
        if re.match(r'^Вариант', name) or name.startswith('При возможности') or name.startswith('Простите'):
            chunks.append((cat, parts[j + 1]))
            continue
        if name.startswith('Здравствуйте') or name.startswith('Благодарим') or name.startswith('Мы понимаем') or name.startswith('С уважением'):
            chunks.append((cat, name + '\n' + parts[j + 1]))
            continue
        cat = name
        chunks.append((cat, parts[j + 1]))
    for cat, txt in chunks:
        txt = clean(txt)
        for piece in txt.split(SIGN):
            t = piece.strip()
            t = re.sub(r'^Пресс-служба ГКБ №24: ответ на форму обратной связи\s*', '', t)
            if len(t) < 40 or not cat:
                continue
            # личный телефон и подпись сотрудницы, письма модераторам — не берём; общий телефон больницы оставляем
            if re.search(r'\b[89]\d{10}\b|\+7\s?\(9\d\d\)|moderation@', t):
                continue
            # служебные пометки перед текстом ответа («кому переслать») — отрезаем
            k = t.find('Здравствуйте')
            if k > 0: t = t[k:]
            if not re.match(r'(Здравствуйте|Спасибо|Благодарим|\[)', t):
                continue
            if sec in ('Для доп. проверки', 'Этический комитет', 'Для отчётов') or 'Умную госпитализацию' in cat:
                continue
            items.append({"section": sec, "category": cat, "text": t + "\n" + SIGN})
open(out, 'w', encoding='utf-8').write(
    "/* Шаблоны ответов ГКБ №24 (из документа «Шаблоны ответов») — основа вариантов «Ещё вариант». Без персональных данных. */\n"
    "window.__otvTemplates = " + json.dumps(items, ensure_ascii=False, indent=0) + ";\n")
from collections import Counter
print(len(items)); print(Counter((x['section'], x['category']) for x in items).most_common(80))
