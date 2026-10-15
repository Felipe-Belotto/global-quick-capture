import React, { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Crop,
  Monitor,
  ScanText,
  Copy,
  Download,
  FileEdit,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { extractTextFromImage } from "../../ocr/lib/ocrEngine";

interface CropResult {
  base64: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const SnippingOverlay: React.FC = () => {
  const [screenImage, setScreenImage] = useState<string>("");
  const [isSelecting, setIsSelecting] = useState(false);
  const [isCtrlHeld, setIsCtrlHeld] = useState<boolean>(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [completedCrop, setCompletedCrop] = useState<CropResult | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState<boolean>(false);
  const [ocrSuccess, setOcrSuccess] = useState<boolean>(false);

  const imgRef = useRef<HTMLImageElement | null>(null);

  // Inicializar overlay quando acionado
  useEffect(() => {
    const unlisten = listen<string>("start_snip", (event) => {
      if (event.payload) {
        setScreenImage(event.payload);
      }
      setIsSelecting(false);
      setIsCtrlHeld(false);
      setStartPos(null);
      setCurrentPos(null);
      setCompletedCrop(null);
      setIsOcrLoading(false);
      setOcrSuccess(false);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const handleCancel = useCallback(async () => {
    if (completedCrop) {
      // Se há um recorte concluído, primeiro cancela a seleção
      setCompletedCrop(null);
      setStartPos(null);
      setCurrentPos(null);
      return;
    }

    setIsSelecting(false);
    setIsCtrlHeld(false);
    setStartPos(null);
    setCurrentPos(null);
    setCompletedCrop(null);
    try {
      await invoke("cancel_snip");
    } catch (e) {
      console.error("Erro ao cancelar recorte:", e);
    }
  }, [completedCrop]);

  // Função auxiliar para gerar recorte em canvas
  const generateCroppedImage = useCallback(
    async (x: number, y: number, width: number, height: number): Promise<string> => {
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = width;
      cropCanvas.height = height;
      const ctx = cropCanvas.getContext("2d");

      if (ctx && screenImage) {
        const img = new Image();
        img.src = screenImage;

        await new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.onload = () => resolve();
          }
        });

        const scaleX = img.naturalWidth / window.innerWidth;
        const scaleY = img.naturalHeight / window.innerHeight;

        const sx = x * scaleX;
        const sy = y * scaleY;
        const sw = width * scaleX;
        const sh = height * scaleY;

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
        return cropCanvas.toDataURL("image/png");
      }

      return screenImage || "";
    },
    [screenImage]
  );

  // Ações de Saída
  const handleSendToObsidian = useCallback(
    async (crop: CropResult) => {
      try {
        await invoke("finish_snip", {
          croppedBase64: crop.base64,
          x: crop.x,
          y: crop.y,
          width: crop.width,
          height: crop.height,
        });
      } catch (err) {
        console.error("Erro ao enviar para Obsidian:", err);
      }
    },
    []
  );

  const handleCopyToClipboard = useCallback(
    async (crop: CropResult) => {
      try {
        await invoke("copy_image_to_clipboard_cmd", { croppedBase64: crop.base64 });
      } catch (err) {
        console.error("Erro ao copiar imagem:", err);
      }
    },
    []
  );

  const handleSaveToDisk = useCallback(
    async (crop: CropResult) => {
      try {
        await invoke("save_image_to_disk_cmd", { croppedBase64: crop.base64 });
      } catch (err) {
        console.error("Erro ao salvar imagem em disco:", err);
      }
    },
    []
  );

  const handleRunOcr = useCallback(
    async (crop: CropResult) => {
      if (isOcrLoading) return;
      setIsOcrLoading(true);
      try {
        const text = await extractTextFromImage(crop.base64);
        if (text && text.trim().length > 0) {
          await navigator.clipboard.writeText(text.trim());
          setOcrSuccess(true);
          setTimeout(async () => {
            await invoke("cancel_snip");
          }, 400);
        } else {
          setIsOcrLoading(false);
        }
      } catch (err) {
        console.error("Erro ao extrair OCR:", err);
        setIsOcrLoading(false);
      }
    },
    [isOcrLoading]
  );

  // Selecionar tela inteira imediatamente
  const handleSelectFullscreen = useCallback(async () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const base64 = await generateCroppedImage(0, 0, w, h);
    setCompletedCrop({
      base64,
      x: 0,
      y: 0,
      width: w,
      height: h,
    });
    setStartPos({ x: 0, y: 0 });
    setCurrentPos({ x: w, y: h });
  }, [generateCroppedImage]);

  // Teclado
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
      } else if (e.key === "Control" || e.ctrlKey) {
        setIsCtrlHeld(true);
      } else if (e.key === "1") {
        // Modo recorte / limpa tela cheia
        setCompletedCrop(null);
        setStartPos(null);
        setCurrentPos(null);
      } else if (e.key === "2") {
        // Modo tela inteira
        handleSelectFullscreen();
      } else if (e.key === "Enter" && completedCrop) {
        handleSendToObsidian(completedCrop);
      } else if (e.ctrlKey && (e.key === "c" || e.key === "C") && completedCrop) {
        e.preventDefault();
        handleCopyToClipboard(completedCrop);
      } else if (e.ctrlKey && (e.key === "s" || e.key === "S") && completedCrop) {
        e.preventDefault();
        handleSaveToDisk(completedCrop);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || !e.ctrlKey) {
        setIsCtrlHeld(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    handleCancel,
    completedCrop,
    handleSelectFullscreen,
    handleSendToObsidian,
    handleCopyToClipboard,
    handleSaveToDisk,
  ]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Se clicar em botões, não iniciar seleção
    if ((e.target as HTMLElement).closest("button")) return;

    setCompletedCrop(null);
    setIsSelecting(true);
    if (e.ctrlKey) setIsCtrlHeld(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.ctrlKey !== isCtrlHeld) {
      setIsCtrlHeld(e.ctrlKey);
    }
    if (!isSelecting || !startPos) return;
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = async (e: React.MouseEvent) => {
    if (!isSelecting || !startPos || !currentPos) return;
    setIsSelecting(false);

    const isQuickSave = e.ctrlKey || isCtrlHeld;
    setIsCtrlHeld(false);

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);

    if (width < 12 || height < 12) {
      setStartPos(null);
      setCurrentPos(null);
      setCompletedCrop(null);
      return;
    }

    const croppedBase64 = await generateCroppedImage(x, y, width, height);

    if (isQuickSave) {
      try {
        await invoke("quick_save_and_copy_cmd", { croppedBase64 });
      } catch (err) {
        console.error("Erro ao salvar direto:", err);
      }
      setStartPos(null);
      setCurrentPos(null);
      return;
    }

    // Mantém o recorte ativo para a Toolbar de Ações
    setCompletedCrop({
      base64: croppedBase64,
      x,
      y,
      width,
      height,
    });
  };

  const rect =
    startPos && currentPos
      ? {
          left: Math.min(startPos.x, currentPos.x),
          top: Math.min(startPos.y, currentPos.y),
          width: Math.abs(currentPos.x - startPos.x),
          height: Math.abs(currentPos.y - startPos.y),
        }
      : null;

  // Posição inteligente da Action Toolbar (abaixo da seleção ou acima se perto do rodapé)
  const getActionToolbarPos = () => {
    if (!rect) return { top: 16, left: window.innerWidth / 2 };
    const dockHeight = 40;
    const gap = 8;
    const isCloseToBottom = rect.top + rect.height + dockHeight + gap > window.innerHeight - 16;

    const top = isCloseToBottom
      ? Math.max(16, rect.top - dockHeight - gap)
      : rect.top + rect.height + gap;

    const left = Math.min(
      window.innerWidth - 160,
      Math.max(160, rect.left + rect.width / 2)
    );

    return { top, left };
  };

  const actionPos = getActionToolbarPos();

  return (
    <div
      className="fixed inset-0 select-none cursor-crosshair overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {screenImage && (
        <img
          ref={imgRef}
          src={screenImage}
          alt="Frozen Screen"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        />
      )}

      {/* Máscara de escurecimento */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      {/* 1. Top Mode Dock (Barra Superior de Modos de Captura) */}
      {!completedCrop && !isSelecting && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1 rounded-[8px] bg-[#111317]/95 border border-[#282d37] shadow-2xl backdrop-blur-md">
          {/* Botão Recorte */}
          <button
            type="button"
            className="group relative flex items-center justify-center w-8 h-8 rounded-[8px] text-[#ff4d4d] bg-[#1c2028] transition hover:bg-[#252a35] cursor-pointer"
          >
            <Crop size={16} />
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-[4px] bg-[#181a1f] border border-[#2b303c] text-[12px] leading-[16px] font-mono text-[#f5f5f7] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
              Recortar Área [1]
            </span>
          </button>

          {/* Botão Tela Inteira */}
          <button
            type="button"
            onClick={handleSelectFullscreen}
            className="group relative flex items-center justify-center w-8 h-8 rounded-[8px] text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#252a35] transition cursor-pointer"
          >
            <Monitor size={16} />
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-[4px] bg-[#181a1f] border border-[#2b303c] text-[12px] leading-[16px] font-mono text-[#f5f5f7] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
              Tela Inteira [2]
            </span>
          </button>

          {/* Divisor vertical de 16px (múltiplo de 4) */}
          <div className="w-[1px] h-4 bg-[#282d37] mx-1" />

          {/* Botão Fechar */}
          <button
            type="button"
            onClick={handleCancel}
            className="group relative flex items-center justify-center w-8 h-8 rounded-[8px] text-[#86868b] hover:text-[#ff4d4d] hover:bg-[#252a35] transition cursor-pointer"
          >
            <X size={16} />
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-[4px] bg-[#181a1f] border border-[#2b303c] text-[12px] leading-[16px] font-mono text-[#f5f5f7] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
              Cancelar [Esc]
            </span>
          </button>
        </div>
      )}

      {/* Retângulo de Seleção */}
      {rect && (
        <div
          className={`absolute border pointer-events-none transition-[border-color] ${
            isCtrlHeld
              ? "border-[#ff4d4d] shadow-[0_0_0_9999px_rgba(0,0,0,0.65),0_0_16px_rgba(255,77,77,0.3)]"
              : "border-[#ff4d4d] shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
          }`}
          style={{
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          }}
        >
          {/* Badge de Dimensões (sempre múltiplos de 4 nos paddings) */}
          <div
            className={`absolute -top-6 left-0 px-2 py-1 rounded-[4px] border text-[12px] leading-[16px] font-mono whitespace-nowrap flex items-center gap-2 ${
              isCtrlHeld
                ? "bg-[#1c2028] border-[#ff4d4d] text-[#ff4d4d]"
                : "bg-[#111317] border-[#282d37] text-[#f5f5f7]"
            }`}
          >
            <span>
              {rect.width} × {rect.height} px
            </span>
            {isCtrlHeld && <span className="text-[#ff4d4d]">salvar rápido</span>}
          </div>
        </div>
      )}

      {/* 2. Floating Action Dock (Aparece quando a seleção é concluída) */}
      {completedCrop && (
        <div
          style={{
            top: `${actionPos.top}px`,
            left: `${actionPos.left}px`,
            transform: "translateX(-50%)",
          }}
          className="absolute z-50 flex items-center gap-1 p-1 rounded-[8px] bg-[#111317]/95 border border-[#282d37] shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Botão OCR */}
          <button
            type="button"
            onClick={() => handleRunOcr(completedCrop)}
            disabled={isOcrLoading}
            className="group relative flex items-center justify-center w-8 h-8 rounded-[8px] text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#252a35] transition cursor-pointer"
          >
            {isOcrLoading ? (
              <Loader2 size={16} className="animate-spin text-[#38bdf8]" />
            ) : ocrSuccess ? (
              <Check size={16} className="text-[#10b981]" />
            ) : (
              <ScanText size={16} />
            )}
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-[4px] bg-[#181a1f] border border-[#2b303c] text-[12px] leading-[16px] font-mono text-[#f5f5f7] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
              {ocrSuccess ? "Copiado!" : "Copiar Texto (OCR)"}
            </span>
          </button>

          {/* Botão Copiar Imagem */}
          <button
            type="button"
            onClick={() => handleCopyToClipboard(completedCrop)}
            className="group relative flex items-center justify-center w-8 h-8 rounded-[8px] text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#252a35] transition cursor-pointer"
          >
            <Copy size={16} />
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-[4px] bg-[#181a1f] border border-[#2b303c] text-[12px] leading-[16px] font-mono text-[#f5f5f7] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
              Copiar Imagem [Ctrl+C]
            </span>
          </button>

          {/* Botão Salvar PNG */}
          <button
            type="button"
            onClick={() => handleSaveToDisk(completedCrop)}
            className="group relative flex items-center justify-center w-8 h-8 rounded-[8px] text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#252a35] transition cursor-pointer"
          >
            <Download size={16} />
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-[4px] bg-[#181a1f] border border-[#2b303c] text-[12px] leading-[16px] font-mono text-[#f5f5f7] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
              Salvar PNG [Ctrl+S]
            </span>
          </button>

          {/* Divisor vertical */}
          <div className="w-[1px] h-4 bg-[#282d37] mx-1" />

          {/* Botão Enviar para Obsidian */}
          <button
            type="button"
            onClick={() => handleSendToObsidian(completedCrop)}
            className="group relative flex items-center justify-center w-8 h-8 rounded-[8px] text-[#f5f5f7] bg-[#ff4d4d] hover:bg-[#e04343] transition cursor-pointer shadow-[0_0_12px_rgba(255,77,77,0.35)]"
          >
            <FileEdit size={16} />
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-[4px] bg-[#181a1f] border border-[#2b303c] text-[12px] leading-[16px] font-mono text-[#f5f5f7] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
              Nota no Obsidian [Enter]
            </span>
          </button>

          {/* Botão Cancelar Recorte */}
          <button
            type="button"
            onClick={() => {
              setCompletedCrop(null);
              setStartPos(null);
              setCurrentPos(null);
            }}
            className="group relative flex items-center justify-center w-8 h-8 rounded-[8px] text-[#86868b] hover:text-[#ff4d4d] hover:bg-[#252a35] transition cursor-pointer"
          >
            <X size={16} />
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-[4px] bg-[#181a1f] border border-[#2b303c] text-[12px] leading-[16px] font-mono text-[#f5f5f7] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
              Descartar [Esc]
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
