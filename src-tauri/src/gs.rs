//! Связь с Google-скриптом отчётов (Apps Script, веб-приложение в аккаунте сотрудницы).
//! Ходим только на script.google.com/macros/s/…; ответ Google отдаёт через переадресацию
//! на script.googleusercontent.com — её reqwest проходит сам.
//! Если вместо ответа пришла страница (вход, ошибка Google), разбираем, что именно случилось:
//! от этого зависит, что делать сотруднице.

use std::time::Duration;

/// Что за страницу прислал Google вместо ответа скрипта.
fn html_reason(text: &str, final_host: &str) -> (bool, String) {
    let low = text.to_lowercase();
    let login = final_host == "accounts.google.com"
        || low.contains("accounts.google.com/v3/signin")
        || low.contains("servicelogin")
        || (low.contains("accounts.google.com") && low.contains("type=\"password\""));
    if login {
        return (false, "Google просит войти, вместо того чтобы выполнить скрипт. В script.google.com → «Развернуть» → «Управление развертываниями» → карандаш: «Запуск от имени: Я», «У кого есть доступ: Все» → «Развернуть»".into());
    }
    if low.contains("authorization is required") || low.contains("требуется авторизация") || low.contains("requires authorization")
        || low.contains("необходима авторизация") || low.contains("authorisation is required") {
        return (false, "Google просит заново разрешить скрипту доступ к отчётам. Откройте проект «Ответошная» на script.google.com, выберите вверху функцию testState, нажмите «Выполнить» и разрешите доступ".into());
    }
    if low.contains("script function not found") || low.contains("не удалось найти функцию") || low.contains("функция скрипта не найдена") {
        return (false, "в проекте скрипта нет кода программы. Вставьте скрипт заново: «Отчёты» → «Скопировать скрипт»".into());
    }
    if low.contains("exceeded maximum execution time") || low.contains("превышено максимальное время") {
        return (true, "Google не успел выполнить скрипт".into());
    }
    if low.contains("lock timeout") || low.contains("too many lock") || low.contains("тайм-аут блокировки") {
        return (true, "скрипт был занят предыдущим запросом".into());
    }
    if low.contains("unable to open the file") || low.contains("не удалось открыть файл") || low.contains("page not found") || low.contains("страница не найдена") {
        return (false, "Google не нашёл скрипт по этой ссылке: развертывание удалено или ссылка другая. Подключите Google заново со ссылкой из «Управление развертываниями»".into());
    }
    (true, format!("Google ответил ошибкой: {}", plain(text)))
}

/// Убирает блоки <script>…</script> и <style>…</style> (поиск без учёта регистра, длина в байтах не меняется).
fn strip_block(s: &str, tag: &str) -> String {
    let (open, close) = (format!("<{tag}"), format!("</{tag}>"));
    let mut res = String::new();
    let mut rest = s;
    loop {
        let lo = rest.to_ascii_lowercase();
        match lo.find(&open) {
            Some(a) => {
                res.push_str(&rest[..a]);
                match lo[a..].find(&close) {
                    Some(b) => rest = &rest[a + b + close.len()..],
                    None => break,
                }
            }
            None => { res.push_str(rest); break; }
        }
    }
    res
}

/// Текст страницы без разметки, коротко.
fn plain(html: &str) -> String {
    let s = strip_block(&strip_block(html, "script"), "style");
    let mut txt = String::new();
    let mut in_tag = false;
    for ch in s.chars() {
        match ch {
            '<' => { in_tag = true; txt.push(' '); }
            '>' => in_tag = false,
            _ if !in_tag => txt.push(ch),
            _ => {}
        }
    }
    let txt = txt.replace("&quot;", "\"").replace("&#39;", "'").replace("&amp;", "&").replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">");
    txt.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(200).collect()
}

/// Повторять можно только запросы, которые ничего не дописывают дважды.
fn repeatable(body: &str) -> bool {
    let a = serde_json::from_str::<serde_json::Value>(body).ok()
        .and_then(|v| v.get("action").and_then(|x| x.as_str()).map(|x| x.to_string()))
        .unwrap_or_default();
    matches!(a.as_str(), "state" | "refs" | "numbers" | "pair" | "answers")
}

async fn once(client: &reqwest::Client, u: &url::Url, body: &str) -> Result<String, (bool, String)> {
    let r = client.post(u.clone()).header("Content-Type", "text/plain;charset=utf-8").body(body.to_string()).send().await
        .map_err(|e| (true, format!("нет связи с Google: {e}")))?;
    let status = r.status();
    let final_host = r.url().host_str().unwrap_or("").to_string();
    let text = r.text().await.map_err(|e| (true, format!("ответ Google оборвался: {e}")))?;
    if final_host == "accounts.google.com" || text.trim_start().starts_with('<') {
        return Err(html_reason(&text, &final_host));
    }
    if !status.is_success() {
        return Err((status.as_u16() >= 500, format!("Google ответил {}", status.as_u16())));
    }
    Ok(text)
}

#[tauri::command]
pub async fn gs_call(url: String, body: String) -> Result<String, String> {
    let u = url::Url::parse(url.trim()).map_err(|_| "неверная ссылка на скрипт".to_string())?;
    if u.scheme() != "https" || u.host_str() != Some("script.google.com") || !u.path().starts_with("/macros/s/") || !u.path().ends_with("/exec") {
        return Err("нужна ссылка вида https://script.google.com/macros/s/…/exec".into());
    }
    if body.len() > 8 * 1024 * 1024 {
        return Err("слишком большой запрос".into());
    }
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(330))
        .redirect(reqwest::redirect::Policy::custom(|a| {
            let ok = a.url().host_str().map(|h| h == "script.google.com" || h.ends_with(".googleusercontent.com") || h == "accounts.google.com").unwrap_or(false);
            if ok && a.previous().len() < 6 { a.follow() } else { a.stop() }
        }))
        .build()
        .map_err(|e| e.to_string())?;
    let rep = repeatable(&body);
    let mut last = String::new();
    for attempt in 0..3 {
        match once(&client, &u, &body).await {
            Ok(t) => return Ok(t),
            Err((transient, msg)) => {
                last = msg;
                // временный сбой Google: ждём и пробуем ещё раз (только для запросов без записи)
                if !(transient && rep) || attempt == 2 { break; }
                tokio::time::sleep(Duration::from_secs(4 + attempt * 6)).await;
            }
        }
    }
    Err(last)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reasons() {
        assert!(html_reason("<html><form action=\"https://accounts.google.com/v3/signin/identifier\">", "script.google.com").1.contains("войти"));
        assert!(html_reason("<html><title>Ошибка</title><div>Authorization is required to perform that action.</div>", "script.googleusercontent.com").1.contains("разрешить"));
        let (t, m) = html_reason("<html><head><style>a{}</style><script>x()</script></head><body><div>TypeError: Cannot read properties of null (line 12, file &quot;Код&quot;)</div></body></html>", "script.googleusercontent.com");
        assert!(t && m.contains("TypeError: Cannot read properties of null (line 12, file \"Код\")"), "{m}");
        assert!(repeatable("{\"action\":\"state\",\"token\":\"x\"}"));
        assert!(!repeatable("{\"action\":\"add\"}"));
    }
}
