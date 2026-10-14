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

## 4. Arquitetura do Frontend: Vertical Slices (Feature-Based)

O frontend adota **Arquitetura Vertical Sliced**, organizando o código por funcionalidades de negócio autônomas em vez de agrupamentos técnicos planos:

```
src/
├── features/                  # Fatias verticais do negócio (autônomas)
│   ├── snipping/              # Recorte e congelamento de tela
│   │   └── components/        # SnippingOverlay, etc.
│   ├── capture-card/          # Card flutuante de anotação e envio rápido
│   │   └── components/        # QuickCaptureCard, CardHeader, ImagePreviewLightbox
│   ├── annotations/           # Ferramentas express de desenho (setas, retângulos, blur/censura)
│   │   ├── components/        # AnnotationEditorModal
│   │   └── lib/               # drawUtils.ts
│   ├── settings/              # Gerenciador de rotas e configurações do cofre
│   │   └── components/        # SettingsModal
│   └── onboarding/            # Setup inicial do primeiro uso
│       └── components/        # OnboardingModal
└── shared/                    # Código compartilhado entre as features
    ├── components/            # DragHandle, etc.
    ├── hooks/                 # useDraggableWindow
    ├── lib/                   # date.ts, tauri-ipc wrappers
    └── types/                 # AppConfig, ProjectRoute, SaveSnippetPayload
```

### Regras do Vertical Slicing:
1. **Isolamento de Features**: Cada pasta dentro de `src/features/[feature]` contém tudo o que é necessário para a funcionalidade operar.
2. **Dependência Unidirecional**: Features dependem apenas de `shared/` e não devem importar diretamente componentes internos de outras features.
3. **Novas Funcionalidades**: Novas capacidades (como OCR, histórico, áudio) devem ser criadas como novas pastas em `src/features/[nome-da-feature]/` sem alterar fatias existentes.
4. **Performance Cloud-Sync (Google Drive / OneDrive)**: Gravação não-bloqueante no Rust backend sem chamadas síncronas a `sync_all()`, com feedback assíncrono via eventos do Tauri.
5. **Movimentação Nativa**: Toda janela modal implementa arraste imperativo via `startDragging()` no evento `onMouseDown` do cabeçalho.

