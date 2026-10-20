//! Встроенная модель для текстов ответов (Qwen3 4B, llama.cpp).
//! Работает целиком на компьютере: модель скачивается один раз в папку программы,
//! сервер llama.cpp поднимается по первому запросу только на 127.0.0.1 и
//! выключается сам после 10 минут без работы, чтобы не держать память.

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{Emitter, Manager, State};

pub const MODEL_FILE: &str = "qwen3-4b-instruct-2507-q4_k_m.gguf";
const MODEL_URLS: [&str; 4] = [
    "https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf",
    "https://huggingface.co/bartowski/Qwen_Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen_Qwen3-4B-Instruct-2507-Q4_K_M.gguf",
    "https://hf-mirror.com/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf",
    "https://hf-mirror.com/bartowski/Qwen_Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen_Qwen3-4B-Instruct-2507-Q4_K_M.gguf",
];
const IDLE: Duration = Duration::from_secs(600);

#[derive(Clone, Serialize, Default)]
pub struct Dl {
    active: bool,
    done: u64,
    total: u64,
    error: String,
}

pub struct ModelState {
    server: Mutex<Option<(Child, u16)>>,
    last_use: Mutex<Instant>,
    dl: Mutex<Dl>,
}

impl ModelState {
    pub fn new() -> Self {
        ModelState { server: Mutex::new(None), last_use: Mutex::new(Instant::now()), dl: Mutex::new(Dl::default()) }
    }
    pub fn stop(&self) {
        if let Ok(mut g) = self.server.lock() {
            if let Some((mut c, _)) = g.take() {
                let _ = c.kill();
                let _ = c.wait();
            }
        }
    }
}

fn model_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?.join("models");
    fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d)
}

fn server_bin() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let name = if cfg!(windows) { "llama-server.exe" } else { "llama-server" };
    let p = dir.join(name);
    if p.exists() { Some(p) } else { None }
}

#[derive(Serialize)]
pub struct Status {
    installed: bool,
    bytes: u64,
    server: bool,
    running: bool,
    download: Dl,
}

#[tauri::command]
pub fn model_status(app: tauri::AppHandle, st: State<ModelState>) -> Result<Status, String> {
    let f = model_dir(&app)?.join(MODEL_FILE);
    let bytes = fs::metadata(&f).map(|m| m.len()).unwrap_or(0);
    let running = st.server.lock().map(|g| g.is_some()).unwrap_or(false);
    let download = st.dl.lock().map(|d| d.clone()).unwrap_or_default();
    Ok(Status { installed: bytes > 0, bytes, server: server_bin().is_some(), running, download })
}

#[tauri::command]
pub fn model_delete(app: tauri::AppHandle, st: State<ModelState>) -> Result<(), String> {
    st.stop();
    let d = model_dir(&app)?;
    let _ = fs::remove_file(d.join(MODEL_FILE));
    let _ = fs::remove_file(d.join(format!("{MODEL_FILE}.part")));
    Ok(())
}

/// Скачивание с докачкой: файл .part, по 8 МБ событие «model-progress».
#[tauri::command]
pub async fn model_download(app: tauri::AppHandle, st: State<'_, ModelState>) -> Result<(), String> {
    {
        let mut d = st.dl.lock().map_err(|_| "занято")?;
        if d.active {
            return Ok(());
        }
        *d = Dl { active: true, ..Default::default() };
    }
    let app2 = app.clone();
    tauri::async_runtime::spawn(async move {
        let res = download_all(&app2).await;
        let st = app2.state::<ModelState>();
        if let Ok(mut d) = st.dl.lock() {
            d.active = false;
            d.error = res.err().unwrap_or_default();
        }
        let _ = app2.emit_to("main", "model-progress", serde_json::json!({ "finished": true }));
    });
    Ok(())
}

async fn download_all(app: &tauri::AppHandle) -> Result<(), String> {
    let mut last = String::new();
    for url in MODEL_URLS {
        match download_one(app, url).await {
            Ok(()) => return Ok(()),
            Err(e) => last = e,
        }
    }
    Err(last)
}

async fn download_one(app: &tauri::AppHandle, url: &str) -> Result<(), String> {
    use futures_util::StreamExt;
    let dir = model_dir(app)?;
    let part = dir.join(format!("{MODEL_FILE}.part"));
    let have = fs::metadata(&part).map(|m| m.len()).unwrap_or(0);
    let client = reqwest::Client::builder().connect_timeout(Duration::from_secs(20)).build().map_err(|e| e.to_string())?;
    let mut req = client.get(url);
    if have > 0 {
        req = req.header("Range", format!("bytes={have}-"));
    }
    let resp = req.send().await.map_err(|e| format!("нет связи с {}: {e}", host(url)))?;
    let status = resp.status();
    if !(status.is_success()) {
        return Err(format!("{} ответил {}", host(url), status.as_u16()));
    }
    let resumed = status.as_u16() == 206;
    let start = if resumed { have } else { 0 };
    let total = start + resp.content_length().unwrap_or(0);
    let mut file = fs::OpenOptions::new().create(true).write(true).append(resumed).truncate(!resumed).open(&part).map_err(|e| e.to_string())?;
    let st = app.state::<ModelState>();
    let mut done = start;
    let mut next_emit = done + 8 * 1024 * 1024;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("связь прервалась: {e}"))?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        done += chunk.len() as u64;
        if done >= next_emit {
            next_emit = done + 8 * 1024 * 1024;
            if let Ok(mut d) = st.dl.lock() {
                d.done = done;
                d.total = total;
            }
            let _ = app.emit_to("main", "model-progress", serde_json::json!({ "done": done, "total": total }));
        }
    }
    file.flush().map_err(|e| e.to_string())?;
    drop(file);
    if total > 0 && done < total {
        return Err("файл скачался не полностью. Нажмите ещё раз, докачается".into());
    }
    // проверка: настоящий файл модели начинается с «GGUF»
    let mut magic = [0u8; 4];
    fs::File::open(&part).and_then(|mut f| f.read_exact(&mut magic)).map_err(|e| e.to_string())?;
    if &magic != b"GGUF" {
        let _ = fs::remove_file(&part);
        return Err("скачался не файл модели".into());
    }
    fs::rename(&part, dir.join(MODEL_FILE)).map_err(|e| e.to_string())?;
    Ok(())
}

fn host(url: &str) -> String {
    url::Url::parse(url).ok().and_then(|u| u.host_str().map(|h| h.to_string())).unwrap_or_default()
}

fn free_port() -> Result<u16, String> {
    let l = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    Ok(l.local_addr().map_err(|e| e.to_string())?.port())
}

/// Поднимает сервер модели, если он ещё не работает, и ждёт готовности.
async fn ensure_server(app: &tauri::AppHandle) -> Result<u16, String> {
    let st = app.state::<ModelState>();
    {
        let mut g = st.server.lock().map_err(|_| "занято")?;
        if let Some((c, port)) = g.as_mut() {
            if c.try_wait().map(|x| x.is_none()).unwrap_or(false) {
                return Ok(*port);
            }
            *g = None;
        }
        let model = model_dir(app)?.join(MODEL_FILE);
        if !model.exists() {
            return Err("модель не скачана".into());
        }
        let bin = server_bin().ok_or("в этой сборке нет сервера модели")?;
        let port = free_port()?;
        let threads = std::thread::available_parallelism().map(|n| n.get().saturating_sub(2).max(2)).unwrap_or(4);
        let mut cmd = Command::new(bin);
        cmd.arg("-m").arg(&model)
            .args(["--host", "127.0.0.1", "--port", &port.to_string(), "-c", "4096", "-np", "1", "-t", &threads.to_string(), "-ngl", "99"])
            .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000);
        }
        let child = cmd.spawn().map_err(|e| format!("сервер модели не запустился: {e}"))?;
        *g = Some((child, port));
    }
    let port = st.server.lock().map_err(|_| "занято")?.as_ref().map(|x| x.1).unwrap_or(0);
    let client = reqwest::Client::new();
    for _ in 0..240 {
        if let Ok(r) = client.get(format!("http://127.0.0.1:{port}/health")).send().await {
            if r.status().is_success() {
                return Ok(port);
            }
        }
        {
            let mut g = st.server.lock().map_err(|_| "занято")?;
            if let Some((c, _)) = g.as_mut() {
                if c.try_wait().map(|x| x.is_some()).unwrap_or(true) {
                    *g = None;
                    return Err("сервер модели закрылся при запуске. Возможно, не хватает памяти".into());
                }
            }
        }
        tokio_sleep(500).await;
    }
    Err("модель долго загружается. Попробуйте ещё раз".into())
}

async fn tokio_sleep(ms: u64) {
    tokio::time::sleep(Duration::from_millis(ms)).await;
}

#[derive(Deserialize, Serialize, Clone)]
pub struct Msg {
    role: String,
    content: String,
}

#[tauri::command]
pub async fn model_generate(app: tauri::AppHandle, messages: Vec<Msg>, max_tokens: Option<u32>, temperature: Option<f32>) -> Result<String, String> {
    if messages.is_empty() || messages.len() > 40 {
        return Err("неверный запрос".into());
    }
    let port = ensure_server(&app).await?;
    if let Ok(mut t) = app.state::<ModelState>().last_use.lock() {
        *t = Instant::now();
    }
    let body = serde_json::json!({
        "messages": messages,
        "max_tokens": max_tokens.unwrap_or(400).min(1200),
        "temperature": temperature.unwrap_or(0.8).clamp(0.0, 1.5),
        "top_p": 0.8,
        "top_k": 20,
        "min_p": 0.0,
        "repeat_penalty": 1.05,
        "stream": false
    });
    let client = reqwest::Client::builder().timeout(Duration::from_secs(180)).build().map_err(|e| e.to_string())?;
    let r = client.post(format!("http://127.0.0.1:{port}/v1/chat/completions")).json(&body).send().await.map_err(|e| e.to_string())?;
    if !r.status().is_success() {
        return Err(format!("модель ответила {}", r.status().as_u16()));
    }
    let v: serde_json::Value = r.json().await.map_err(|e| e.to_string())?;
    if let Ok(mut t) = app.state::<ModelState>().last_use.lock() {
        *t = Instant::now();
    }
    Ok(v["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string())
}

/// Раз в минуту: сервер без работы дольше 10 минут выключаем.
pub fn start_idle_watch(app: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(60));
        let st = app.state::<ModelState>();
        let idle = st.last_use.lock().map(|t| t.elapsed() > IDLE).unwrap_or(false);
        let running = st.server.lock().map(|g| g.is_some()).unwrap_or(false);
        if idle && running {
            st.stop();
        }
    });
}
