pub mod config;
pub mod obsidian;

use config::{load_config, save_config, AppConfig};
use obsidian::{list_vault_nodes, save_snippet, SaveSnippetPayload, VaultNode};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[tauri::command]
fn get_vault_config() -> AppConfig {
    load_config()
}

#[tauri::command]
fn update_vault_config(config: AppConfig) -> Result<(), String> {
    save_config(&config)
}

#[tauri::command]
fn save_snippet_cmd(app: tauri::AppHandle, payload: SaveSnippetPayload) -> Result<(), String> {
    save_snippet(payload)?;
    if let Some(card_win) = app.get_webview_window("capture_card") {
        let _ = card_win.hide();
    }
    Ok(())
}

#[tauri::command]
fn list_vault_nodes_cmd(vault_path: Option<String>) -> Vec<VaultNode> {
    let path = match vault_path {
        Some(p) => p,
        None => load_config().vault_path,
    };
    list_vault_nodes(&path)
}

#[tauri::command]
fn trigger_capture(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("snipping_overlay") {
        let _ = overlay.show();
        let _ = overlay.set_focus();
        let _ = overlay.emit("start_snip", ());
    }
    Ok(())
}

#[tauri::command]
fn finish_snip(app: tauri::AppHandle, cropped_base64: String) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("snipping_overlay") {
        let _ = overlay.hide();
    }
    if let Some(card_win) = app.get_webview_window("capture_card") {
        let _ = card_win.show();
        let _ = card_win.set_focus();
        let _ = card_win.emit("load_snip_image", cropped_base64);
    }
    Ok(())
}

#[tauri::command]
fn cancel_snip(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("snipping_overlay") {
        let _ = overlay.hide();
    }
    if let Some(card_win) = app.get_webview_window("capture_card") {
        let _ = card_win.hide();
    }
    Ok(())
}

#[tauri::command]
fn select_vault_folder() -> Option<String> {
    let folder = rfd::FileDialog::new()
        .set_title("Selecione a pasta raiz do seu Cofre do Obsidian")
        .pick_folder();
    folder.map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
fn scan_vault_folders_cmd(vault_path: Option<String>) -> Vec<String> {
    let path = match vault_path {
        Some(p) => p,
        None => load_config().vault_path,
    };
    obsidian::scan_vault_subfolders(&path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_vault_config,
            update_vault_config,
            save_snippet_cmd,
            list_vault_nodes_cmd,
            select_vault_folder,
            scan_vault_folders_cmd,
            trigger_capture,
            finish_snip,
            cancel_snip
        ])
        .setup(|app| {
            // 1. Registrar Atalho Global dinâmico do config (padrão Win + Alt + S)
            use std::str::FromStr;
            let config = load_config();
            let shortcut = Shortcut::from_str(&config.global_shortcut)
                .unwrap_or_else(|_| Shortcut::new(Some(Modifiers::SUPER | Modifiers::ALT), Code::KeyS));

            let app_handle = app.handle().clone();

            let _ = app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    let _ = trigger_capture(app_handle.clone());
                }
            });

            // 2. Configurar Menu da Bandeja (Tray)
            let quit_i = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
            let capture_i = MenuItem::with_id(app, "capture", "Nova Captura (Win+Alt+S)", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&capture_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Global Quick Capture (Win+Alt+S)")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "capture" => {
                        let _ = trigger_capture(app.clone());
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
