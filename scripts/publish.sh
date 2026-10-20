#!/usr/bin/env bash
# Выпуск версии: берёт готовые файлы из ветки dist (их кладёт сборка после отправки в ветку release)
# и выкладывает в открытый otvetoshnaya-releases одним коммитом без истории.
# Запуск: scripts/publish.sh /путь/к/клону/otvetoshnaya-releases
set -euo pipefail
REL="${1:?укажите путь к клону otvetoshnaya-releases}"
# ПРАВИЛО: без пройденных проверок не выпускаем. И выпускаем ровно ту версию, которую проверили
[ -z "$(git status --porcelain)" ] || { echo "Есть незафиксированные изменения: выпуск остановлен" >&2; exit 1; }
bash tests/run-all.sh || exit 1
git fetch -q origin dist ci-status-macOS ci-status-Windows
for b in ci-status-macOS ci-status-Windows; do
  git show "origin/$b:status.txt" | grep -q "sha $(git rev-parse HEAD)" || { echo "Сборка $b не из проверенной версии $(git rev-parse --short HEAD): выпуск остановлен" >&2; exit 1; }
  git show "origin/$b:status.txt" | grep -q "job success" || { echo "Сборка $b не прошла: выпуск остановлен" >&2; exit 1; }
done
git fetch -q origin dist
# в сборке должна быть ровно проверенная версия (сборка выкладывает файлы последним шагом — раньше времени не выпускаем)
WANT=$(python3 -c 'import json;print(json.load(open("package.json"))["version"])')
GOT=$(git show FETCH_HEAD:latest.json | python3 -c 'import json,sys;print(json.load(sys.stdin)["version"])')
[ "$WANT" = "$GOT" ] || { echo "В сборке версия $GOT, а проверена $WANT: сборка ещё не выложила файлы, выпуск остановлен" >&2; exit 1; }
# без программы для Mac не выпускаем: иначе на Mac пропадёт и обновление, и установщик
if ! git show FETCH_HEAD:latest.json | grep -q '"darwin-aarch64"' && [ "${ALLOW_NO_MAC:-}" != "1" ]; then
  echo "В сборке нет программы для Mac, выпуск остановлен (ALLOW_NO_MAC=1, чтобы выпустить всё равно)" >&2
  exit 1
fi
cd "$REL"
git checkout -q --orphan "pub-$$"
git rm -rq --cached . >/dev/null 2>&1 || true
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
for f in $(git -C "$OLDPWD" ls-tree --name-only FETCH_HEAD); do git -C "$OLDPWD" show "FETCH_HEAD:$f" > "$f"; done
git -C "$OLDPWD" show HEAD:scripts/releases-readme.md > README.md
# подпись обновлений настоящим ключом (он только здесь, не в репозитории и не на сборочных машинах)
KEY="${UPDATER_KEY:-/home/claude/keys/otvetoshnaya-updater.key}"
TAURI="$OLDPWD/node_modules/.bin/tauri"
python3 - "$KEY" "$TAURI" <<'PY'
import json, os, subprocess, sys
key, tauri = sys.argv[1], sys.argv[2]
d = json.load(open("latest.json"))
for plat, v in d["platforms"].items():
    f = os.path.basename(v["url"])
    if not os.path.exists(f): sys.exit(f"нет файла {f} для {plat}")
    for old in (f + ".sig",):
        if os.path.exists(old): os.remove(old)
    subprocess.run([tauri, "signer", "sign", "-f", key, "-p", "", f], check=True, capture_output=True)
    v["signature"] = open(f + ".sig").read().strip()
    os.remove(f + ".sig")
json.dump(d, open("latest.json", "w"), ensure_ascii=False, indent=2)
print("подписано настоящим ключом:", ", ".join(d["platforms"]))
PY
VER=$(python3 -c 'import json;print(json.load(open("latest.json"))["version"])')
git add -A
git commit -q -m "Ответошная $VER"
git push -f origin "HEAD:main"
echo "Выпущена $VER"
