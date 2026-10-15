import React, { useState, useEffect, useRef } from "react";
import { Loader2, Copy, Check, FileCode, X, AlertCircle, ScanText } from "lucide-react";
import {
  extractTextFromImage,
  formatAsMarkdownCodeBlock,
  copyTextToClipboard,
  OcrProgressInfo,
} from "../lib/ocrEngine";

export interface OcrButtonProps {
  /** Imagem em base64 (recorte atual) */
  imageBase64: string;
  /** Callback para inserir o bloco de código Markdown no campo de anotações */
  onInsertMarkdown?: (markdownCodeBlock: string) => void;
  /** Classe CSS customizada opcional */
  className?: string;
}

export const OcrButton: React.FC<OcrButtonProps> = ({
  imageBase64,
  onInsertMarkdown,
  className = "",
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("reconhecendo texto...");
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [showPopover, setShowPopover] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [insertSuccess, setInsertSuccess] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Invalida o cache se a imagem mudar (novo recorte)
  useEffect(() => {
    setExtractedText(null);
    setShowPopover(false);
    setErrorMessage(null);
    setIsLoading(false);
    setCopySuccess(false);
    setInsertSuccess(false);
  }, [imageBase64]);

  // Fechar popover com Escape (fase de captura para não fechar a janela do app)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showPopover) {
        e.stopPropagation();
        setShowPopover(false);
      }
    };
    if (showPopover) {
      window.addEventListener("keydown", handleKeyDown, true);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [showPopover]);

  // Fechar popover ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowPopover(false);
      }
    };

    if (showPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPopover]);

  // Limpar timeout ao desmontar
  useEffect(() => {
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  const handleStartOcr = async () => {
    if (isLoading) return;

    // Se já temos o texto extraído para esta imagem, apenas reabrimos o menu de ações
    if (extractedText) {
      setShowPopover(true);
      return;
    }

    if (!imageBase64) {
      showFallbackError("Nenhum recorte disponível para OCR");
      return;
    }

    setIsLoading(true);
    setLoadingStatus("reconhecendo texto...");
    setErrorMessage(null);

    try {
      const text = await extractTextFromImage(imageBase64, (info: OcrProgressInfo) => {
        setLoadingStatus(info.status);
      });

      if (!text || text.trim().length === 0) {
        showFallbackError("Nenhum texto legível encontrado na imagem");
        setExtractedText(null);
        setShowPopover(false);
      } else {
        setExtractedText(text);
        // Copia automaticamente para a área de transferência para máxima agilidade
        await copyTextToClipboard(text);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 3000);
        setShowPopover(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao processar imagem";
      showFallbackError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const showFallbackError = (msg: string) => {
    setErrorMessage(msg);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    errorTimeoutRef.current = setTimeout(() => {
      setErrorMessage(null);
    }, 3500);
  };

  const handleCopyClipboard = async () => {
    if (!extractedText) return;
    const ok = await copyTextToClipboard(extractedText);
    if (ok) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } else {
      showFallbackError("Falha ao acessar área de transferência");
    }
  };

  const handleInsertMarkdown = () => {
    if (!extractedText) return;
    const markdownBlock = formatAsMarkdownCodeBlock(extractedText);
    onInsertMarkdown?.(markdownBlock);
    setInsertSuccess(true);
    setTimeout(() => {
      setInsertSuccess(false);
      setShowPopover(false);
    }, 600);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Botão Principal de OCR */}
      <button
        type="button"
        onClick={handleStartOcr}
        disabled={isLoading || !imageBase64}
        className={`w-full py-1 px-2 rounded-md bg-[#16181d] hover:bg-[#1e222a] border border-[#282d37] hover:border-[#ff4d4d]/50 text-[#f5f5f7] text-[11px] font-mono flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        title="Extrair texto da imagem via OCR e copiar automaticamente"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin text-[#ff4d4d]" />
            <span className="truncate max-w-[65px]">{loadingStatus.includes("reconhec") ? "lendo..." : loadingStatus}</span>
          </>
        ) : (
          <>
            <ScanText className="w-3 h-3 text-[#ff4d4d]" strokeWidth={2} />
            <span>OCR</span>
          </>
        )}
      </button>

      {/* Fallback elegante em caso de ausência de texto legível ou erro */}
      {errorMessage && (
        <div className="absolute left-0 bottom-full mb-1.5 z-40 w-56 p-2 rounded-md bg-[#1e222a] border border-[#ff4d4d]/40 text-[#ff4d4d] text-[10px] font-mono shadow-xl flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#ff4d4d] mt-0.5" />
          <span className="leading-tight flex-1">{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-[#ff4d4d]/70 hover:text-[#ff4d4d] cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Popover / Menu de Ações com o Texto Extraído (Abre para cima para nunca ser cortado pela janela) */}
      {showPopover && extractedText && (
        <div className="absolute left-0 bottom-full mb-2 z-50 w-80 sm:w-88 p-3 rounded-md bg-[#111317] border border-[#282d37] shadow-2xl backdrop-blur-md text-[#f5f5f7] flex flex-col gap-2 font-mono">
          {/* Cabeçalho do Popover */}
          <div className="flex items-center justify-between pb-1.5 border-b border-[#282d37]">
            <div className="flex items-center gap-1.5 text-xs text-[#ff4d4d] font-medium">
              <ScanText className="w-3.5 h-3.5 text-[#ff4d4d]" />
              <span>Texto Reconhecido</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPopover(false)}
              className="text-[#86868b] hover:text-[#f5f5f7] p-1 rounded hover:bg-[#1e222a] transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Banner discreto de feedback quando auto-copiado */}
          {copySuccess && (
            <div className="px-2 py-1 rounded bg-[#10b981]/15 border border-[#10b981]/40 text-[#34d399] text-[10px] flex items-center gap-1.5">
              <Check className="w-3 h-3 shrink-0" />
              <span>Texto copiado automaticamente para o clipboard!</span>
            </div>
          )}

          {/* Preview do Texto Extraído com Rolagem */}
          <div className="max-h-32 overflow-y-auto bg-[#16181d] border border-[#282d37] rounded-md p-2.5 text-[11px] leading-relaxed text-[#f5f5f7] whitespace-pre-wrap select-text selection:bg-[#ff4d4d]/30 selection:text-white font-mono">
            {extractedText}
          </div>

          {/* Ações Rápidas em grade lado a lado */}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            {/* Ação 1: Copiar para Área de Transferência */}
            <button
              type="button"
              onClick={handleCopyClipboard}
              className={`py-1.5 px-2 rounded-md text-[11px] font-mono flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                copySuccess
                  ? "bg-[#10b981]/20 border-[#10b981]/60 text-[#34d399]"
                  : "bg-[#16181d] hover:bg-white/10 border-[#282d37] hover:border-white/20 text-[#f5f5f7] active:scale-[0.98]"
              }`}
            >
              {copySuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#34d399]" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#ff4d4d]" />
                  <span>Copiar Tudo</span>
                </>
              )}
            </button>

            {/* Ação 2: Inserir no campo de anotações como bloco de código Markdown */}
            {onInsertMarkdown && (
              <button
                type="button"
                onClick={handleInsertMarkdown}
                className={`py-1.5 px-2 rounded-md text-[11px] font-mono flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                  insertSuccess
                    ? "bg-[#10b981]/20 border-[#10b981]/60 text-[#34d399]"
                    : "bg-[#16181d] hover:bg-white/10 border-[#282d37] hover:border-white/20 text-[#f5f5f7] active:scale-[0.98]"
                }`}
              >
                {insertSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#34d399]" />
                    <span>Inserido!</span>
                  </>
                ) : (
                  <>
                    <FileCode className="w-3.5 h-3.5 text-[#ff4d4d]" />
                    <span>Inserir no Card</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
