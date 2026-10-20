fn main() {
    // Команды программы перечислены явно: так каждому окну можно выдать только нужные права
    // (окнам кабинетов — одну команду source_result).
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
        "db_load",
        "db_save",
        "asset_put",
        "asset_delete",
        "save_download",
        "app_info",
        "update_check",
        "update_install",
        "source_open",
        "source_collect",
        "source_result",
        "source_close",
        "source_allow",
        "source_stop",
        "model_status",
        "model_download",
        "model_delete",
        "model_generate",
        "gs_call",
        "log_append",
        "log_read",
    ])))
    .expect("ошибка сборки");
}
