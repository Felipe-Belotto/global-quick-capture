use crate::config::{load_config, ProjectRoute};
use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveSnippetPayload {
    #[serde(rename = "imageBufferBase64")]
    pub image_buffer_base64: String,
    pub title: String,
    pub message: Option<String>,
    #[serde(rename = "routeId")]
    pub route_id: String,
    #[serde(rename = "customTargetFile")]
    pub custom_target_file: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultNode {
    pub path: String,
    pub name: String,
    #[serde(rename = "isFolder")]
    pub is_folder: bool,
}

pub fn save_snippet(payload: SaveSnippetPayload) -> Result<(), String> {
    let config = load_config();
    let vault_root = PathBuf::from(&config.vault_path);

    if !vault_root.exists() {
        return Err(format!("Cofre do Obsidian não encontrado em: {}", config.vault_path));
    }

    let now = Local::now();
    let time_str = now.format("%H:%M").to_string();
    let file_timestamp = now.format("%Y%m%d-%H%M%S").to_string();
    let image_filename = format!("clip-{}.png", file_timestamp);

    // 1. Encontrar a rota configurada
    let matched_route: Option<ProjectRoute> = config
        .project_routes
        .iter()
        .find(|r| r.id == payload.route_id)
        .cloned();

    // 2. Determinar a pasta de anexo
    let attachments_dir = if let Some(route) = &matched_route {
        if let Some(custom_dir) = &route.custom_attachments_folder {
            vault_root.join(custom_dir)
        } else {
            vault_root.join(&config.attachments_folder)
        }
    } else {
        vault_root.join(&config.attachments_folder)
    };

    fs::create_dir_all(&attachments_dir).map_err(|e| e.to_string())?;
    let image_path = attachments_dir.join(&image_filename);

    // 3. Decodificar Base64 e salvar a imagem PNG
    let clean_base64 = if let Some(pos) = payload.image_buffer_base64.find("base64,") {
        &payload.image_buffer_base64[pos + 7..]
    } else {
        &payload.image_buffer_base64
    };

    use base64::Engine;
    let decoded_bytes = base64::engine::general_purpose::STANDARD
        .decode(clean_base64.trim())
        .map_err(|e| format!("Falha ao decodificar imagem base64: {}", e))?;

    let mut img_file = None;
    for attempt in 0..6 {
        match fs::File::create(&image_path) {
            Ok(f) => {
                img_file = Some(f);
                break;
            }
            Err(_) if attempt < 5 => {
                std::thread::sleep(std::time::Duration::from_millis(30));
            }
            Err(e) => {
                return Err(format!("Falha ao criar imagem: {}", e));
            }
        }
    }

    if let Some(mut f) = img_file {
        f.write_all(&decoded_bytes)
            .map_err(|e| format!("Falha ao gravar imagem: {}", e))?;
        let _ = f.flush();
        let _ = f.sync_all();
        drop(f);
    }

    let dd_mm_yyyy = now.format("%d-%m-%Y").to_string();
    let yyyy_mm_dd = now.format("%Y-%m-%d").to_string();

    // 4. Determinar o arquivo Markdown de destino
    let target_md_path = if let Some(custom_file) = payload.custom_target_file {
        vault_root.join(custom_file)
    } else if let Some(route) = &matched_route {
        match route.target_type.as_str() {
            "daily_note" => {
                let folder = route.folder_path.as_deref().unwrap_or("Daily");
                let daily_dir = vault_root.join(folder);
                fs::create_dir_all(&daily_dir).map_err(|e| e.to_string())?;

                let candidate_dd = daily_dir.join(format!("{}.md", dd_mm_yyyy));
                let candidate_iso = daily_dir.join(format!("{}.md", yyyy_mm_dd));

                // Se já existir qualquer nota desse dia (DD-MM-YYYY ou YYYY-MM-DD), anexa a ela
                if candidate_dd.exists() {
                    candidate_dd
                } else if candidate_iso.exists() {
                    candidate_iso
                } else {
                    candidate_dd
                }
            }
            "file" => {
                let file = route.file_path.as_deref().unwrap_or("Inbox.md");
                vault_root.join(file)
            }
            "folder" => {
                let folder = route.folder_path.as_deref().unwrap_or("Projects");
                let project_dir = vault_root.join(folder);
                fs::create_dir_all(&project_dir).map_err(|e| e.to_string())?;

                let candidate_dd = project_dir.join(format!("{}.md", dd_mm_yyyy));
                let candidate_iso = project_dir.join(format!("{}.md", yyyy_mm_dd));

                // Se já existir nota diária nesta pasta de projeto, anexa a ela
                if candidate_dd.exists() {
                    candidate_dd
                } else if candidate_iso.exists() {
                    candidate_iso
                } else {
                    candidate_dd
                }
            }
            _ => vault_root.join("Inbox.md"),
        }
    } else {
        vault_root.join("Inbox.md")
    };

    // Garantir que a pasta do arquivo markdown existe
    if let Some(parent) = target_md_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    // 5. Montar o texto formatado em Markdown
    let mut tags_str = String::new();
    for tag in &payload.tags {
        let clean_tag = tag.trim_start_matches('#');
        if !clean_tag.is_empty() {
            tags_str.push_str(&format!(" #{}", clean_tag));
        }
    }

    let mut entry = if !tags_str.is_empty() {
        format!("### {}{}\n![[{}]]\n", time_str, tags_str, image_filename)
    } else {
        format!("### {}\n![[{}]]\n", time_str, image_filename)
    };

    if let Some(msg) = &payload.message {
        let trimmed = msg.trim();
        if !trimmed.is_empty() {
            entry.push_str(&format!("\n{}\n", trimmed));
        }
    } else if !payload.title.trim().is_empty()
        && payload.title.trim() != "Captura"
        && payload.title.trim() != "Captura Rápida"
    {
        let trimmed = payload.title.trim();
        entry.push_str(&format!("\n{}\n", trimmed));
    }

    // 6. Gravar (Append) no arquivo Markdown
    let existing_content = if target_md_path.exists() {
        fs::read_to_string(&target_md_path).unwrap_or_default()
    } else {
        String::new()
    };

    let prefix = if existing_content.trim().is_empty() {
        // Se a nota é nova, cria com o título do dia
        format!("# {}\n\n", dd_mm_yyyy)
    } else if !existing_content.ends_with("\n\n") {
        if existing_content.ends_with('\n') {
            "\n".to_string()
        } else {
            "\n\n".to_string()
        }
    } else {
        String::new()
    };

    let full_to_write = format!("{}{}\n", prefix, entry);

    let mut file = None;
    for attempt in 0..10 {
        match OpenOptions::new()
            .create(true)
            .append(true)
            .open(&target_md_path)
        {
            Ok(f) => {
                file = Some(f);
                break;
            }
            Err(_) if attempt < 9 => {
                std::thread::sleep(std::time::Duration::from_millis(40));
            }
            Err(e) => {
                return Err(format!("Falha ao abrir nota de destino {}: {}", target_md_path.display(), e));
            }
        }
    }

    if let Some(mut f) = file {
        f.write_all(full_to_write.as_bytes())
            .map_err(|e| format!("Falha ao escrever nota: {}", e))?;
        let _ = f.flush();
        let _ = f.sync_all();
        drop(f);
    }

    Ok(())
}

pub fn list_vault_nodes(vault_path: &str) -> Vec<VaultNode> {
    let mut nodes = Vec::new();
    let root = Path::new(vault_path);
    if !root.exists() {
        return nodes;
    }

    let _ = scan_dir_recursive(root, root, &mut nodes, 0);
    nodes
}

fn scan_dir_recursive(
    root: &Path,
    current: &Path,
    nodes: &mut Vec<VaultNode>,
    depth: usize,
) -> std::io::Result<()> {
    if depth > 4 {
        return Ok(()); // Limita profundidade para performance
    }

    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Ignorar pastas ocultas como .obsidian, .git ou pasta de attachments
        if name.starts_with('.') || name == "_attachments" || name == "node_modules" {
            continue;
        }

        if let Ok(relative) = path.strip_prefix(root) {
            let relative_str = relative.to_string_lossy().replace('\\', "/");
            let is_folder = path.is_dir();

            if is_folder {
                nodes.push(VaultNode {
                    path: relative_str.clone(),
                    name: name.clone(),
                    is_folder: true,
                });
                let _ = scan_dir_recursive(root, &path, nodes, depth + 1);
            } else if name.ends_with(".md") {
                nodes.push(VaultNode {
                    path: relative_str,
                    name,
                    is_folder: false,
                });
            }
        }
    }
    Ok(())
}

pub fn scan_vault_subfolders(vault_path: &str) -> Vec<String> {
    let mut folders = Vec::new();
    let root = Path::new(vault_path);
    if !root.exists() {
        return folders;
    }

    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                if !name.starts_with('.') && name != "_attachments" && name != "node_modules" {
                    folders.push(name.clone());
                    // Subpastas de nível 2 (ex: Projects/QA)
                    if let Ok(sub_entries) = fs::read_dir(&path) {
                        for sub_entry in sub_entries.flatten() {
                            let sub_path = sub_entry.path();
                            if sub_path.is_dir() {
                                let sub_name = sub_entry.file_name().to_string_lossy().to_string();
                                if !sub_name.starts_with('.') {
                                    folders.push(format!("{}/{}", name, sub_name));
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    folders.sort();
    folders
}

