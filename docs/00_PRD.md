# PRD - Global Quick Capture (Obsidian Windows)

## 1. Visão Geral
Utilitário de bandeja para Windows no estilo Raycast/Spotlight de ultra-baixo consumo de memória (~30-50 MB) focado em captura rápida de recortes de tela anotados diretamente para um cofre Obsidian, sem abrir o Obsidian.

## 2. Fluxo do Usuário
1. **Gatilho Global**: Pressiona `Win + Alt + S` (ou `Ctrl + Shift + S`) em qualquer lugar do SO.
2. **Overlay de Recorte**: Tela congela/escurece com crosshair. O usuário seleciona a área com o mouse.
3. **Card Quick Capture (Modal Flutuante - Otimizado para Produtividade & QA)**:
   - Surge centralizado no monitor ativo com o thumbnail do recorte.
   - **Roteador de Destino / Atalhos de Projetos**:
     - Atalhos rápidos configuráveis (ex: `[1] Daily Note`, `[2] Inbox`, `[3] QA/Bugs`, `[4] Projeto X`).
     - Seletor com fuzzy search para qualquer pasta ou nota do cofre Obsidian.
     - Opção de criar nova nota no projeto caso ela não exista.
   - **Campos de Entrada**:
     - *Título / Contexto*: campo com `autofocus` para etiqueta rápida (ex: "Bug no Checkout", "Inspiração de UI").
     - *Mensagem / Observação Detalhada (ideal para QA/Devs)*: campo para notas complementares (passos para reproduzir, comportamento esperado vs obtido, observações).
     - *Tags*: seletor rápido de tags (ex: `#bug`, `#qa`, `#ui`, `#p1`).
4. **Persistência Instantânea**:
   - `Enter` ou `Ctrl + Enter`:
     - Salva o `.png` recortado na pasta de anexos do cofre ou na subpasta de anexos do projeto selecionado (ex: `_attachments/clip-20261013-2035.png` ou `Projetos/AppAlpha/assets/clip-20261013-2035.png`).
     - Adiciona a entrada formatada no arquivo Markdown correspondente:
       ```markdown
       ### 20:35 - Bug no Checkout #bug #qa
       ![[clip-20261013-2035.png]]
       > **Observação/QA**: Ao clicar em 'Pagar com PIX', o modal fecha inesperadamente sem gerar o QR code.
       ```
     - Janela fecha e descarrega a memória imediatamente.
   - `Esc`: Cancela e descarta sem salvar.

## 3. Casos de Uso Especiais
- **QA & Bug Reporting**: Captura rápida de evidências de bugs com descrição detalhada de passos e direcionamento direto para a pasta do projeto/sprint em teste.
- **Design Review**: Captura de referências e feedback visual enviado para notas de produto.
- **Diário de Bordo / Daily Note**: Registro cronológico rápido de decisões de engenharia.

## 4. Critérios de Sucesso
- Abertura do overlay em < 200ms após o atalho global.
- Gravação direta em disco no cofre (zero dependência de plugins ou Obsidian aberto).
- Navegação 100% pelo teclado (atalhos numéricos para projetos, tabulação rápida, enter para salvar).
- Consumo mínimo em idle na bandeja do sistema.
