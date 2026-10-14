import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  drawArrow,
  drawHighlightRect,
  applyPixelate,
  drawHighlighter,
  drawAnnotationText,
} from "../lib/drawUtils";

interface AnnotationEditorModalProps {
  imageBase64: string;
  onSave: (annotatedBase64: string) => void;
  onClose: () => void;
}

type ToolType = "arrow" | "rect" | "blur" | "pen" | "highlighter" | "text";

interface TextInputState {
  canvasX: number;
  canvasY: number;
  domX: number;
  domY: number;
  value: string;
}

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

  // Estado para ferramenta de texto interativa
  const [textInput, setTextInput] = useState<TextInputState | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const highlighterPointsRef = useRef<{ x: number; y: number }[]>([]);

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

    // Se houver input de texto aberto, descarta antes de desfazer
    setTextInput(null);

    const newHistory = history.slice(0, -1);
    const previous = newHistory[newHistory.length - 1];
    ctx.putImageData(previous, 0, 0);
    setHistory(newHistory);
  }, [history]);

  // Função para desenhar o texto digitado de forma definitiva no canvas
  const handleCommitText = useCallback(
    (text: string, x: number, y: number) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setTextInput(null);
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const fontSize = Math.max(16, Math.min(Math.round(canvas.width * 0.024), 36));
      drawAnnotationText(ctx, trimmed, x, y, color, fontSize);
      saveToHistory();
      setTextInput(null);
    },
    [color, saveToHistory]
  );

  // Troca de ferramentas com suporte a comitar texto pendente e auto-sugestão de cor
  const selectTool = useCallback(
    (tool: ToolType) => {
      if (textInput && textInput.value.trim()) {
        handleCommitText(textInput.value, textInput.canvasX, textInput.canvasY);
      } else if (textInput) {
        setTextInput(null);
      }
      setActiveTool(tool);

      // Sugere amarelo padrão ao selecionar marca-texto caso esteja no vermelho inicial
      if (tool === "highlighter" && color === "#ef4444") {
        setColor("#eab308");
      }
    },
    [textInput, handleCommitText, color]
  );

  // Atalhos de Teclado: A, R, B, H, T e Ctrl+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputActive =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // Ctrl+Z para Desfazer (não captura se estiver digitando em campo de texto)
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        if (!isInputActive) {
          e.preventDefault();
          handleUndo();
          return;
        }
      }

      // Se o usuário estiver ativamente digitando texto na imagem, ignora atalhos de ferramentas
      if (isInputActive) {
        return;
      }

      // Ignora atalhos se modificadores estiverem ativos
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      const key = e.key.toLowerCase();
      switch (key) {
        case "a":
          e.preventDefault();
          selectTool("arrow");
          break;
        case "r":
          e.preventDefault();
          selectTool("rect");
          break;
        case "b":
          e.preventDefault();
          selectTool("blur");
          break;
        case "h":
          e.preventDefault();
          selectTool("highlighter");
          break;
        case "t":
          e.preventDefault();
          selectTool("text");
          break;
        case "escape":
          e.preventDefault();
          if (textInput) {
            setTextInput(null);
          } else {
            onClose();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleUndo, selectTool, textInput, onClose]);

  // Foco automático no input de texto quando aberto
  useEffect(() => {
    if (textInput && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [textInput]);

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

    // Ferramenta de Texto: ao clicar, posiciona e abre a caixa para digitar legenda
    if (activeTool === "text") {
      if (textInput && textInput.value.trim()) {
        handleCommitText(textInput.value, textInput.canvasX, textInput.canvasY);
      }

      const container = canvasContainerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();

      const domX = Math.max(4, Math.min(e.clientX - containerRect.left, containerRect.width - 150));
      const domY = Math.max(4, Math.min(e.clientY - containerRect.top, containerRect.height - 30));
      const coords = getCanvasCoords(e);

      setTextInput({
        canvasX: coords.x,
        canvasY: coords.y,
        domX,
        domY,
        value: "",
      });
      return;
    }

    // Se clicar fora com outra ferramenta e houver texto aberto, comita
    if (textInput) {
      if (textInput.value.trim()) {
        handleCommitText(textInput.value, textInput.canvasX, textInput.canvasY);
      } else {
        setTextInput(null);
      }
    }

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
    } else if (activeTool === "highlighter") {
      highlighterPointsRef.current = [coords];
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

    // Marca-Texto: traçado suave com blend mode e transparência uniforme
    if (activeTool === "highlighter") {
      highlighterPointsRef.current.push(coords);
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      if (history.length > 0) {
        tempCtx.putImageData(history[history.length - 1], 0, 0);
      }
      const hlWidth = Math.max(18, Math.min(Math.round(canvas.width * 0.028), 44));
      drawHighlighter(tempCtx, highlighterPointsRef.current, color, hlWidth);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0);
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
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    const x = Math.min(startPos.x, coords.x);
    const y = Math.min(startPos.y, coords.y);
    const w = Math.abs(coords.x - startPos.x);
    const h = Math.abs(coords.y - startPos.y);

    // Restaura o estado anterior limpo antes de desenhar a geometria final
    if (history.length > 0 && activeTool !== "pen") {
      ctx.putImageData(history[history.length - 1], 0, 0);
    }

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
    } else if (activeTool === "highlighter") {
      if (highlighterPointsRef.current.length > 0) {
        const hlWidth = Math.max(18, Math.min(Math.round(canvas.width * 0.028), 44));
        drawHighlighter(ctx, highlighterPointsRef.current, color, hlWidth);
      }
      highlighterPointsRef.current = [];
    }

    setStartPos(null);
    saveToHistory();
  };

  const handleApply = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Se houver texto digitado ainda não comitado, aplica antes de finalizar
    if (textInput && textInput.value.trim()) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const fontSize = Math.max(16, Math.min(Math.round(canvas.width * 0.024), 36));
        drawAnnotationText(
          ctx,
          textInput.value.trim(),
          textInput.canvasX,
          textInput.canvasY,
          color,
          fontSize
        );
      }
    }

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
        className="w-full max-w-[740px] bg-[#111216] border border-[#232530] rounded-lg shadow-2xl flex flex-col overflow-hidden font-mono text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de Ferramentas Estilo Warp */}
        <div className="h-11 px-3 bg-[#0c0d10] border-b border-[#232530] flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[#2dd4bf] font-bold mr-1">✏️</span>
            <button
              onClick={() => selectTool("arrow")}
              className={`px-2 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                activeTool === "arrow"
                  ? "bg-[#1f222d] border border-[#323645] text-[#2dd4bf]"
                  : "text-[#71717a] hover:text-[#d4d4d8]"
              }`}
              title="Seta (A)"
            >
              <span>➔</span>
              <span>seta</span>
              <kbd className="text-[9px] bg-[#16171f] px-1 py-0.2 rounded text-[#525460] border border-[#232530]">
                A
              </kbd>
            </button>
            <button
              onClick={() => selectTool("rect")}
              className={`px-2 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                activeTool === "rect"
                  ? "bg-[#1f222d] border border-[#323645] text-[#2dd4bf]"
                  : "text-[#71717a] hover:text-[#d4d4d8]"
              }`}
              title="Retângulo (R)"
            >
              <span>▢</span>
              <span>retângulo</span>
              <kbd className="text-[9px] bg-[#16171f] px-1 py-0.2 rounded text-[#525460] border border-[#232530]">
                R
              </kbd>
            </button>
            <button
              onClick={() => selectTool("blur")}
              className={`px-2 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                activeTool === "blur"
                  ? "bg-[#1f222d] border border-[#323645] text-[#2dd4bf]"
                  : "text-[#71717a] hover:text-[#d4d4d8]"
              }`}
              title="Censurar / Pixelar senhas ou dados sensíveis (B)"
            >
              <span>▓</span>
              <span>blur</span>
              <kbd className="text-[9px] bg-[#16171f] px-1 py-0.2 rounded text-[#525460] border border-[#232530]">
                B
              </kbd>
            </button>
            <button
              onClick={() => selectTool("highlighter")}
              className={`px-2 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                activeTool === "highlighter"
                  ? "bg-[#1f222d] border border-[#323645] text-[#2dd4bf]"
                  : "text-[#71717a] hover:text-[#d4d4d8]"
              }`}
              title="Marca-Texto semi-transparente (H)"
            >
              <span>🖍</span>
              <span>marca-texto</span>
              <kbd className="text-[9px] bg-[#16171f] px-1 py-0.2 rounded text-[#525460] border border-[#232530]">
                H
              </kbd>
            </button>
            <button
              onClick={() => selectTool("text")}
              className={`px-2 py-1 rounded transition cursor-pointer flex items-center gap-1.5 ${
                activeTool === "text"
                  ? "bg-[#1f222d] border border-[#323645] text-[#2dd4bf]"
                  : "text-[#71717a] hover:text-[#d4d4d8]"
              }`}
              title="Legenda / Nota Rápida (T)"
            >
              <span className="font-bold">T</span>
              <span>texto</span>
              <kbd className="text-[9px] bg-[#16171f] px-1 py-0.2 rounded text-[#525460] border border-[#232530]">
                T
              </kbd>
            </button>
            <button
              onClick={() => selectTool("pen")}
              className={`px-2 py-1 rounded transition cursor-pointer flex items-center gap-1 ${
                activeTool === "pen"
                  ? "bg-[#1f222d] border border-[#323645] text-[#2dd4bf]"
                  : "text-[#71717a] hover:text-[#d4d4d8]"
              }`}
              title="Desenho Livre"
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
              className="px-2 py-1 rounded text-[#71717a] hover:text-[#d4d4d8] disabled:opacity-30 transition cursor-pointer flex items-center gap-1"
              title="Desfazer (Ctrl+Z)"
            >
              <span>↺ desfazer</span>
              <kbd className="text-[9px] bg-[#16171f] px-1 py-0.2 rounded text-[#525460] border border-[#232530]">
                ^Z
              </kbd>
            </button>
          </div>
        </div>

        {/* Área de Visualização do Canvas com Aspect Ratio preservado */}
        <div className="p-3 bg-[#0a0a0d] flex items-center justify-center max-h-[300px] overflow-hidden">
          <div ref={canvasContainerRef} className="relative inline-flex items-center justify-center">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className={`max-w-full max-h-[280px] object-contain rounded border border-[#232530] shadow-md ${
                activeTool === "text" ? "cursor-text" : "cursor-crosshair"
              }`}
            />
            {/* Canvas invisível para double buffering suave */}
            <canvas ref={tempCanvasRef} className="hidden" />

            {/* Input de texto flutuante exatamente na posição do clique */}
            {textInput && (
              <div
                className="absolute z-20 pointer-events-auto"
                style={{
                  left: `${textInput.domX}px`,
                  top: `${textInput.domY}px`,
                }}
              >
                <input
                  ref={textInputRef}
                  type="text"
                  value={textInput.value}
                  onChange={(e) =>
                    setTextInput((prev) => (prev ? { ...prev, value: e.target.value } : null))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCommitText(textInput.value, textInput.canvasX, textInput.canvasY);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setTextInput(null);
                    }
                  }}
                  onBlur={() => {
                    handleCommitText(textInput.value, textInput.canvasX, textInput.canvasY);
                  }}
                  placeholder="digite a legenda... (Enter)"
                  className="px-2 py-0.5 bg-[#0c0d10]/95 border border-[#2dd4bf] rounded shadow-2xl text-xs font-mono outline-none min-w-[130px] max-w-[240px]"
                  style={{ color }}
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="h-10 px-4 bg-[#0c0d10] border-t border-[#232530] flex items-center justify-between">
          <span className="text-[#525460] text-[11px]">
            {activeTool === "blur" && "arraste sobre senhas ou dados sensíveis para pixelar [B]"}
            {activeTool === "highlighter" && "arraste sobre o texto para destacar com marca-texto [H]"}
            {activeTool === "text" && "clique na imagem para digitar uma legenda/nota rápida [T]"}
            {activeTool === "arrow" && "arraste para desenhar uma seta indicativa [A]"}
            {activeTool === "rect" && "arraste para destacar uma área com retângulo [R]"}
            {activeTool === "pen" && "desenhe livremente sobre a imagem"}
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
