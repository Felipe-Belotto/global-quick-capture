import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
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

  // Carrega informações do aplicativo e sistema
  useEffect(() => {
    fetchSystemAppInfo().then((info) => {
      setAppInfo(info);
    });
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

  const handleStartDownload = () => {
    if (!updateResult?.release?.downloadUrl) return;

    setUpdateStatus("downloading");
    setDownloadProgress(5);

    // Simulação visual de download fluído
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
    }, 350);
  };

  const handleInstall = () => {
    if (updateResult?.release?.htmlUrl) {
      openExternalLink(updateResult.release.htmlUrl);
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
      <div className="w-full max-w-[560px] h-full max-h-[540px] bg-[#111216] border border-[#232530] rounded-lg shadow-2xl text-[#d4d4d8] flex flex-col overflow-hidden mx-auto">
        {/* Terminal Header */}
        <div
          onMouseDown={handleDrag}
          className="h-10 px-3 bg-[#0c0d10] border-b border-[#232530] flex items-center justify-between cursor-grab active:cursor-grabbing rounded-t-lg shrink-0"
        >
          <div className="flex items-center gap-1.5 text-[#8e909a]">
            <DragHandle />
            <span className="text-[#2dd4bf]">❯</span>
            <span>quick-capture</span>
            <span className="text-[#525460]">/</span>
            <span className="text-[#d4d4d8]">device-info & updater</span>
          </div>
          <button
            onClick={handleClose}
            className="text-[#71717a] hover:text-[#ef4444] px-1.5 py-0.5 rounded hover:bg-[#1f222d] transition cursor-pointer"
            title="Fechar (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Top App Banner */}
        <div className="px-5 py-3.5 bg-[#14151b] border-b border-[#232530] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1f222d] border border-[#323645] flex items-center justify-center text-lg shadow-inner">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white tracking-wide">
                  Global Quick Capture
                </span>
                <span className="px-1.5 py-0.5 text-[10px] rounded bg-[#2dd4bf]/15 text-[#2dd4bf] border border-[#2dd4bf]/30 font-semibold">
                  v{appInfo?.version || "0.1.3"}
                </span>
              </div>
              <p className="text-[11px] text-[#71717a] mt-0.5">
                Snipping tool global & captura rápida para Obsidian
              </p>
            </div>
          </div>

          {/* Abas */}
          <div className="flex bg-[#0c0d10] p-1 rounded border border-[#232530] gap-1">
            <button
              onClick={() => setActiveTab("updater")}
              className={`px-2.5 py-1 rounded transition cursor-pointer ${
                activeTab === "updater"
                  ? "bg-[#1f222d] text-[#2dd4bf] border border-[#323645]"
                  : "text-[#71717a] hover:text-white"
              }`}
            >
              Atualizações
            </button>
            <button
              onClick={() => setActiveTab("system")}
              className={`px-2.5 py-1 rounded transition cursor-pointer ${
                activeTab === "system"
                  ? "bg-[#1f222d] text-[#2dd4bf] border border-[#323645]"
                  : "text-[#71717a] hover:text-white"
              }`}
            >
              Dispositivo
            </button>
          </div>
        </div>

        {/* Conteúdo Dinâmico */}
        <div className="flex-1 p-5 overflow-y-auto no-scrollbar flex flex-col gap-4">
          {activeTab === "updater" && (
            <div className="flex flex-col gap-4">
              {/* Card de Status da Versão */}
              <div className="p-4 rounded-lg bg-[#16171f] border border-[#232530] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[#8e909a]">Status do Aplicativo:</span>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
                    <span className="text-[#10b981] font-medium">Bandeja Ativa</span>
                  </div>
                </div>

                <div className="flex items-center justify-between py-1 border-t border-[#232530]/60">
                  <span className="text-[#71717a]">Versão Instalada:</span>
                  <span className="text-white font-mono font-bold">
                    v{appInfo?.version || "0.1.3"}
                  </span>
                </div>

                {updateResult?.checkedAt && (
                  <div className="flex items-center justify-between text-[11px] text-[#525460]">
                    <span>Última verificação:</span>
                    <span>{updateResult.checkedAt}</span>
                  </div>
                )}
              </div>

              {/* Resultado da Checagem / Download */}
              {updateStatus === "checking" && (
                <div className="p-4 rounded-lg bg-[#16171f] border border-[#2dd4bf]/40 flex items-center gap-3 text-[#2dd4bf]">
                  <span className="animate-spin text-base">⟳</span>
                  <span>Verificando novas versões no repositório GitHub...</span>
                </div>
              )}

              {updateStatus === "up-to-date" && (
                <div className="p-4 rounded-lg bg-[#0e2a22] border border-[#10b981]/40 flex items-start gap-3">
                  <span className="text-[#10b981] text-base mt-0.5">✓</span>
                  <div>
                    <div className="font-semibold text-[#10b981]">
                      Você está na versão mais recente!
                    </div>
                    <div className="text-[11px] text-[#a7f3d0] mt-0.5">
                      Sua cópia local (v{appInfo?.version || "0.1.3"}) está atualizada com a branch principal.
                    </div>
                  </div>
                </div>
              )}

              {updateStatus === "error" && (
                <div className="p-4 rounded-lg bg-[#271518] border border-[#ef4444]/40 flex items-start gap-3">
                  <span className="text-[#ef4444] text-base mt-0.5">⚠</span>
                  <div>
                    <div className="font-semibold text-[#ef4444]">Aviso de Verificação</div>
                    <div className="text-[11px] text-[#fca5a5] mt-0.5">
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
                  <div className="p-4 rounded-lg bg-[#141a24] border border-[#38bdf8]/50 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🚀</span>
                        <span className="font-bold text-white text-sm">
                          {updateResult.release.tagName} Disponível!
                        </span>
                      </div>
                      {updateResult.release.downloadSize && (
                        <span className="text-[11px] text-[#71717a]">
                          {formatBytes(updateResult.release.downloadSize)}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-[#93c5fd]">
                      {updateResult.release.name}
                    </div>

                    {/* Changelog Box */}
                    <div className="max-h-28 overflow-y-auto bg-[#0c0d10] p-2.5 rounded border border-[#1e293b] text-[#cbd5e1] text-[11px] leading-relaxed whitespace-pre-wrap no-scrollbar">
                      {updateResult.release.body}
                    </div>

                    {/* Progresso de Download */}
                    {updateStatus === "downloading" && (
                      <div className="flex flex-col gap-1.5 pt-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#38bdf8]">Baixando atualização...</span>
                          <span className="text-white font-mono">{downloadProgress}%</span>
                        </div>
                        <div className="w-full bg-[#1e293b] rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-[#38bdf8] h-2 rounded-full transition-all duration-300"
                            style={{ width: `${downloadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Ações de Download / Instalação */}
                    <div className="flex items-center gap-2 pt-1">
                      {updateStatus === "update-available" && (
                        <button
                          onClick={handleStartDownload}
                          className="flex-1 py-2 bg-[#2dd4bf] hover:bg-[#25b5a3] text-[#0c0d10] font-bold rounded transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span>⬇</span> Baixar & Atualizar Agora
                        </button>
                      )}

                      {updateStatus === "downloaded" && (
                        <button
                          onClick={handleInstall}
                          className="flex-1 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <span>✓</span> Instalar Atualização
                        </button>
                      )}

                      <button
                        onClick={() => openExternalLink(updateResult.release!.htmlUrl)}
                        className="px-3 py-2 bg-[#1f222d] hover:bg-[#282b37] border border-[#323645] text-white rounded transition cursor-pointer"
                        title="Ver release completa no GitHub"
                      >
                        ↗ GitHub
                      </button>
                    </div>
                  </div>
                )}

              {/* Botão de Verificação Principal */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => handleCheckUpdate(false)}
                  disabled={updateStatus === "checking" || updateStatus === "downloading"}
                  className="flex-1 py-2.5 bg-[#20222c] hover:bg-[#282b37] border border-[#323645] text-white font-medium rounded transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className={updateStatus === "checking" ? "animate-spin" : ""}>⟳</span>
                  {updateStatus === "checking"
                    ? "Verificando Atualizações..."
                    : "Verificar Atualizações Agora"}
                </button>

                {/* Alternador de Simulação (Ideal para testar a UI) */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !simulateMode;
                    setSimulateMode(next);
                    handleCheckUpdate(next);
                  }}
                  className={`px-3 py-2.5 rounded border transition cursor-pointer text-[11px] ${
                    simulateMode
                      ? "bg-[#3b82f6]/20 border-[#3b82f6] text-[#60a5fa]"
                      : "bg-[#16171f] border-[#232530] text-[#71717a] hover:text-white"
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
              <div className="p-3 bg-[#16171f] border border-[#232530] rounded-lg flex flex-col gap-2.5">
                <div className="text-[#8e909a] font-semibold">Configuração do Ambiente:</div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-[#111216] rounded border border-[#232530]">
                    <div className="text-[#71717a]">Sistema Operacional:</div>
                    <div className="text-white font-medium capitalize">
                      {appInfo?.os || "windows"} ({appInfo?.arch || "x86_64"})
                    </div>
                  </div>

                  <div className="p-2 bg-[#111216] rounded border border-[#232530]">
                    <div className="text-[#71717a]">Runtime:</div>
                    <div className="text-white font-medium">Tauri {appInfo?.tauri_version || "2.x"}</div>
                  </div>
                </div>

                <div className="p-2 bg-[#111216] rounded border border-[#232530] flex flex-col gap-1 text-[11px]">
                  <div className="text-[#71717a]">Atalho Global de Recorte:</div>
                  <div className="text-[#2dd4bf] font-bold flex items-center justify-between">
                    <span>{appInfo?.global_shortcut || "Win + Alt + S"}</span>
                    <span className="text-[10px] text-[#10b981] bg-[#10b981]/15 px-1.5 py-0.5 rounded">
                      Ativo no Windows
                    </span>
                  </div>
                </div>

                <div className="p-2 bg-[#111216] rounded border border-[#232530] flex flex-col gap-1 text-[11px]">
                  <div className="text-[#71717a]">Cofre do Obsidian (Vault):</div>
                  <div className="text-white truncate font-mono text-[10px]">
                    {appInfo?.vault_path || "Não configurado"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-[#111216] rounded border border-[#232530]">
                    <div className="text-[#71717a]">Rota Padrão:</div>
                    <div className="text-white font-medium">
                      {appInfo?.default_route_id || "daily"}
                    </div>
                  </div>
                  <div className="p-2 bg-[#111216] rounded border border-[#232530]">
                    <div className="text-[#71717a]">Rotas Cadastradas:</div>
                    <div className="text-white font-medium">
                      {appInfo?.routes_count ?? 2} rotas ativas
                    </div>
                  </div>
                </div>
              </div>

              {/* Ações de Atalho Rápido */}
              <div className="flex gap-2">
                <button
                  onClick={handleTriggerCapture}
                  className="flex-1 py-2 bg-[#20222c] hover:bg-[#282b37] border border-[#323645] text-white rounded transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  📸 Disparar Captura
                </button>
                <button
                  onClick={handleOpenSettings}
                  className="flex-1 py-2 bg-[#20222c] hover:bg-[#282b37] border border-[#323645] text-white rounded transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  ⚙️ Configurações
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="h-11 px-5 bg-[#0c0d10] border-t border-[#232530] flex items-center justify-between text-[11px] text-[#71717a] shrink-0">
          <div className="flex items-center gap-2">
            <span>Repositório:</span>
            <button
              onClick={() => openExternalLink("https://github.com/Felipe-Belotto/global-quick-capture")}
              className="text-[#2dd4bf] hover:underline cursor-pointer"
            >
              Felipe-Belotto/global-quick-capture
            </button>
          </div>
          <button
            onClick={handleClose}
            className="px-3 py-1 bg-[#16171f] hover:bg-[#20222c] border border-[#232530] text-[#d4d4d8] rounded transition cursor-pointer"
          >
            fechar (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
