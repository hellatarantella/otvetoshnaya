"""Берёт страницу онлайн-сервиса и кладёт в web/page.html без идентификаторов Google-файлов и задач Claude.
Идентификаторы программа берёт из своих настроек (перенесённых данных), а не из кода."""
import re, sys
src, dst = sys.argv[1], sys.argv[2]
t = open(src, encoding="utf-8").read()
t = re.sub(r'(docs\.google\.com/spreadsheets/d/)[A-Za-z0-9_-]{25,}', r'\1__POS_ID__', t)
t = re.sub(r'(docs\.google\.com/document/d/)[A-Za-z0-9_-]{25,}', r'\1__NEG_ID__', t)
t = re.sub(r'(POS_ID = ")[A-Za-z0-9_-]{25,}"', r'\1__POS_ID__"', t)
t = re.sub(r'(NEG_ID = ")[A-Za-z0-9_-]{25,}"', r'\1__NEG_ID__"', t)
t = re.sub(r'trig_[A-Za-z0-9]{10,}', 'trig_none', t)
left = re.findall(r'[A-Za-z0-9_-]{40,}', t)
open(dst, "w", encoding="utf-8").write(t)
print("ok; длинных идентификаторов осталось:", len(left))
