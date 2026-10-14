use base64::Engine;
use image::ImageFormat;
use std::io::Cursor;
use xcap::Monitor;

pub fn capture_primary_screen() -> Result<String, String> {
    let monitors = Monitor::all().map_err(|e| format!("Falha ao listar monitores: {}", e))?;
    if monitors.is_empty() {
        return Err("Nenhum monitor encontrado".to_string());
    }

    // Pega o monitor principal ou o primeiro disponível
    let primary_monitor = monitors
        .into_iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .ok_or_else(|| "Nenhum monitor primário encontrado".to_string())?;

    let img = primary_monitor
        .capture_image()
        .map_err(|e| format!("Falha ao capturar tela: {}", e))?;

    let mut buffer = Vec::new();
    let mut cursor = Cursor::new(&mut buffer);

    img.write_to(&mut cursor, ImageFormat::Png)
        .map_err(|e| format!("Falha ao codificar PNG: {}", e))?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&buffer);
    Ok(format!("data:image/png;base64,{}", b64))
}
