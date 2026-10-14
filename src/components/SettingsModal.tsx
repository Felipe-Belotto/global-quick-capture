import React, { useState } from "react";
import { AppConfig, ProjectRoute } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { X, Save, FolderOpen, Plus, Trash2, RefreshCw } from "lucide-react";

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

  const handlePickFolder = async () => {
    try {
      const path = await invoke<string | null>("select_vault_folder");
      if (path) {
        setVaultPath(path);
      }
    } catch (e) {
      console.error("Erro ao selecionar pasta:", e);
    }
  };

  const handleScanFolders = async () => {
    if (!vaultPath.trim()) return;
    setIsScanning(true);
    try {
      const detected = await invoke<string[]>("scan_vault_folders_cmd", { vaultPath: vaultPath.trim() });
      const currentIds = new Set(projectRoutes.map((r) => r.id));
      const newRoutes: ProjectRoute[] = [...projectRoutes];
      let shortcutCounter = projectRoutes.length + 1;

      detected.forEach((folder) => {
        const id = `route_${folder.replace(/[^a-zA-Z0-9]/g, "_")}`;
        if (!currentIds.has(id)) {
          const name = folder.split("/").pop() || folder;
          const isQA = folder.toLowerCase().includes("qa") || folder.toLowerCase().includes("bug");
          newRoutes.push({
            id,
            keyShortcut: shortcutCounter <= 9 ? shortcutCounter.toString() : undefined,
            label: isQA ? `QA / ${name}` : name,
            targetType: "folder",
            folderPath: folder,
            customAttachmentsFolder: isQA ? `${folder}/assets` : undefined,
            defaultTags: isQA ? ["qa", "bug"] : ["projeto"],
          });
          shortcutCounter++;
        }
      });
      setProjectRoutes(newRoutes);
    } catch (e) {
      console.error("Erro ao escanear pastas:", e);
    } finally {
      setIsScanning(false);
    }
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
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-3">
      <div className="w-full max-w-[620px] max-h-[92vh] bg-[#0f1117]/98 border border-white/[0.09] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.85)] p-5 text-zinc-100 flex flex-col gap-4 overflow-y-auto no-scrollbar">
        
        {/* Header estilo Warp */}
        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FolderOpen className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-zinc-100">Configurações do Cofre & Atalhos</h2>
              <p className="text-[11px] text-zinc-400">Gerencie diretórios locais e rotas de envio rápido</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-200 rounded cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Caminho do Vault com Botão de Navegar */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-zinc-300 font-medium">Pasta Raiz do Vault (Obsidian)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={vaultPath}
              onChange={(e) => setVaultPath(e.target.value)}
              placeholder="Ex: C:\Users\nome\Documents\MeuCofre"
              className="flex-1 bg-zinc-900/90 border border-white/[0.08] focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none font-mono"
            />
            <button
              onClick={handlePickFolder}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 shrink-0 transition cursor-pointer"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Procurar...</span>
            </button>
          </div>
        </div>

        {/* Atalho Global & Pasta de Anexos */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-zinc-300 font-medium">Pasta de Anexos</label>
            <input
              type="text"
              value={attachmentsFolder}
              onChange={(e) => setAttachmentsFolder(e.target.value)}
              placeholder="_attachments"
              className="w-full bg-zinc-900/90 border border-white/[0.08] focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none font-mono"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-zinc-300 font-medium">Atalho de Captura</label>
            <input
              type="text"
              value={globalShortcut}
              onChange={(e) => setGlobalShortcut(e.target.value)}
              placeholder="Super+Alt+S"
              className="w-full bg-zinc-900/90 border border-white/[0.08] focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none font-mono"
            />
          </div>
        </div>

        {/* Gerenciar Rotas de Projetos */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-zinc-300 font-medium">Rotas de Projetos Cadastradas</label>
            <button
              onClick={handleScanFolders}
              disabled={isScanning}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer font-medium"
            >
              <RefreshCw className={`w-3 h-3 ${isScanning ? "animate-spin" : ""}`} />
              <span>Detectar Novas Pastas</span>
            </button>
          </div>
          
          <div className="max-h-32 overflow-y-auto flex flex-col gap-1.5 pr-1 no-scrollbar">
            {projectRoutes.map((route, idx) => (
              <div key={route.id} className="flex items-center justify-between bg-zinc-900/70 border border-white/[0.06] px-2.5 py-1.5 rounded-lg text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-mono text-zinc-500 text-[10px]">[{route.keyShortcut || idx + 1}]</span>
                  <span className="font-medium text-zinc-200 truncate">{route.label}</span>
                  <span className="text-[10px] text-zinc-500 font-mono truncate">({route.folderPath || route.filePath || "Daily"})</span>
                </div>
                {route.id !== "daily" && route.id !== "inbox" && (
                  <button
                    onClick={() => handleDeleteRoute(route.id)}
                    className="text-zinc-600 hover:text-rose-400 transition p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
              placeholder="Rótulo (ex: QA/Bugs)"
              className="w-1/3 bg-zinc-900/90 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
            />
            <input
              type="text"
              value={newRoutePath}
              onChange={(e) => setNewRoutePath(e.target.value)}
              placeholder="Pasta (ex: Projects/QA)"
              className="flex-1 bg-zinc-900/90 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none font-mono"
            />
            <button
              onClick={handleAddRoute}
              className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.08]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar</span>
          </button>
        </div>

      </div>
    </div>
  );
};
