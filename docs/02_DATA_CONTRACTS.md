# Contratos de Dados & Integração com Obsidian

## 1. Arquivo de Configuração do App (`config.json`)
Armazenado em `%APPDATA%\global-quick-capture\config.json`.

```json
{
  "vaultPath": "C:\\Users\\seu-usuario\\Documents\\ObsidianVault",
  "attachmentsFolder": "_attachments",
  "projectRoutes": [
    {
      "id": "daily",
      "keyShortcut": "1",
      "label": "Daily Note",
      "targetType": "daily_note",
      "folder": "Daily",
      "filePattern": "YYYY-MM-DD.md"
    },
    {
      "id": "inbox",
      "keyShortcut": "2",
      "label": "Inbox",
      "targetType": "file",
      "filePath": "Inbox.md"
    },
    {
      "id": "qa_bugs",
      "keyShortcut": "3",
      "label": "QA / Bugs",
      "targetType": "folder",
      "folderPath": "Projects/QA/Bugs",
      "customAttachmentsFolder": "Projects/QA/Bugs/assets",
      "defaultTags": ["qa", "bug"]
    },
    {
      "id": "frontend",
      "keyShortcut": "4",
      "label": "Frontend App",
      "targetType": "folder",
      "folderPath": "Projects/FrontendApp",
      "defaultTags": ["frontend", "ui"]
    }
  ],
  "defaultRouteId": "daily",
  "globalShortcut": "CommandOrControl+Shift+S",
  "markdownTemplate": "### {{time}} - {{title}} {{tags}}\n![[{{filename}}]]\n{{#if message}}> **QA / Detalhes**: {{message}}\n{{/if}}\n"
}
```

## 2. Tipos TypeScript Compartilhados

```typescript
export interface ProjectRoute {
  id: string;
  keyShortcut?: string;
  label: string;
  targetType: "daily_note" | "file" | "folder";
  folderPath?: string;
  filePath?: string;
  customAttachmentsFolder?: string;
  defaultTags?: string[];
}

export interface SaveSnippetPayload {
  imageBufferBase64: string;
  title: string;
  message?: string;
  routeId: string;
  customTargetFile?: string;
  tags: string[];
}

export interface VaultNode {
  path: string;
  name: string;
  isFolder: boolean;
  children?: VaultNode[];
}
```
