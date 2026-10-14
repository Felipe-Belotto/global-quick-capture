import React, { useRef, useState, useEffect, useCallback } from "react";
import { drawArrow, drawHighlightRect, applyPixelate } from "../lib/drawUtils";

interface AnnotationEditorModalProps {
  imageBase64: string;
  onSave: (annotatedBase64: string) => void;
  onClose: () => void;
}

type ToolType = "arrow" | "rect" | "blur" | "pen";

export const AnnotationEditorModal: React.FC<AnnotationEditorModalProps> = ({
  imageBase64,
  onSave,
  onClose,
}) => {
  const [activeTool, setActiveTool] = useState<ToolType>("arrow");
  const [color, setColor] = useState<string>("#ef4444");
  const [history, setHistory] = useState<ImageData[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Inicializar Canvas com a imagem original
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = imageBase64;
    img.onload = () => {
      imgRef.current = img;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      if (tempCanvasRef.current) {
        tempCanvasRef.current.width = img.naturalWidth;
        tempCanvasRef.current.height = img.naturalHeight;
      }

      ctx.drawImage(img, 0, 0);
      const initial = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([initial]);
    };
  }, [imageBase64]);

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev, current]);
  }, []);

  const handleUndo = useCallback(() => {
    if (history.length <= 1) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const newHistory = history.slice(0, -1);
    const previous = newHistory[newHistory.length - 1];
    ctx.putImageData(previous, 0, 0);
    setHistory(newHistory);
  }, [history]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    setStartPos(coords);

    if (activeTool === "pen") {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    const canvas = canvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    if (!canvas || !tempCanvas) return;

    const ctx = canvas.getContext("2d");
    const tempCtx = tempCanvas.getContext("2d");
    if (!ctx || !tempCtx) return;

    const coords = getCanvasCoords(e);

    if (activeTool === "pen") {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
      return;
    }

    // Para ferramentas de forma (seta, rect, blur), desenha no tempCanvas para preview
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    if (history.length > 0) {
      tempCtx.putImageData(history[history.length - 1], 0, 0);
    }

    const x = Math.min(startPos.x, coords.x);
    const y = Math.min(startPos.y, coords.y);
    const w = Math.abs(coords.x - startPos.x);
    const h = Math.abs(coords.y - startPos.y);

    if (activeTool === "arrow") {
      drawArrow(tempCtx, startPos.x, startPos.y, coords.x, coords.y, color, 4);
    } else if (activeTool === "rect") {
      drawHighlightRect(tempCtx, x, y, w, h, color, 4);
    } else if (activeTool === "blur") {
      applyPixelate(tempCtx, x, y, w, h, 12);
      drawHighlightRect(tempCtx, x, y, w, h, "rgba(255,255,255,0.4)", 1);
    }

    // Copia o frame temporário para o canvas principal para visualização suave
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    const x = Math.min(startPos.x, coords.x);
    const y = Math.min(startPos.y, coords.y);
    const w = Math.abs(coords.x - startPos.x);
    const h = Math.abs(coords.y - startPos.y);

    if (activeTool === "arrow") {
      if (Math.hypot(coords.x - startPos.x, coords.y - startPos.y) > 5) {
        drawArrow(ctx, startPos.x, startPos.y, coords.x, coords.y, color, 4);
      }
    } else if (activeTool === "rect") {
      if (w > 5 && h > 5) {
        drawHighlightRect(ctx, x, y, w, h, color, 4);
      }
    } else if (activeTool === "blur") {
      if (w > 5 && h > 5) {
        applyPixelate(ctx, x, y, w, h, 12);
      }
    }

    setStartPos(null);
    saveToHistory();
  };

  const handleApply = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const newBase64 = canvas.toDataURL("image/png");
    onSave(newBase64);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-3 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[680px] bg-[#111216] border border-[#232530] rounded-lg shadow-2xl flex flex-col overflow-hidden font-mono text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de Ferramentas Estilo Warp */}
        <div className="h-11 px-3 bg-[#0c0d10] border-b border-[#232530] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[#2dd4bf] font-bold mr-1">✏️</span>
            <button
              onClick={() => setActiveTool("arrow")}
              className={`px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1 ${
                activeTool === "arrow"
                  ? "bg-[#1f222d] border border-[#323645] text-[#2dd4bf]"
                  : "text-[#71717a] hover:text-[#d4d4d8]"
              }`}
            >
              <span>➔</span>
              <span>seta</span>
            </button>
            <button
              onClick={() => setActiveTool("rect")}
              className={`px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1 ${
                activeTool === "rect"
                  ? "bg-[#1f222d] border border-[#323645] text-[#2dd4bf]"
                  : "text-[#71717a] hover:text-[#d4d4d8]"
              }`}
            >
              <span>▢</span>
              <span>retângulo</span>
            </button>
            <button
              onClick={() => setActiveTool("blur")}
              className={`px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1 ${
                activeTool === "blur"
                  ? "bg-[#1f222d] border border-[#323645] text-[#2dd4bf]"
                  : "text-[#71717a] hover:text-[#d4d4d8]"
              }`}
              title="Censurar / Pixelar senhas ou dados sensíveis"
            >
              <span>▓</span>
              <span>blur/censura</span>
            </button>
            <button
              onClick={() => setActiveTool("pen")}
              className={`px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1 ${
                activeTool === "pen"
                  ? "bg-[#1f222d] border border-[#323645] text-[#2dd4bf]"
                  : "text-[#71717a] hover:text-[#d4d4d8]"
              }`}
            >
              <span>✎</span>
              <span>desenho</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Seletor de cores */}
            <div className="flex items-center gap-1 bg-[#16171f] px-2 py-0.5 rounded border border-[#232530]">
              {["#ef4444", "#38bdf8", "#2dd4bf", "#eab308"].map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-3.5 h-3.5 rounded-full transition cursor-pointer ${
                    color === c ? "scale-125 ring-2 ring-white/50" : "opacity-60 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <button
              onClick={handleUndo}
              disabled={history.length <= 1}
              className="px-2 py-1 rounded text-[#71717a] hover:text-[#d4d4d8] disabled:opacity-30 transition cursor-pointer"
              title="Desfazer (Ctrl+Z)"
            >
              ↺ desfazer
            </button>
          </div>
        </div>

        {/* Área de Visualização do Canvas com Aspect Ratio preservado */}
        <div className="p-3 bg-[#0a0a0d] flex items-center justify-center max-h-[300px] overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="max-w-full max-h-[280px] object-contain rounded border border-[#232530] shadow-md cursor-crosshair"
          />
          {/* Canvas invisível para double buffering suave */}
          <canvas ref={tempCanvasRef} className="hidden" />
        </div>

        {/* Rodapé de Ações */}
        <div className="h-10 px-4 bg-[#0c0d10] border-t border-[#232530] flex items-center justify-between">
          <span className="text-[#525460] text-[11px]">
            {activeTool === "blur"
              ? "arraste sobre senhas ou dados sensíveis para pixelar"
              : "arraste o mouse sobre a imagem para anotar"}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-2.5 py-1 text-[#71717a] hover:text-[#d4d4d8] transition cursor-pointer"
            >
              cancelar
            </button>
            <button
              onClick={handleApply}
              className="px-3 py-1 bg-[#2dd4bf] hover:bg-[#25b5a3] text-[#0c0d10] font-medium rounded transition cursor-pointer"
            >
              aplicar alterações ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
