import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppConfig, ProjectRoute } from "../types";

interface OnboardingModalProps {
  onComplete: (config: AppConfig) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [vaultPath, setVaultPath] = useState<string>("");
  const [detectedFolders, setDetectedFolders] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [step, setStep] = useState<"pick" | "review">("pick");

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
      markdownTemplate: "### {{time}} - {{title}} {{tags}}\n![[{{filename}}]]\n{{#if message}}> **QA / Detalhes**: {{message}}\n{{/if}}\n",
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
      <div className="w-full max-w-[640px] bg-[#111216] border border-[#232530] rounded-lg shadow-2xl text-[#d4d4d8] flex flex-col font-sans">
        
        {/* Header estilo terminal Warp (arrastável) */}
        <div
          data-tauri-drag-region
          className="h-10 px-4 bg-[#0c0d10] border-b border-[#232530] flex items-center justify-between cursor-move rounded-t-lg"
        >
          <div data-tauri-drag-region className="flex items-center gap-2 font-mono text-xs text-[#8e909a]">
            <span className="text-[#2dd4bf]">❯</span>
            <span>quick-capture</span>
            <span className="text-[#525460]">/</span>
            <span className="text-[#d4d4d8]">setup</span>
          </div>

          <div data-tauri-drag-region className="flex items-center gap-1.5 opacity-60">
            <span className="w-2.5 h-2.5 rounded-full bg-[#262833]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#262833]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#2dd4bf]" />
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-5 flex flex-col gap-5">
          {step === "pick" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs text-[#2dd4bf]">01 // SELECT_VAULT</span>
                <h2 className="text-sm font-medium text-white tracking-tight">
                  Selecione o diretório do seu Cofre do Obsidian
                </h2>
                <p className="text-xs text-[#8e909a] leading-relaxed">
                  O aplicativo salvará as imagens e fará o append das notas diretamente no sistema de arquivos local.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={vaultPath || "Nenhum diretório selecionado..."}
                  className="flex-1 bg-[#171821] border border-[#262833] rounded px-3 py-2 text-xs font-mono text-[#a1a1aa] outline-none"
                />
                <button
                  onClick={handlePickFolder}
                  disabled={isScanning}
                  className="px-4 py-2 bg-[#20222c] hover:bg-[#282b37] active:bg-[#1a1c24] border border-[#323645] text-white rounded text-xs font-mono transition cursor-pointer"
                >
                  {isScanning ? "Escaneando..." : "Procurar..."}
                </button>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs text-[#2dd4bf]">02 // DETECTED_FOLDERS</span>
                <h2 className="text-sm font-medium text-white tracking-tight">
                  Pastas identificadas no cofre
                </h2>
                <p className="text-xs text-[#8e909a]">
                  Selecione quais pastas devem virar rotas de atalho rápido (<kbd className="font-mono text-[10px] text-zinc-300">1</kbd>-<kbd className="font-mono text-[10px] text-zinc-300">9</kbd>).
                </p>
              </div>

              <div className="flex items-center justify-between px-3 py-2 bg-[#171821] border border-[#262833] rounded text-xs font-mono text-[#a1a1aa]">
                <span className="truncate max-w-[460px]">{vaultPath}</span>
                <button
                  onClick={handlePickFolder}
                  className="text-xs text-[#2dd4bf] hover:underline ml-2 cursor-pointer"
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
                        className={`px-3 py-2.5 rounded border text-left text-xs font-mono transition cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? "bg-[#172228] border-[#2dd4bf]/40 text-[#e4e4e7]"
                            : "bg-[#16171f] border-[#232530] text-[#71717a] hover:text-[#a1a1aa] hover:border-[#2f3242]"
                        }`}
                      >
                        <span className="truncate">{folder}/</span>
                        <span className={`text-[10px] ${isSelected ? "text-[#2dd4bf]" : "text-transparent"}`}>
                          [x]
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-2 py-4 text-center text-xs font-mono text-[#71717a]">
                    Nenhuma subpasta encontrada. Usando Daily Note e Inbox como padrão.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#232530] text-xs font-mono text-[#71717a]">
                <span>Atalho global padrão: <span className="text-[#d4d4d8]">Win + Alt + S</span></span>
                <button
                  onClick={handleFinish}
                  className="px-4 py-2 bg-[#2dd4bf] hover:bg-[#25b5a3] text-[#0c0d10] font-medium text-xs rounded transition cursor-pointer"
                >
                  Salvar e Continuar ↵
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
