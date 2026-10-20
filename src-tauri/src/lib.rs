//! «Ответошная»: окно с интерфейсом сервиса + защищённое локальное хранилище.
//! Данные лежат одним зашифрованным файлом (AES-256-GCM) в папке программы;
//! ключ — в системной связке ключей (Keychain на Mac, Credential Manager на Windows).

use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use rand::RngCore;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Manager, State};

mod gs;
mod model;

const MAGIC: &[u8; 4] = b"OTV1";
const DATA_FILE: &str = "data.enc";
const KEY_SOURCE_FILE: &str = "key-source";
const KEY_FILE: &str = "data.key";
const BACKUPS_KEEP: usize = 14;

struct Store {
    dir: PathBuf,
    key: Result<[u8; 32], String>,
    lock: Mutex<()>,
}

// ---------- ключ ----------

#[cfg(desktop)]
fn keychain_entry() -> Option<keyring::Entry> {
    keyring::Entry::new("Otvetoshnaya", "data-key").ok()
}

fn decode_key(s: &str) -> Option<[u8; 32]> {
    let v = B64.decode(s.trim()).ok()?;
    if v.len() != 32 {
        return None;
    }
    let mut k = [0u8; 32];
    k.copy_from_slice(&v);
    Some(k)
}

fn write_private(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let mut f = fs::File::create(path)?;
    f.write_all(bytes)?;
    f.sync_all()?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

fn load_or_create_key(dir: &Path) -> Result<[u8; 32], String> {
    let marker = dir.join(KEY_SOURCE_FILE);
    let source = fs::read_to_string(&marker).unwrap_or_default();
    match source.trim() {
        "keychain" => {
            #[cfg(desktop)]
            {
                let e = keychain_entry().ok_or("Связка ключей недоступна")?;
                let s = e
                    .get_password()
                    .map_err(|e| format!("Не удалось получить ключ из связки ключей: {e}"))?;
                return decode_key(&s).ok_or_else(|| "Ключ в связке ключей повреждён".to_string());
            }
            #[cfg(not(desktop))]
            return Err("Связка ключей недоступна".into());
        }
        "file" => {
            let s = fs::read_to_string(dir.join(KEY_FILE)).map_err(|e| format!("Нет файла ключа: {e}"))?;
            decode_key(&s).ok_or_else(|| "Файл ключа повреждён".to_string())
        }
        _ => {
            if dir.join(DATA_FILE).exists() {
                return Err("Данные есть, а ключа нет. Новый ключ не создаю, чтобы ничего не потерять".into());
            }
            let mut k = [0u8; 32];
            OsRng.fill_bytes(&mut k);
            let enc = B64.encode(k);
            #[cfg(desktop)]
            if let Some(e) = keychain_entry() {
                if e.set_password(&enc).is_ok() && e.get_password().ok().as_deref() == Some(enc.as_str()) {
                    write_private(&marker, b"keychain").map_err(|e| e.to_string())?;
                    return Ok(k);
                }
            }
            write_private(&dir.join(KEY_FILE), enc.as_bytes()).map_err(|e| e.to_string())?;
            write_private(&marker, b"file").map_err(|e| e.to_string())?;
            Ok(k)
        }
    }
}

// ---------- шифрование ----------

fn encrypt(key: &[u8; 32], plain: &[u8]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ct = cipher.encrypt(&nonce, plain).map_err(|_| "Ошибка шифрования".to_string())?;
    let mut out = Vec::with_capacity(4 + 12 + ct.len());
    out.extend_from_slice(MAGIC);
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&ct);
    Ok(out)
}

fn decrypt(key: &[u8; 32], bytes: &[u8]) -> Result<Vec<u8>, String> {
    if bytes.len() < 16 || &bytes[..4] != MAGIC {
        return Err("Файл данных не распознан".into());
    }
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    cipher
        .decrypt(Nonce::from_slice(&bytes[4..16]), &bytes[16..])
        .map_err(|_| "Не удалось расшифровать данные. Ключ не подходит".to_string())
}

// ---------- даты для копий ----------

fn today() -> String {
    let days = (SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0) / 86400) as i64;
    // перевод номера дня в дату (алгоритм Хиннанта)
    let z = days + 719468;
    let era = z.div_euclid(146097);
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
    format!("{y:04}-{m:02}-{d:02}")
}

fn daily_backup(dir: &Path) {
    let cur = dir.join(DATA_FILE);
    if !cur.exists() {
        return;
    }
    let bdir = dir.join("backups");
    if fs::create_dir_all(&bdir).is_err() {
        return;
    }
    let target = bdir.join(format!("data-{}.enc", today()));
    if !target.exists() {
        let _ = fs::copy(&cur, &target);
    }
    if let Ok(rd) = fs::read_dir(&bdir) {
        let mut names: Vec<PathBuf> = rd.filter_map(|e| e.ok().map(|e| e.path())).collect();
        names.sort();
        while names.len() > BACKUPS_KEEP {
            let _ = fs::remove_file(names.remove(0));
        }
    }
}

// ---------- команды для окна ----------

fn key_of(store: &Store) -> Result<[u8; 32], String> {
    store.key.clone()
}

#[tauri::command]
fn db_load(store: State<Store>) -> Result<String, String> {
    let key = key_of(&store)?;
    let _g = store.lock.lock().map_err(|_| "занято")?;
    let path = store.dir.join(DATA_FILE);
    if !path.exists() {
        return Ok("{}".into());
    }
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    let plain = decrypt(&key, &bytes)?;
    String::from_utf8(plain).map_err(|e| e.to_string())
}

#[tauri::command]
fn db_save(store: State<Store>, json: String) -> Result<(), String> {
    serde_json::from_str::<serde_json::Value>(&json).map_err(|e| format!("Неверные данные: {e}"))?;
    let key = key_of(&store)?;
    let _g = store.lock.lock().map_err(|_| "занято")?;
    daily_backup(&store.dir);
    let enc = encrypt(&key, json.as_bytes())?;
    let tmp = store.dir.join(format!("{DATA_FILE}.tmp"));
    write_private(&tmp, &enc).map_err(|e| e.to_string())?;
    fs::rename(&tmp, store.dir.join(DATA_FILE)).map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct AssetRef {
    id: String,
    path: String,
}

fn safe_ext(ext: &str) -> String {
    let e: String = ext.chars().filter(|c| c.is_ascii_alphanumeric()).take(5).collect();
    if e.is_empty() { "bin".into() } else { e.to_lowercase() }
}

#[tauri::command]
fn asset_put(store: State<Store>, ext: String, data: String) -> Result<AssetRef, String> {
    let bytes = B64.decode(data).map_err(|e| e.to_string())?;
    let dir = store.dir.join("assets");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut raw = [0u8; 8];
    OsRng.fill_bytes(&mut raw);
    let id: String = raw.iter().map(|b| format!("{b:02x}")).collect();
    let path = dir.join(format!("{id}.{}", safe_ext(&ext)));
    write_private(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(AssetRef { id, path: path.to_string_lossy().into_owned() })
}

#[tauri::command]
fn asset_delete(store: State<Store>, id: String) -> Result<(), String> {
    if !id.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("bad id".into());
    }
    let dir = store.dir.join("assets");
    if let Ok(rd) = fs::read_dir(&dir) {
        for e in rd.flatten() {
            if e.file_name().to_string_lossy().starts_with(&format!("{id}.")) {
                let _ = fs::remove_file(e.path());
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn save_download(filename: String, data: String) -> Result<String, String> {
    let bytes = B64.decode(data).map_err(|e| e.to_string())?;
    let dir = dirs::download_dir().or_else(dirs::home_dir).ok_or("Нет папки «Загрузки»")?;
    let clean: String = filename
        .chars()
        .map(|c| if "\\/:*?\"<>|".contains(c) || c.is_control() { '_' } else { c })
        .collect();
    let clean = if clean.trim().is_empty() { "файл".to_string() } else { clean };
    let (stem, ext) = match clean.rfind('.') {
        Some(i) if i > 0 => (clean[..i].to_string(), clean[i..].to_string()),
        _ => (clean.clone(), String::new()),
    };
    let mut path = dir.join(&clean);
    let mut n = 2;
    while path.exists() {
        path = dir.join(format!("{stem} ({n}){ext}"));
        n += 1;
    }
    fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn app_info(app: tauri::AppHandle, store: State<Store>) -> serde_json::Value {
    let source = fs::read_to_string(store.dir.join(KEY_SOURCE_FILE)).unwrap_or_default();
    let backups = fs::read_dir(store.dir.join("backups")).map(|r| r.count()).unwrap_or(0);
    let data_bytes = fs::metadata(store.dir.join(DATA_FILE)).map(|m| m.len()).unwrap_or(0);
    serde_json::json!({
        "version": app.package_info().version.to_string(),
        "keySource": source.trim(),
        "keyError": store.key.as_ref().err(),
        "backups": backups,
        "backupsKeep": BACKUPS_KEEP,
        "dataBytes": data_bytes,
        "test": cfg!(debug_assertions) && std::env::var("OTV_TEST").is_ok(),
        "encrypted": data_bytes == 0 || fs::read(store.dir.join(DATA_FILE)).map(|b| b.starts_with(MAGIC)).unwrap_or(false),
    })
}


// ---------- источники: кабинеты площадок ----------
// Окно входа (видимое) и окно сбора (скрытое) делят одни cookie программы, поэтому вход нужен один раз.
// Скрипт сбора выполняется на странице кабинета и возвращает результат одной командой source_result,
// которая разрешена только этим окнам и только с адресов площадок (capabilities/sources.json).

fn safe_id(id: &str) -> Result<String, String> {
    if !id.is_empty() && id.len() <= 32 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        Ok(id.to_string())
    } else {
        Err("bad source id".into())
    }
}

fn parse_https(url: &str) -> Result<tauri::Url, String> {
    let u: tauri::Url = url.parse().map_err(|_| "Неверный адрес".to_string())?;
    if u.scheme() != "https" {
        return Err("Только https".into());
    }
    Ok(u)
}


/// Окна кабинетов ведут себя как обычный браузер: на Mac представляются Safari
/// (иначе Google и некоторые капчи не пускают во «встроенный браузер»),
/// разрешают всплывающие окна входа и любые https/http-переходы внутри входа.
fn source_window<'a, R: tauri::Runtime, M: tauri::Manager<R>>(
    app: &'a M,
    label: String,
    url: tauri::Url,
) -> tauri::WebviewWindowBuilder<'a, R, M> {
    let b = tauri::WebviewWindowBuilder::new(app, label, tauri::WebviewUrl::External(url))
        .on_navigation(|u: &url::Url| matches!(u.scheme(), "https" | "http" | "about" | "blob" | "data"))
        .on_new_window(|_, _| tauri::webview::NewWindowResponse::Allow);
    #[cfg(target_os = "macos")]
    let b = b.user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15");
    b
}


/// Ошибки страницы с самого начала загрузки (для «что видит программа» в окне входа).
const DIAG_INIT: &str = r#"(function(){ if (window.top !== window) return; window.__otvErrs = [];
  window.addEventListener('error', function (e) { try { window.__otvErrs.push(String(e.message || (e.target && (e.target.src || e.target.href)) || e.type).slice(0, 160)); } catch (x) {} }, true);
  window.addEventListener('unhandledrejection', function (e) { try { window.__otvErrs.push('promise: ' + String(e.reason).slice(0, 160)); } catch (x) {} });
})();"#;

/// Через 4 секунды после загрузки сообщает программе, что на странице: адрес, сколько текста, ошибки.
const DIAG_REPORT: &str = r#"(function(){ if (window.top !== window) return;
  setTimeout(function () { try {
    var t = document.title, b = document.body;
    var d = { url: location.href, title: t.slice(0, 80), text: b ? (b.innerText || '').trim().length : -1,
              els: document.getElementsByTagName('*').length, errs: (window.__otvErrs || []).slice(0, 5),
              ua: navigator.userAgent.slice(0, 40) };
    document.title = 'OTVDIAG|' + JSON.stringify(d);
    setTimeout(function () { document.title = t; }, 400);
  } catch (e) {} }, 4000);
})();"#;

#[tauri::command]
async fn source_open(app: tauri::AppHandle, id: String, url: String, title: String, script: Option<String>) -> Result<(), String> {
    let id = safe_id(&id)?;
    let label = format!("src-{id}");
    if let Some(w) = app.get_webview_window(&label) {
        if script.is_some() {
            let _ = w.close();
        } else {
            let _ = w.show();
            let _ = w.set_focus();
            return Ok(());
        }
    }
    let u = parse_https(&url)?;
    let base_title = title.clone();
    let sid = id.clone();
    let sid2 = id.clone();
    let b = source_window(&app, label, u)
        .title(title)
        .inner_size(1100.0, 820.0)
        .initialization_script(DIAG_INIT)
        .on_page_load(move |w, p| {
            use tauri::Emitter;
            let _ = w.set_title(&format!("{base_title} · {}", p.url()));
            let _ = w.emit_to("main", "source-nav", serde_json::json!({ "id": sid, "url": p.url().as_str(),
                "finished": matches!(p.event(), tauri::webview::PageLoadEvent::Finished) }));
            if matches!(p.event(), tauri::webview::PageLoadEvent::Finished) {
                let _ = w.eval(DIAG_REPORT);
                if let Some(js) = &script {
                    // «Покажите отзыв»: подсказка и выбор отзыва на каждой открытой странице
                    let _ = w.eval(js);
                }
            }
        })
        .on_document_title_changed(move |w, t| {
            use tauri::Emitter;
            if let Some(d) = t.strip_prefix("OTVDIAG|") {
                let _ = w.emit_to("main", "source-diag", serde_json::json!({ "id": sid2, "diag": d }));
            }
        });
    b.build().map_err(|e| e.to_string())?;
    Ok(())
}

/// Разрешает страницам добавленного пользователем сайта вернуть собранные отзывы (только source_result).
#[tauri::command]
fn source_allow(app: tauri::AppHandle, allowed: State<AllowedHosts>, url: String) -> Result<(), String> {
    let u = parse_https(&url)?;
    let host = u.host_str().ok_or("Нет домена")?.to_lowercase();
    if !host.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-') {
        return Err("Странный домен".into());
    }
    let mut set = allowed.0.lock().map_err(|_| "занято")?;
    if set.contains(&host) {
        return Ok(());
    }
    let cap = tauri::ipc::CapabilityBuilder::new(format!("custom-{}", host.replace('.', "-")))
        .remote(format!("https://{host}/*"))
        .window("src-*")
        .permission("allow-source-result");
    app.add_capability(cap).map_err(|e| e.to_string())?;
    set.insert(host);
    Ok(())
}

struct AllowedHosts(Mutex<std::collections::HashSet<String>>);

/// Окна сбора и публикации: одно рабочее окно на источник (src-<id>-c), оно не закрывается,
/// а между заданиями стоит пустым и спрятанным. Новое задание: сценарий запоминается здесь,
/// окно переходит на нужную страницу и выполняет его после загрузки. Так окна не копятся.
#[derive(Clone)]
struct Job { id: String, prefix: String, js: String, seq: u64 }
static BRIDGES: Mutex<Option<std::collections::HashMap<String, Job>>> = Mutex::new(None);
static JOB_SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
/// Окна входа, которые программа развернула для чтения: после чтения сворачиваем обратно.
static REMIN: Mutex<Vec<String>> = Mutex::new(Vec::new());

fn bridge_set(label: &str, job: Option<Job>) {
    if let Ok(mut g) = BRIDGES.lock() {
        let m = g.get_or_insert_with(Default::default);
        match job {
            Some(j) => { m.insert(label.to_string(), j); }
            None => { m.remove(label); }
        }
    }
}
fn bridge_get(label: &str) -> Option<Job> {
    BRIDGES.lock().ok().and_then(|g| g.as_ref().and_then(|m| m.get(label).cloned()))
}

/// Страница ушла с кабинета (на вход в Яндекс ID, mos.ru и т. п.) — сама она программе ответить не может.
/// Через 9 секунд, если окно так и не вернулось в кабинет, программа сама сообщает «нужен вход».
fn watch_login<R: tauri::Runtime>(app: tauri::AppHandle<R>, label: String, seq: u64) {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(9));
        let job = match bridge_get(&label) { Some(j) if j.seq == seq => j, _ => return };
        let url = app.get_webview_window(&label).and_then(|w| w.url().ok()).map(|u| u.to_string()).unwrap_or_default();
        if url.starts_with(&job.prefix) { return; }
        use tauri::Emitter;
        let payload = serde_json::json!({ "ok": false, "needLogin": true, "url": url.split('?').next().unwrap_or("") }).to_string();
        let _ = app.emit_to("main", "source-result", serde_json::json!({ "id": job.id, "payload": payload, "from": label }));
        idle_window(&app, &label);
    });
}

/// Тяжёлые страницы (Яндекс) могут долго не сообщать «загружено»: через 15 секунд сценарий
/// запускается и так, если окно уже на нужной странице. Повторный запуск сценарий сам пропускает.
fn kick_late<R: tauri::Runtime>(app: tauri::AppHandle<R>, label: String, seq: u64) {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(15));
        let job = match bridge_get(&label) { Some(j) if j.seq == seq => j, _ => return };
        if let Some(w) = app.get_webview_window(&label) {
            let here = w.url().map(|u| u.as_str().starts_with(&job.prefix)).unwrap_or(false);
            if here {
                let _ = w.eval(&job.js);
            }
        }
    });
}

fn is_collect_label(label: &str, id: &str) -> bool {
    let base = format!("src-{id}-c");
    label == base || (label.starts_with(&base) && label[base.len()..].chars().all(|c| c.is_ascii_digit()))
}

/// Рабочее окно закончило: забываем сценарий, уводим на пустую страницу и прячем.
fn idle_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>, label: &str) {
    bridge_set(label, None);
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.eval("window.__otvStop = true;");
        let _ = w.hide();
        if let Ok(u) = "about:blank".parse() {
            let _ = w.navigate(u);
        }
    }
}

/// Где держать окно, которому нужна «видимая» страница (Google, почта, публикация):
/// у правого края экрана, видна полоска в 2 точки. Страница считает себя на экране и работает,
/// а окно не закрывает программу и не забирает фокус.
fn parked_position<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> (f64, f64) {
    if let Ok(Some(m)) = app.primary_monitor() {
        let sf = m.scale_factor();
        let w = m.size().width as f64 / sf;
        let h = m.size().height as f64 / sf;
        return (w - 2.0, (h * 0.25).max(60.0));
    }
    (1438.0, 200.0)
}

#[tauri::command]
async fn source_collect(app: tauri::AppHandle, id: String, url: String, script: String, prefix: String, wait_ms: u32, show: Option<bool>, reuse: Option<bool>, visible: Option<bool>) -> Result<(), String> {
    let id = safe_id(&id)?;
    let label = format!("src-{id}-c");
    let u = parse_https(&url)?;
    let bridge = format!(
        r#"(function(){{
  if (window.top !== window) return;
  var ID = {id:?}, PREFIX = {prefix}, WAIT = {wait}, DEBUG = {debug}, REUSE = {reuse};
  var sent = false;
  function mark(s) {{ try {{ if (DEBUG) {{ var h = document.createElement('h1'); h.textContent = 'OTV: ' + s; document.body.prepend(h); }} }} catch (e) {{}} }}
  function send(p) {{
    if (sent) return; sent = true;
    try {{
      Promise.resolve(window.__TAURI_INTERNALS__.invoke('source_result', {{ id: ID, payload: JSON.stringify(p) }}))
        .then(function () {{ mark('отправлено'); }}, function (e) {{ mark('ошибка передачи: ' + e); }});
    }} catch (e) {{ mark('нет связи с программой: ' + e); }}
  }}
  function run() {{
    mark('запуск, ipc: ' + typeof window.__TAURI_INTERNALS__);
    if (location.href.indexOf(PREFIX) !== 0) {{
      setTimeout(function () {{ send({{ ok: false, needLogin: true, url: location.href }}); }}, 9000);
      return;
    }}
    setTimeout(async function () {{
      try {{
        var res = await ({script});
        if (typeof res === 'string') res = JSON.parse(res);
        var seen = null, diag = null, answered = null;
        if (res && !Array.isArray(res) && Array.isArray(res.items)) {{ seen = res.seen; diag = res.diag || null; answered = res.answered || null; res = res.items; }}
        send({{ ok: true, url: location.href, items: res, seen: seen, diag: diag, answered: answered }});
      }} catch (e) {{
        send({{ ok: false, url: location.href, error: String((e && e.message) || e) }});
      }}
    }}, WAIT);
  }}
  if (window.__otvBridge && !REUSE) return; window.__otvBridge = true;
  window.__otvStop = false;
  run();
}})();"#,
        id = id,
        prefix = serde_json::to_string(&prefix).map_err(|e| e.to_string())?,
        wait = wait_ms.min(20000),
        debug = show.unwrap_or(false),
        reuse = reuse.unwrap_or(false),
        script = script
    );
    // Если окно входа открыто (например, Google: отзывы открыты руками) — читаем прямо из него.
    if reuse.unwrap_or(false) {
        if let Some(w) = app.get_webview_window(&format!("src-{id}")) {
            // окно входа годится, только если в нём открыта нужная страница; свёрнутое окно
            // разворачиваем — в свёрнутом окне страница «спит» и ничего не читает
            let here = w.url().map(|u| u.as_str().starts_with(prefix.as_str())).unwrap_or(false);
            if here {
                if w.is_minimized().unwrap_or(false) {
                    let _ = w.unminimize();
                    if let Ok(mut v) = REMIN.lock() { v.push(w.label().to_string()); }
                }
                w.eval(&bridge).map_err(|e| e.to_string())?;
                return Ok(());
            }
        }
    }
    let debug = show.unwrap_or(false);
    let needs_screen = visible.unwrap_or(false);
    let seq = JOB_SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    bridge_set(&label, Some(Job { id: id.clone(), prefix: prefix.clone(), js: bridge, seq }));
    if let Some(w) = app.get_webview_window(&label) {
        // окно уже есть: переходим на нужную страницу, сценарий выполнится после загрузки
        if needs_screen || debug {
            let _ = w.show();
        }
        w.navigate(u).map_err(|e| e.to_string())?;
        kick_late(app.clone(), label.clone(), seq);
        return Ok(());
    }
    let lbl = label.clone();
    let app2 = app.clone();
    let mut b = source_window(&app, label, u)
        .title("Ответошная · сбор")
        .inner_size(1100.0, 820.0)
        .focused(false)
        .on_page_load(move |w, p| {
            if matches!(p.event(), tauri::webview::PageLoadEvent::Finished) {
                if let Some(job) = bridge_get(&lbl) {
                    if !p.url().as_str().starts_with(&job.prefix) && p.url().scheme() != "about" {
                        watch_login(app2.clone(), lbl.clone(), job.seq);
                    }
                    let _ = w.eval(&job.js);
                }
            }
        });
    if debug {
        b = b.visible(true);
    } else if needs_screen {
        let (x, y) = parked_position(&app);
        b = b.visible(true).decorations(false).shadow(false).focusable(false).skip_taskbar(true).position(x, y);
    } else {
        b = b.visible(false);
    }
    let w = b.build().map_err(|e| e.to_string())?;
    if needs_screen && !debug {
        let _ = w.set_ignore_cursor_events(true);
    }
    kick_late(app.clone(), w.label().to_string(), seq);
    Ok(())
}

#[tauri::command]
fn source_result(app: tauri::AppHandle, window: tauri::WebviewWindow, id: String, payload: String) -> Result<(), String> {
    use tauri::Emitter;
    let id = safe_id(&id)?;
    if !is_collect_label(window.label(), &id) && window.label() != format!("src-{id}") {
        return Err("чужое окно".into());
    }
    if payload.len() > 8 * 1024 * 1024 {
        return Err("слишком много данных".into());
    }
    app.emit_to("main", "source-result", serde_json::json!({ "id": id, "payload": payload, "from": window.label() }))
        .map_err(|e| e.to_string())?;
    if is_collect_label(window.label(), &id) {
        // задание выполнено: окно пустеет и прячется до следующего раза
        idle_window(&app, window.label());
    } else if let Ok(mut v) = REMIN.lock() {
        // окно входа было свёрнуто: прочитали и сворачиваем обратно
        if let Some(i) = v.iter().position(|l| l == window.label()) {
            v.remove(i);
            let _ = window.minimize();
        }
    }
    Ok(())
}

/// «Остановить сбор»: закрывает окно сбора и просит страницу в окне входа прекратить чтение.
#[tauri::command]
fn source_stop(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let id = safe_id(&id)?;
    idle_window(&app, &format!("src-{id}-c"));
    if let Some(w) = app.get_webview_window(&format!("src-{id}")) {
        let _ = w.eval("window.__otvStop = true;");
    }
    Ok(())
}

#[tauri::command]
fn source_close(app: tauri::AppHandle, label: String) -> Result<(), String> {
    if !label.starts_with("src-") {
        return Err("bad label".into());
    }
    if let Some(id) = label.strip_prefix("src-").and_then(|x| x.strip_suffix("-c")) {
        // рабочее окно не закрываем: пустеет и прячется
        let id = safe_id(id)?;
        idle_window(&app, &format!("src-{id}-c"));
    } else if let Some(w) = app.get_webview_window(&label) {
        let _ = w.close();
    }
    Ok(())
}

// ---------- журнал работы: только события и ошибки, без текстов отзывов и писем ----------

const LOG_FILE: &str = "journal.txt";

#[tauri::command]
fn log_append(store: State<Store>, line: String) -> Result<(), String> {
    let path = store.dir.join(LOG_FILE);
    if let Ok(m) = fs::metadata(&path) {
        if m.len() > 400_000 {
            let _ = fs::rename(&path, store.dir.join("journal.old.txt"));
        }
    }
    let clean: String = line.chars().filter(|c| !c.is_control() || *c == ' ').take(600).collect();
    let mut f = fs::OpenOptions::new().create(true).append(true).open(&path).map_err(|e| e.to_string())?;
    writeln!(f, "{} {}", now_stamp(), clean).map_err(|e| e.to_string())
}

#[tauri::command]
fn log_read(store: State<Store>) -> Result<String, String> {
    let old = fs::read_to_string(store.dir.join("journal.old.txt")).unwrap_or_default();
    let cur = fs::read_to_string(store.dir.join(LOG_FILE)).unwrap_or_default();
    Ok(old + &cur)
}

fn now_stamp() -> String {
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let (h, m, s) = ((secs / 3600) % 24, (secs / 60) % 60, secs % 60);
    format!("{} {:02}:{:02}:{:02} UTC", today(), h, m, s)
}

// ---------- обновления (только компьютер) ----------

#[cfg(desktop)]
#[tauri::command]
async fn update_check(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_updater::UpdaterExt;
    let up = app.updater().map_err(|e| e.to_string())?;
    match up.check().await {
        Ok(Some(u)) => Ok(Some(u.version.clone())),
        Ok(None) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(desktop)]
#[tauri::command]
async fn update_install(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    let up = app.updater().map_err(|e| e.to_string())?;
    let u = up.check().await.map_err(|e| e.to_string())?.ok_or("Обновлений нет")?;
    // ход скачивания показываем в программе: на медленном интернете это пара минут, без него кажется, что всё зависло
    let app2 = app.clone();
    let mut done: u64 = 0;
    let mut last: u64 = 0;
    let res = u.download_and_install(
        move |chunk, total| {
            use tauri::Emitter;
            done += chunk as u64;
            if done - last > 256 * 1024 || Some(done) == total {
                last = done;
                let _ = app2.emit_to("main", "update-progress", serde_json::json!({ "done": done, "total": total }));
            }
        },
        || {},
    ).await;
    if let Err(e) = res {
        // связь оборвалась посреди скачивания: пробуем ещё раз
        let u2 = up.check().await.map_err(|e| e.to_string())?.ok_or("Обновлений нет")?;
        u2.download_and_install(|_, _| {}, || {}).await.map_err(|e2| format!("{e}; повтор: {e2}"))?;
    }
    app.restart();
}

#[cfg(not(desktop))]
#[tauri::command]
async fn update_check() -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(not(desktop))]
#[tauri::command]
async fn update_install() -> Result<(), String> {
    Err("Обновление через магазин приложений".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }
    builder
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let dir = app.path().app_data_dir().expect("нет папки данных");
            fs::create_dir_all(&dir)?;
            let key = load_or_create_key(&dir);
            app.manage(Store { dir, key, lock: Mutex::new(()) });
            app.manage(AllowedHosts(Mutex::new(Default::default())));
            app.manage(model::ModelState::new());
            model::start_idle_watch(app.handle().clone());
            // Окно программы не уходит на чужие сайты: внешние ссылки открываются в браузере.
            let win = tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
                .title("Ответошная")
                .inner_size(1000.0, 860.0)
                .min_inner_size(380.0, 500.0)
                .on_navigation(|u: &url::Url| {
                    matches!(u.scheme(), "tauri" | "asset")
                        || matches!(u.host_str(), Some("tauri.localhost") | Some("localhost") | Some("asset.localhost"))
                })
                .build()?;
            let _ = win;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db_load,
            db_save,
            asset_put,
            asset_delete,
            save_download,
            app_info,
            update_check,
            update_install,
            source_open,
            source_collect,
            source_result,
            source_close,
            source_stop,
            source_allow,
            log_append,
            log_read,
            model::model_status,
            model::model_download,
            model::model_delete,
            model::model_generate,
            gs::gs_call
        ])
        .build(tauri::generate_context!())
        .expect("ошибка запуска «Ответошной»")
        .run(|app, ev| {
            // программа закрывается — сервер модели не оставляем работать
            if let tauri::RunEvent::Exit = ev {
                if let Some(st) = app.try_state::<model::ModelState>() {
                    st.stop();
                }
            }
        });
}
