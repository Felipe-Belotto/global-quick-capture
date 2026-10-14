import React, { useState } from "react";
import { AppConfig, ProjectRoute } from "../types";
import { invoke } from "@tauri-apps/api/core";

interface SettingsModalProps {
  config: AppConfig;
  onClose: () => void;
  onSave: (updated: AppConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ config, onClose, onSave }) => {
  const [vaultPath, setVaultPath] = useState(config.vaultPath);
  const [attachmentsFolder, setAttachmentsFolder] = useState(config.attachmentsFolder);
  const [globalShortcut, setGlobalShortcut] = useState(config.globalShortcut || "Super+Alt+S");
  const [projectRoutes, setProjectRoutes] = useState<ProjectRoute[]>(config.projectRoutes);
  const [newRouteLabel, setNewRouteLabel] = useState("");
  const [newRoutePath, setNewRoutePath] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const rescanFolders = async (targetPath?: string, replaceAll = false) => {
    const path = targetPath || vaultPath;
    if (!path.trim()) return;
    setIsScanning(true);
    try {
      const detected = await invoke<string[]>("scan_vault_folders_cmd", {
        vaultPath: path.trim(),
      });

      const baseRoutes: ProjectRoute[] = [
        {
          id: "daily",
          keyShortcut: "1",
          label: "Daily Note",
          targetType: "daily_note",
          folderPath: "Daily",
        },
        {
          id: "inbox",
          keyShortcut: "2",
          label: "Inbox",
          targetType: "file",
          filePath: "Inbox.md",
        },
      ];

      const currentRoutes = replaceAll ? baseRoutes : [...projectRoutes];
      const existingIds = new Set(currentRoutes.map((r) => r.id));
      const existingFolderPaths = new Set(
        currentRoutes
          .filter((r) => r.targetType === "folder" && r.folderPath)
          .map((r) => r.folderPath!.toLowerCase())
      );

      let shortcutCounter = currentRoutes.length + 1;

      detected.forEach((folder) => {
        const lower = folder.toLowerCase();
        if (
          !lower.includes("daily") &&
          !lower.includes("inbox") &&
          !existingFolderPaths.has(lower)
        ) {
          const id = `route_${folder.replace(/[^a-zA-Z0-9]/g, "_")}`;
          if (!existingIds.has(id)) {
            const name = folder.split("/").pop() || folder;
            const isQA = lower.includes("qa") || lower.includes("bug");
            currentRoutes.push({
              id,
              keyShortcut: shortcutCounter <= 9 ? shortcutCounter.toString() : undefined,
              label: isQA ? `QA / ${name}` : name,
              targetType: "folder",
              folderPath: folder,
              customAttachmentsFolder: isQA ? `${folder}/assets` : undefined,
            });
            existingIds.add(id);
            shortcutCounter++;
          }
        }
      });

      setProjectRoutes(currentRoutes);
    } catch (e) {
      console.error("Erro ao escanear pastas:", e);
    } finally {
      setIsScanning(false);
    }
  };

  const handlePickFolder = async () => {
    try {
      const path = await invoke<string | null>("select_vault_folder");
      if (path && path !== vaultPath) {
        setVaultPath(path);
        // Ao trocar o cofre, limpa as rotas do cofre anterior e detecta as novas
        await rescanFolders(path, true);
      }
    } catch (e) {
      console.error("Erro ao selecionar pasta:", e);
    }
  };

  const handleScanFolders = async () => {
    await rescanFolders(vaultPath, false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updated: AppConfig = {
      ...config,
      vaultPath: vaultPath.trim(),
      attachmentsFolder: attachmentsFolder.trim(),
      globalShortcut: globalShortcut.trim(),
      projectRoutes,
    };

    try {
      await invoke("update_vault_config", { config: updated });
      onSave(updated);
      onClose();
    } catch (e) {
      console.error("Erro ao salvar config:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddRoute = () => {
    if (!newRouteLabel.trim() || !newRoutePath.trim()) return;
    const newRoute: ProjectRoute = {
      id: `project_${Date.now()}`,
      keyShortcut: (projectRoutes.length + 1).toString(),
      label: newRouteLabel.trim(),
      targetType: "folder",
      folderPath: newRoutePath.trim(),
      defaultTags: ["projeto"],
    };
    setProjectRoutes([...projectRoutes, newRoute]);
    setNewRouteLabel("");
    setNewRoutePath("");
  };

  const handleDeleteRoute = (id: string) => {
    setProjectRoutes(projectRoutes.filter((r) => r.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 select-none">
      <div className="w-full max-w-[620px] max-h-[92vh] bg-[#111216] border border-[#232530] rounded-lg shadow-2xl text-[#d4d4d8] flex flex-col font-mono text-xs overflow-hidden">
        
        {/* Header estilo terminal Warp (arrastável) */}
        <div
          data-tauri-drag-region
          className="h-10 px-4 bg-[#0c0d10] border-b border-[#232530] flex items-center justify-between cursor-move rounded-t-lg shrink-0"
        >
          <div data-tauri-drag-region className="flex items-center gap-2 text-[#8e909a]">
            <span className="text-[#2dd4bf]">❯</span>
            <span>quick-capture</span>
            <span className="text-[#525460]">/</span>
            <span className="text-[#d4d4d8]">settings</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-[#ef4444] px-1.5 py-0.5 rounded hover:bg-[#1f222d] transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Formulário com scroll limpo */}
        <div className="p-5 overflow-y-auto flex flex-col gap-4 no-scrollbar">
          {/* Caminho do Vault */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[#8e909a]">vault_path:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={vaultPath}
                onChange={(e) => setVaultPath(e.target.value)}
                placeholder="C:\Users\...\ObsidianVault"
                className="flex-1 bg-[#171821] border border-[#262833] focus:border-[#2dd4bf] rounded px-3 py-2 text-white outline-none"
              />
              <button
                onClick={handlePickFolder}
                className="px-3 py-2 bg-[#20222c] hover:bg-[#282b37] border border-[#323645] text-white rounded transition cursor-pointer"
              >
                procurar...
              </button>
            </div>
          </div>

          {/* Atalho & Anexos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[#8e909a]">attachments_dir:</label>
              <input
                type="text"
                value={attachmentsFolder}
                onChange={(e) => setAttachmentsFolder(e.target.value)}
                placeholder="_attachments"
                className="w-full bg-[#171821] border border-[#262833] focus:border-[#2dd4bf] rounded px-3 py-2 text-white outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[#8e909a]">global_shortcut:</label>
              <input
                type="text"
                value={globalShortcut}
                onChange={(e) => setGlobalShortcut(e.target.value)}
                placeholder="Super+Alt+S"
                className="w-full bg-[#171821] border border-[#262833] focus:border-[#2dd4bf] rounded px-3 py-2 text-white outline-none"
              />
            </div>
          </div>

          {/* Rotas de Projetos */}
          <div className="flex flex-col gap-2 pt-1 border-t border-[#232530]">
            <div className="flex items-center justify-between text-[#8e909a]">
              <span>project_routes:</span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleScanFolders}
                  disabled={isScanning}
                  className="text-[#2dd4bf] hover:underline cursor-pointer"
                  title="Detecta novas pastas sem apagar as existentes"
                >
                  {isScanning ? "escaneando..." : "[ + detectar ]"}
                </button>
                <button
                  type="button"
                  onClick={() => rescanFolders(vaultPath, true)}
                  disabled={isScanning}
                  className="text-[#f59e0b] hover:underline cursor-pointer"
                  title="Limpa as rotas antigas e recria a partir deste cofre"
                >
                  [ ↺ redefinir ]
                </button>
              </div>
            </div>

            <div className="max-h-32 overflow-y-auto flex flex-col gap-1.5 pr-1 no-scrollbar">
              {projectRoutes.map((route, idx) => (
                <div
                  key={route.id}
                  className="flex items-center justify-between bg-[#16171f] border border-[#232530] px-3 py-1.5 rounded text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[#525460]">[{route.keyShortcut || idx + 1}]</span>
                    <span className="text-white truncate">{route.label}</span>
                    <span className="text-[#525460] truncate">
                      ({route.folderPath || route.filePath || "Daily"})
                    </span>
                  </div>
                  {route.id !== "daily" && route.id !== "inbox" && (
                    <button
                      onClick={() => handleDeleteRoute(route.id)}
                      className="text-[#525460] hover:text-[#ef4444] transition cursor-pointer px-1"
                    >
                      [x]
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Adicionar Rota Manual */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newRouteLabel}
                onChange={(e) => setNewRouteLabel(e.target.value)}
                placeholder="nome (ex: QA/Bugs)"
                className="w-1/3 bg-[#171821] border border-[#262833] rounded px-2.5 py-1.5 text-white outline-none"
              />
              <input
                type="text"
                value={newRoutePath}
                onChange={(e) => setNewRoutePath(e.target.value)}
                placeholder="pasta (ex: Projects/QA)"
                className="flex-1 bg-[#171821] border border-[#262833] rounded px-2.5 py-1.5 text-white outline-none"
              />
              <button
                onClick={handleAddRoute}
                className="px-3 py-1.5 bg-[#20222c] hover:bg-[#282b37] border border-[#323645] text-white rounded transition cursor-pointer"
              >
                + add
              </button>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="h-12 px-5 bg-[#0c0d10] border-t border-[#232530] flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[#71717a] hover:text-[#d4d4d8] transition cursor-pointer"
          >
            cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 bg-[#2dd4bf] hover:bg-[#25b5a3] text-[#0c0d10] font-medium rounded transition cursor-pointer"
          >
            salvar ↵
          </button>
        </div>

      </div>
    </div>
  );
};
