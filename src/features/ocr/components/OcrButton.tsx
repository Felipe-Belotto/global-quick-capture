import React, { useState, useEffect, useRef } from "react";
import { Loader2, Check, ScanText, AlertCircle } from "lucide-react";
import {
  extractTextFromImage,
  copyTextToClipboard,
  OcrProgressInfo,
} from "../lib/ocrEngine";

export interface OcrButtonProps {
  /** Imagem em base64 (recorte atual) */
  imageBase64: string;
  /** Callback para inserir o texto extraído no campo de anotações */
  onInsertText?: (text: string) => void;
  /** Retrocompatibilidade */
  onInsertMarkdown?: (markdownText: string) => void;
  /** Classe CSS customizada opcional */
  className?: string;
}

export const OcrButton: React.FC<OcrButtonProps> = ({
  imageBase64,
  onInsertText,
  onInsertMarkdown,
  className = "",
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStatus, setLoadingStatus] = useState<string>("lendo...");
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Invalida cache se a imagem mudar
  useEffect(() => {
    setExtractedText(null);
    setStatusSuccess(false);
    setStatusError(null);
    setIsLoading(false);
  }, [imageBase64]);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const handleStartOcr = async () => {
    if (isLoading) return;

    if (!imageBase64) {
      showError("Sem recorte");
      return;
    }

    // Se já tiver texto extraído em cache, reinsere direto
    if (extractedText) {
      await copyTextToClipboard(extractedText);
      if (onInsertText) onInsertText(extractedText);
      else if (onInsertMarkdown) onInsertMarkdown(extractedText);
      showSuccess();
      return;
    }

    setIsLoading(true);
    setLoadingStatus("lendo...");
    setStatusError(null);

    try {
      const text = await extractTextFromImage(imageBase64, (info: OcrProgressInfo) => {
        setLoadingStatus(info.status.includes("reconhec") ? "lendo..." : "processando...");
      });

      if (!text || text.trim().length === 0) {
        setExtractedText(null);
        showError("Sem texto");
      } else {
        const cleanText = text.trim();
        setExtractedText(cleanText);
        // Copia automaticamente para o clipboard
        await copyTextToClipboard(cleanText);
        // Insere diretamente na anotação ao lado
        if (onInsertText) {
          onInsertText(cleanText);
        } else if (onInsertMarkdown) {
          onInsertMarkdown(cleanText);
        }
        showSuccess();
      }
    } catch (err: unknown) {
      console.error("Erro no OCR:", err);
      showError("Erro OCR");
    } finally {
      setIsLoading(false);
    }
  };

  const showSuccess = () => {
    setStatusSuccess(true);
    setStatusError(null);
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = setTimeout(() => {
      setStatusSuccess(false);
    }, 2500);
  };

  const showError = (msg: string) => {
    setStatusError(msg);
    setStatusSuccess(false);
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = setTimeout(() => {
      setStatusError(null);
    }, 2500);
  };

  return (
    <button
      type="button"
      onClick={handleStartOcr}
      disabled={isLoading || !imageBase64}
      className={`w-full py-1.5 px-2 rounded-md border text-[11px] font-mono flex items-center justify-center gap-1.5 transition cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${
        statusSuccess
          ? "bg-[#10b981]/15 border-[#10b981]/50 text-[#34d399]"
          : statusError
          ? "bg-[#ff4d4d]/15 border-[#ff4d4d]/50 text-[#ff4d4d]"
          : "bg-[#16181d] hover:bg-[#1e222a] border-[#282d37] hover:border-[#ff4d4d]/50 text-[#f5f5f7]"
      } ${className}`}
      title={
        statusSuccess
          ? "Texto extraído e inserido na anotação ao lado (e copiado para o clipboard)!"
          : "Extrair texto da imagem e inserir diretamente na anotação ao lado"
      }
    >
      {isLoading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff4d4d]" />
          <span className="truncate">{loadingStatus}</span>
        </>
      ) : statusSuccess ? (
        <>
          <Check className="w-3.5 h-3.5 text-[#34d399]" strokeWidth={2.5} />
          <span className="font-medium">Inserido!</span>
        </>
      ) : statusError ? (
        <>
          <AlertCircle className="w-3.5 h-3.5 text-[#ff4d4d]" />
          <span>{statusError}</span>
        </>
      ) : (
        <>
          <ScanText className="w-3.5 h-3.5 text-[#ff4d4d]" strokeWidth={2} />
          <span>OCR</span>
        </>
      )}
    </button>
  );
};
