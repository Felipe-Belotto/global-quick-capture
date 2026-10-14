# Global Quick Capture

> Utilitário nativo para Windows de captura rápida de recortes de tela e evidências de QA integradas ao Obsidian, com foco em baixo consumo de recursos e produtividade pelo teclado.

[![Tauri v2](https://img.shields.io/badge/Tauri-v2-1f2937?logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-19-1f2937?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-1f2937?logo=tailwindcss)](https://tailwindcss.com/)
[![Rust](https://img.shields.io/badge/Rust-MSVC-1f2937?logo=rust)](https://www.rust-lang.org/)
[![License](https://img.shields.io/badge/License-MIT-1f2937.svg)](LICENSE)

---

## Visão Geral

O **Global Quick Capture** é um utilitário de sistema projetado para registrar anotações visuais, contextos rápidos e evidências de testes diretamente em arquivos Markdown de um cofre local do Obsidian, sem necessidade de alternar janelas ou manter o Obsidian em execução.

A ferramenta opera em segundo plano através da bandeja do sistema com consumo reduzido de memória (~35 MB em idle) e acionamento global por atalho.

---

## Recursos Principais

### Captura e Recorte
- **Atalho Global Customizável**: Acionado por padrão via `Win + Alt + S`, evitando colisões com atalhos de navegadores e IDEs.
- **Overlay de Recorte com Mira**: Congela a tela com transparência e fornece seleção retangular precisa com exibição de dimensões em pixels.
- **Cancelamento Rápido**: Tecla `Esc` fecha a interface e descarta o buffer sem persistência em disco.

### Interface de Entrada (Quick Capture Card)
- **Design Sólido e Focado**: Interface escura de alta fidelidade com transparência sutil e foco automático no campo de resumo.
- **Campo de Evidências de QA**: Área dedicada para descrição detalhada de comportamentos observados, passos para reprodução e notas técnicas.
- **Roteamento por Teclado**: Atalhos numéricos (`1` a `9`) para direcionar a nota instantaneamente entre *Daily Note*, *Inbox* ou diretórios de projetos.
- **Tags Rápidas**: Seleção de identificadores pré-definidos (`#qa`, `#bug`, `#ui`, `#p1`).

### Integração Local com o Obsidian
- **Zero Dependências**: Gravação direta no sistema de arquivos local (`std::fs`). O Obsidian detecta e sincroniza as alterações nativamente.
- **Onboarding Guiado**: Detecção automática da estrutura de pastas do cofre e geração de rotas ao selecionar o diretório raiz via diálogo nativo do Windows.
- **Padronização de Anexos**: Armazenamento automático das imagens PNG em diretórios dedicados (`_attachments` ou pastas de assets do projeto) com links formatados em sintaxe Wiki (`![[clip-...png]]`).

---

## Formato de Persistência

Ao confirmar o envio (`Ctrl + Enter`), a entrada é gravada no arquivo Markdown correspondente seguindo o padrão:

```markdown
### 21:40 - Resumo da Nota / Título do Bug #qa #bug
![[clip-20261013-214012.png]]
> **QA / Observação**: Comportamento observado ou passos de reprodução registrados no card.
```

---

## Arquitetura do Projeto

A arquitetura adota o padrão **Spec-Driven Agentic Engineering**, com especificações técnicas mantidas no diretório `docs/`:

```
global-quick-capture/
├── docs/
│   ├── 00_PRD.md               # Requisitos do produto, fluxos e critérios de aceite
│   ├── 01_ARCHITECTURE.md      # Estratégia multi-janela, contratos IPC e stack
│   ├── 02_DATA_CONTRACTS.md    # Esquemas JSON, resolução de caminhos e templates
│   ├── 03_ROADMAP.md           # Fila de execução de tarefas
│   └── AGENT_GUIDELINES.md     # Protocolo operacional para agentes de código
├── src/                        # Frontend (React 19 + TypeScript + Tailwind CSS v4)
│   ├── components/
│   │   ├── OnboardingModal.tsx # Setup inicial com escaneamento de pastas
│   │   ├── QuickCaptureCard.tsx# Modal principal de preenchimento e rotas
│   │   ├── SettingsModal.tsx   # Configurações de diretórios e atalhos
│   │   └── SnippingOverlay.tsx # Overlay de congelamento e recorte
│   └── types.ts                # Contratos TypeScript de rotas e configurações
└── src-tauri/                  # Backend Nativo (Rust)
    ├── src/
    │   ├── config.rs           # Gerenciamento de preferências em %APPDATA%
    │   ├── lib.rs              # Registro de atalhos globais, IPC e bandeja
    │   └── obsidian.rs         # Gravação de arquivos binários e append em Markdown
    └── tauri.conf.json         # Configuração de janelas nativas
```

---

## Instalação e Execução

### Pré-requisitos para Desenvolvimento
- **Node.js**: Versão 20 ou superior
- **Rust**: Canal estável com o toolchain `x86_64-pc-windows-msvc`
- **Visual Studio Build Tools**: C++ Build Tools (`VCTools` e Windows 11 SDK)

### Execução Local

```powershell
# 1. Instalar dependências do frontend
npm install

# 2. Iniciar em modo de desenvolvimento com Hot Reload
npm run tauri dev
```

### Compilação do Instalador

```powershell
npm run tauri build
```

O binário instalador do Windows (`.exe` NSIS e `.msi`) é gerado no diretório:
`src-tauri/target/release/bundle/nsis/`

---

## Tabela de Atalhos de Teclado

| Atalho | Contexto | Ação |
| :--- | :--- | :--- |
| `Win + Alt + S` | Global (Windows) | Abre o overlay de recorte sobre a tela atual |
| `Esc` | Overlay / Card | Cancela a operação e fecha a janela ativa |
| `1` a `9` | Card de Captura | Seleciona a rota de destino (Daily Note, Inbox ou Projetos) |
| `Tab` | Card de Captura | Alterna entre o campo de título e o campo de observações de QA |
| `Ctrl + Enter` | Card de Captura | Salva os dados no Obsidian e fecha a interface |

---

## Licença

Este projeto é distribuído sob a licença [MIT](LICENSE).
