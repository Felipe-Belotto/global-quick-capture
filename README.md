<div align="center">

# ⚡ Global Quick Capture (Obsidian + Windows)

**Captura rápida global de tela e evidências de QA direto para o seu cofre do Obsidian, no estilo Raycast/Spotlight e visual do Warp Terminal.**

[![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18%2F19-61dafb?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Rust](https://img.shields.io/badge/Rust-MSVC-orange?logo=rust)](https://www.rust-lang.org/)
[![Obsidian](https://img.shields.io/badge/Obsidian-Vault_Sync-purple?logo=obsidian)](https://obsidian.md/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[Download do Instalador (.exe)](https://github.com/Felipe-Belotto/global-quick-capture/releases) • [Documentação (/docs)](./docs) • [Roadmap](./docs/03_ROADMAP.md)

</div>

---

## 💡 O Que É?

O **Global Quick Capture** é um utilitário de bandeja nativo para Windows de ultra-baixo consumo de memória (~30-40 MB) feito para desenvolvedores, QAs e usuários do Obsidian registrarem ideias, anotações e evidências de bugs instantaneamente em qualquer lugar do sistema operacional, **sem precisar abrir o Obsidian**.

---

## ✨ Principais Funcionalidades

- 🎯 **Atalho Global sem Conflitos (`Win + Alt + S`)**: Dispare o recorte de tela de qualquer aplicativo ou jogo no Windows.
- ✂️ **Overlay de Recorte com Mira em Cruz**: Fundo congelado translúcido com indicador de dimensões em tempo real (`L × A px`). Cancele a qualquer momento com <kbd>Esc</kbd>.
- 🚀 **Card Rápido no Estilo Warp Terminal**:
  - **Título com Autofocus**: Digite um resumo imediato.
  - **Campo de Evidências de QA**: Espaço dedicado para passos de reprodução, logs ou comportamento observado vs. esperado.
  - **Roteador de Projetos por Teclado**: Pressione <kbd>1</kbd> para Daily Note, <kbd>2</kbd> para Inbox, <kbd>3</kbd> para QA/Bugs, etc.
  - **Tags Rápidas**: `#qa`, `#bug`, `#ui`, `#p1`.
- 📁 **Onboarding com Detecção Automática de Pastas**:
  - Selecione a pasta raiz do seu cofre através do seletor nativo do Windows.
  - O app escaneia seu cofre em tempo real (como nas IAs como Claude e Cursor) e identifica pastas de projetos e bugs automaticamente.
- ⚡ **Persistência Instantânea no Obsidian**:
  - Salva a imagem `.png` com timestamp na pasta de anexos (`_attachments/` ou na pasta de assets do projeto).
  - Faz o `append` no arquivo Markdown de destino com formatação limpa:
    ```markdown
    ### 21:40 - Botão de checkout não responde #qa #bug
    ![[clip-20261013-214012.png]]
    > **QA / Observação**: Ao clicar em Pagar com PIX na resolução 1440p, a requisição retorna 422.
    ```
- 🔔 **Ícone na Bandeja do Sistema (Tray)**: Roda silencioso em segundo plano com menu de contexto ("Nova Captura", "Configurações" e "Sair").

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia | Função |
| :--- | :--- | :--- |
| **Host & Desktop** | **Tauri v2** | Empacotamento nativo Windows com baixo consumo de memória (~35 MB) |
| **Backend Nativo** | **Rust (MSVC)** | Atalhos globais, scanner de arquivos, gravação binária e diálogo nativo |
| **Frontend UI** | **React + Vite + TypeScript** | Componentes responsivos de alto desempenho |
| **Estilização** | **Tailwind CSS v4** | Paleta escura sólida inspirada no Warp Terminal e backdrop-blur |
| **Ícones** | **Lucide Icons** | Conjunto moderno de ícones vetoriais |
| **CI/CD** | **GitHub Actions** | Compilação e empacotamento automático do instalador `.exe` na nuvem |

---

## 🚀 Como Usar

### Opção 1: Baixar o Instalador Pronto (Recomendado)
1. Acesse a página de [Releases](https://github.com/Felipe-Belotto/global-quick-capture/releases).
2. Baixe o instalador `global-quick-capture_x64-setup.exe`.
3. Instale e abra. No primeiro início, selecione a pasta do seu cofre do Obsidian e pronto!

### Opção 2: Rodar Localmente (Modo Desenvolvimento)

**Pré-requisitos**:
- Node.js (v20+)
- Rust (toolchain `stable-x86_64-pc-windows-msvc`) com C++ Build Tools

**Passos**:
```powershell
# 1. Clonar o repositório
git clone https://github.com/Felipe-Belotto/global-quick-capture.git
cd global-quick-capture

# 2. Instalar dependências
npm install

# 3. Rodar em modo de desenvolvimento (com Hot Reload ativo)
npm run tauri dev
```

---

## 📂 Arquitetura de Agentes (`/docs`)

O projeto segue a metodologia **Spec-Driven Agentic Architecture**:
- [`docs/00_PRD.md`](./docs/00_PRD.md) — Visão do produto, fluxos de uso e critérios de sucesso.
- [`docs/01_ARCHITECTURE.md`](./docs/01_ARCHITECTURE.md) — Decisões técnicas, estratégia multi-janela e contratos IPC.
- [`docs/02_DATA_CONTRACTS.md`](./docs/02_DATA_CONTRACTS.md) — Esquema do `config.json`, resolução do cofre e templates Markdown.
- [`docs/03_ROADMAP.md`](./docs/03_ROADMAP.md) — Lista viva de tarefas e progresso dos agentes.
- [`docs/AGENT_GUIDELINES.md`](./docs/AGENT_GUIDELINES.md) — Regras de governança para subagentes autônomos.

---

## ⌨️ Atalhos Padrão

| Atalho | Ação |
| :--- | :--- |
| <kbd>Win + Alt + S</kbd> | Dispara o overlay de captura de tela em qualquer lugar do Windows |
| <kbd>Esc</kbd> | Cancela a seleção ou fecha o card sem salvar |
| <kbd>1</kbd> a <kbd>9</kbd> | Alterna rapidamente entre as rotas de projetos |
| <kbd>Ctrl + Enter</kbd> | Salva a anotação e a imagem no Obsidian e fecha a janela |

---

## 📝 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.
