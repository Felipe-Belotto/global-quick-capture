# Roadmap de Execução & Tarefas dos Agentes

Este documento é a lista viva de tarefas. Cada agente assume uma tarefa, executa, testa e marca como concluída `[x]`.

---

## Fase 1: Fundação & Scaffolding
- [x] **T1.1**: Inicializar projeto Tauri v2 (Rust + Vite + React-TS).
- [x] **T1.2**: Instalar e configurar Tailwind CSS v4 + Lucide Icons.
- [x] **T1.3**: Configurar estrutura de janelas no `tauri.conf.json` (`snipping_overlay` e `capture_card`).
- [x] **T1.4**: Criar módulo de persistência de configuração (`config.rs`) com leitura/escrita em `%APPDATA%` e rotas de projetos.

## Fase 2: Backend Nativo Rust (Atalhos, Captura & File System)
- [x] **T2.1**: Implementar menu de bandeja (Tray) e handlers de disparo de captura em `lib.rs`.
- [x] **T2.2**: Implementar canal de recorte e tráfego de imagens base64 via IPC (`finish_snip`, `cancel_snip`).
- [x] **T2.3**: Implementar leitor de árvore de arquivos do Vault do Obsidian (`list_vault_nodes`) em `obsidian.rs`.
- [x] **T2.4**: Implementar comando Rust `save_snippet`:
  - Salva o PNG na pasta global (`_attachments`) ou do projeto (`customAttachmentsFolder`).
  - Resolve Daily Note (`Daily/YYYY-MM-DD.md`), Inbox (`Inbox.md`) ou pasta do projeto.
  - Grava entrada formatada em Markdown com título, tags, link da imagem e bloco de QA/observação.

## Fase 3: Frontend - Overlay de Recorte (Snipping)
- [x] **T3.1**: Criar tela de overlay escurecido com cursor em cruz (crosshair).
- [x] **T3.2**: Implementar seleção retangular com clique e arrasto (bounding box com coordenadas e indicador de tamanho `w x h px`).
- [x] **T3.3**: Ao soltar o mouse (`mouseup`), recortar o frame, emitir evento para abrir o `capture_card` e fechar o overlay.
- [x] **T3.4**: Permitir cancelar com tecla `Esc`.

## Fase 4: Frontend - Card Quick Capture (Raycast Modal com QA & Projetos)
- [x] **T4.1**: Criar modal flutuante compacto e moderno (backdrop blur, sombras suaves, dark mode).
- [x] **T4.2**: Renderizar thumbnail da imagem recém-recortada.
- [x] **T4.3**: Input de Título/Resumo com `autofocus` imediato.
- [x] **T4.4**: Área de texto para Mensagem de QA / Observações detalhadas.
- [x] **T4.5**: Seletor de Destino / Projetos:
  - Pílulas de atalhos rápidos acionáveis via teclado (`1`, `2`, `3`...).
  - Indicação em tempo real do arquivo de destino.
- [x] **T4.6**: Badges de tags rápidas interativas (`#bug`, `#qa`, `#ui`, `#p1`, `#daily`).
- [x] **T4.7**: Handlers de teclado:
  - `Ctrl + Enter` (ou `Enter` no campo principal) salva imediatamente.
  - `Esc` descarta e fecha.

## Fase 5: Integração, Bandeja & Validação
- [x] **T5.1**: Configurar ícone na bandeja do Windows (Tray) com menu de contexto (Capturar, Sair).
- [x] **T5.2**: Testar compilação nativa com `cargo check` e MSVC Build Tools configurado.
- [ ] **T5.3**: Validação ponta a ponta com o seu cofre do Obsidian.
