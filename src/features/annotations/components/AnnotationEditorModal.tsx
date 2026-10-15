import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Hand,
  ArrowRight,
  Square,
  EyeOff,
  Highlighter,
  Type,
  Pencil,
  Undo2,
  Check,
} from "lucide-react";
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

type ToolType = "hand" | "arrow" | "rect" | "blur" | "pen" | "highlighter" | "text";

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

  // Estados de Zoom & Pan com suporte à mãozinha do Figma
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const panStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number } | null>(null);

  // Estado para ferramenta de texto interativa
  const [textInput, setTextInput] = useState<TextInputState | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const highlighterPointsRef = useRef<{ x: number; y: number }[]>([]);

  // Wheel listener com Ctrl (Zoom) e Shift (Pan Horizontal lado a lado estilo Figma)
  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        // Zoom in / Zoom out suave
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        setZoom((prev) => Math.min(Math.max(Number((prev + delta).toFixed(2)), 0.5), 4.0));
      } else if (e.shiftKey) {
        // Shift + Wheel arrasta horizontalmente para os lados
        const shiftDelta = e.deltaY || e.deltaX;
        setPan((prev) => ({
          ...prev,
          x: Math.round(prev.x - shiftDelta),
        }));
      } else {
        // Wheel normal ou touchpad: pan vertical e horizontal suave
        setPan((prev) => ({
          x: Math.round(prev.x - e.deltaX),
          y: Math.round(prev.y - e.deltaY),
        }));
      }
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

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

  // Atalhos de Teclado: Espaço (Mãozinha), A, R, B, D, T, P, H e Ctrl+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputActive =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // Segurar Espaço ativa temporariamente a mãozinha (estilo Figma)
      if (e.code === "Space" && !isInputActive && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

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
        case "h":
          e.preventDefault();
          selectTool("hand");
          break;
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
        case "d":
          e.preventDefault();
          selectTool("highlighter");
          break;
        case "p":
          e.preventDefault();
          selectTool("pen");
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

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
        setIsPanning(false);
        panStartRef.current = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleUndo, selectTool, textInput, onClose]);

  // Foco automático no input de texto quando aberto
  useEffect(() => {
    if (textInput && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [textInput]);

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Funções de Pan / Arraste (Mãozinha do Figma)
  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (activeTool === "hand" || isSpacePressed || e.button === 1) {
      e.preventDefault();
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialPanX: pan.x,
        initialPanY: pan.y,
      };
      setIsPanning(true);
    }
  };

  useEffect(() => {
    if (!isPanning) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!panStartRef.current) return;
      e.preventDefault();
      const dx = e.clientX - panStartRef.current.startX;
      const dy = e.clientY - panStartRef.current.startY;
      setPan({
        x: panStartRef.current.initialPanX + dx,
        y: panStartRef.current.initialPanY + dy,
      });
    };

    const handleWindowMouseUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isPanning]);

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (isPanning && panStartRef.current) {
      e.preventDefault();
      const dx = e.clientX - panStartRef.current.startX;
      const dy = e.clientY - panStartRef.current.startY;
      setPan({
        x: panStartRef.current.initialPanX + dx,
        y: panStartRef.current.initialPanY + dy,
      });
    }
  };

  const handleContainerMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
    }
  };

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
    // Se a mãozinha estiver ativa, segurando espaço ou botão do meio: delega para Pan
    if (activeTool === "hand" || isSpacePressed || e.button === 1) {
      handleContainerMouseDown(e);
      return;
    }
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
    if (isPanning) {
      handleContainerMouseMove(e);
      return;
    }
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
    if (isPanning) {
      handleContainerMouseUp();
      return;
    }
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
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-3 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[740px] bg-[#111317] border border-[#282d37] rounded-md shadow-2xl flex flex-col overflow-hidden font-mono text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de Ferramentas Estilo Editorial: apenas botões de ícone */}
        <div className="h-11 px-3 bg-[#16181d] border-b border-[#282d37] flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
          <div className="flex items-center gap-1 shrink-0">
            {/* Mãozinha / Pan */}
            <button
              onClick={() => selectTool("hand")}
              className={`p-2 rounded-md transition cursor-pointer flex items-center justify-center border ${
                activeTool === "hand" || isSpacePressed
                  ? "bg-[#1e222a] border-[#ff4d4d]/60 text-[#ff4d4d]"
                  : "border-transparent text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#1e222a]"
              }`}
              title="Mãozinha para arrastar tela [H ou segurar Espaço]"
            >
              <Hand size={14} />
            </button>
            <button
              onClick={() => selectTool("arrow")}
              className={`p-2 rounded-md transition cursor-pointer flex items-center justify-center border ${
                activeTool === "arrow"
                  ? "bg-[#1e222a] border-[#ff4d4d]/60 text-[#ff4d4d]"
                  : "border-transparent text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#1e222a]"
              }`}
              title="Seta indicativa [A]"
            >
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => selectTool("rect")}
              className={`p-2 rounded-md transition cursor-pointer flex items-center justify-center border ${
                activeTool === "rect"
                  ? "bg-[#1e222a] border-[#ff4d4d]/60 text-[#ff4d4d]"
                  : "border-transparent text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#1e222a]"
              }`}
              title="Retângulo de destaque [R]"
            >
              <Square size={14} />
            </button>
            <button
              onClick={() => selectTool("blur")}
              className={`p-2 rounded-md transition cursor-pointer flex items-center justify-center border ${
                activeTool === "blur"
                  ? "bg-[#1e222a] border-[#ff4d4d]/60 text-[#ff4d4d]"
                  : "border-transparent text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#1e222a]"
              }`}
              title="Censurar ou pixelar [B]"
            >
              <EyeOff size={14} />
            </button>
            <button
              onClick={() => selectTool("highlighter")}
              className={`p-2 rounded-md transition cursor-pointer flex items-center justify-center border ${
                activeTool === "highlighter"
                  ? "bg-[#1e222a] border-[#ff4d4d]/60 text-[#ff4d4d]"
                  : "border-transparent text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#1e222a]"
              }`}
              title="Marca-texto [D]"
            >
              <Highlighter size={14} />
            </button>
            <button
              onClick={() => selectTool("text")}
              className={`p-2 rounded-md transition cursor-pointer flex items-center justify-center border ${
                activeTool === "text"
                  ? "bg-[#1e222a] border-[#ff4d4d]/60 text-[#ff4d4d]"
                  : "border-transparent text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#1e222a]"
              }`}
              title="Texto / Legenda [T]"
            >
              <Type size={14} />
            </button>
            <button
              onClick={() => selectTool("pen")}
              className={`p-2 rounded-md transition cursor-pointer flex items-center justify-center border ${
                activeTool === "pen"
                  ? "bg-[#1e222a] border-[#ff4d4d]/60 text-[#ff4d4d]"
                  : "border-transparent text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#1e222a]"
              }`}
              title="Caneta livre [P]"
            >
              <Pencil size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Seletor de cores */}
            <div className="flex items-center gap-1.5 bg-[#111317] px-2 py-1 rounded-md border border-[#282d37]">
              {["#ff4d4d", "#38bdf8", "#10b981", "#f59e0b"].map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-3.5 h-3.5 rounded-full transition cursor-pointer ${
                    color === c ? "scale-110 ring-1 ring-white/80" : "opacity-60 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {/* Controles de Zoom rápido (Ctrl+Scroll / Shift+Scroll) */}
            <div className="flex items-center bg-[#111317] border border-[#282d37] rounded-md px-1.5 py-0.5 text-[11px] gap-1 text-[#86868b]">
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(0.5, Number((prev - 0.2).toFixed(1))))}
                className="hover:text-white px-1 cursor-pointer"
                title="Reduzir zoom"
              >
                -
              </button>
              <button
                type="button"
                onClick={handleResetView}
                className="hover:text-white px-1 font-mono text-[10px] cursor-pointer"
                title="Ctrl+Scroll para zoom / Shift+Scroll para arrastar / Clique para 100%"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(4.0, Number((prev + 0.2).toFixed(1))))}
                className="hover:text-white px-1 cursor-pointer"
                title="Aumentar zoom"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Área de Visualização do Canvas com Pan (Mãozinha), Zoom e Shift+Scroll */}
        <div
          ref={viewportRef}
          onMouseDown={handleContainerMouseDown}
          onMouseMove={handleContainerMouseMove}
          onMouseUp={handleContainerMouseUp}
          onMouseLeave={handleContainerMouseUp}
          className={`relative p-3 bg-[#0a0c0e] flex items-center justify-center h-[340px] overflow-hidden select-none ${
            isSpacePressed || activeTool === "hand"
              ? isPanning
                ? "cursor-grabbing"
                : "cursor-grab"
              : activeTool === "text"
              ? "cursor-text"
              : "cursor-crosshair"
          }`}
        >
          <div
            ref={canvasContainerRef}
            className="relative inline-flex items-center justify-center will-change-transform"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: isPanning ? "none" : "transform 0.08s ease-out",
            }}
          >
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className={`max-w-full max-h-[300px] object-contain rounded-md border border-[#282d37] shadow-md`}
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
                  className="px-2 py-0.5 bg-[#16181d]/95 border border-[#ff4d4d] rounded-md shadow-2xl text-xs font-mono outline-none min-w-[130px] max-w-[240px]"
                  style={{ color }}
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>

        {/* Rodapé Limpo: Botão Desfazer no canto esquerdo + Ações no canto direito */}
        <div className="h-10 px-3 bg-[#16181d] border-t border-[#282d37] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleUndo}
              disabled={history.length <= 1}
              className="px-2.5 py-1 rounded-md text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#1e222a] disabled:opacity-30 transition cursor-pointer flex items-center gap-1.5"
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 size={13} />
              <span>Desfazer</span>
            </button>
            {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
              <button
                onClick={handleResetView}
                className="text-[10px] text-[#ff4d4d] hover:underline cursor-pointer"
                title="Clique para voltar para o tamanho e posição original (100%)"
              >
                Resetar ({Math.round(zoom * 100)}%)
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1 text-[#86868b] hover:text-[#f5f5f7] rounded-md transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-1.5 bg-[#16181d] border border-[#282d37] hover:bg-white/10 hover:border-white/25 text-[#f5f5f7] font-medium text-xs rounded-md transition cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
            >
              <Check size={13} />
              <span>Aplicar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
