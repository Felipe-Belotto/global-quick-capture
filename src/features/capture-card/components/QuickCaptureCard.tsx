import React, { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AppConfig, SaveSnippetPayload } from "../../../shared/types";
import { getTodayFormatted } from "../../../shared/lib/date";
import { CardHeader } from "./CardHeader";
import { ImagePreviewLightbox } from "./ImagePreviewLightbox";
import { SettingsModal } from "../../settings/components/SettingsModal";
import { OnboardingModal } from "../../onboarding/components/OnboardingModal";
import { AnnotationEditorModal } from "../../annotations/components/AnnotationEditorModal";

export const QuickCaptureCard: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("daily");
  const [description, setDescription] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [showImagePreview, setShowImagePreview] = useState<boolean>(false);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  const descInputRef = useRef<HTMLTextAreaElement | null>(null);
  const isSavingRef = useRef<boolean>(false);

  // Sincronizar selectedRouteId se as rotas mudarem
  useEffect(() => {
    if (config?.projectRoutes && config.projectRoutes.length > 0) {
      const exists = config.projectRoutes.some((r) => r.id === selectedRouteId);
      if (!exists) {
        setSelectedRouteId(config.defaultRouteId || config.projectRoutes[0].id || "daily");
      }
    }
  }, [config, selectedRouteId]);

  // Carregar configurações e escutar eventos nativos do Tauri
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const loaded = await invoke<AppConfig>("get_vault_config");
        setConfig(loaded);
        if (loaded.defaultRouteId) {
          setSelectedRouteId(loaded.defaultRouteId);
        }

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

    const unlistenLoad = listen<string>("load_snip_image", (event) => {
      setImageBase64(event.payload);
      setDescription("");
      setShowImagePreview(false);
      setShowAnnotationEditor(false);
      setSaveSuccess(false);
      setErrorMsg(null);
      isSavingRef.current = false;
      setIsSaving(false);
      setTimeout(() => {
        descInputRef.current?.focus();
      }, 100);
    });

    const unlistenError = listen<string>("snippet_save_error", (event) => {
      console.error("Erro assíncrono ao salvar snippet:", event.payload);
      setErrorMsg(`Erro de gravação: ${event.payload}`);
      setIsSaving(false);
      isSavingRef.current = false;
    });

    return () => {
      unlistenLoad.then((f) => f());
      unlistenError.then((f) => f());
    };
  }, []);

  const handleSave = useCallback(async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
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
      isSavingRef.current = false;
    }
  }, [description, imageBase64, selectedRouteId]);

  const handleCancel = useCallback(async () => {
    try {
      await invoke("cancel_snip");
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Atalhos de teclado globais do card
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAnnotationEditor) {
          setShowAnnotationEditor(false);
        } else if (showImagePreview) {
          setShowImagePreview(false);
        } else if (showSettings) {
          setShowSettings(false);
        } else {
          handleCancel();
        }
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        if (document.activeElement?.tagName !== "TEXTAREA") {
          e.preventDefault();
          handleSave();
        }
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
  }, [handleCancel, handleSave, config, showSettings, showImagePreview, showAnnotationEditor]);

  // Suporte a markdown inteligente no textarea
  const handleMarkdownKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      handleSave();
      return;
    }

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
  const todayFormatted = getTodayFormatted();

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
        
        {/* Cabeçalho Modular com Drag Handle e Tabs */}
        <CardHeader
          config={config}
          selectedRouteId={selectedRouteId}
          onSelectRoute={setSelectedRouteId}
          onOpenSettings={() => setShowSettings(true)}
          onClose={handleCancel}
        />

        {/* Corpo Principal */}
        <div className="p-4 flex flex-col gap-3">
          <div className="flex gap-3">
            {/* Thumbnail do Recorte com Ações Rápidas */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <div
                onClick={() => imageBase64 && setShowImagePreview(true)}
                className="group relative w-36 h-28 rounded bg-[#16171f] border border-[#232530] hover:border-[#2dd4bf]/60 flex items-center justify-center overflow-hidden cursor-zoom-in transition"
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
                      <span>🔍</span> ampliar
                    </div>
                  </>
                ) : (
                  <span className="text-[11px] font-mono text-[#525460]">sem recorte</span>
                )}
              </div>

              {/* Botão de Anotação Express (Setas, Retângulo, Censura/Blur) */}
              {imageBase64 && (
                <button
                  onClick={() => setShowAnnotationEditor(true)}
                  className="w-full py-1 px-2 rounded bg-[#162725] hover:bg-[#1a3834] border border-[#2dd4bf]/40 text-[#2dd4bf] text-[11px] font-mono flex items-center justify-center gap-1 transition cursor-pointer"
                  title="Desenhar setas, caixas ou censurar senhas/tokens"
                >
                  <span>✏️</span>
                  <span>anotar / blur</span>
                </button>
              )}
            </div>

            {/* Campo de Markdown com atalhos de lista e tab */}
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
        </div>
      </div>

      {/* Modal de Anotações (Setas, Retângulos, Blur/Pixelate) */}
      {showAnnotationEditor && imageBase64 && (
        <AnnotationEditorModal
          imageBase64={imageBase64}
          onSave={(annotated) => setImageBase64(annotated)}
          onClose={() => setShowAnnotationEditor(false)}
        />
      )}

      {/* Lightbox / Preview da Imagem Ampliada */}
      {showImagePreview && imageBase64 && (
        <ImagePreviewLightbox
          imageBase64={imageBase64}
          onClose={() => setShowImagePreview(false)}
          onOpenAnnotation={() => setShowAnnotationEditor(true)}
        />
      )}

      {showSettings && config && (
        <SettingsModal
          config={config}
          onClose={() => setShowSettings(false)}
          onSave={(updated) => {
            setConfig(updated);
            if (!updated.projectRoutes.some((r) => r.id === selectedRouteId)) {
              setSelectedRouteId(updated.defaultRouteId || updated.projectRoutes[0]?.id || "daily");
            }
          }}
        />
      )}
    </div>
  );
};
