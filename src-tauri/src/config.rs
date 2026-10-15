use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectRoute {
    pub id: String,
    #[serde(rename = "keyShortcut")]
    pub key_shortcut: Option<String>,
    pub label: String,
    #[serde(rename = "targetType")]
    pub target_type: String, // "daily_note" | "file" | "folder"
    #[serde(rename = "folderPath")]
    pub folder_path: Option<String>,
    #[serde(rename = "filePath")]
    pub file_path: Option<String>,
    #[serde(rename = "customAttachmentsFolder")]
    pub custom_attachments_folder: Option<String>,
    #[serde(rename = "defaultTags")]
    pub default_tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(rename = "vaultPath")]
    pub vault_path: String,
    #[serde(rename = "attachmentsFolder")]
    pub attachments_folder: String,
    #[serde(rename = "projectRoutes")]
    pub project_routes: Vec<ProjectRoute>,
    #[serde(rename = "defaultRouteId")]
    pub default_route_id: String,
    #[serde(rename = "globalShortcut")]
    pub global_shortcut: String,
    #[serde(rename = "markdownTemplate")]
    pub markdown_template: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        let home = dirs::document_dir().unwrap_or_else(|| PathBuf::from("C:\\"));
        let default_vault = home.join("ObsidianVault");

        Self {
            vault_path: default_vault.to_string_lossy().to_string(),
            attachments_folder: "_attachments".to_string(),
            default_route_id: "daily".to_string(),
            global_shortcut: "Super+Alt+S".to_string(),
            project_routes: vec![
                ProjectRoute {
                    id: "daily".to_string(),
                    key_shortcut: Some("1".to_string()),
                    label: "Daily Note".to_string(),
                    target_type: "daily_note".to_string(),
                    folder_path: Some("Daily".to_string()),
                    file_path: None,
                    custom_attachments_folder: None,
                    default_tags: Some(vec!["daily".to_string()]),
                },
                ProjectRoute {
                    id: "inbox".to_string(),
                    key_shortcut: Some("2".to_string()),
                    label: "Inbox".to_string(),
                    target_type: "file".to_string(),
                    folder_path: None,
                    file_path: Some("Inbox.md".to_string()),
                    custom_attachments_folder: None,
                    default_tags: Some(vec!["inbox".to_string()]),
                },
                ProjectRoute {
                    id: "qa_bugs".to_string(),
                    key_shortcut: Some("3".to_string()),
                    label: "QA / Bugs".to_string(),
                    target_type: "folder".to_string(),
                    folder_path: Some("Projects/QA/Bugs".to_string()),
                    file_path: None,
                    custom_attachments_folder: Some("Projects/QA/Bugs/assets".to_string()),
                    default_tags: Some(vec!["qa".to_string(), "bug".to_string()]),
                },
                ProjectRoute {
                    id: "frontend".to_string(),
                    key_shortcut: Some("4".to_string()),
                    label: "Frontend".to_string(),
                    target_type: "folder".to_string(),
                    folder_path: Some("Projects/Frontend".to_string()),
                    file_path: None,
                    custom_attachments_folder: None,
                    default_tags: Some(vec!["ui".to_string(), "frontend".to_string()]),
                },
            ],
            markdown_template: "### {{time}} - {{title}} {{tags}}\n![[{{filename}}]]\n{{#if message}}> **QA / Detalhes**: {{message}}\n{{/if}}\n".to_string(),
        }
    }
}

pub fn get_config_path() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    let new_dir = base.join("qcap");
    let old_dir = base.join("global-quick-capture");

    if !new_dir.exists() && old_dir.join("config.json").exists() {
        let _ = fs::create_dir_all(&new_dir);
        let _ = fs::copy(old_dir.join("config.json"), new_dir.join("config.json"));
    } else {
        let _ = fs::create_dir_all(&new_dir);
    }
    new_dir.join("config.json")
}

pub fn load_config() -> AppConfig {
    let path = get_config_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                return config;
            }
        }
    }
    let default_config = AppConfig::default();
    let _ = save_config(&default_config);
    default_config
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let path = get_config_path();
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}
