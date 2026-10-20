// Проверка встроенной модели на выдуманных отзывах (в CI): тот же код, что в программе (gen.js + model.js),
// только вместо окна программы — заглушки, а модель — llama-server на этом компьютере.
// Запуск: node tools/model_check.mjs <порт> > results.md
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = process.argv[2] || "8080";
const page = readFileSync(join(root, "web", "page.html"), "utf8");
const refs = {};
for (const m of page.matchAll(/<script type="text\/plain" id="(ref-[^"]+)">([\s\S]*?)<\/script>/g)) refs[m[1]] = m[2];
const cases = JSON.parse(readFileSync(join(root, "tools", "model_check_cases.json"), "utf8"));
const raw = [];
const win = {
  __OTV_APP: true,
  addEventListener() {}, dispatchEvent() {},
  claude: { use: () => Promise.resolve({ collection: () => ({ doc: () => ({ get: () => Promise.resolve({ exists: false }), set: () => Promise.resolve() }) }) }) },
  __otvAll: () => ({}),
  __TAURI__: {
    event: { listen() { return Promise.resolve(() => {}); } },
    core: {
      invoke: async (cmd, a) => {
        if (cmd === "model_status") return { installed: true, server: true, running: false, bytes: 1, download: {} };
        if (cmd !== "model_generate") return null;
        const t0 = Date.now();
        const r = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, { method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: a.messages, max_tokens: a.maxTokens, temperature: a.temperature, top_p: 0.8, top_k: 20, min_p: 0, repeat_penalty: 1.05, stream: false }) });
        const j = await r.json();
        const out = j.choices?.[0]?.message?.content || "";
        raw.push({ out, ms: Date.now() - t0, ptok: j.usage?.prompt_tokens, ctok: j.usage?.completion_tokens });
        return out;
      }
    }
  }
};
win.window = win;
win.document = { getElementById: (id) => (refs[id] != null ? { textContent: refs[id] } : null), addEventListener() {} };
const ctx = vm.createContext(win);
for (const f of ["templates.js", "gen.js", "model.js"]) vm.runInContext(readFileSync(join(root, "web", f), "utf8"), ctx, { filename: f });

const lines = ["# Проверка модели на выдуманных отзывах", ""];
for (const c of cases) {
  lines.push(`## ${c.kind === "question" ? "Вопрос" : "Отзыв"} · ${c.platform} · ${c.page}${c.rating ? " · ★" + c.rating : ""}${c.author ? " · " + c.author : ""}`, "", "> " + c.review, "");
  let cur = "";
  for (let i = 0; i < 2; i++) {
    raw.length = 0;
    let res = null, err = "";
    try { res = await win.__otvModel.write(Object.assign({}, c, { current: cur })); } catch (e) { err = String(e); }
    raw.forEach((r, k) => lines.push(`- сырой ответ ${k + 1} (${(r.ms / 1000).toFixed(1)} с, промпт ${r.ptok} ток., ответ ${r.ctok} ток.): ${r.out.replace(/\n+/g, " / ")}`));
    lines.push("", `**Вариант ${i + 1}:** ` + (res ? "\n\n" + res.split("\n").join("  \n") : `— не прошёл проверку ${err}`), "");
    if (res) cur = res;
  }
}
console.log(lines.join("\n"));
