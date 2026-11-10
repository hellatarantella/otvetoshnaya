//! Уведомления о негативных отзывах в мессенджер MAX (бот сотрудницы).
//! Ходим только на platform-api.max.ru: отправка сообщения и чтение входящих (чтобы узнать, кому писать).
//! Токен бота хранится в зашифрованных данных программы и передаётся сюда на каждый запрос.

use std::time::Duration;

const BASE: &str = "https://platform-api.max.ru";

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(40))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())
}

fn token_ok(t: &str) -> Result<String, String> {
    let t = t.trim();
    if t.is_empty() || t.len() > 400 || !t.chars().all(|c| c.is_ascii_graphic()) {
        return Err("токен бота MAX пустой или с лишними символами".into());
    }
    Ok(t.to_string())
}

fn reason(code: u16, body: &str) -> String {
    match code {
        401 | 403 => "MAX не принял токен бота: скопируйте его заново в настройках сообщества → «Для разработчиков»".into(),
        404 => "MAX не нашёл получателя: напишите боту любое сообщение и нажмите «Привязать» ещё раз".into(),
        429 => "MAX просит подождать: слишком много сообщений подряд".into(),
        _ => format!("MAX ответил ошибкой {code}: {}", body.chars().take(200).collect::<String>()),
    }
}

/// Отправить текст пользователю (user_id) или в чат (chat_id).
#[tauri::command]
pub async fn max_send(token: String, user_id: Option<i64>, chat_id: Option<i64>, text: String) -> Result<String, String> {
    let tok = token_ok(&token)?;
    if text.trim().is_empty() || text.chars().count() > 4000 {
        return Err("текст уведомления пустой или длиннее 4000 знаков".into());
    }
    let q = match (user_id, chat_id) {
        (Some(u), _) => format!("user_id={u}"),
        (None, Some(c)) => format!("chat_id={c}"),
        _ => return Err("бот ещё не знает, кому писать: напишите ему и нажмите «Привязать»".into()),
    };
    let body = serde_json::json!({ "text": text, "notify": true });
    let mut last = String::new();
    for attempt in 0..3u64 {
        let r = client()?
            .post(format!("{BASE}/messages?{q}"))
            .header("Authorization", tok.as_str())
            .json(&body)
            .send()
            .await;
        match r {
            Ok(resp) => {
                let code = resp.status().as_u16();
                let t = resp.text().await.unwrap_or_default();
                if (200..300).contains(&code) { return Ok(t); }
                last = reason(code, &t);
                if !(code == 429 || code >= 500) { break; }
            }
            Err(e) => last = format!("нет связи с MAX: {e}"),
        }
        tokio::time::sleep(Duration::from_secs(3 + attempt * 5)).await;
    }
    Err(last)
}

/// Последние входящие боту (короткий опрос, без ожидания): по ним узнаём user_id сотрудницы.
#[tauri::command]
pub async fn max_updates(token: String) -> Result<String, String> {
    let tok = token_ok(&token)?;
    let resp = client()?
        .get(format!("{BASE}/updates?limit=50&timeout=0"))
        .header("Authorization", tok.as_str())
        .send()
        .await
        .map_err(|e| format!("нет связи с MAX: {e}"))?;
    let code = resp.status().as_u16();
    let t = resp.text().await.unwrap_or_default();
    if (200..300).contains(&code) { Ok(t) } else { Err(reason(code, &t)) }
}

/// Проверка токена: имя бота.
#[tauri::command]
pub async fn max_me(token: String) -> Result<String, String> {
    let tok = token_ok(&token)?;
    let resp = client()?
        .get(format!("{BASE}/me"))
        .header("Authorization", tok.as_str())
        .send()
        .await
        .map_err(|e| format!("нет связи с MAX: {e}"))?;
    let code = resp.status().as_u16();
    let t = resp.text().await.unwrap_or_default();
    if (200..300).contains(&code) { Ok(t) } else { Err(reason(code, &t)) }
}

/// Последние сообщения чата (в том числе отправленные самим ботом) — чтобы два компьютера
/// с одним ботом не прислали одно и то же: перед отправкой каждый смотрит, нет ли уже такого сообщения.
#[tauri::command]
pub async fn max_messages(token: String, chat_id: i64) -> Result<String, String> {
    let tok = token_ok(&token)?;
    let resp = client()?
        .get(format!("{BASE}/messages?chat_id={chat_id}&count=100"))
        .header("Authorization", tok.as_str())
        .send()
        .await
        .map_err(|e| format!("нет связи с MAX: {e}"))?;
    let code = resp.status().as_u16();
    let t = resp.text().await.unwrap_or_default();
    if (200..300).contains(&code) { Ok(t) } else { Err(reason(code, &t)) }
}
