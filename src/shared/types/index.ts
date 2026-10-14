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

export interface AppConfig {
  vaultPath: string;
  attachmentsFolder: string;
  projectRoutes: ProjectRoute[];
  defaultRouteId: string;
  globalShortcut: string;
  markdownTemplate: string;
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
}

export interface SnipRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

