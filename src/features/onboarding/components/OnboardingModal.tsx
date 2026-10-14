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
      <div className="w-full max-w-[640px] bg-[#211d1a] border border-[#3f3a36] rounded-[4px] shadow-2xl text-[#dad2c1] flex flex-col font-sans">
        {/* Header estilo terminal Warp (arrastável nativo) */}
        <div
          data-tauri-drag-region
          onMouseDown={handleDrag}
          className="h-10 px-3 bg-[#262320] border-b border-[#383330] flex items-center justify-between cursor-grab active:cursor-grabbing rounded-t-[4px] select-none"
        >
          <div className="flex items-center gap-2 font-mono text-xs text-[#aea69c]">
            <DragHandle />
            <span className="text-[#dad2c1] font-semibold">❯</span>
            <span>quick-capture</span>
            <span className="text-[#5c544d]">/</span>
            <span className="text-[#f7f5f0] font-medium">setup</span>
          </div>

          <div className="flex items-center gap-1.5 opacity-60">
            <span className="w-2.5 h-2.5 rounded-full bg-[#383330]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#383330]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#f7f5f0]" />
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-5 flex flex-col gap-5">
          {step === "pick" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs text-[#aea69c]">01 // SELECT_VAULT</span>
                <h2 className="text-sm font-medium text-[#f7f5f0] tracking-tight">
                  Selecione o diretório do seu Cofre do Obsidian (Local ou Google Drive)
                </h2>
                <p className="text-xs text-[#aea69c] leading-relaxed">
                  O aplicativo salvará as imagens e fará o append das notas diretamente no cofre selecionado.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={vaultPath || "Nenhum diretório selecionado..."}
                  className="flex-1 bg-[#1a1715] border border-[#383330] rounded-[3px] px-3 py-2 text-xs font-mono text-[#dad2c1] outline-none"
                />
                <button
                  onClick={handlePickFolder}
                  disabled={isScanning}
                  className="px-4 py-2 bg-[#2b2622] hover:bg-[#383330] active:bg-[#1a1715] border border-[#3f3a36] text-[#f7f5f0] rounded-[3px] text-xs font-mono transition cursor-pointer flex items-center gap-1.5"
                >
                  <FolderOpen size={13} className="text-[#dad2c1]" />
                  <span>{isScanning ? "Escaneando..." : "Procurar..."}</span>
                </button>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs text-[#aea69c]">02 // DETECTED_FOLDERS</span>
                <h2 className="text-sm font-medium text-[#f7f5f0] tracking-tight">
                  Pastas identificadas no cofre
                </h2>
                <p className="text-xs text-[#aea69c]">
                  Selecione quais pastas devem virar rotas de atalho rápido (
                  <kbd className="font-mono text-[10px] text-[#dad2c1]">1</kbd>-
                  <kbd className="font-mono text-[10px] text-[#dad2c1]">9</kbd>).
                </p>
              </div>

              <div className="flex items-center justify-between px-3 py-2 bg-[#1a1715] border border-[#383330] rounded-[3px] text-xs font-mono text-[#dad2c1]">
                <span className="truncate max-w-[460px]">{vaultPath}</span>
                <button
                  onClick={handlePickFolder}
                  className="text-xs text-[#dad2c1] hover:text-[#f7f5f0] hover:underline ml-2 cursor-pointer"
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
                        className={`px-3 py-2.5 rounded-[3px] border text-left text-xs font-mono transition cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "bg-[#2b2622] border-[#3f3a36] text-[#f7f5f0]"
                            : "bg-[#262320] border-[#383330] text-[#aea69c] hover:text-[#dad2c1] hover:border-[#3f3a36]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Folder size={12} className={isSelected ? "text-[#f7f5f0]" : "text-[#877e74]"} />
                          <span className="truncate">{folder}/</span>
                        </div>
                        {isSelected && <Check size={12} className="text-[#f7f5f0] shrink-0" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-2 py-4 text-center text-xs font-mono text-[#877e74]">
                    Nenhuma subpasta encontrada. Usando Daily Note e Inbox como padrão.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#383330] text-xs font-mono text-[#aea69c]">
                <span>
                  Atalho global padrão: <span className="text-[#f7f5f0]">Win + Alt + S</span>
                </span>
                <button
                  onClick={handleFinish}
                  className="px-4 py-2 bg-[#f7f5f0] hover:bg-white text-[#211d1a] font-medium text-xs rounded-[3px] transition cursor-pointer flex items-center gap-1.5"
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
