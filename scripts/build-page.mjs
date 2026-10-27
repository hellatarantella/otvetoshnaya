// Собирает интерфейс программы из той же страницы, что и онлайн-сервис.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });

let page = readFileSync(join(root, "web", "page.html"), "utf8");
if (!page.includes("<head>")) throw new Error("page.html: нет <head>");
page = page.replace("<head>", '<head>\n<link rel="stylesheet" href="runtime.css">\n<script src="runtime.js"></script>\n<script src="sources.js"></script>\n<script src="kb.js"></script>\n<script src="templates.js"></script>\n<script src="gen.js"></script>\n<script src="model.js"></script>\n<script src="gscode.js"></script>\n<script src="reports.js"></script>\n<script src="vendor/jspdf.umd.min.js"></script>\n<script src="vendor/pptxgen.bundle.js"></script>\n<script src="deck-assets.js"></script>\n<script src="deck.js"></script>\n<script src="deck-data.js"></script>\n<script src="deck-export.js"></script>\n<script src="deck-ui.js"></script>');
writeFileSync(join(dist, "index.html"), page);
// текст Google-скрипта отчётов — для кнопки «Скопировать скрипт»
// __otvGsCode — постоянный скрипт для установки (кнопка «Скопировать скрипт»), __otvGsLib — логика отчётов, её программа шлёт при каждом обращении
writeFileSync(join(root, "web", "gscode.js"), "/* сгенерировано из google/Runner.gs и google/Code.gs */\nwindow.__otvGsCode = " + JSON.stringify(readFileSync(join(root, "google", "Code.gs"), "utf8")) + ";\nwindow.__otvGsLib = " + JSON.stringify(readFileSync(join(root, "google", "Code.gs"), "utf8")) + ";\n");
copyFileSync(join(root, "web", "gscode.js"), join(dist, "gscode.js"));
for (const f of ["runtime.js", "runtime.css", "sources.js", "kb.js", "templates.js", "gen.js", "model.js", "reports.js", "deck-assets.js", "deck.js", "deck-data.js", "deck-export.js", "deck-ui.js"]) copyFileSync(join(root, "web", f), join(dist, f));
mkdirSync(join(dist, "vendor"), { recursive: true });
for (const f of ["jspdf.umd.min.js", "pptxgen.bundle.js"]) copyFileSync(join(root, "web", "vendor", f), join(dist, "vendor", f));
console.log("dist/index.html готов:", page.length, "символов");
