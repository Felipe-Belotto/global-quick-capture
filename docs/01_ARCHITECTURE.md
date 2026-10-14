# Arquitetura e Decisões Técnicas

## 1. Stack Tecnológica
- **Framework Host**: **Tauri v2** (Rust para operações nativas do Windows + Webview2 para UI leve).
- **Backend (Rust)**:
  - Atalhos Globais: `tauri-plugin-global-shortcut`.
  - Captura de Tela: `xcap` ou buffer nativo.
  - Persistência e Sistema de Arquivos: `std::fs` e `chrono`.
  - Ícone de Bandeja: `tauri::tray` oficial do Tauri v2.
- **Frontend (UI Raycast-like)**:
  - Framework: React 18 / 19 com Vite + TypeScript.
  - Estilização: Tailwind CSS (modo escuro nativo, transparência, blur/backdrop-filter estilo Spotlight/Raycast).
  - Ícones: `lucide-react`.

## 2. Padrão de Janelas (Multi-Window Strategy)
O app utilizará duas janelas orquestradas pelo Rust:
1. `snipping_overlay` (Janela de Recorte):
   - `transparent: true`, `decorations: false`, `always_on_top: true`, `fullscreen: true`, `skip_taskbar: true`.
   - Inicialmente oculta. Ao disparar o atalho, o Rust tira o print da tela, exibe a janela com a imagem de fundo congelada e o canvas de seleção por cima.
2. `capture_card` (Janela do Card Raycast):
   - Dimensões: ~580px x 280px.
   - `decorations: false`, `always_on_top: true`, `transparent: true`, `center: true`, `skip_taskbar: true`.
   - Mostra o thumbnail, input de texto rápido, badges de tags, atalhos de projetos e campo QA.

## 3. Comunicação IPC (Tauri Commands)
```rust
#[tauri::command]
fn trigger_capture() -> Result<CaptureMetadata, String>;

#[tauri::command]
fn save_snippet(payload: SaveSnippetPayload) -> Result<(), String>;

#[tauri::command]
fn get_vault_config() -> Result<VaultConfig, String>;

#[tauri::command]
fn update_vault_config(config: VaultConfig) -> Result<(), String>;

#[tauri::command]
fn list_vault_nodes() -> Result<Vec<VaultNode>, String>;
```
