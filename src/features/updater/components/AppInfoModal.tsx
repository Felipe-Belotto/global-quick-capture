import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Terminal,
  RefreshCw,
  Check,
  AlertCircle,
  Sparkles,
  Camera,
  Settings,
  ExternalLink,
  X,
  Cpu,
  Keyboard,
  Folder,
} from "lucide-react";
import { DragHandle } from "../../../shared/components/DragHandle";
import { useDraggableWindow } from "../../../shared/hooks/useDraggableWindow";
import { SystemAppInfo, UpdateCheckResult, UpdateStatus } from "../types";
import {
  checkForUpdates,
  fetchSystemAppInfo,
  formatBytes,
  openExternalLink,
} from "../lib/updateService";

interface AppInfoModalProps {
  isWindowView?: boolean;
  onClose?: () => void;
}

export const AppInfoModal: React.FC<AppInfoModalProps> = ({ isWindowView = false, onClose }) => {
  const [activeTab, setActiveTab] = useState<"updater" | "system">("updater");
  const [appInfo, setAppInfo] = useState<SystemAppInfo | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [simulateMode, setSimulateMode] = useState(false);

  const { onMouseDown: handleDrag } = useDraggableWindow();

  // Carrega informações do aplicativo e escuta eventos de atualização nativos
  useEffect(() => {
    fetchSystemAppInfo().then((info) => {
      setAppInfo(info);
    });

    const unlistenProgress = listen<number>("update_progress", (event) => {
      setDownloadProgress(event.payload);
      setUpdateStatus("downloading");
    });

    const unlistenReady = listen("update_ready_to_install", () => {
      setDownloadProgress(100);
      setUpdateStatus("downloaded");
    });

    const unlistenError = listen<string>("update_error", (event) => {
      setUpdateStatus("error");
      setUpdateResult((prev) =>
        prev
          ? { ...prev, errorMessage: event.payload }
          : {
              hasUpdate: false,
              currentVersion: "0.1.3",
              latestVersion: "0.1.4",
              checkedAt: new Date().toLocaleTimeString(),
              errorMessage: event.payload,
            }
      );
    });

    return () => {
      unlistenProgress.then((f) => f());
      unlistenReady.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, []);

  // Fechar no Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isWindowView, onClose]);

  const handleClose = async () => {
    if (onClose) {
      onClose();
    }
    if (isWindowView) {
      try {
        await invoke("hide_about_window");
      } catch (e) {
        console.error("Erro ao esconder janela about:", e);
      }
    }
  };

  const handleCheckUpdate = async (simulate = simulateMode) => {
    const currentVersion = appInfo?.version || "0.1.3";
    setUpdateStatus("checking");
    try {
      const result = await checkForUpdates(currentVersion, { simulate });
      setUpdateResult(result);
      if (result.hasUpdate) {
        setUpdateStatus("update-available");
      } else {
        setUpdateStatus("up-to-date");
      }
    } catch (e: any) {
      setUpdateStatus("error");
      setUpdateResult({
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        checkedAt: new Date().toLocaleTimeString(),
        errorMessage: e?.message || "Falha na verificação de atualização.",
      });
    }
  };

  const handleStartDownload = async () => {
    if (!updateResult?.release?.downloadUrl) return;

    setUpdateStatus("downloading");
    setDownloadProgress(10);

    if (updateResult.isSimulated) {
      const interval = setInterval(() => {
        setDownloadProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setUpdateStatus("downloaded");
            return 100;
          }
          const step = Math.floor(Math.random() * 20) + 10;
          return Math.min(prev + step, 100);
        });
      }, 300);
      return;
    }

    try {
      await invoke("download_and_install_update", {
        url: updateResult.release.downloadUrl,
      });
    } catch (e: any) {
      setUpdateStatus("error");
      setUpdateResult((prev) =>
        prev
          ? { ...prev, errorMessage: e?.message || "Falha ao iniciar atualização automática." }
          : null
      );
    }
  };

  const handleTriggerCapture = async () => {
    try {
      await invoke("trigger_capture");
      handleClose();
    } catch (e) {
      console.error("Erro ao disparar captura:", e);
    }
  };

  const handleOpenSettings = async () => {
    try {
      await invoke("show_settings_window");
      handleClose();
    } catch (e) {
      console.error("Erro ao abrir configurações:", e);
    }
  };

  return (
    <div
      className={`select-none font-mono text-xs flex flex-col ${
        isWindowView
          ? "w-screen h-screen bg-transparent p-3"
          : "fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3"
      }`}
    >
      <div className="w-full max-w-[560px] h-full max-h-[540px] bg-[#211d1a] border border-[#3f3a36] rounded-[4px] shadow-2xl text-[#f7f5f0] flex flex-col overflow-hidden mx-auto font-sans">
        {/* Terminal Header */}
        <div
          data-tauri-drag-region
          onMouseDown={handleDrag}
          className="h-10 px-3 bg-[#1c1a18] border-b border-[#3f3a36] flex items-center justify-between cursor-grab active:cursor-grabbing rounded-t-[4px] shrink-0 font-mono text-xs"
        >
          <div className="flex items-center gap-1.5 text-[#aea69c]">
            <DragHandle />
            <span className="text-[#2dd4bf] font-bold">❯</span>
            <span>quick-capture</span>
            <span className="text-[#544e48]">/</span>
            <span className="text-[#dad2c1]">device-info & updater</span>
          </div>
          <button
            onClick={handleClose}
            className="text-[#aea69c] hover:text-[#f43f5e] p-1 rounded-[3px] hover:bg-[#383330] transition cursor-pointer flex items-center justify-center"
            title="Fechar (Esc)"
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Top App Banner */}
        <div className="px-5 py-3.5 bg-[#262320] border-b border-[#3f3a36] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[3px] bg-[#383330] border border-[#4f4843] flex items-center justify-center text-[#2dd4bf] shadow-inner">
              <Terminal className="w-4 h-4" strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-[#f7f5f0] tracking-tight">
                  Global Quick Capture
                </span>
                <span className="px-1.5 py-0.5 text-[10px] rounded-[2px] bg-[#2dd4bf]/15 text-[#2dd4bf] border border-[#2dd4bf]/30 font-mono font-medium">
                  v{appInfo?.version || "0.1.3"}
                </span>
              </div>
              <p className="text-[11px] text-[#aea69c] mt-0.5">
                Snipping tool global & captura rápida para Obsidian
              </p>
            </div>
          </div>

          {/* Abas */}
          <div className="flex bg-[#1c1a18] p-0.5 rounded-[3px] border border-[#3f3a36] gap-1 font-mono text-xs">
            <button
              onClick={() => setActiveTab("updater")}
              className={`px-2.5 py-1 rounded-[2px] transition cursor-pointer ${
                activeTab === "updater"
                  ? "bg-[#383330] text-[#f7f5f0] border border-[#4f4843]"
                  : "text-[#aea69c] hover:text-[#f7f5f0]"
              }`}
            >
              Atualizações
            </button>
            <button
              onClick={() => setActiveTab("system")}
              className={`px-2.5 py-1 rounded-[2px] transition cursor-pointer ${
                activeTab === "system"
                  ? "bg-[#383330] text-[#f7f5f0] border border-[#4f4843]"
                  : "text-[#aea69c] hover:text-[#f7f5f0]"
              }`}
            >
              Dispositivo
            </button>
          </div>
        </div>

        {/* Conteúdo Dinâmico */}
        <div className="flex-1 p-5 overflow-y-auto no-scrollbar flex flex-col gap-4 font-mono text-xs">
          {activeTab === "updater" && (
            <div className="flex flex-col gap-4">
              {/* Card de Status da Versão */}
              <div className="p-4 rounded-[4px] bg-[#262320] border border-[#3f3a36] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[#aea69c]">Status do Aplicativo:</span>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#10b981]"></span>
                    <span className="text-[#10b981] font-medium text-[11px]">Bandeja Ativa</span>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1 border-t border-[#3f3a36]/60">
                  <span className="text-[#aea69c]">Versão Instalada:</span>
                  <span className="text-[#f7f5f0] font-mono font-bold">
                    v{appInfo?.version || "0.1.3"}
                  </span>
                </div>

                {updateResult?.checkedAt && (
                  <div className="flex items-center justify-between text-[11px] text-[#aea69c]/70">
                    <span>Última verificação:</span>
                    <span>{updateResult.checkedAt}</span>
                  </div>
                )}
              </div>

              {/* Resultado da Checagem / Download */}
              {updateStatus === "checking" && (
                <div className="p-4 rounded-[4px] bg-[#262320] border border-[#2dd4bf]/40 flex items-center gap-2.5 text-[#2dd4bf]">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#2dd4bf]" strokeWidth={2} />
                  <span>Verificando novas versões no repositório GitHub...</span>
                </div>
              )}

              {updateStatus === "up-to-date" && (
                <div className="p-4 rounded-[4px] bg-[#1c2923] border border-[#10b981]/40 flex items-start gap-3">
                  <Check className="w-4 h-4 text-[#10b981] shrink-0 mt-0.5" strokeWidth={2.5} />
                  <div>
                    <div className="font-semibold text-[#10b981]">
                      Você está na versão mais recente!
                    </div>
                    <div className="text-[11px] text-[#a7f3d0] mt-0.5 font-sans">
                      Sua cópia local (v{appInfo?.version || "0.1.3"}) está atualizada com a branch principal.
                    </div>
                  </div>
                </div>
              )}

              {updateStatus === "error" && (
                <div className="p-4 rounded-[4px] bg-[#2b2220] border border-[#f43f5e]/40 flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-[#f43f5e] shrink-0 mt-0.5" strokeWidth={2} />
                  <div>
                    <div className="font-semibold text-[#f43f5e]">Aviso de Verificação</div>
                    <div className="text-[11px] text-[#fca5a5] mt-0.5 font-sans">
                      {updateResult?.errorMessage || "Não foi possível verificar no momento."}
                    </div>
                  </div>
                </div>
              )}

              {/* Nova Versão Disponível */}
              {(updateStatus === "update-available" ||
                updateStatus === "downloading" ||
                updateStatus === "downloaded") &&
                updateResult?.release && (
                  <div className="p-4 rounded-[4px] bg-[#262320] border border-[#38bdf8]/40 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#38bdf8]" strokeWidth={2} />
                        <span className="font-bold text-[#f7f5f0] text-sm">
                          {updateResult.release.tagName} Disponível!
                        </span>
                      </div>
                      {updateResult.release.downloadSize && (
                        <span className="text-[11px] text-[#aea69c]">
                          {formatBytes(updateResult.release.downloadSize)}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-[#93c5fd] font-sans">
                      {updateResult.release.name}
                    </div>

                    {/* Changelog Box */}
                    <div className="max-h-28 overflow-y-auto bg-[#1c1a18] p-2.5 rounded-[3px] border border-[#3f3a36] text-[#dad2c1] text-[11px] leading-relaxed whitespace-pre-wrap no-scrollbar font-mono">
                      {updateResult.release.body}
                    </div>

                    {/* Progresso de Download */}
                    {updateStatus === "downloading" && (
                      <div className="flex flex-col gap-1.5 pt-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#38bdf8]">Baixando atualização...</span>
                          <span className="text-[#f7f5f0] font-mono">{downloadProgress}%</span>
                        </div>
                        <div className="w-full bg-[#1c1a18] rounded-[2px] h-2 overflow-hidden border border-[#3f3a36]">
                          <div
                            className="bg-[#38bdf8] h-2 rounded-[2px] transition-all duration-300"
                            style={{ width: `${downloadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Ações de Download / Instalação Automática */}
                    <div className="flex items-center gap-2 pt-1">
                      {updateStatus === "update-available" && (
                        <button
                          onClick={handleStartDownload}
                          className="flex-1 py-2 bg-[#f7f5f0] hover:bg-[#eae6de] text-[#211d1a] font-medium text-xs rounded-[3px] transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:translate-y-px"
                        >
                          <span>Atualizar Automaticamente Agora</span>
                        </button>
                      )}

                      {updateStatus === "downloading" && (
                        <button
                          disabled
                          className="flex-1 py-2 bg-[#2b2622] border border-[#38bdf8]/50 text-[#38bdf8] font-medium text-xs rounded-[3px] flex items-center justify-center gap-2"
                        >
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                          <span>Baixando atualização ({downloadProgress}%)...</span>
                        </button>
                      )}

                      {updateStatus === "downloaded" && (
                        <button
                          disabled
                          className="flex-1 py-2 bg-[#1c2923] border border-[#10b981] text-[#10b981] font-medium text-xs rounded-[3px] flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" strokeWidth={2} />
                          <span>Iniciando instalador e reiniciando...</span>
                        </button>
                      )}

                      <button
                        onClick={() => openExternalLink(updateResult.release!.htmlUrl)}
                        className="px-3 py-2 bg-[#383330] hover:bg-[#4f4843] border border-[#3f3a36] text-[#dad2c1] hover:text-[#f7f5f0] rounded-[3px] transition cursor-pointer flex items-center gap-1.5 text-xs"
                        title="Ver release completa no GitHub"
                      >
                        <ExternalLink className="w-3 h-3" strokeWidth={1.75} />
                        <span>GitHub</span>
                      </button>
                    </div>
                  </div>
                )}

              {/* Botão de Verificação Principal */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => handleCheckUpdate(false)}
                  disabled={updateStatus === "checking" || updateStatus === "downloading"}
                  className="flex-1 py-2.5 bg-[#262320] hover:bg-[#383330] border border-[#3f3a36] text-[#f7f5f0] font-medium rounded-[3px] transition cursor-pointer flex items-center justify-center gap-2 text-xs"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${updateStatus === "checking" ? "animate-spin" : ""}`}
                    strokeWidth={1.75}
                  />
                  <span>
                    {updateStatus === "checking"
                      ? "Verificando Atualizações..."
                      : "Verificar Atualizações Agora"}
                  </span>
                </button>

                {/* Alternador de Simulação */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !simulateMode;
                    setSimulateMode(next);
                    handleCheckUpdate(next);
                  }}
                  className={`px-3 py-2.5 rounded-[3px] border transition cursor-pointer text-[11px] ${
                    simulateMode
                      ? "bg-[#38bdf8]/15 border-[#38bdf8]/50 text-[#38bdf8]"
                      : "bg-[#262320] border-[#3f3a36] text-[#aea69c] hover:text-[#f7f5f0]"
                  }`}
                  title="Simula a detecção da versão v0.1.4 para testes da UI"
                >
                  {simulateMode ? "Modo Simulação: ON" : "Testar Simulação"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "system" && (
            <div className="flex flex-col gap-3">
              <div className="p-3.5 bg-[#262320] border border-[#3f3a36] rounded-[4px] flex flex-col gap-2.5">
                <div className="text-[#aea69c] font-medium text-xs">Configuração do Ambiente:</div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-[#1c1a18] rounded-[3px] border border-[#3f3a36] flex flex-col gap-0.5">
                    <div className="text-[#aea69c] flex items-center gap-1.5">
                      <Cpu className="w-3 h-3 text-[#aea69c]" strokeWidth={1.75} />
                      <span>Sistema Operacional:</span>
                    </div>
                    <div className="text-[#f7f5f0] font-medium capitalize">
                      {appInfo?.os || "windows"} ({appInfo?.arch || "x86_64"})
                    </div>
                  </div>

                  <div className="p-2.5 bg-[#1c1a18] rounded-[3px] border border-[#3f3a36] flex flex-col gap-0.5">
                    <div className="text-[#aea69c] flex items-center gap-1.5">
                      <Terminal className="w-3 h-3 text-[#aea69c]" strokeWidth={1.75} />
                      <span>Runtime:</span>
                    </div>
                    <div className="text-[#f7f5f0] font-medium">Tauri {appInfo?.tauri_version || "2.x"}</div>
                  </div>
                </div>

                <div className="p-2.5 bg-[#1c1a18] rounded-[3px] border border-[#3f3a36] flex flex-col gap-1 text-[11px]">
                  <div className="text-[#aea69c] flex items-center gap-1.5">
                    <Keyboard className="w-3 h-3 text-[#aea69c]" strokeWidth={1.75} />
                    <span>Atalho Global de Recorte:</span>
                  </div>
                  <div className="text-[#2dd4bf] font-bold flex items-center justify-between">
                    <span>{appInfo?.global_shortcut || "Win + Alt + S"}</span>
                    <span className="text-[10px] text-[#10b981] bg-[#10b981]/15 px-1.5 py-0.5 rounded-[2px]">
                      Ativo no Windows
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-[#1c1a18] rounded-[3px] border border-[#3f3a36] flex flex-col gap-1 text-[11px]">
                  <div className="text-[#aea69c] flex items-center gap-1.5">
                    <Folder className="w-3 h-3 text-[#aea69c]" strokeWidth={1.75} />
                    <span>Cofre do Obsidian (Vault):</span>
                  </div>
                  <div className="text-[#dad2c1] truncate font-mono text-[10px]">
                    {appInfo?.vault_path || "Não configurado"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-[#1c1a18] rounded-[3px] border border-[#3f3a36]">
                    <div className="text-[#aea69c]">Rota Padrão:</div>
                    <div className="text-[#f7f5f0] font-medium">
                      {appInfo?.default_route_id || "daily"}
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#1c1a18] rounded-[3px] border border-[#3f3a36]">
                    <div className="text-[#aea69c]">Rotas Cadastradas:</div>
                    <div className="text-[#f7f5f0] font-medium">
                      {appInfo?.routes_count ?? 2} rotas ativas
                    </div>
                  </div>
                </div>
              </div>

              {/* Ações Rápidas */}
              <div className="flex gap-2">
                <button
                  onClick={handleTriggerCapture}
                  className="flex-1 py-2 bg-[#262320] hover:bg-[#383330] border border-[#3f3a36] text-[#f7f5f0] rounded-[3px] transition cursor-pointer flex items-center justify-center gap-2 text-xs"
                >
                  <Camera className="w-3.5 h-3.5 text-[#2dd4bf]" strokeWidth={1.75} />
                  <span>Disparar Captura</span>
                </button>
                <button
                  onClick={handleOpenSettings}
                  className="flex-1 py-2 bg-[#262320] hover:bg-[#383330] border border-[#3f3a36] text-[#f7f5f0] rounded-[3px] transition cursor-pointer flex items-center justify-center gap-2 text-xs"
                >
                  <Settings className="w-3.5 h-3.5 text-[#aea69c]" strokeWidth={1.75} />
                  <span>Configurações</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="h-11 px-5 bg-[#1c1a18] border-t border-[#3f3a36] flex items-center justify-between text-[11px] text-[#aea69c] shrink-0 font-mono">
          <div className="flex items-center gap-2">
            <span>Repositório:</span>
            <button
              onClick={() => openExternalLink("https://github.com/Felipe-Belotto/global-quick-capture")}
              className="text-[#2dd4bf] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Felipe-Belotto/global-quick-capture</span>
              <ExternalLink className="w-2.5 h-2.5" strokeWidth={1.75} />
            </button>
          </div>
          <button
            onClick={handleClose}
            className="px-3 py-1 bg-[#262320] hover:bg-[#383330] border border-[#3f3a36] text-[#dad2c1] rounded-[3px] transition cursor-pointer text-xs"
          >
            fechar (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
