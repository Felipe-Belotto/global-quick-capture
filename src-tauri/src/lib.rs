pub mod capture;
pub mod config;
pub mod obsidian;

use config::{load_config, save_config, AppConfig};
use obsidian::{list_vault_nodes, save_snippet, SaveSnippetPayload, VaultNode};
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, PhysicalPosition, PhysicalSize, Position,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

static LAST_CARD_POS: Mutex<Option<PhysicalPosition<i32>>> = Mutex::new(None);

#[derive(serde::Deserialize, serde::Serialize, Clone, Copy, Debug, PartialEq)]
pub struct SnipRegion {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

pub fn is_pos_within_monitor(
    pos: &PhysicalPosition<i32>,
    mon_x: i32,
    mon_y: i32,
    mon_w: u32,
    mon_h: u32,
) -> bool {
    pos.x >= mon_x
        && pos.x < mon_x + mon_w as i32
        && pos.y >= mon_y
        && pos.y < mon_y + mon_h as i32
}

/// Calcula a posição ideal para a janela do card de anotação respeitando DPI e os limites do monitor.
pub fn calculate_smart_position(
    mon_pos: PhysicalPosition<i32>,
    mon_size: PhysicalSize<u32>,
    scale_factor: f64,
    card_phys_size: Option<PhysicalSize<u32>>,
    crop: Option<SnipRegion>,
    last_pos: Option<PhysicalPosition<i32>>,
) -> PhysicalPosition<i32> {
    let scale = if scale_factor > 0.0 { scale_factor } else { 1.0 };
    let mon_x = mon_pos.x;
    let mon_y = mon_pos.y;
    let mon_w = mon_size.width;
    let mon_h = mon_size.height;

    // Dimensões do card de anotação em pixels físicos (padrão 720x480 lógico)
    let card_size = card_phys_size
        .filter(|s| s.width > 0 && s.height > 0)
        .unwrap_or_else(|| {
            PhysicalSize::new(
                (720.0 * scale).round() as u32,
                (480.0 * scale).round() as u32,
            )
        });

    let gap = (12.0 * scale).round() as i32;
    let margin_x = (16.0 * scale).round() as i32;
    let margin_top = (16.0 * scale).round() as i32;
    let margin_bottom = (48.0 * scale).round() as i32; // Margem para barra de tarefas do Windows

    let usable_left = mon_x + margin_x;
    let usable_top = mon_y + margin_top;
    let usable_right = (mon_x + mon_w as i32 - margin_x).max(usable_left);
    let usable_bottom = (mon_y + mon_h as i32 - margin_bottom).max(usable_top);

    let max_w = (usable_right - usable_left).max(100);
    let max_h = (usable_bottom - usable_top).max(100);
    let card_w = (card_size.width as i32).min(max_w);
    let card_h = (card_size.height as i32).min(max_h);

    let center_x = mon_x + (mon_w as i32 - card_w) / 2;
    let center_y = mon_y + (mon_h as i32 - card_h) / 2;

    // Se nenhum recorte foi fornecido ou área insignificante (< 10px), mantém última posição ou centro
    let crop = match crop {
        Some(c) if c.width >= 10.0 && c.height >= 10.0 => c,
        _ => {
            if let Some(last) = last_pos {
                if is_pos_within_monitor(&last, mon_x, mon_y, mon_w, mon_h) {
                    return last;
                }
            }
            return PhysicalPosition::new(center_x, center_y);
        }
    };

    // Coordenadas físicas do recorte no monitor
    let crop_x = mon_x + (crop.x * scale).round() as i32;
    let crop_y = mon_y + (crop.y * scale).round() as i32;
    let crop_w = (crop.width * scale).round() as i32;
    let crop_h = (crop.height * scale).round() as i32;

    // Se o recorte cobrir praticamente a tela inteira (>= 90% largura e altura), mantém centro ou última posição
    if crop_w >= (mon_w as f64 * 0.90) as i32 && crop_h >= (mon_h as f64 * 0.90) as i32 {
        if let Some(last) = last_pos {
            if is_pos_within_monitor(&last, mon_x, mon_y, mon_w, mon_h) {
                return last;
            }
        }
        return PhysicalPosition::new(center_x, center_y);
    }

    // 1. Preferência: Logo abaixo da área recortada
    if crop_y + crop_h + gap + card_h <= usable_bottom {
        let ideal_x = crop_x + (crop_w - card_w) / 2;
        let target_x = ideal_x.clamp(usable_left, usable_right - card_w);
        let target_y = crop_y + crop_h + gap;
        return PhysicalPosition::new(target_x, target_y);
    }

    // 2. Preferência: Logo acima da área recortada
    if crop_y - gap - card_h >= usable_top {
        let ideal_x = crop_x + (crop_w - card_w) / 2;
        let target_x = ideal_x.clamp(usable_left, usable_right - card_w);
        let target_y = crop_y - gap - card_h;
        return PhysicalPosition::new(target_x, target_y);
    }

    // 3. Preferência: Ao lado direito da área recortada
    if crop_x + crop_w + gap + card_w <= usable_right {
        let ideal_y = crop_y + (crop_h - card_h) / 2;
        let target_y = ideal_y.clamp(usable_top, usable_bottom - card_h);
        let target_x = crop_x + crop_w + gap;
        return PhysicalPosition::new(target_x, target_y);
    }

    // 4. Preferência: Ao lado esquerdo da área recortada
    if crop_x - gap - card_w >= usable_left {
        let ideal_y = crop_y + (crop_h - card_h) / 2;
        let target_y = ideal_y.clamp(usable_top, usable_bottom - card_h);
        let target_x = crop_x - gap - card_w;
        return PhysicalPosition::new(target_x, target_y);
    }

    // 5. Caso não caiba com margem completa em nenhum lado, escolhe o lado com maior espaço disponível
    let space_below = usable_bottom - (crop_y + crop_h + gap);
    let space_above = (crop_y - gap) - usable_top;
    let space_right = usable_right - (crop_x + crop_w + gap);
    let space_left = (crop_x - gap) - usable_left;

    let max_space = space_below.max(space_above).max(space_right).max(space_left);

    if max_space == space_below && space_below > 0 {
        let ideal_x = crop_x + (crop_w - card_w) / 2;
        let target_x = ideal_x.clamp(usable_left, usable_right - card_w);
        let target_y = (usable_bottom - card_h).max(usable_top);
        PhysicalPosition::new(target_x, target_y)
    } else if max_space == space_above && space_above > 0 {
        let ideal_x = crop_x + (crop_w - card_w) / 2;
        let target_x = ideal_x.clamp(usable_left, usable_right - card_w);
        let target_y = usable_top;
        PhysicalPosition::new(target_x, target_y)
    } else if max_space == space_right && space_right > 0 {
        let ideal_y = crop_y + (crop_h - card_h) / 2;
        let target_y = ideal_y.clamp(usable_top, usable_bottom - card_h);
        let target_x = (usable_right - card_w).max(usable_left);
        PhysicalPosition::new(target_x, target_y)
    } else if max_space == space_left && space_left > 0 {
        let ideal_y = crop_y + (crop_h - card_h) / 2;
        let target_y = ideal_y.clamp(usable_top, usable_bottom - card_h);
        let target_x = usable_left;
        PhysicalPosition::new(target_x, target_y)
    } else {
        PhysicalPosition::new(center_x, center_y)
    }
}

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
    // 1. Salva a última posição da janela antes de fechar e esconde imediatamente (zero latência percebida)
    if let Some(card_win) = app.get_webview_window("capture_card") {
        if let Ok(pos) = card_win.outer_position() {
            if let Ok(mut last) = LAST_CARD_POS.lock() {
                *last = Some(pos);
            }
        }
        let _ = card_win.hide();
    }

    // 2. Grava em background sem congelar o app
    let app_handle = app.clone();
    std::thread::spawn(move || {
        match save_snippet(payload) {
            Ok(()) => {
                let _ = app_handle.emit("snippet_save_success", ());
            }
            Err(e) => {
                eprintln!("Erro ao gravar no Obsidian: {}", e);
                let _ = app_handle.emit("snippet_save_error", e);
            }
        }
    });

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
    // 1. Tira o print da tela antes de abrir a janela para congelar o estado real
    let screen_b64 = capture::capture_primary_screen().unwrap_or_default();

    if let Some(overlay) = app.get_webview_window("snipping_overlay") {
        let _ = overlay.show();
        let _ = overlay.set_focus();
        let _ = overlay.emit("start_snip", screen_b64);
    }
    Ok(())
}

#[tauri::command]
fn finish_snip(
    app: tauri::AppHandle,
    cropped_base64: String,
    x: Option<f64>,
    y: Option<f64>,
    width: Option<f64>,
    height: Option<f64>,
    region: Option<SnipRegion>,
) -> Result<(), String> {
    let overlay = app.get_webview_window("snipping_overlay");
    let card_win = app.get_webview_window("capture_card");

    // Identifica o monitor da captura antes de esconder o overlay
    let monitor = overlay
        .as_ref()
        .and_then(|w| w.current_monitor().ok().flatten())
        .or_else(|| card_win.as_ref().and_then(|w| w.current_monitor().ok().flatten()))
        .or_else(|| app.primary_monitor().ok().flatten());

    if let Some(ref o) = overlay {
        let _ = o.hide();
    }

    if let Some(ref card) = card_win {
        let snip_coords = match region {
            Some(r) => Some(r),
            None => match (x, y, width, height) {
                (Some(x), Some(y), Some(w), Some(h)) => Some(SnipRegion {
                    x,
                    y,
                    width: w,
                    height: h,
                }),
                _ => None,
            },
        };

        let last_pos = LAST_CARD_POS.lock().ok().and_then(|guard| *guard);

        if let Some(ref mon) = monitor {
            let card_size = card.outer_size().ok();
            let smart_pos = calculate_smart_position(
                *mon.position(),
                *mon.size(),
                mon.scale_factor(),
                card_size,
                snip_coords,
                last_pos,
            );
            let _ = card.set_position(Position::Physical(smart_pos));
        } else {
            let _ = card.center();
        }

        let _ = card.show();
        let _ = card.set_focus();
        let _ = card.emit("load_snip_image", cropped_base64);
    }
    Ok(())
}

#[tauri::command]
fn cancel_snip(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("snipping_overlay") {
        let _ = overlay.hide();
    }
    if let Some(card_win) = app.get_webview_window("capture_card") {
        if let Ok(pos) = card_win.outer_position() {
            if let Ok(mut last) = LAST_CARD_POS.lock() {
                *last = Some(pos);
            }
        }
        let _ = card_win.hide();
    }
    Ok(())
}

#[tauri::command]
fn quick_save_and_copy_cmd(app: tauri::AppHandle, cropped_base64: String) -> Result<(), String> {
    // 1. Ocultar o overlay de recorte imediatamente (0ms de latência percebida)
    if let Some(overlay) = app.get_webview_window("snipping_overlay") {
        let _ = overlay.hide();
    }

    // 2. Executar cópia para clipboard e persistência no cofre em segundo plano
    std::thread::spawn(move || {
        // A. Copiar imagem para a Área de Transferência (Clipboard)
        let clean_base64 = if let Some(pos) = cropped_base64.find("base64,") {
            &cropped_base64[pos + 7..]
        } else {
            &cropped_base64
        };
        use base64::Engine;
        if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(clean_base64.trim()) {
            if let Err(e) = obsidian::copy_image_to_clipboard(&bytes) {
                eprintln!("Erro ao copiar imagem para clipboard: {}", e);
            }
        }

        // B. Salvar no Obsidian na rota primária configurada
        let cfg = config::load_config();
        let target_route_id = if !cfg.default_route_id.is_empty() {
            cfg.default_route_id
        } else if let Some(first_route) = cfg.project_routes.first() {
            first_route.id.clone()
        } else {
            "daily".to_string()
        };

        let payload = obsidian::SaveSnippetPayload {
            image_buffer_base64: cropped_base64,
            title: "Captura Rápida".to_string(),
            message: None,
            route_id: target_route_id,
            custom_target_file: None,
            tags: vec![],
        };

        match obsidian::save_snippet(payload) {
            Ok(()) => {
                let _ = app.emit("snippet_save_success", ());
            }
            Err(e) => {
                eprintln!("Erro no salvamento rápido do Obsidian: {}", e);
                let _ = app.emit("snippet_save_error", e);
            }
        }
    });

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

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct SystemAppInfo {
    pub version: String,
    pub name: String,
    pub tauri_version: String,
    pub os: String,
    pub arch: String,
    pub vault_path: String,
    pub global_shortcut: String,
    pub default_route_id: String,
    pub routes_count: usize,
}

#[tauri::command]
fn get_system_app_info(app: tauri::AppHandle) -> SystemAppInfo {
    let cfg = load_config();
    SystemAppInfo {
        version: app.package_info().version.to_string(),
        name: app.package_info().name.to_string(),
        tauri_version: tauri::VERSION.to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        vault_path: cfg.vault_path,
        global_shortcut: cfg.global_shortcut,
        default_route_id: cfg.default_route_id,
        routes_count: cfg.project_routes.len(),
    }
}

#[tauri::command]
fn show_about_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("about_window") {
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.center();
    }
    Ok(())
}

#[tauri::command]
fn hide_about_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("about_window") {
        let _ = win.hide();
    }
    Ok(())
}

#[tauri::command]
fn show_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(card_win) = app.get_webview_window("capture_card") {
        let _ = card_win.show();
        let _ = card_win.set_focus();
        let _ = card_win.emit("open_settings", ());
    }
    Ok(())
}

#[tauri::command]
fn start_dragging_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn download_and_install_update(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let temp_dir = std::env::temp_dir();
    let installer_path = temp_dir.join("Global-Quick-Capture-Update.exe");

    let app_handle = app.clone();
    std::thread::spawn(move || {
        let _ = app_handle.emit("update_progress", 20);

        // Download usando curl nativo do Windows com -L para seguir redirects de releases
        let status = std::process::Command::new("curl.exe")
            .args(["-L", "-s", "-o", installer_path.to_str().unwrap(), &url])
            .status();

        match status {
            Ok(s) if s.success() => {
                let _ = app_handle.emit("update_progress", 100);
                let _ = app_handle.emit("update_ready_to_install", ());

                std::thread::sleep(std::time::Duration::from_millis(600));

                #[cfg(target_os = "windows")]
                {
                    use std::os::windows::process::CommandExt;
                    const DETACHED_PROCESS: u32 = 0x00000008;
                    let _ = std::process::Command::new(&installer_path)
                        .creation_flags(DETACHED_PROCESS)
                        .spawn();
                }
                #[cfg(not(target_os = "windows"))]
                {
                    let _ = std::process::Command::new(&installer_path).spawn();
                }

                // Encerra a instância antiga para permitir que o instalador substitua os arquivos
                app_handle.exit(0);
            }
            Ok(s) => {
                let _ = app_handle.emit("update_error", format!("curl retornou erro: {}", s));
            }
            Err(e) => {
                let _ = app_handle.emit("update_error", format!("Falha ao baixar instalador: {}", e));
            }
        }
    });

    Ok(())
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
            cancel_snip,
            quick_save_and_copy_cmd,
            get_system_app_info,
            show_about_window,
            hide_about_window,
            show_settings_window,
            start_dragging_window,
            download_and_install_update
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

            // 2. Configurar Menu da Bandeja (Tray) com suporte a clique e menu
            let quit_i = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
            let capture_i = MenuItem::with_id(app, "capture", "Nova Captura (Win+Alt+S)", true, None::<&str>)?;
            let about_i = MenuItem::with_id(app, "about", "ℹ️ Sobre & Atualizações...", true, None::<&str>)?;
            let settings_i = MenuItem::with_id(app, "settings", "⚙️ Configurações...", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&capture_i, &about_i, &settings_i, &quit_i])?;

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
                    "about" => {
                        let _ = show_about_window(app.clone());
                    }
                    "settings" => {
                        let _ = show_settings_window(app.clone());
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        let _ = show_about_window(app.clone());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_smart_positioning_below() {
        let mon_pos = PhysicalPosition::new(0, 0);
        let mon_size = PhysicalSize::new(1920, 1080);
        let scale = 1.0;
        let card_size = Some(PhysicalSize::new(720, 480));

        // Snip na parte superior da tela (x=100, y=100, w=300, h=200)
        let crop = Some(SnipRegion {
            x: 100.0,
            y: 100.0,
            width: 300.0,
            height: 200.0,
        });

        let pos = calculate_smart_position(mon_pos, mon_size, scale, card_size, crop, None);
        // O card deve ficar abaixo do crop (y = 100 + 200 + 12 = 312)
        assert_eq!(pos.y, 312);
        // E alinhado com o crop respeitando margem mínima (16)
        assert!(pos.x >= 16);
    }

    #[test]
    fn test_smart_positioning_above() {
        let mon_pos = PhysicalPosition::new(0, 0);
        let mon_size = PhysicalSize::new(1920, 1080);
        let scale = 1.0;
        let card_size = Some(PhysicalSize::new(720, 480));

        // Snip na parte inferior da tela (x=500, y=700, w=400, h=250)
        let crop = Some(SnipRegion {
            x: 500.0,
            y: 700.0,
            width: 400.0,
            height: 250.0,
        });

        let pos = calculate_smart_position(mon_pos, mon_size, scale, card_size, crop, None);
        // Deve ficar acima do crop (y = 700 - 12 - 480 = 208)
        assert_eq!(pos.y, 208);
        assert!(pos.x >= 16 && pos.x <= 1920 - 16 - 720);
    }

    #[test]
    fn test_smart_positioning_right() {
        let mon_pos = PhysicalPosition::new(0, 0);
        let mon_size = PhysicalSize::new(1920, 1080);
        let scale = 1.0;
        let card_size = Some(PhysicalSize::new(720, 480));

        // Snip alto e estreito no lado esquerdo (x=50, y=50, w=200, h=900)
        let crop = Some(SnipRegion {
            x: 50.0,
            y: 50.0,
            width: 200.0,
            height: 900.0,
        });

        let pos = calculate_smart_position(mon_pos, mon_size, scale, card_size, crop, None);
        // Deve ficar à direita do crop (x = 50 + 200 + 12 = 262)
        assert_eq!(pos.x, 262);
        assert!(pos.y >= 16);
    }

    #[test]
    fn test_smart_positioning_left() {
        let mon_pos = PhysicalPosition::new(0, 0);
        let mon_size = PhysicalSize::new(1920, 1080);
        let scale = 1.0;
        let card_size = Some(PhysicalSize::new(720, 480));

        // Snip alto e estreito no lado direito (x=1600, y=50, w=250, h=900)
        let crop = Some(SnipRegion {
            x: 1600.0,
            y: 50.0,
            width: 250.0,
            height: 900.0,
        });

        let pos = calculate_smart_position(mon_pos, mon_size, scale, card_size, crop, None);
        // Deve ficar à esquerda do crop (x = 1600 - 12 - 720 = 868)
        assert_eq!(pos.x, 868);
        assert!(pos.y >= 16);
    }

    #[test]
    fn test_smart_positioning_fullscreen_centers() {
        let mon_pos = PhysicalPosition::new(0, 0);
        let mon_size = PhysicalSize::new(1920, 1080);
        let scale = 1.0;
        let card_size = Some(PhysicalSize::new(720, 480));

        // Snip cobrindo tela inteira
        let crop = Some(SnipRegion {
            x: 0.0,
            y: 0.0,
            width: 1920.0,
            height: 1080.0,
        });

        let pos = calculate_smart_position(mon_pos, mon_size, scale, card_size, crop, None);
        // Centro: x = (1920 - 720) / 2 = 600, y = (1080 - 480) / 2 = 300
        assert_eq!(pos.x, 600);
        assert_eq!(pos.y, 300);
    }

    #[test]
    fn test_smart_positioning_fullscreen_with_last_user_pos() {
        let mon_pos = PhysicalPosition::new(0, 0);
        let mon_size = PhysicalSize::new(1920, 1080);
        let scale = 1.0;
        let card_size = Some(PhysicalSize::new(720, 480));
        let last_pos = Some(PhysicalPosition::new(450, 250));

        let crop = Some(SnipRegion {
            x: 0.0,
            y: 0.0,
            width: 1920.0,
            height: 1080.0,
        });

        let pos = calculate_smart_position(mon_pos, mon_size, scale, card_size, crop, last_pos);
        assert_eq!(pos.x, 450);
        assert_eq!(pos.y, 250);
    }

    #[test]
    fn test_dpi_scaling_respects_scaling_factor() {
        let mon_pos = PhysicalPosition::new(0, 0);
        let mon_size = PhysicalSize::new(1920, 1080);
        let scale = 1.5; // 150% DPI
        let card_size = Some(PhysicalSize::new(1080, 720)); // 720x480 * 1.5

        let crop = Some(SnipRegion {
            x: 50.0,
            y: 50.0,
            width: 150.0,
            height: 100.0,
        });

        let pos = calculate_smart_position(mon_pos, mon_size, scale, card_size, crop, None);
        // crop_y = 50 * 1.5 = 75, crop_h = 100 * 1.5 = 150. gap = 12 * 1.5 = 18.
        // target_y = 75 + 150 + 18 = 243
        assert_eq!(pos.y, 243);
    }

    #[test]
    fn test_edge_clamping_never_overflows_monitor() {
        let mon_pos = PhysicalPosition::new(0, 0);
        let mon_size = PhysicalSize::new(1920, 1080);
        let scale = 1.0;
        let card_size = Some(PhysicalSize::new(720, 480));

        // Snip encostado no canto superior direito
        let crop = Some(SnipRegion {
            x: 1800.0,
            y: 10.0,
            width: 100.0,
            height: 100.0,
        });

        let pos = calculate_smart_position(mon_pos, mon_size, scale, card_size, crop, None);
        // target_x + 720 não pode passar de 1920 - 16 = 1904
        assert!(pos.x + 720 <= 1904);
        assert!(pos.x >= 16);
        assert!(pos.y >= 16);
        assert!(pos.y + 480 <= 1080 - 48);
    }
}

