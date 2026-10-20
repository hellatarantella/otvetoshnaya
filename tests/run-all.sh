#!/usr/bin/env bash
# Все проверки разом. Правило: без «ВСЕ ПРОВЕРКИ ПРОШЛИ» ничего не выпускается (scripts/publish.sh и сборка это проверяют).
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0; out=$(mktemp -d)
node scripts/build-page.mjs >/dev/null || { echo "НЕ СОБРАЛАСЬ СТРАНИЦА"; exit 1; }
for f in web/*.js google/*.gs; do node -e "new Function(require('fs').readFileSync('$f','utf8'))" 2>/dev/null || { echo "ОШИБКА СИНТАКСИСА: $f"; fail=1; }; done
for t in tests/*.test.js; do
  node "$t" > "$out/r" 2>&1; if tail -1 "$out/r" | grep -q "ALL OK"; then echo "ok  $t"; else echo "НЕ ПРОШЛА: $t"; grep -E "FAIL|BAD|Error" "$out/r" | head -20; fail=1; fi
done
if [ "${NO_BROWSER:-}" != "1" ]; then
  python3 tests/demo/build.py "$out/page.html" >/dev/null || { echo "НЕ СОБРАЛАСЬ ТЕСТОВАЯ СТРАНИЦА"; fail=1; }
  for t in tests/*.py; do
    python3 "$t" "$out/page.html" > "$out/r" 2>&1; if tail -1 "$out/r" | grep -q "ALL OK"; then echo "ok  $t"; else echo "НЕ ПРОШЛА: $t"; tail -20 "$out/r"; fail=1; fi
  done
fi
rm -rf "$out"
[ $fail = 0 ] && echo "ВСЕ ПРОВЕРКИ ПРОШЛИ" || { echo "ПРОВЕРКИ НЕ ПРОШЛИ: выпуск запрещён"; exit 1; }
