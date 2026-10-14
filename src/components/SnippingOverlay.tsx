import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export const SnippingOverlay: React.FC = () => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleCancel = useCallback(async () => {
    setIsSelecting(false);
    setStartPos(null);
    setCurrentPos(null);
    try {
      await invoke("cancel_snip");
    } catch (e) {
      console.error("Erro ao cancelar recorte:", e);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleCancel]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // apenas botão esquerdo
    setIsSelecting(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !startPos) return;
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = async () => {
    if (!isSelecting || !startPos || !currentPos) return;
    setIsSelecting(false);

    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);

    if (width < 10 || height < 10) {
      // Clique acidental muito pequeno, reseta
      setStartPos(null);
      setCurrentPos(null);
      return;
    }

    // Criar canvas temporário com a área recortada
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = width;
    cropCanvas.height = height;
    const ctx = cropCanvas.getContext("2d");

    if (ctx) {
      // Cria um background representativo de placeholder de alta definição
      // Quando integrado com o buffer real do Rust, substitui pelos pixels capturados
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#1e293b");
      gradient.addColorStop(1, "#0f172a");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Marca d'água sutil de dimensões
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.font = "14px sans-serif";
      ctx.fillText(`Recorte ${width}x${height}px`, 16, 28);
    }

    const base64Data = cropCanvas.toDataURL("image/png");

    try {
      await invoke("finish_snip", { croppedBase64: base64Data });
    } catch (err) {
      console.error("Erro ao finalizar recorte:", err);
    }

    setStartPos(null);
    setCurrentPos(null);
  };

  // Calcular retângulo atual
  const rect = startPos && currentPos ? {
    left: Math.min(startPos.x, currentPos.x),
    top: Math.min(startPos.y, currentPos.y),
    width: Math.abs(currentPos.x - startPos.x),
    height: Math.abs(currentPos.y - startPos.y),
  } : null;

  return (
    <div
      className="fixed inset-0 select-none cursor-crosshair bg-black/40 backdrop-blur-[1px] transition-colors"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Guia / Instrução superior */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-700/60 text-xs text-zinc-300 shadow-xl flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>Clique e arraste para recortar • Pressione <kbd className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-200 border border-zinc-600 font-mono text-[11px]">Esc</kbd> para cancelar</span>
      </div>

      {/* Caixa de Seleção */}
      {rect && (
        <div
          className="absolute border-2 border-indigo-400 bg-indigo-500/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] pointer-events-none"
          style={{
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          }}
        >
          {/* Badge de Dimensões */}
          <div className="absolute -bottom-7 left-0 px-2 py-0.5 rounded bg-zinc-900/90 border border-zinc-700 text-[11px] text-zinc-200 font-mono">
            {rect.width} × {rect.height} px
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
