import React, { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AppConfig, SaveSnippetPayload } from "../types";
import { SettingsModal } from "./SettingsModal";
import { OnboardingModal } from "./OnboardingModal";

export const QuickCaptureCard: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("daily");
  const [description, setDescription] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [showImagePreview, setShowImagePreview] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  const descInputRef = useRef<HTMLTextAreaElement | null>(null);

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
      setDescription("");
      setShowImagePreview(false);
      setSaveSuccess(false);
      setErrorMsg(null);
      setTimeout(() => {
        descInputRef.current?.focus();
      }, 100);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setErrorMsg(null);

    const payload: SaveSnippetPayload = {
      imageBufferBase64:
        imageBase64 ||
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      title: description.trim() ? description.trim().split("\n")[0].slice(0, 40) : "Captura",
      message: description.trim() || undefined,
      routeId: selectedRouteId,
      tags: [],
    };

    try {
      await invoke("save_snippet_cmd", { payload });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 1000);
    } catch (err: unknown) {
      setErrorMsg(String(err));
      setIsSaving(false);
    }
  }, [description, imageBase64, selectedRouteId]);

  const handleCancel = useCallback(async () => {
    try {
      await invoke("cancel_snip");
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Atalhos de teclado
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showImagePreview) {
          setShowImagePreview(false);
        } else if (showSettings) {
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
  }, [handleCancel, handleSave, config, showSettings, showImagePreview]);

  // Suporte a markdown no textarea (Tab e continuação de listas)
  const handleMarkdownKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
      return;
    }

    // Suporte a Tab para indentar em Markdown (2 espaços)
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      const updated = val.substring(0, start) + "  " + val.substring(end);
      setDescription(updated);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
      return;
    }

    // Suporte a continuação inteligente de listas (- [ ] ou - )
    if (e.key === "Enter" && !e.shiftKey) {
      const target = e.currentTarget;
      const start = target.selectionStart;
      const lines = target.value.substring(0, start).split("\n");
      const currentLine = lines[lines.length - 1];

      const taskMatch = currentLine.match(/^(\s*)-\s\[ \]\s(.*)$/);
      const bulletMatch = currentLine.match(/^(\s*)-\s(.*)$/);

      if (taskMatch) {
        if (taskMatch[2].trim() === "") {
          e.preventDefault();
          const lineStart = start - currentLine.length;
          const updated = target.value.substring(0, lineStart) + target.value.substring(start);
          setDescription(updated);
          setTimeout(() => {
            target.selectionStart = target.selectionEnd = lineStart;
          }, 0);
        } else {
          e.preventDefault();
          const indent = taskMatch[1];
          const insert = `\n${indent}- [ ] `;
          const updated = target.value.substring(0, start) + insert + target.value.substring(start);
          setDescription(updated);
          setTimeout(() => {
            target.selectionStart = target.selectionEnd = start + insert.length;
          }, 0);
        }
      } else if (bulletMatch) {
        if (bulletMatch[2].trim() === "") {
          e.preventDefault();
          const lineStart = start - currentLine.length;
          const updated = target.value.substring(0, lineStart) + target.value.substring(start);
          setDescription(updated);
          setTimeout(() => {
            target.selectionStart = target.selectionEnd = lineStart;
          }, 0);
        } else {
          e.preventDefault();
          const indent = bulletMatch[1];
          const insert = `\n${indent}- `;
          const updated = target.value.substring(0, start) + insert + target.value.substring(start);
          setDescription(updated);
          setTimeout(() => {
            target.selectionStart = target.selectionEnd = start + insert.length;
          }, 0);
        }
      }
    }
  };

  const activeRoute = config?.projectRoutes.find((r) => r.id === selectedRouteId);

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
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="h-10 px-3 bg-[#0c0d10] border-b border-[#232530] flex items-center justify-between cursor-move rounded-t-lg select-none"
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
            {/* Thumbnail do Recorte (com clique para ampliar) */}
            <div
              onClick={() => imageBase64 && setShowImagePreview(true)}
              className="group relative w-36 h-32 rounded bg-[#16171f] border border-[#232530] hover:border-[#2dd4bf]/60 flex items-center justify-center overflow-hidden shrink-0 cursor-zoom-in transition"
              title="Clique para ver preview ampliado"
            >
              {imageBase64 ? (
                <>
                  <img
                    src={imageBase64}
                    alt="Recorte"
                    className="w-full h-full object-cover rounded group-hover:scale-105 transition duration-200"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition font-mono text-[10px] text-[#2dd4bf] gap-1">
                    <span>🔍</span> ver recorte
                  </div>
                </>
              ) : (
                <span className="text-[11px] font-mono text-[#525460]">sem recorte</span>
              )}
            </div>

            {/* Campo de Markdown único */}
            <div className="flex-1 flex flex-col font-mono">
              <textarea
                ref={descInputRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleMarkdownKeyDown}
                placeholder="❯ anotações em Markdown (listas, - [ ], [[links]], notas)... [ctrl+enter para salvar]"
                rows={5}
                className="w-full h-full min-h-[125px] bg-[#16171f] border border-[#232530] focus:border-[#2dd4bf] rounded px-3 py-2.5 text-xs text-[#d4d4d8] placeholder-[#525460] outline-none resize-none transition leading-relaxed"
                autoFocus
              />
            </div>
          </div>

          {errorMsg && (
            <div className="text-xs font-mono text-[#ef4444] bg-[#2a1318] border border-[#4d1f27] px-3 py-1.5 rounded">
              ! {errorMsg}
            </div>
          )}

          {/* Rodapé: Destino & Ações */}
          {(() => {
            const d = new Date();
            const dd = String(d.getDate()).padStart(2, "0");
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const yyyy = d.getFullYear();
            const todayFormatted = `${dd}-${mm}-${yyyy}`;

            return (
              <div className="flex items-center justify-between pt-2 border-t border-[#232530] text-xs font-mono text-[#71717a]">
                <div className="truncate max-w-[360px]">
                  <span className="opacity-60">destino: </span>
                  <span className="text-[#d4d4d8]">
                    {activeRoute?.targetType === "daily_note" && `Daily/${todayFormatted}.md`}
                    {activeRoute?.targetType === "file" && (activeRoute.filePath || "Inbox.md")}
                    {activeRoute?.targetType === "folder" && `${activeRoute.folderPath}/${todayFormatted}.md`}
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
            );
          })()}
        </div>
      </div>

      {/* Lightbox / Preview da Imagem Ampliada */}
      {showImagePreview && imageBase64 && (
        <div
          onClick={() => setShowImagePreview(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 cursor-zoom-out select-none"
        >
          <div
            className="relative max-w-full max-h-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 text-xs font-mono text-[#a1a1aa]">
              <span>preview da captura</span>
              <button
                onClick={() => setShowImagePreview(false)}
                className="px-2 py-0.5 rounded bg-[#1f222d] hover:bg-[#2e3343] text-white cursor-pointer"
              >
                fechar [esc]
              </button>
            </div>
            <img
              src={imageBase64}
              alt="Preview Completo"
              className="max-w-[85vw] max-h-[75vh] object-contain rounded border border-[#323645] shadow-2xl bg-[#0c0d10]"
            />
          </div>
        </div>
      )}

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
