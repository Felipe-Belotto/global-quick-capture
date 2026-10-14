import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppConfig, ProjectRoute } from "../types";
import { FolderOpen, Sparkles, CheckCircle2, ArrowRight, ShieldCheck, Tag } from "lucide-react";

interface OnboardingModalProps {
  onComplete: (config: AppConfig) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [vaultPath, setVaultPath] = useState<string>("");
  const [detectedFolders, setDetectedFolders] = useState<string[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [step, setStep] = useState<"pick" | "review">("pick");

  // Escanear pastas quando o caminho for escolhido
  const scanFolders = async (path: string) => {
    setIsScanning(true);
    try {
      const folders = await invoke<string[]>("scan_vault_folders_cmd", { vaultPath: path });
      setDetectedFolders(folders);
      // Seleciona automaticamente pastas comuns como Daily, Inbox, Projects, QA
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
    // Montar rotas de projetos com base nas pastas selecionadas
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
      <div className="w-full max-w-[620px] bg-[#0f1117]/96 backdrop-blur-2xl border border-white/[0.09] rounded-2xl shadow-[0_30px_70px_rgba(0,0,0,0.85)] p-6 text-zinc-100 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header estilo Warp Terminal */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-wide text-zinc-100 flex items-center gap-2">
                <span>Configurar Cofre do Obsidian</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                  Setup
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                Conecte seu diretório local para escanear e rotear projetos instantaneamente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-700/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 animate-pulse" />
          </div>
        </div>

        {/* Passo 1: Selecionar Pasta do Cofre */}
        {step === "pick" && (
          <div className="flex flex-col gap-4 py-2">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/[0.06] flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shrink-0">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-200">Onde fica o seu Cofre?</h3>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                    Clique no botão abaixo para abrir a janela nativa do Windows e apontar para a pasta raiz do seu Obsidian.
                  </p>
                </div>
              </div>

              <button
                onClick={handlePickFolder}
                disabled={isScanning}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <FolderOpen className="w-4 h-4" />
                <span>{isScanning ? "Escaneando pastas..." : "Escolher Pasta do Cofre..."}</span>
              </button>
            </div>

            <div className="text-[11px] text-zinc-500 text-center">
              Acesso 100% local direto no disco • Zero plugins do Obsidian necessários
            </div>
          </div>
        )}

        {/* Passo 2: Pastas Detectadas & Revisão */}
        {step === "review" && (
          <div className="flex flex-col gap-4 py-1">
            {/* Caminho Selecionado */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900/80 border border-white/[0.08] text-xs">
              <div className="flex items-center gap-2 truncate max-w-[420px]">
                <FolderOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-mono text-zinc-300 text-[11px] truncate">{vaultPath}</span>
              </div>
              <button
                onClick={handlePickFolder}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium ml-2 cursor-pointer"
              >
                Alterar
              </button>
            </div>

            {/* Pastas Identificadas */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  Pastas Identificadas ({detectedFolders.length}):
                </span>
                <span className="text-[11px] text-zinc-500">
                  Selecione as que deseja transformar em atalho
                </span>
              </div>

              <div className="max-h-44 overflow-y-auto grid grid-cols-2 gap-2 p-1 no-scrollbar">
                {detectedFolders.length > 0 ? (
                  detectedFolders.map((folder) => {
                    const selected = selectedFolders.includes(folder);
                    return (
                      <button
                        key={folder}
                        onClick={() => toggleFolder(folder)}
                        className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                          selected
                            ? "bg-indigo-600/20 border-indigo-500/40 text-zinc-100 shadow-sm"
                            : "bg-zinc-900/40 border-white/[0.05] text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                        }`}
                      >
                        <div className="truncate">
                          <span className="text-xs font-mono font-medium block truncate">
                            {folder}
                          </span>
                        </div>
                        {selected && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-2 text-center text-xs text-zinc-500 py-4">
                    Nenhuma subpasta encontrada. Usaremos Daily Note e Inbox como padrão.
                  </div>
                )}
              </div>
            </div>

            {/* Atalho Padrão Informativo */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900/40 border border-white/[0.05] text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                <span>Atalho de captura:</span>
              </div>
              <kbd className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-200 border border-zinc-700 font-mono text-[11px]">
                Win + Alt + S
              </kbd>
            </div>

            {/* Botão de Finalização */}
            <button
              onClick={handleFinish}
              className="w-full mt-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <span>Concluir e Começar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
