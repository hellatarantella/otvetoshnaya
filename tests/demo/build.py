# Тестовая страница: программа целиком с поддельным окружением (данные выдуманные). Запуск: python3 tests/demo/build.py ВЫХОД.html
import re, sys, os
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, '..', '..', 'dist') + '/'
demo = here + '/'
h = open(root + 'index.html', encoding='utf-8').read()
css = open(root + 'runtime.css', encoding='utf-8').read() + "\n.demo-note{background:#3d3216;color:#ffd36e;border-radius:10px;padding:8px 12px;font-size:13px;margin:0 0 14px}\n"
stub = open(demo + 'stub.js', encoding='utf-8').read()
h = h.replace('<link rel="stylesheet" href="runtime.css">', '<style>\n' + css + '\n</style>')
def inline(name):
    global h
    tag = '<script src="%s"></script>' % name
    assert tag in h, name
    js = open(root + name, encoding='utf-8').read().replace('</script', '<\\/script')
    h = h.replace(tag, '<script>\n' + js + '\n</script>')
inline('runtime.js'); inline('sources.js'); inline('kb.js'); inline('templates.js'); inline('gen.js'); inline('model.js'); inline('gscode.js'); inline('reports.js')
for n in ['learn.js', 'appeal.js', 'vendor/jspdf.umd.min.js', 'vendor/pptxgen.bundle.js', 'deck-assets.js', 'deck.js', 'deck-data.js', 'deck-export.js', 'deck-ui.js']: inline(n)
h = h.replace('<head>', '<head>\n<script>\n' + stub + '\n</script>', 1)
h = h.replace('window.claude', 'window.__otvRt')
h = re.sub(r'<title>[^<]*</title>', '<title>Ответошная тест</title>', h, count=1)
open(sys.argv[1], 'w', encoding='utf-8').write(h)
print(len(h))
