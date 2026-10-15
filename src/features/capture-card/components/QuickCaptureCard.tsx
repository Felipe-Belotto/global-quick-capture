import React, { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AppConfig, SaveSnippetPayload } from "../../../shared/types";
import { getTodayFormatted } from "../../../shared/lib/date";
import { CardHeader } from "./CardHeader";
import { SettingsModal } from "../../settings";
import { OnboardingModal } from "../../onboarding";
import { AnnotationEditorModal } from "../../annotations";
import { useVaultAutocomplete } from "../hooks/useVaultAutocomplete";
import { AutocompletePopover } from "./AutocompletePopover";
import { MarkdownContextMenu } from "./MarkdownContextMenu";
import { OcrButton } from "../../ocr";
import { AppInfoModal } from "../../updater";
import { ArrowDownToLine, PenTool, Check } from "lucide-react";

export const QuickCaptureCard: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("daily");
  const [description, setDescription] = useState<string>("");
  const [imageBase64, setImageBase64] = useState<string>("");
  const [showAnnotationEditor, setShowAnnotationEditor] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showAbout, setShowAbout] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    hasSelection: boolean;
  }>({ isOpen: false, x: 0, y: 0, hasSelection: false });

  const descInputRef = useRef<HTMLTextAreaElement | null>(null);
  const isSavingRef = useRef<boolean>(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            setImageBase64(event.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const autocomplete = useVaultAutocomplete({
    value: description,
    onChange: setDescription,
    textareaRef: descInputRef,
    config,
  });

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

    const unlistenSettings = listen("open_settings", () => {
      setShowSettings(true);
    });

    return () => {
      unlistenLoad.then((f) => f());
      unlistenError.then((f) => f());
      unlistenSettings.then((f) => f());
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const textarea = descInputRef.current;
    const hasSel = !!(textarea && textarea.selectionStart !== textarea.selectionEnd);
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      hasSelection: hasSel,
    });
  };

  const applyFormat = (prefix: string, suffix = prefix) => {
    const textarea = descInputRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = description;
    const selected = val.substring(start, end);
    const replacement = `${prefix}${selected || "texto"}${suffix}`;
    const nextVal = val.substring(0, start) + replacement + val.substring(end);
    setDescription(nextVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selected ? selected.length : "texto".length)
      );
    }, 10);
  };

  const insertTemplate = (template: string) => {
    const textarea = descInputRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = description;
    const nextVal = val.substring(0, start) + template + val.substring(end);
    setDescription(nextVal);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + template.length, start + template.length);
    }, 10);
  };

  const handleClipboard = async (action: "cut" | "copy" | "paste" | "select_all") => {
    const textarea = descInputRef.current;
    if (!textarea) return;
    if (action === "select_all") {
      textarea.select();
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = description.substring(start, end);

    if (action === "copy") {
      if (selected) await navigator.clipboard.writeText(selected);
    } else if (action === "cut") {
      if (selected) {
        await navigator.clipboard.writeText(selected);
        const nextVal = description.substring(0, start) + description.substring(end);
        setDescription(nextVal);
        setTimeout(() => {
          textarea.setSelectionRange(start, start);
        }, 10);
      }
    } else if (action === "paste") {
      try {
        const text = await navigator.clipboard.readText();
        const nextVal = description.substring(0, start) + text + description.substring(end);
        setDescription(nextVal);
        setTimeout(() => {
          textarea.setSelectionRange(start + text.length, start + text.length);
        }, 10);
      } catch (err) {
        console.warn("Falha ao colar da área de transferência:", err);
      }
    }
  };

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
        if (autocomplete.isOpen) {
          autocomplete.close();
        } else if (showAnnotationEditor) {
          setShowAnnotationEditor(false);
        } else if (showSettings) {
          setShowSettings(false);
        } else if (showAbout) {
          setShowAbout(false);
        } else {
          handleCancel();
        }
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        if (document.activeElement?.tagName !== "TEXTAREA") {
          e.preventDefault();
          handleSave();
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const hasOpenModal =
          showSettings ||
          showAbout ||
          showAnnotationEditor ||
          showOnboarding;
        if (
          !hasOpenModal &&
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
  }, [
    handleCancel,
    handleSave,
    config,
    showSettings,
    showAbout,
    showOnboarding,
    showAnnotationEditor,
    autocomplete,
  ]);

  // Suporte a markdown inteligente no textarea
  const handleMarkdownKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 1. O autocomplete captura setas Cima/Baixo, Enter, Tab e Esc com prioridade máxima
    if (autocomplete.handleKeyDown(e)) {
      return;
    }

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
    <div className="w-full h-full flex flex-col p-2 select-none overflow-hidden">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropFile}
        className={`w-full h-full bg-[#111317] border rounded-md shadow-2xl text-[#f5f5f7] flex flex-col font-sans relative transition-all duration-150 ${
          isDraggingFile ? "border-[#ff4d4d] ring-2 ring-[#ff4d4d]/40" : "border-[#282d37]"
        }`}
      >
        {/* Overlay visual ao arrastar arquivo de imagem para dentro do card */}
        {isDraggingFile && (
          <div className="absolute inset-0 bg-[#111317]/95 z-40 rounded-md flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#ff4d4d] pointer-events-none">
            <ArrowDownToLine className="w-7 h-7 text-[#ff4d4d] animate-bounce" strokeWidth={1.75} />
            <span className="font-mono text-xs text-[#ff4d4d] font-medium tracking-tight">Solte a imagem para carregar</span>
            <span className="font-mono text-[10px] text-[#86868b]">Suporta PNG, JPG, WEBP</span>
          </div>
        )}

        {/* Cabeçalho Modular com Drag Handle e Tabs */}
        <CardHeader
          config={config}
          selectedRouteId={selectedRouteId}
          onSelectRoute={setSelectedRouteId}
          onOpenSettings={() => setShowSettings(true)}
          onOpenAbout={() => setShowAbout(true)}
          onClose={handleCancel}
        />

        {/* Corpo Principal Flexível */}
        <div className="p-3.5 flex-1 flex flex-col gap-3 overflow-hidden">
          <div className="flex-1 flex gap-3 min-h-[140px]">
            {/* Thumbnail do Recorte: clique direto abre anotação */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <div
                onClick={() => imageBase64 && setShowAnnotationEditor(true)}
                className="group relative w-36 h-28 rounded-md bg-[#16181d] border border-[#282d37] hover:border-[#ff4d4d]/60 flex items-center justify-center overflow-hidden cursor-pointer transition"
                title="Clique na imagem para desenhar setas, caixas ou censurar"
              >
                {imageBase64 ? (
                  <>
                    <img
                      src={imageBase64}
                      alt="Recorte"
                      className="w-full h-full object-cover rounded-sm group-hover:scale-105 transition duration-200"
                    />
                    <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition font-mono text-[11px] text-[#f5f5f7] gap-1.5 backdrop-blur-[1px]">
                      <PenTool className="w-3.5 h-3.5 text-[#ff4d4d]" strokeWidth={2} />
                      <span>Editar</span>
                    </div>
                  </>
                ) : (
                  <span className="text-[11px] font-mono text-[#86868b]">sem recorte</span>
                )}
              </div>

              {/* Botão de OCR limpo embaixo da imagem */}
              {/* Botão de OCR limpo embaixo da imagem: insere direto na anotação ao lado */}
              {imageBase64 && (
                <div className="w-36">
                  <OcrButton
                    imageBase64={imageBase64}
                    className="w-full"
                    onInsertText={(text) => {
                      setDescription((prev) => (prev.trim() ? `${prev}\n\n${text}` : text));
                      setTimeout(() => {
                        const textarea = descInputRef.current;
                        if (textarea) {
                          textarea.focus();
                          textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
                        }
                      }, 50);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Campo de Markdown com botão direito do Obsidian e atalhos */}
            <div className="relative flex-1 flex flex-col font-mono h-full">
              <textarea
                ref={descInputRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={handleMarkdownKeyDown}
                onContextMenu={handleContextMenu}
                placeholder="Anotações em Markdown..."
                rows={5}
                className="w-full h-full min-h-[125px] flex-1 bg-[#16181d] border border-[#282d37] focus:border-[#ff4d4d]/70 focus:ring-1 focus:ring-[#ff4d4d]/20 rounded-md px-3 py-2.5 text-xs text-[#f5f5f7] placeholder-[#585e6a] outline-none resize-y transition leading-relaxed font-mono"
                autoFocus
              />

              <AutocompletePopover
                isOpen={autocomplete.isOpen}
                mode={autocomplete.mode}
                items={autocomplete.items}
                selectedIndex={autocomplete.selectedIndex}
                position={autocomplete.position}
                onSelect={autocomplete.applySuggestion}
                onHover={autocomplete.setSelectedIndex}
              />

              <MarkdownContextMenu
                isOpen={contextMenu.isOpen}
                position={{ x: contextMenu.x, y: contextMenu.y }}
                onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
                onApplyFormat={applyFormat}
                onInsertTemplate={insertTemplate}
                onClipboardAction={handleClipboard}
                hasSelection={contextMenu.hasSelection}
              />
            </div>
          </div>

          {errorMsg && (
            <div className="text-xs font-mono text-[#ff4d4d] bg-[#1e222a] border border-[#ff4d4d]/40 px-3 py-1.5 rounded-md">
              ! {errorMsg}
            </div>
          )}

          {/* Rodapé: Destino & Ações */}
          <div className="flex items-center justify-between pt-2 border-t border-[#282d37] text-xs font-mono text-[#86868b]">
            <div className="truncate max-w-[360px]">
              <span className="opacity-60">destino: </span>
              <span className="text-[#f5f5f7]">
                {activeRoute?.targetType === "daily_note" && `Daily/${todayFormatted}.md`}
                {activeRoute?.targetType === "file" && (activeRoute.filePath || "Inbox.md")}
                {activeRoute?.targetType === "folder" && `${activeRoute.folderPath}/${todayFormatted}.md`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#1e222a] rounded-md transition cursor-pointer"
              >
                Cancelar
              </button>

              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`px-4 py-1.5 rounded-md font-medium text-xs font-mono transition cursor-pointer flex items-center gap-1.5 active:scale-[0.98] ${
                  saveSuccess
                    ? "bg-[#10b981]/15 border border-[#10b981]/50 text-[#10b981]"
                    : "bg-[#16181d] border border-[#282d37] hover:bg-white/10 hover:border-white/25 text-[#f5f5f7]"
                }`}
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#10b981]" strokeWidth={2.5} />
                    <span>Salvo!</span>
                  </>
                ) : (
                  <span>Salvar</span>
                )}
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

      {/* Modal de Sobre, Dispositivo & Atualizações */}
      {showAbout && (
        <AppInfoModal onClose={() => setShowAbout(false)} />
      )}
    </div>
  );
};
