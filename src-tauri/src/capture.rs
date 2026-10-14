use base64::Engine;
use image::codecs::png::{CompressionType, FilterType, PngEncoder};
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

    let encoder = PngEncoder::new_with_quality(&mut cursor, CompressionType::Fast, FilterType::NoFilter);
    img.write_with_encoder(encoder)
        .map_err(|e| format!("Falha ao codificar PNG rápido: {}", e))?;

    let b64 = base64::engine::general_purpose::STANDARD.encode(&buffer);
    Ok(format!("data:image/png;base64,{}", b64))
}
