export interface SystemAppInfo {
  version: string;
  name: string;
  tauri_version: string;
  os: string;
  arch: string;
  vault_path: string;
  global_shortcut: string;
  default_route_id: string;
  routes_count: number;
}

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

export interface ReleaseInfo {
  tagName: string;
  name: string;
  body: string;
  publishedAt: string;
  htmlUrl: string;
  downloadUrl?: string;
  downloadSize?: number;
  assets: ReleaseAsset[];
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  release?: ReleaseInfo;
  checkedAt: string;
  isSimulated?: boolean;
  errorMessage?: string;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'update-available'
  | 'downloading'
  | 'downloaded'
  | 'error';
