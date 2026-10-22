// Сбор по расписанию: если скрытое окно почты молчит, программа не висит 4 минуты, а через короткое время читает из окна почты и пишет это в журнал
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "web", "sources.js"), "utf8");
const i = src.indexOf("  var HIDDEN_MS = "), j = src.indexOf("  /* ---------- запись в реестр");
const body = src.slice(i, j);
let fails = 0; const ok = (c, m) => { console.log((c ? "OK  " : "FAIL") + " " + m); if (!c) fails++; };
function run(answer) {
  const calls = [], log = [], pending = {};
  const invoke = (cmd, a) => { if (cmd === "source_collect") { calls.push(a); const r = answer(a, calls.length); if (r) setTimeout(() => pending[a.id] && pending[a.id](r), 5); } return Promise.resolve(null); };
  const f = new Function("invoke", "jlog", "pending", "autoRun", "window", body + "; HIDDEN_MS = 50; return collectOne;");
  const collectOne = f(invoke, l => log.push(l), pending, true, { __otvAll: () => ({}) });
  return collectOne({ id: "mail", name: "Почта сайта", reuse: true, timeout: 240000, url: "u", prefix: "p", fn: function () {} }).then(p => ({ p, calls, log }));
}
(async () => {
  const t0 = Date.now();
  const a = await run((x, n) => n === 1 ? null : { ok: true, items: [1, 2] });   // скрытое окно молчит
  ok(Date.now() - t0 < 1000, "скрытое окно не держит сбор до полного срока");
  ok(a.calls.length === 2 && a.calls[1].reuse === true, "после молчания читаем из открытого окна почты");
  ok(a.p.ok && a.p.items.length === 2, "письма прочитаны");
  ok(a.log.some(l => /скрытом окне страница не ответила/.test(l)), "в журнале видно, что было");
  const b = await run(() => ({ ok: false, stopped: true }));
  ok(b.calls.length === 1 && b.p.stopped, "остановленный сбор не перезапускается");
  console.log(fails ? "SOME FAILED" : "ALL OK"); process.exit(fails ? 1 : 0);
})();
