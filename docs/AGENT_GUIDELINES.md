# Diretrizes de Orquestração para Agentes (Agent Guidelines)

Este documento dita como agentes autônomos ou subagentes devem operar neste repositório.

## 1. Princípios de Operação
1. **Docs como SSOT (Single Source of Truth)**: Antes de qualquer alteração, consulte `docs/00_PRD.md`, `docs/01_ARCHITECTURE.md` e `docs/02_DATA_CONTRACTS.md`.
2. **Atualização Ativa do Roadmap**:
   - Antes de iniciar uma tarefa, verifique os pré-requisitos em `docs/03_ROADMAP.md`.
   - Assim que finalizar e validar uma tarefa, altere o status em `docs/03_ROADMAP.md` de `[ ]` para `[x]`.
3. **Isolamento de Responsabilidade**:
   - Agentes de Backend (Rust) focam exclusivamente em `src-tauri/` e contratos IPC.
   - Agentes de Frontend focam em `src/` (componentes, estilos, hooks de IPC).
   - Não altere configurações estruturais do Tauri sem registrar a mudança em `docs/01_ARCHITECTURE.md`.

## 2. Protocolo de Cada Agente
Ao receber um ticket/tarefa:
1. **Leitura**: Ler a tarefa correspondente em `docs/03_ROADMAP.md`.
2. **Implementação**: Escrever código com tipagem estrita e tratamento de erros.
3. **Validação**: Compilar (`cargo check` / `npm run build`) para garantir zero erros.
4. **Finalização**: Atualizar `docs/03_ROADMAP.md` e reportar o resultado com links para os arquivos modificados.
