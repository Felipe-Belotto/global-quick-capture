import { invoke } from "@tauri-apps/api/core";
import { openUrl as openWithOpener } from "@tauri-apps/plugin-opener";
import { ReleaseAsset, ReleaseInfo, SystemAppInfo, UpdateCheckResult } from "../types";

const DEFAULT_REPO = "Felipe-Belotto/global-quick-capture";

/**
 * Obtém informações do sistema e do aplicativo a partir do backend Rust
 */
export async function fetchSystemAppInfo(): Promise<SystemAppInfo> {
  try {
    return await invoke<SystemAppInfo>("get_system_app_info");
  } catch (error) {
    console.warn("Falha ao invocar get_system_app_info, usando fallback:", error);
    return {
      version: "0.1.3",
      name: "Global Quick Capture",
      tauri_version: "2.12.3",
      os: "windows",
      arch: "x86_64",
      vault_path: "C:\\Users\\User\\ObsidianVault",
      global_shortcut: "Super+Alt+S",
      default_route_id: "daily",
      routes_count: 2,
    };
  }
}

/**
 * Compara duas versões semver (ex: "v0.1.3" vs "v0.1.4").
 * Retorna > 0 se remote for maior que current (há atualização).
 * Retorna 0 se forem iguais.
 * Retorna < 0 se current for maior que remote.
 */
export function compareSemver(current: string, remote: string): number {
  const clean = (v: string) => v.replace(/^v/i, "").trim();
  const cParts = clean(current).split(".").map((n) => parseInt(n, 10) || 0);
  const rParts = clean(remote).split(".").map((n) => parseInt(n, 10) || 0);

  const maxLen = Math.max(cParts.length, rParts.length);
  for (let i = 0; i < maxLen; i++) {
    const c = cParts[i] ?? 0;
    const r = rParts[i] ?? 0;
    if (r > c) return 1;
    if (r < c) return -1;
  }
  return 0;
}

/**
 * Formata bytes legíveis (KB / MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Abre URL no navegador padrão do sistema
 */
export async function openExternalLink(url: string): Promise<void> {
  try {
    await openWithOpener(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Checa por atualizações no repositório GitHub
 */
export async function checkForUpdates(
  currentVersion: string,
  options?: { repo?: string; simulate?: boolean }
): Promise<UpdateCheckResult> {
  const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  if (options?.simulate) {
    const simulatedRelease: ReleaseInfo = {
      tagName: "v0.1.4",
      name: "Global Quick Capture v0.1.4 — Atualizações Automáticas & Histórico",
      publishedAt: new Date().toISOString(),
      htmlUrl: `https://github.com/${options.repo || DEFAULT_REPO}/releases/tag/v0.1.4`,
      body: `### O que há de novo na v0.1.4:\n\n- ✨ **Central de Atualizações pela UI**: Verificação de novas versões direto na barra de tarefas.\n- 📋 **Interface do Dispositivo / Tray**: Painel de status ao clicar no ícone do sistema.\n- 🚀 **Smart Positioning refinado**: Janela posicionada dinamicamente com suporte a multi-monitores.\n- ⚡ **Desempenho Otimizado**: Inicialização instantânea do snipping overlay.`,
      assets: [
        {
          name: "Global-Quick-Capture_0.1.4_x64-setup.exe",
          browser_download_url: `https://github.com/${options.repo || DEFAULT_REPO}/releases/download/v0.1.4/installer.exe`,
          size: 14500000,
          content_type: "application/vnd.microsoft.portable-executable",
        },
      ],
      downloadUrl: `https://github.com/${options.repo || DEFAULT_REPO}/releases/download/v0.1.4/installer.exe`,
      downloadSize: 14500000,
    };

    return {
      hasUpdate: true,
      currentVersion,
      latestVersion: "v0.1.4",
      release: simulatedRelease,
      checkedAt: now,
      isSimulated: true,
    };
  }

  const repo = options?.repo || DEFAULT_REPO;
  const endpoint = `https://api.github.com/repos/${repo}/releases/latest`;

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (response.status === 404) {
      // Repositório ainda não tem releases publicadas
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion.startsWith("v") ? currentVersion : `v${currentVersion}`,
        checkedAt: now,
        errorMessage: "Nenhuma release publicada no repositório ainda. Você está na compilação mais recente.",
      };
    }

    if (!response.ok) {
      throw new Error(`GitHub API retornou status HTTP ${response.status}`);
    }

    const data = await response.json();
    const tagName = data.tag_name || "";
    const hasUpdate = compareSemver(currentVersion, tagName) > 0;

    // Procura executável do Windows nos assets (.exe, .msi)
    const assets: ReleaseAsset[] = Array.isArray(data.assets)
      ? data.assets.map((a: any) => ({
          name: a.name,
          browser_download_url: a.browser_download_url,
          size: a.size,
          content_type: a.content_type,
        }))
      : [];

    const installerAsset = assets.find((a) =>
      a.name.toLowerCase().endsWith(".exe") || a.name.toLowerCase().endsWith(".msi")
    );

    const release: ReleaseInfo = {
      tagName,
      name: data.name || tagName,
      body: data.body || "Sem notas de lançamento disponíveis.",
      publishedAt: data.published_at || new Date().toISOString(),
      htmlUrl: data.html_url || `https://github.com/${repo}/releases`,
      downloadUrl: installerAsset?.browser_download_url || data.html_url,
      downloadSize: installerAsset?.size,
      assets,
    };

    return {
      hasUpdate,
      currentVersion,
      latestVersion: tagName,
      release,
      checkedAt: now,
    };
  } catch (error: any) {
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      checkedAt: now,
      errorMessage: error?.message || "Erro desconhecido ao consultar atualizações.",
    };
  }
}
