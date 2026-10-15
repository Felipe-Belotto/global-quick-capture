import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppConfig, ProjectRoute } from "../../../shared/types";
import { useDraggableWindow } from "../../../shared/hooks/useDraggableWindow";
import { DragHandle } from "../../../shared/components/DragHandle";
import { FolderOpen, Check, Folder } from "lucide-react";

interface OnboardingModalProps {
  onComplete: (config: AppConfig) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [vaultPath, setVaultPath] = useState<string>("");
  const [detectedFolders, setDetectedFolders] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [step, setStep] = useState<"pick" | "review">("pick");

  const { onMouseDown: handleDrag } = useDraggableWindow();

  const scanFolders = async (path: string) => {
    setIsScanning(true);
    try {
      const folders = await invoke<string[]>("scan_vault_folders_cmd", { vaultPath: path });
      setDetectedFolders(folders);
      const autoSelected = folders.filter((f) => {
        const lower = f.toLowerCase();
        return (
          lower.includes("daily") ||
          lower.includes("inbox") ||
          lower.includes("qa") ||
          lower.includes("bug") ||
          lower.includes("proj")
        );
      });
      setSelectedFolders(autoSelected.length > 0 ? autoSelected : folders.slice(0, 4));
      setStep("review");
    } catch (e) {
      console.error("Erro ao escanear cofre:", e);
    } finally {
      setIsScanning(false);
    }
  };

  const handlePickFolder = async () => {
    try {
      const path = await invoke<string | null>("select_vault_folder");
      if (path) {
        setVaultPath(path);
        await scanFolders(path);
      }
    } catch (e) {
      console.error("Erro ao selecionar pasta:", e);
    }
  };

  const toggleFolder = (folder: string) => {
    setSelectedFolders((prev) =>
      prev.includes(folder) ? prev.filter((f) => f !== folder) : [...prev, folder]
    );
  };

  const handleFinish = async () => {
    const routes: ProjectRoute[] = [
      {
        id: "daily",
        keyShortcut: "1",
        label: "Daily Note",
        targetType: "daily_note",
        folderPath: "Daily",
        defaultTags: ["daily"],
      },
      {
        id: "inbox",
        keyShortcut: "2",
        label: "Inbox",
        targetType: "file",
        filePath: "Inbox.md",
        defaultTags: ["inbox"],
      },
    ];

    let shortcutCounter = 3;
    selectedFolders.forEach((folder) => {
      const lower = folder.toLowerCase();
      if (!lower.includes("daily") && !lower.includes("inbox")) {
        const name = folder.split("/").pop() || folder;
        const isQA = lower.includes("qa") || lower.includes("bug");
        routes.push({
          id: `route_${folder.replace(/[^a-zA-Z0-9]/g, "_")}`,
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

    const newConfig: AppConfig = {
      vaultPath: vaultPath.trim(),
      attachmentsFolder: "_attachments",
      projectRoutes: routes,
      defaultRouteId: "daily",
      globalShortcut: "Super+Alt+S",
      markdownTemplate:
        "### {{time}} - {{title}} {{tags}}\n![[{{filename}}]]\n{{#if message}}> **QA / Detalhes**: {{message}}\n{{/if}}\n",
    };

    try {
      await invoke("update_vault_config", { config: newConfig });
      onComplete(newConfig);
    } catch (e) {
      console.error("Erro ao gravar config do onboarding:", e);
    }
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-[640px] bg-[#111317] border border-[#282d37] rounded-md shadow-2xl text-[#f5f5f7] flex flex-col font-sans">
        {/* Header estilo terminal editorial */}
        <div
          data-tauri-drag-region
          onMouseDown={handleDrag}
          className="h-10 px-3 bg-[#16181d] border-b border-[#282d37] flex items-center justify-between cursor-grab active:cursor-grabbing rounded-t-md select-none"
        >
          <div className="flex items-center gap-2 font-mono text-xs text-[#86868b]">
            <DragHandle />
            <span className="text-[#ff4d4d] font-black text-sm select-none">❯</span>
            <span className="text-[#f5f5f7] font-semibold">qcap</span>
            <span className="text-[#363d4a]">/</span>
            <span className="text-[#86868b]">setup</span>
          </div>

          <div className="flex items-center gap-1.5 opacity-60">
            <span className="w-2 h-2 rounded-full bg-[#282d37]" />
            <span className="w-2 h-2 rounded-full bg-[#282d37]" />
            <span className="w-2 h-2 rounded-full bg-[#ff4d4d]" />
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-5 flex flex-col gap-5">
          {step === "pick" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs text-[#ff4d4d]">01 // SELECT_VAULT</span>
                <h2 className="text-sm font-medium text-[#f5f5f7] tracking-tight">
                  Selecione o diretório do seu Cofre do Obsidian (Local ou Google Drive)
                </h2>
                <p className="text-xs text-[#86868b] leading-relaxed">
                  O aplicativo salvará as imagens e fará o append das notas diretamente no cofre selecionado.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={vaultPath || "Nenhum diretório selecionado..."}
                  className="flex-1 bg-[#16181d] border border-[#282d37] rounded-md px-3 py-2 text-xs font-mono text-[#f5f5f7] outline-none"
                />
                <button
                  onClick={handlePickFolder}
                  disabled={isScanning}
                  className="px-4 py-2 bg-[#1e222a] hover:bg-[#262b35] active:bg-[#16181d] border border-[#282d37] text-[#f5f5f7] rounded-md text-xs font-mono transition cursor-pointer flex items-center gap-1.5"
                >
                  <FolderOpen size={13} className="text-[#ff4d4d]" />
                  <span>{isScanning ? "Escaneando..." : "Procurar..."}</span>
                </button>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs text-[#ff4d4d]">02 // DETECTED_FOLDERS</span>
                <h2 className="text-sm font-medium text-[#f5f5f7] tracking-tight">
                  Pastas identificadas no cofre
                </h2>
                <p className="text-xs text-[#86868b]">
                  Selecione quais pastas devem virar rotas de atalho rápido (
                  <kbd className="font-mono text-[10px] text-[#f5f5f7]">1</kbd>-
                  <kbd className="font-mono text-[10px] text-[#f5f5f7]">9</kbd>).
                </p>
              </div>

              <div className="flex items-center justify-between px-3 py-2 bg-[#16181d] border border-[#282d37] rounded-md text-xs font-mono text-[#f5f5f7]">
                <span className="truncate max-w-[460px]">{vaultPath}</span>
                <button
                  onClick={handlePickFolder}
                  className="text-xs text-[#86868b] hover:text-[#ff4d4d] hover:underline ml-2 cursor-pointer"
                >
                  alterar
                </button>
              </div>

              <div className="max-h-44 overflow-y-auto grid grid-cols-2 gap-2 pr-1 no-scrollbar">
                {detectedFolders.length > 0 ? (
                  detectedFolders.map((folder) => {
                    const isSelected = selectedFolders.includes(folder);
                    return (
                      <button
                        key={folder}
                        onClick={() => toggleFolder(folder)}
                        className={`px-3 py-2.5 rounded-md border text-left text-xs font-mono transition cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "bg-[#ff4d4d]/10 border-[#ff4d4d]/40 text-[#f5f5f7]"
                            : "bg-[#16181d] border-[#282d37] text-[#86868b] hover:text-[#f5f5f7] hover:border-[#363d4a]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Folder size={12} className={isSelected ? "text-[#ff4d4d]" : "text-[#585e6a]"} />
                          <span className="truncate">{folder}/</span>
                        </div>
                        {isSelected && <Check size={12} className="text-[#ff4d4d] shrink-0" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-2 py-4 text-center text-xs font-mono text-[#585e6a]">
                    Nenhuma subpasta encontrada. Usando Daily Note e Inbox como padrão.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#282d37] text-xs font-mono text-[#86868b]">
                <span>
                  Atalho global padrão: <span className="text-[#f5f5f7]">Win + Alt + S</span>
                </span>
                <button
                  onClick={handleFinish}
                  className="px-4 py-2 bg-[#16181d] border border-[#282d37] hover:bg-white/10 hover:border-white/25 text-[#f5f5f7] font-medium text-xs rounded-md transition cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
                >
                  <Check size={13} />
                  <span>Salvar e Continuar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
