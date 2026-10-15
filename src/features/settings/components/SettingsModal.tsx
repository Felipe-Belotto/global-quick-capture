import React, { useState } from "react";
import { AppConfig, ProjectRoute } from "../../../shared/types";
import { invoke } from "@tauri-apps/api/core";
import { useDraggableWindow } from "../../../shared/hooks/useDraggableWindow";
import { DragHandle } from "../../../shared/components/DragHandle";
import { X, FolderOpen, RefreshCw, Sparkles, Plus, Trash2, Check, RefreshCcw } from "lucide-react";

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

  const { onMouseDown: handleDrag } = useDraggableWindow();

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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 select-none">
      <div className="w-full max-w-[620px] max-h-[92vh] bg-[#111317] border border-[#282d37] rounded-md shadow-2xl text-[#f5f5f7] flex flex-col font-mono text-xs overflow-hidden">
        {/* Header estilo terminal editorial */}
        <div
          data-tauri-drag-region
          onMouseDown={handleDrag}
          className="h-10 px-3 bg-[#16181d] border-b border-[#282d37] flex items-center justify-between cursor-grab active:cursor-grabbing shrink-0 select-none"
        >
          <div className="flex items-center gap-2 text-[#86868b]">
            <DragHandle />
            <span className="text-[#ff4d4d] font-black text-sm select-none">❯</span>
            <span className="text-[#f5f5f7] font-semibold">qcap</span>
            <span className="text-[#363d4a]">/</span>
            <span className="text-[#86868b]">settings</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#86868b] hover:text-[#f5f5f7] p-1 rounded-md hover:bg-[#1e222a] transition cursor-pointer"
            title="Fechar"
          >
            <X size={14} />
          </button>
        </div>

        {/* Formulário com scroll limpo */}
        <div className="p-5 overflow-y-auto flex flex-col gap-4 no-scrollbar">
          {/* Caminho do Vault */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[#86868b]">vault_path (Cofre Obsidian / Google Drive):</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={vaultPath}
                onChange={(e) => setVaultPath(e.target.value)}
                placeholder="C:\Users\...\ObsidianVault ou G:\Meu Drive\Obsidian"
                className="flex-1 bg-[#16181d] border border-[#282d37] focus:border-[#ff4d4d]/60 rounded-md px-3 py-2 text-[#f5f5f7] outline-none transition"
              />
              <button
                onClick={handlePickFolder}
                className="px-3 py-2 bg-[#1e222a] hover:bg-[#262b35] border border-[#282d37] text-[#f5f5f7] rounded-md transition cursor-pointer flex items-center gap-1.5"
              >
                <FolderOpen size={13} className="text-[#ff4d4d]" />
                <span>procurar...</span>
              </button>
            </div>
          </div>

          {/* Atalho & Anexos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[#86868b]">attachments_dir:</label>
              <input
                type="text"
                value={attachmentsFolder}
                onChange={(e) => setAttachmentsFolder(e.target.value)}
                placeholder="_attachments"
                className="w-full bg-[#16181d] border border-[#282d37] focus:border-[#ff4d4d]/60 rounded-md px-3 py-2 text-[#f5f5f7] outline-none transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[#86868b]">global_shortcut:</label>
              <input
                type="text"
                value={globalShortcut}
                onChange={(e) => setGlobalShortcut(e.target.value)}
                placeholder="Super+Alt+S"
                className="w-full bg-[#16181d] border border-[#282d37] focus:border-[#ff4d4d]/60 rounded-md px-3 py-2 text-[#f5f5f7] outline-none transition"
              />
            </div>
          </div>

          {/* Rotas de Projetos */}
          <div className="flex flex-col gap-2 pt-1 border-t border-[#282d37]">
            <div className="flex items-center justify-between text-[#86868b]">
              <span>project_routes:</span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleScanFolders}
                  disabled={isScanning}
                  className="text-[#86868b] hover:text-[#f5f5f7] flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                  title="Detecta novas pastas sem apagar as existentes"
                >
                  <Sparkles size={12} className="text-[#ff4d4d]" />
                  <span>{isScanning ? "escaneando..." : "detectar"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => rescanFolders(vaultPath, true)}
                  disabled={isScanning}
                  className="text-[#86868b] hover:text-[#f5f5f7] flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                  title="Limpa as rotas antigas e recria a partir deste cofre"
                >
                  <RefreshCcw size={11} />
                  <span>redefinir</span>
                </button>
              </div>
            </div>

            <div className="max-h-36 overflow-y-auto flex flex-col gap-1.5 pr-1 no-scrollbar">
              {projectRoutes.map((route, idx) => (
                <div
                  key={route.id}
                  className="flex items-center justify-between bg-[#16181d] border border-[#282d37] px-3 py-1.5 rounded-md text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[#585e6a] font-mono">[{route.keyShortcut || idx + 1}]</span>
                    <span className="text-[#f5f5f7] truncate">{route.label}</span>
                    <span className="text-[#585e6a] truncate">
                      ({route.folderPath || route.filePath || "Daily"})
                    </span>
                  </div>
                  {route.id !== "daily" && route.id !== "inbox" && (
                    <button
                      onClick={() => handleDeleteRoute(route.id)}
                      className="text-[#585e6a] hover:text-[#ff4d4d] transition cursor-pointer p-0.5 rounded"
                      title="Remover rota"
                    >
                      <Trash2 size={12} />
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
                className="w-1/3 bg-[#16181d] border border-[#282d37] rounded-md px-2.5 py-1.5 text-[#f5f5f7] outline-none"
              />
              <input
                type="text"
                value={newRoutePath}
                onChange={(e) => setNewRoutePath(e.target.value)}
                placeholder="pasta (ex: Projects/QA)"
                className="flex-1 bg-[#16181d] border border-[#282d37] rounded-md px-2.5 py-1.5 text-[#f5f5f7] outline-none"
              />
              <button
                onClick={handleAddRoute}
                className="px-3 py-1.5 bg-[#1e222a] hover:bg-[#262b35] border border-[#282d37] text-[#f5f5f7] rounded-md transition cursor-pointer flex items-center gap-1"
              >
                <Plus size={12} />
                <span>add</span>
              </button>
            </div>
          </div>

          {/* Versão e Verificação de Atualizações */}
          <div className="pt-3 border-t border-[#282d37] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#86868b]">versão_instalada:</span>
              <span className="text-[#f5f5f7] font-mono bg-[#16181d] px-2 py-0.5 rounded-md border border-[#282d37]">
                v0.1.4
              </span>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  await invoke("show_about_window");
                } catch {
                  window.open("https://github.com/felipe-belotto/global-quick-capture/releases", "_blank");
                }
              }}
              className="text-[#86868b] hover:text-[#ff4d4d] cursor-pointer flex items-center gap-1.5 transition"
            >
              <RefreshCw size={12} />
              <span>verificar atualizações & status</span>
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <div className="h-12 px-5 bg-[#16181d] border-t border-[#282d37] flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[#86868b] hover:text-[#f5f5f7] rounded-md transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 bg-[#16181d] border border-[#282d37] hover:bg-white/10 hover:border-white/25 text-[#f5f5f7] font-medium text-xs rounded-md transition cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
          >
            <Check size={13} />
            <span>Salvar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
