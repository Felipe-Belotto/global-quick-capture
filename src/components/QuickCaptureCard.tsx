import React, { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AppConfig, SaveSnippetPayload } from "../types";
import { SettingsModal } from "./SettingsModal";
import { OnboardingModal } from "./OnboardingModal";

export const QuickCaptureCard: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("daily");
  const [title, setTitle] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [imageBase64, setImageBase64] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  const titleInputRef = useRef<HTMLInputElement | null>(null);

  // Carregar configurações e verificar se precisa de Onboarding
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const loaded = await invoke<AppConfig>("get_vault_config");
        setConfig(loaded);
        if (loaded.defaultRouteId) {
          setSelectedRouteId(loaded.defaultRouteId);
        }

        // Se o caminho não existir ou for o padrão fictício, abre o onboarding
        if (
          !loaded.vaultPath ||
          loaded.vaultPath.includes("seu-usuario") ||
          loaded.vaultPath.endsWith("ObsidianVault")
        ) {
          setShowOnboarding(true);
        }
      } catch (e) {
        console.error("Erro ao carregar config:", e);
      }
    };
    fetchConfig();

    const unlisten = listen<string>("load_snip_image", (event) => {
      setImageBase64(event.payload);
      setTitle("");
      setMessage("");
      setSaveSuccess(false);
      setErrorMsg(null);
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const handleSave = useCallback(async () => {
    if (!title.trim() && !message.trim()) {
      setErrorMsg("Digite um título ou observação.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    const payload: SaveSnippetPayload = {
      imageBufferBase64:
        imageBase64 ||
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      title: title.trim() || "Captura Rápida",
      message: message.trim() || undefined,
      routeId: selectedRouteId,
      tags: selectedTags,
    };

    try {
      await invoke("save_snippet_cmd", { payload });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 1200);
    } catch (err: unknown) {
      setErrorMsg(String(err));
      setIsSaving(false);
    }
  }, [title, message, imageBase64, selectedRouteId, selectedTags]);

  const handleCancel = useCallback(async () => {
    try {
      await invoke("cancel_snip");
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSettings) {
          setShowSettings(false);
        } else {
          handleCancel();
        }
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (
          document.activeElement?.tagName !== "INPUT" &&
          document.activeElement?.tagName !== "TEXTAREA"
        ) {
          const num = parseInt(e.key, 10);
          if (config && num >= 1 && num <= config.projectRoutes.length) {
            setSelectedRouteId(config.projectRoutes[num - 1].id);
          }
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleCancel, handleSave, config, showSettings]);

  const activeRoute = config?.projectRoutes.find((r) => r.id === selectedRouteId);

  useEffect(() => {
    if (activeRoute?.defaultTags) {
      setSelectedTags(activeRoute.defaultTags);
    }
  }, [selectedRouteId, activeRoute]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  if (showOnboarding) {
    return (
      <OnboardingModal
        onComplete={(newCfg) => {
          setConfig(newCfg);
          setShowOnboarding(false);
        }}
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-3 select-none">
      <div className="w-full max-w-[680px] bg-[#111216] border border-[#232530] rounded-lg shadow-2xl text-[#d4d4d8] flex flex-col font-sans">
        
        {/* Header estilo terminal Warp (arrastável) */}
        <div
          data-tauri-drag-region
          className="h-10 px-3 bg-[#0c0d10] border-b border-[#232530] flex items-center justify-between cursor-move rounded-t-lg"
        >
          {/* Rotas de projetos estilo abas de terminal */}
          <div data-tauri-drag-region className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            <span data-tauri-drag-region className="font-mono text-xs text-[#2dd4bf] mr-1">❯</span>
            {config?.projectRoutes.map((route, idx) => {
              const isSelected = route.id === selectedRouteId;
              return (
                <button
                  key={route.id}
                  onClick={() => setSelectedRouteId(route.id)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-[#1f222d] border border-[#323645] text-white shadow-sm"
                      : "text-[#71717a] hover:text-[#d4d4d8] hover:bg-[#16171f]"
                  }`}
                >
                  <span className="opacity-50">{route.keyShortcut || idx + 1}:</span>
                  <span>{route.label.toLowerCase()}</span>
                </button>
              );
            })}
          </div>

          {/* Ações da Janela */}
          <div className="flex items-center gap-2 pl-2">
            <button
              onClick={() => setShowSettings(true)}
              className="text-xs font-mono text-[#71717a] hover:text-[#d4d4d8] px-1.5 py-0.5 rounded hover:bg-[#1f222d] transition cursor-pointer"
              title="Configurações (Vault e Atalhos)"
            >
              [config]
            </button>
            <button
              onClick={handleCancel}
              className="text-xs font-mono text-[#71717a] hover:text-[#ef4444] px-1.5 py-0.5 rounded hover:bg-[#1f222d] transition cursor-pointer"
              title="Fechar (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Corpo Principal */}
        <div className="p-4 flex flex-col gap-3">
          <div className="flex gap-3">
            {/* Thumbnail do Recorte */}
            <div className="w-32 h-28 rounded bg-[#16171f] border border-[#232530] flex items-center justify-center overflow-hidden shrink-0">
              {imageBase64 ? (
                <img
                  src={imageBase64}
                  alt="Recorte"
                  className="w-full h-full object-cover rounded"
                />
              ) : (
                <span className="text-[11px] font-mono text-[#525460]">sem recorte</span>
              )}
            </div>

            {/* Campos de Entrada */}
            <div className="flex-1 flex flex-col gap-2 font-mono">
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                placeholder="❯ resumo rápido / título do bug..."
                className="w-full bg-[#16171f] border border-[#232530] focus:border-[#2dd4bf] rounded px-3 py-2 text-xs text-white placeholder-[#525460] outline-none transition"
                autoFocus
              />

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="❯ notas de qa, passos de reprodução, logs adicionais..."
                rows={2}
                className="w-full bg-[#16171f] border border-[#232530] focus:border-[#2dd4bf] rounded px-3 py-2 text-xs text-[#d4d4d8] placeholder-[#525460] outline-none resize-none transition"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className="text-[#525460] text-[11px]">tags:</span>
            {["qa", "bug", "ui", "p1", "daily"].map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                    active
                      ? "bg-[#172228] text-[#2dd4bf] border border-[#2dd4bf]/40"
                      : "bg-[#16171f] text-[#71717a] hover:text-[#d4d4d8] border border-[#232530]"
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>

          {errorMsg && (
            <div className="text-xs font-mono text-[#ef4444] bg-[#2a1318] border border-[#4d1f27] px-3 py-1.5 rounded">
              ! {errorMsg}
            </div>
          )}

          {/* Rodapé: Destino & Ações */}
          <div className="flex items-center justify-between pt-2 border-t border-[#232530] text-xs font-mono text-[#71717a]">
            <div className="truncate max-w-[360px]">
              <span className="opacity-60">destino: </span>
              <span className="text-[#d4d4d8]">
                {activeRoute?.targetType === "daily_note" && "Daily/YYYY-MM-DD.md"}
                {activeRoute?.targetType === "file" && (activeRoute.filePath || "Inbox.md")}
                {activeRoute?.targetType === "folder" && `${activeRoute.folderPath}/YYYY-MM-DD_nota.md`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCancel}
                className="px-3 py-1 text-[#71717a] hover:text-[#d4d4d8] transition cursor-pointer"
              >
                cancelar [esc]
              </button>

              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`px-3.5 py-1.5 rounded font-medium transition cursor-pointer ${
                  saveSuccess
                    ? "bg-[#10b981] text-[#0c0d10]"
                    : "bg-[#2dd4bf] hover:bg-[#25b5a3] text-[#0c0d10]"
                }`}
              >
                {saveSuccess ? "salvo!" : "salvar [ctrl+enter] ↵"}
              </button>
            </div>
          </div>
        </div>

      </div>

      {showSettings && config && (
        <SettingsModal
          config={config}
          onClose={() => setShowSettings(false)}
          onSave={(updated) => setConfig(updated)}
        />
      )}
    </div>
  );
};
