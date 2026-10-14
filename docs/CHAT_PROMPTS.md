# Guia de Prompts por Feature (Chats Isolados)

Como nosso projeto agora segue rigorosamente a **Arquitetura Vertical Sliced**, cada funcionalidade vive isolada em sua própria pasta (`src/features/[nome-da-feature]`), compartilhando apenas os tipos e utilitários em `src/shared/`.

Você pode abrir **um chat separado para cada feature** copiando e colando os prompts abaixo. Nenhuma feature interferirá na outra. No final, há o prompt do **Chat de Review Geral**.

---

## 💬 Chat 1: Feature de Anotações Avançadas (`src/features/annotations`)

**Copie e cole este prompt em um novo chat:**

```text
Olá! Estou trabalhando no repositório Global Quick Capture, que segue a Arquitetura Vertical Sliced.
Seu escopo de trabalho está restrito EXCLUSIVAMENTE à feature de anotações em:
`src/features/annotations/`

Objetivo da tarefa:
1. Adicionar uma ferramenta de "Marca-Texto" (highlighter semi-transparente com blend mode para destacar textos na imagem capturada).
2. Adicionar uma ferramenta de "Texto" simples (clicar na imagem e digitar uma legenda ou nota rápida em vermelho/amarelo).
3. Adicionar atalhos de teclado no modal de anotações (`src/features/annotations/components/AnnotationEditorModal.tsx`):
   - 'A' para Seta
   - 'R' para Retângulo
   - 'B' para Blur/Censura
   - 'H' para Marca-Texto
   - 'T' para Texto
   - 'Ctrl+Z' para Desfazer

Diretrizes:
- Não modifique arquivos fora de `src/features/annotations/` (exceto se precisar importar utilitários de `src/shared/`).
- Mantenha a interface no estilo terminal Warp / minimalista escuro.
- Ao final, certifique-se de que `npm run build` continue passando sem erros.
```

---

## 💬 Chat 2: Feature de OCR & Extração de Texto (`src/features/ocr`)

**Copie e cole este prompt em um novo chat:**

```text
Olá! Estou trabalhando no repositório Global Quick Capture, que segue a Arquitetura Vertical Sliced.
Seu escopo de trabalho é criar uma NOVA feature isolada em:
`src/features/ocr/`

Objetivo da tarefa:
1. Criar `src/features/ocr/components/OcrButton.tsx` e `src/features/ocr/lib/ocrEngine.ts`.
2. Permitir que o usuário clique em um botão "📋 OCR / Copiar Texto" na visualização do recorte.
3. Extrair o texto da imagem (usando a API nativa do navegador/Tauri ou Tesseract.js leve) e fornecer duas ações:
   - "Copiar para Área de Transferência"
   - "Inserir no campo de anotações como bloco de código Markdown"
4. Adicionar o botão de forma não-intrusiva no `src/features/capture-card/components/QuickCaptureCard.tsx` apenas como consumidor da feature de OCR.

Diretrizes:
- Isole toda a lógica de reconhecimento e estado dentro de `src/features/ocr/`.
- Forneça feedback visual de carregamento ("reconhecendo texto...") com fallback elegante caso não haja texto legível.
- Ao final, execute `npm run build` para garantir zero erros de TypeScript.
```

---

## 💬 Chat 3: Feature Smart Positioning & Janela Inteligente (`src/features/snipping` & Tauri)

**Copie e cole este prompt em um novo chat:**

```text
Olá! Estou trabalhando no repositório Global Quick Capture, que segue a Arquitetura Vertical Sliced.
Seu escopo de trabalho é aprimorar a inteligência de posicionamento da janela do card:
Arquivos foco: `src-tauri/src/lib.rs` e `src/features/snipping/`

Objetivo da tarefa:
1. Atualmente, o card de anotação (`capture_card`) abre sempre no centro da tela, muitas vezes cobrindo exatamente o que o usuário acabou de recortar.
2. Implementar "Smart Positioning":
   - Ao finalizar o recorte no `SnippingOverlay`, enviar as coordenadas `(x, y, width, height)` do retângulo recortado para o Rust no comando `finish_snip`.
   - O Rust deve calcular a melhor posição na tela para exibir o `capture_card` (por exemplo: logo abaixo ou ao lado da área recortada, garantindo que não saia das bordas do monitor).
   - Se a área recortada for a tela inteira, manter no centro ou na última posição do usuário.

Diretrizes:
- Respeite o DPI scaling do Windows.
- O card deve continuar totalmente arrastável através do `useDraggableWindow`.
- Execute `cargo check` e `npm run build` para validar que tudo está compilando.
```

---

## 💬 Chat 4: Feature Autocomplete de Tags e Wikilinks (`src/features/capture-card`)

**Copie e cole este prompt em um novo chat:**

```text
Olá! Estou trabalhando no repositório Global Quick Capture, que segue a Arquitetura Vertical Sliced.
Seu escopo de trabalho é evoluir o editor de Markdown em:
`src/features/capture-card/`

Objetivo da tarefa:
1. Criar um hook `useVaultAutocomplete.ts` dentro de `src/features/capture-card/hooks/`.
2. Ao digitar `#` no textarea, abrir um mini popover flutuante sugerindo as tags mais frequentes ou padrão do cofre (ex: `#bug`, `#qa`, `#reuniao`, `#ideia`, `#projeto`).
3. Ao digitar `[[`, abrir um popover sugerindo as notas existentes ou pastas do cofre para fechar com `]]`.
4. Navegação no popover via setas do teclado (Cima/Baixo) e confirmação via `Enter` ou `Tab`.

Diretrizes:
- Mantenha a digitação extremamente ágil (zero lag na digitação).
- Isole a lógica do popover em `src/features/capture-card/components/AutocompletePopover.tsx`.
- Execute `npm run build` ao finalizar.
```

---

## 💬 Chat 5: Feature de Histórico Local / Snippet Gallery (`src/features/history`)

**Copie e cole este prompt em um novo chat:**

```text
Olá! Estou trabalhando no repositório Global Quick Capture, que segue a Arquitetura Vertical Sliced.
Seu escopo de trabalho é criar uma NOVA feature isolada em:
`src/features/history/`

Objetivo da tarefa:
1. Criar um histórico local em memória/localStorage das últimas 10 capturas realizadas na sessão.
2. Criar o componente `src/features/history/components/HistoryDrawer.tsx` (ou modal flutuante).
3. Permitir que o usuário pressione um atalho (ou clique em `[histórico]`) para ver as capturas recentes e:
   - Reenviar uma captura anterior para outra rota do Obsidian.
   - Copiar novamente a imagem para a área de transferência.
   - Ver data e hora da captura.

Diretrizes:
- Isole os tipos em `src/features/history/types.ts`.
- Mantenha a consistência visual no tema escuro Warp.
- Execute `npm run build` ao finalizar.
```

---

## 💬 Chat Final: Code Review Geral & Validação de Qualidade (QA)

**Após concluir as features que desejar, copie e cole este prompt em um último chat de auditoria:**

```text
Olá! Sou o mantenedor do projeto Global Quick Capture.
Acabamos de implementar novas features utilizando a Arquitetura Vertical Sliced.
Seu papel neste chat é realizar um CODE REVIEW COMPLETO e AUDITORIA DE QUALIDADE (QA) em toda a aplicação.

Por favor, analise a codebase e verifique:
1. Conformidade com a Arquitetura Vertical Sliced:
   - Existem vazamentos de dependências entre features?
   - O código compartilhado está devidamente alocado em `src/shared/`?
2. Performance e Fluidade no Windows / Google Drive:
   - Há algum bloqueio síncrono ou chamada a `sync_all` / I/O desnecessária no Rust?
   - Há algum vazamento de memória ou listeners do Tauri (`listen`) não desmontados no React (`unlisten`)?
3. Usabilidade e Ergonomia:
   - O arraste de janelas (`useDraggableWindow`) funciona sem falhas?
   - Os atalhos de teclado (Esc, Ctrl+Enter, atalhos numéricos 1-9) estão consistentes?
4. Qualidade de Código e Build:
   - Execute `npm run build` e certifique-se de que não há warnings de TypeScript nem dead code.
   - Execute `cargo check` no diretório `src-tauri` para garantir a integridade do backend.

Entregue um relatório estruturado com os pontos fortes encontrados, eventuais correções sugeridas ou melhorias aplicadas!
```
