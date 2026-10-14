import React, { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AppConfig, SaveSnippetPayload } from "../types";
import { Send, X, Folder, Calendar, Tag, ShieldAlert, Sparkles, Check, Settings as SettingsIcon } from "lucide-react";
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

        // Se o caminho for o padrão não configurado, abre o onboarding
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

    // Ouvinte para receber o recorte recém-tirado
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
      setErrorMsg("Digite um resumo ou observação.");
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

  // Se estiver em modo de Onboarding
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
      {/* Container estilo Warp Terminal com transparência sutil e profundidade sólida */}
      <div className="w-full max-w-[660px] bg-[#0f1117]/96 backdrop-blur-2xl border border-white/[0.09] rounded-2xl shadow-[0_30px_70px_rgba(0,0,0,0.85)] p-5 text-zinc-100 flex flex-col gap-3.5 transition-all animate-in fade-in zoom-in-95 duration-150">
        
        {/* Top Header: Rotas de Projetos com Teclas de Atalho */}
        <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
            {config?.projectRoutes.map((route, idx) => {
              const isSelected = route.id === selectedRouteId;
              return (
                <button
                  key={route.id}
                  onClick={() => setSelectedRouteId(route.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600/90 text-white shadow-md shadow-indigo-600/25 border border-indigo-400/40"
                      : "bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200 border border-white/[0.04]"
                  }`}
                >
                  <span className="font-mono text-[10px] opacity-70">
                    [{route.keyShortcut || idx + 1}]
                  </span>
                  {route.targetType === "daily_note" && <Calendar className="w-3.5 h-3.5" />}
                  {route.targetType === "file" && <Folder className="w-3.5 h-3.5" />}
                  {route.targetType === "folder" && (
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span className="tracking-tight">{route.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition cursor-pointer"
              title="Configurações do Vault & Projetos"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleCancel}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition cursor-pointer"
              title="Fechar (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corpo Principal: Thumbnail + Inputs */}
        <div className="flex gap-3.5">
          {/* Thumbnail do Recorte */}
          <div className="w-32 h-28 rounded-xl bg-[#141620] border border-white/[0.08] flex items-center justify-center overflow-hidden shrink-0 relative group shadow-inner">
            {imageBase64 ? (
              <img
                src={imageBase64}
                alt="Recorte"
                className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition duration-300"
              />
            ) : (
              <div className="text-[11px] text-zinc-500 flex flex-col items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span className="font-mono text-[10px]">Sem Recorte</span>
              </div>
            )}
          </div>

          {/* Campos de Entrada */}
          <div className="flex-1 flex flex-col gap-2.5">
            {/* Título com Autofocus */}
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
              placeholder="Resumo do recorte / Título do bug..."
              className="w-full bg-[#141620] border border-white/[0.08] focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/40 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none transition"
              autoFocus
            />

            {/* Mensagem / Observações de QA */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Observação detalhada de QA, passos de teste ou contexto..."
              rows={2}
              className="w-full bg-[#141620]/80 border border-white/[0.06] focus:border-indigo-500/60 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none resize-none transition"
            />
          </div>
        </div>

        {/* Tags Rápidas */}
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 pt-0.5">
          <Tag className="w-3.5 h-3.5 text-zinc-500 ml-1" />
          <span className="text-[11px] text-zinc-500">Tags:</span>
          {["qa", "bug", "ui", "p1", "daily"].map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition cursor-pointer ${
                  active
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-zinc-900/80 text-zinc-500 hover:text-zinc-300 border border-white/[0.05]"
                }`}
              >
                #{tag}
              </button>
            );
          })}
        </div>

        {/* Mensagem de Erro (se houver) */}
        {errorMsg && (
          <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/60 px-3 py-1.5 rounded-xl">
            {errorMsg}
          </div>
        )}

        {/* Rodapé: Destino & Ações */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.08] text-xs text-zinc-500">
          <div className="flex items-center gap-1.5 truncate max-w-[360px]">
            <span className="text-zinc-500 text-[11px]">↳ Destino:</span>
            <span className="text-zinc-300 font-mono text-[11px] truncate">
              {activeRoute?.targetType === "daily_note" && "Daily/YYYY-MM-DD.md"}
              {activeRoute?.targetType === "file" && (activeRoute.filePath || "Inbox.md")}
              {activeRoute?.targetType === "folder" &&
                `${activeRoute.folderPath}/YYYY-MM-DD_nota.md`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="px-2.5 py-1.5 text-zinc-400 hover:text-zinc-200 text-xs transition cursor-pointer"
            >
              Cancelar (Esc)
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`px-4 py-2 rounded-xl font-medium text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                saveSuccess
                  ? "bg-emerald-600 text-white shadow-emerald-600/30"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 active:scale-[0.99]"
              }`}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvo no Obsidian!</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    Salvar <kbd className="font-mono text-[10px] opacity-70">Ctrl+Enter</kbd>
                  </span>
                </>
              )}
            </button>
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
