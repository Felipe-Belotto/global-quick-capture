import React, { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Crop,
  AppWindow,
  ScrollText,
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

interface WindowRect {
  title: string;
  app_name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StartSnipData {
  screen_image: string;
  windows: WindowRect[];
}

interface CropResult {
  base64: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DragStartInfo {
  mouseX: number;
  mouseY: number;
  rectLeft: number;
  rectTop: number;
  rectWidth: number;
  rectHeight: number;
}

export const SnippingOverlay: React.FC = () => {
  const [screenImage, setScreenImage] = useState<string>("");
  const [windows, setWindows] = useState<WindowRect[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isCtrlHeld, setIsCtrlHeld] = useState<boolean>(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [completedCrop, setCompletedCrop] = useState<CropResult | null>(null);
  const [hoveredWindow, setHoveredWindow] = useState<WindowRect | null>(null);
  const [isOcrLoading, setIsOcrLoading] = useState<boolean>(false);
  const [ocrSuccess, setOcrSuccess] = useState<boolean>(false);
  const [isScrollingCapture, setIsScrollingCapture] = useState<boolean>(false);

  // Redimensionamento e Ajuste de Pixels
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [dragStartPoint, setDragStartPoint] = useState<DragStartInfo | null>(null);
  const [isEditingDimensions, setIsEditingDimensions] = useState<boolean>(false);
  const [customWidthInput, setCustomWidthInput] = useState<string>("");
  const [customHeightInput, setCustomHeightInput] = useState<string>("");

  const imgRef = useRef<HTMLImageElement | null>(null);
  const completedCropRef = useRef<CropResult | null>(null);
  const hoveredWindowRef = useRef<WindowRect | null>(null);
  const isCtrlHeldRef = useRef<boolean>(false);
  const resizeHandleRef = useRef<string | null>(null);
  const dragStartPointRef = useRef<DragStartInfo | null>(null);

  useEffect(() => {
    completedCropRef.current = completedCrop;
  }, [completedCrop]);

  useEffect(() => {
    hoveredWindowRef.current = hoveredWindow;
  }, [hoveredWindow]);

  useEffect(() => {
    isCtrlHeldRef.current = isCtrlHeld;
  }, [isCtrlHeld]);

  useEffect(() => {
    resizeHandleRef.current = resizeHandle;
  }, [resizeHandle]);

  useEffect(() => {
    dragStartPointRef.current = dragStartPoint;
  }, [dragStartPoint]);

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
  const handleSendToObsidian = useCallback(async (crop: CropResult) => {
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
  }, []);

  const handleCopyToClipboard = useCallback(async (crop: CropResult) => {
    try {
      await invoke("copy_image_to_clipboard_cmd", { croppedBase64: crop.base64 });
    } catch (err) {
      console.error("Erro ao copiar imagem:", err);
    }
  }, []);

  const handleSaveToDisk = useCallback(async (crop: CropResult) => {
    try {
      await invoke("save_image_to_disk_cmd", { croppedBase64: crop.base64 });
    } catch (err) {
      console.error("Erro ao salvar imagem em disco:", err);
    }
  }, []);

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
          }, 300);
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

  const handleSelectFullscreen = useCallback(async () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const base64 = await generateCroppedImage(0, 0, w, h);
    const cropData: CropResult = {
      base64,
      x: 0,
      y: 0,
      width: w,
      height: h,
    };
    setCompletedCrop(cropData);
    setStartPos({ x: 0, y: 0 });
    setCurrentPos({ x: w, y: h });
  }, [generateCroppedImage]);

  const handleStartScrollingCapture = useCallback(async () => {
    setIsScrollingCapture(true);
    try {
      await invoke("start_scrolling_capture_cmd");
    } catch (err) {
      console.error("Erro ao iniciar captura de página inteira:", err);
      setIsScrollingCapture(false);
    }
  }, []);

  const handleCancel = useCallback(async () => {
    if (isEditingDimensions) {
      setIsEditingDimensions(false);
      return;
    }

    if (completedCropRef.current) {
      setCompletedCrop(null);
      setStartPos(null);
      setCurrentPos(null);
      setHoveredWindow(null);
      setIsEditingDimensions(false);
      return;
    }

    setIsSelecting(false);
    setIsCtrlHeld(false);
    setStartPos(null);
    setCurrentPos(null);
    setCompletedCrop(null);
    setHoveredWindow(null);
    setIsEditingDimensions(false);
    try {
      await invoke("cancel_snip");
    } catch (e) {
      console.error("Erro ao cancelar recorte:", e);
    }
  }, [isEditingDimensions]);

  // Inicializar overlay quando acionado pelo backend
  useEffect(() => {
    const unlistenData = listen<StartSnipData>("start_snip_data", (event) => {
      if (event.payload) {
        setScreenImage(event.payload.screen_image);
        setWindows(event.payload.windows || []);
      }
      setIsSelecting(false);
      setIsCtrlHeld(false);
      setStartPos(null);
      setCurrentPos(null);
      setCompletedCrop(null);
      setHoveredWindow(null);
      setIsOcrLoading(false);
      setOcrSuccess(false);
      setIsScrollingCapture(false);
      setIsEditingDimensions(false);
      setResizeHandle(null);
      setDragStartPoint(null);
    });

    const unlistenLegacy = listen<string>("start_snip", (event) => {
      if (event.payload) {
        setScreenImage(event.payload);
      }
      setIsSelecting(false);
      setIsCtrlHeld(false);
      setStartPos(null);
      setCurrentPos(null);
      setCompletedCrop(null);
      setHoveredWindow(null);
      setIsOcrLoading(false);
      setOcrSuccess(false);
      setIsScrollingCapture(false);
      setIsEditingDimensions(false);
      setResizeHandle(null);
      setDragStartPoint(null);
    });

    return () => {
      unlistenData.then((f) => f());
      unlistenLegacy.then((f) => f());
    };
  }, []);

  // Teclado
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeCrop = completedCropRef.current;
      const activeWin = hoveredWindowRef.current;

      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      } else if (e.key === "Control" || e.ctrlKey) {
        setIsCtrlHeld(true);
      } else if (e.key === "1" && !isEditingDimensions) {
        setCompletedCrop(null);
        setStartPos(null);
        setCurrentPos(null);
        setHoveredWindow(null);
      } else if (e.key === "2" && !isEditingDimensions) {
        if (activeWin) {
          const x = Math.max(0, activeWin.x);
          const y = Math.max(0, activeWin.y);
          const w = Math.min(window.innerWidth - x, activeWin.width);
          const h = Math.min(window.innerHeight - y, activeWin.height);
          generateCroppedImage(x, y, w, h).then((b64) => {
            const res: CropResult = { base64: b64, x, y, width: w, height: h };
            setCompletedCrop(res);
            setStartPos({ x, y });
            setCurrentPos({ x: x + w, y: y + h });
          });
        }
      } else if (e.key === "3" && !isEditingDimensions) {
        handleStartScrollingCapture();
      } else if (e.key === "4" && !isEditingDimensions) {
        handleSelectFullscreen();
      } else if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        if (activeCrop) {
          handleCopyToClipboard(activeCrop);
        } else if (activeWin) {
          const x = Math.max(0, activeWin.x);
          const y = Math.max(0, activeWin.y);
          const w = Math.min(window.innerWidth - x, activeWin.width);
          const h = Math.min(window.innerHeight - y, activeWin.height);
          generateCroppedImage(x, y, w, h).then((b64) => {
            handleCopyToClipboard({ base64: b64, x, y, width: w, height: h });
          });
        }
      } else if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        if (activeCrop) {
          handleSaveToDisk(activeCrop);
        } else if (activeWin) {
          const x = Math.max(0, activeWin.x);
          const y = Math.max(0, activeWin.y);
          const w = Math.min(window.innerWidth - x, activeWin.width);
          const h = Math.min(window.innerHeight - y, activeWin.height);
          generateCroppedImage(x, y, w, h).then((b64) => {
            handleSaveToDisk({ base64: b64, x, y, width: w, height: h });
          });
        }
      } else if (e.key === "Enter" && !isEditingDimensions) {
        if (activeCrop) {
          handleSendToObsidian(activeCrop);
        } else if (activeWin) {
          const x = Math.max(0, activeWin.x);
          const y = Math.max(0, activeWin.y);
          const w = Math.min(window.innerWidth - x, activeWin.width);
          const h = Math.min(window.innerHeight - y, activeWin.height);
          generateCroppedImage(x, y, w, h).then((b64) => {
            handleSendToObsidian({ base64: b64, x, y, width: w, height: h });
          });
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || !e.ctrlKey) {
        setIsCtrlHeld(false);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [
    handleCancel,
    generateCroppedImage,
    handleStartScrollingCapture,
    handleSelectFullscreen,
    handleCopyToClipboard,
    handleSaveToDisk,
    handleSendToObsidian,
    isEditingDimensions,
  ]);

  const rect =
    startPos && currentPos
      ? {
          left: Math.min(startPos.x, currentPos.x),
          top: Math.min(startPos.y, currentPos.y),
          width: Math.abs(currentPos.x - startPos.x),
          height: Math.abs(currentPos.y - startPos.y),
        }
      : null;

  // Lógica de Redimensionamento e Mover por Arraste
  const handleResizeStart = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!rect) return;

    setResizeHandle(handle);
    setDragStartPoint({
      mouseX: e.clientX,
      mouseY: e.clientY,
      rectLeft: rect.left,
      rectTop: rect.top,
      rectWidth: rect.width,
      rectHeight: rect.height,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.ctrlKey !== isCtrlHeld) {
      setIsCtrlHeld(e.ctrlKey);
    }

    // Se estiver redimensionando ou movendo a seleção existente
    if (resizeHandleRef.current && dragStartPointRef.current) {
      const handle = resizeHandleRef.current;
      const initial = dragStartPointRef.current;
      const dx = e.clientX - initial.mouseX;
      const dy = e.clientY - initial.mouseY;

      if (handle === "move") {
        const nextLeft = Math.max(0, Math.min(window.innerWidth - initial.rectWidth, initial.rectLeft + dx));
        const nextTop = Math.max(0, Math.min(window.innerHeight - initial.rectHeight, initial.rectTop + dy));
        setStartPos({ x: nextLeft, y: nextTop });
        setCurrentPos({ x: nextLeft + initial.rectWidth, y: nextTop + initial.rectHeight });
      } else if (handle === "se") {
        const nextW = Math.max(16, Math.min(window.innerWidth - initial.rectLeft, initial.rectWidth + dx));
        const nextH = Math.max(16, Math.min(window.innerHeight - initial.rectTop, initial.rectHeight + dy));
        setStartPos({ x: initial.rectLeft, y: initial.rectTop });
        setCurrentPos({ x: initial.rectLeft + nextW, y: initial.rectTop + nextH });
      } else if (handle === "sw") {
        const nextLeft = Math.max(0, Math.min(initial.rectLeft + initial.rectWidth - 16, initial.rectLeft + dx));
        const nextW = initial.rectLeft + initial.rectWidth - nextLeft;
        const nextH = Math.max(16, Math.min(window.innerHeight - initial.rectTop, initial.rectHeight + dy));
        setStartPos({ x: nextLeft, y: initial.rectTop });
        setCurrentPos({ x: nextLeft + nextW, y: initial.rectTop + nextH });
      } else if (handle === "ne") {
        const nextTop = Math.max(0, Math.min(initial.rectTop + initial.rectHeight - 16, initial.rectTop + dy));
        const nextH = initial.rectTop + initial.rectHeight - nextTop;
        const nextW = Math.max(16, Math.min(window.innerWidth - initial.rectLeft, initial.rectWidth + dx));
        setStartPos({ x: initial.rectLeft, y: nextTop });
        setCurrentPos({ x: initial.rectLeft + nextW, y: nextTop + nextH });
      } else if (handle === "nw") {
        const nextLeft = Math.max(0, Math.min(initial.rectLeft + initial.rectWidth - 16, initial.rectLeft + dx));
        const nextTop = Math.max(0, Math.min(initial.rectTop + initial.rectHeight - 16, initial.rectTop + dy));
        const nextW = initial.rectLeft + initial.rectWidth - nextLeft;
        const nextH = initial.rectTop + initial.rectHeight - nextTop;
        setStartPos({ x: nextLeft, y: nextTop });
        setCurrentPos({ x: nextLeft + nextW, y: nextTop + nextH });
      } else if (handle === "e") {
        const nextW = Math.max(16, Math.min(window.innerWidth - initial.rectLeft, initial.rectWidth + dx));
        setCurrentPos({ x: initial.rectLeft + nextW, y: currentPos ? currentPos.y : initial.rectTop + initial.rectHeight });
      } else if (handle === "w") {
        const nextLeft = Math.max(0, Math.min(initial.rectLeft + initial.rectWidth - 16, initial.rectLeft + dx));
        setStartPos({ x: nextLeft, y: startPos ? startPos.y : initial.rectTop });
      } else if (handle === "s") {
        const nextH = Math.max(16, Math.min(window.innerHeight - initial.rectTop, initial.rectHeight + dy));
        setCurrentPos({ x: currentPos ? currentPos.x : initial.rectLeft + initial.rectWidth, y: initial.rectTop + nextH });
      } else if (handle === "n") {
        const nextTop = Math.max(0, Math.min(initial.rectTop + initial.rectHeight - 16, initial.rectTop + dy));
        setStartPos({ x: startPos ? startPos.x : initial.rectLeft, y: nextTop });
      }
      return;
    }

    if (isSelecting && startPos) {
      setCurrentPos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (completedCrop) return;

    // Detectar janela sob o cursor
    const mx = e.clientX;
    const my = e.clientY;

    const matched = windows.filter(
      (w) => mx >= w.x && mx <= w.x + w.width && my >= w.y && my <= w.y + w.height
    );

    if (matched.length > 0) {
      matched.sort((a, b) => a.width * a.height - b.width * b.height);
      setHoveredWindow(matched[0]);
    } else {
      setHoveredWindow(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) return;

    if (completedCrop) {
      setIsEditingDimensions(false);
      return;
    }

    if (hoveredWindow) {
      const hw = hoveredWindow;
      const x = Math.max(0, hw.x);
      const y = Math.max(0, hw.y);
      const width = Math.min(window.innerWidth - x, hw.width);
      const height = Math.min(window.innerHeight - y, hw.height);

      if (e.ctrlKey || isCtrlHeldRef.current) {
        generateCroppedImage(x, y, width, height).then((b64) => {
          invoke("quick_save_and_copy_cmd", { croppedBase64: b64 });
        });
        return;
      }
    }

    setCompletedCrop(null);
    setIsSelecting(true);
    if (e.ctrlKey) setIsCtrlHeld(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = async (e: React.MouseEvent) => {
    // Se estava redimensionando ou movendo
    if (resizeHandleRef.current) {
      setResizeHandle(null);
      setDragStartPoint(null);
      if (rect && rect.width >= 16 && rect.height >= 16) {
        const b64 = await generateCroppedImage(rect.left, rect.top, rect.width, rect.height);
        setCompletedCrop({
          base64: b64,
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });
      }
      return;
    }

    if (!isSelecting || !startPos || !currentPos) return;
    setIsSelecting(false);

    const isQuickSave = e.ctrlKey || isCtrlHeld;
    setIsCtrlHeld(false);

    let x = Math.min(startPos.x, currentPos.x);
    let y = Math.min(startPos.y, currentPos.y);
    let width = Math.abs(currentPos.x - startPos.x);
    let height = Math.abs(currentPos.y - startPos.y);

    if (width < 8 && height < 8 && hoveredWindow) {
      const hw = hoveredWindow;
      x = Math.max(0, hw.x);
      y = Math.max(0, hw.y);
      width = Math.min(window.innerWidth - x, hw.width);
      height = Math.min(window.innerHeight - y, hw.height);
    } else if (width < 12 || height < 12) {
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
      setCompletedCrop(null);
      return;
    }

    setCompletedCrop({
      base64: croppedBase64,
      x,
      y,
      width,
      height,
    });
    setStartPos({ x, y });
    setCurrentPos({ x: x + width, y: y + height });
    setHoveredWindow(null);
  };

  // Aplicação manual de dimensões em px
  const handleApplyDimensions = async (wVal: number, hVal: number) => {
    if (!rect) return;
    const newWidth = Math.max(16, Math.min(window.innerWidth - rect.left, wVal));
    const newHeight = Math.max(16, Math.min(window.innerHeight - rect.top, hVal));

    const nextCurrent = { x: rect.left + newWidth, y: rect.top + newHeight };
    setCurrentPos(nextCurrent);

    const b64 = await generateCroppedImage(rect.left, rect.top, newWidth, newHeight);
    setCompletedCrop({
      base64: b64,
      x: rect.left,
      y: rect.top,
      width: newWidth,
      height: newHeight,
    });
    setIsEditingDimensions(false);
  };

  // Posição inteligente da Action Toolbar
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

      {/* Máscara de escurecimento suave */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />

      {/* Destaque Inteligente de Janela / Modal sob o cursor (Smart Snapping) */}
      {!completedCrop && !isSelecting && hoveredWindow && (
        <div
          className="absolute border-2 border-[#ff4d4d] bg-[#ff4d4d]/10 pointer-events-none transition-all duration-75 shadow-[0_0_24px_rgba(255,77,77,0.25)] rounded-[4px]"
          style={{
            left: `${Math.max(0, hoveredWindow.x)}px`,
            top: `${Math.max(0, hoveredWindow.y)}px`,
            width: `${Math.min(window.innerWidth - hoveredWindow.x, hoveredWindow.width)}px`,
            height: `${Math.min(window.innerHeight - hoveredWindow.y, hoveredWindow.height)}px`,
          }}
        >
          <div className="absolute -top-7 left-0 px-2 py-1 rounded-[4px] bg-[#111317] border border-[#ff4d4d] text-[12px] leading-[16px] font-mono text-[#ff4d4d] whitespace-nowrap flex items-center gap-1.5 shadow-xl">
            <AppWindow size={12} />
            <span className="font-semibold truncate max-w-[280px]">
              {hoveredWindow.app_name || hoveredWindow.title || "Janela"}
            </span>
            <span className="text-zinc-400 font-normal">
              • {hoveredWindow.width}×{hoveredWindow.height}px [Clique p/ capturar]
            </span>
          </div>
        </div>
      )}

      {/* 1. Top Mode Dock (Barra Superior de Modos de Captura) */}
      {!completedCrop && !isSelecting && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1 rounded-[8px] bg-[#111317]/95 border border-[#282d37] shadow-2xl backdrop-blur-md">
          {/* Botão Recorte Livre */}
          <button
            type="button"
            className="group relative flex items-center justify-center w-8 h-8 rounded-[8px] text-[#ff4d4d] bg-[#1c2028] transition hover:bg-[#252a35] cursor-pointer"
          >
            <Crop size={16} />
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-[4px] bg-[#181a1f] border border-[#2b303c] text-[12px] leading-[16px] font-mono text-[#f5f5f7] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
              Recortar Área [1]
            </span>
          </button>

          {/* Botão Janela / Modal Snapping */}
          <button
            type="button"
            className={`group relative flex items-center justify-center w-8 h-8 rounded-[8px] transition cursor-pointer ${
              hoveredWindow
                ? "text-[#ff4d4d] bg-[#1c2028]"
                : "text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#252a35]"
            }`}
          >
            <AppWindow size={16} />
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-[4px] bg-[#181a1f] border border-[#2b303c] text-[12px] leading-[16px] font-mono text-[#f5f5f7] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
              Smart Snapping (Janela/Modal) [2]
            </span>
          </button>

          {/* Botão Página Inteira (Auto-Scroll) */}
          <button
            type="button"
            onClick={handleStartScrollingCapture}
            disabled={isScrollingCapture}
            className="group relative flex items-center justify-center w-8 h-8 rounded-[8px] text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#252a35] transition cursor-pointer"
          >
            {isScrollingCapture ? (
              <Loader2 size={16} className="animate-spin text-[#ff4d4d]" />
            ) : (
              <ScrollText size={16} />
            )}
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-[4px] bg-[#181a1f] border border-[#2b303c] text-[12px] leading-[16px] font-mono text-[#f5f5f7] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
              {isScrollingCapture ? "Rolando página..." : "Página Inteira (Auto-Scroll) [3]"}
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
              Tela Inteira [4]
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

      {/* Retângulo de Seleção com Handles de Redimensionamento */}
      {rect && (
        <div
          className={`absolute border transition-[border-color] ${
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
          {/* Área central com cursor de mover */}
          {completedCrop && (
            <div
              onMouseDown={(e) => handleResizeStart(e, "move")}
              className="absolute inset-0 cursor-move bg-transparent"
              title="Arrastar área de recorte"
            />
          )}

          {/* Badge de Dimensões Interativo (Clicável para editar px) */}
          <div className="absolute -top-7 left-0 flex items-center gap-1 z-50">
            {!isEditingDimensions ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCustomWidthInput(String(rect.width));
                  setCustomHeightInput(String(rect.height));
                  setIsEditingDimensions(true);
                }}
                className={`px-2 py-1 rounded-[4px] border text-[12px] leading-[16px] font-mono whitespace-nowrap flex items-center gap-2 cursor-pointer shadow-xl transition hover:border-[#ff4d4d] ${
                  isCtrlHeld
                    ? "bg-[#1c2028] border-[#ff4d4d] text-[#ff4d4d]"
                    : "bg-[#111317] border-[#282d37] text-[#f5f5f7] hover:bg-[#181a1f]"
                }`}
                title="Clique para definir dimensões exatas em pixels"
              >
                <span>
                  {rect.width} × {rect.height} px
                </span>
                {isCtrlHeld && <span className="text-[#ff4d4d]">salvar rápido [Ctrl]</span>}
              </button>
            ) : (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 p-1 rounded-[4px] bg-[#111317] border border-[#ff4d4d] shadow-2xl backdrop-blur-md z-50 animate-in fade-in"
              >
                <input
                  type="number"
                  value={customWidthInput}
                  onChange={(e) => setCustomWidthInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleApplyDimensions(Number(customWidthInput) || rect.width, Number(customHeightInput) || rect.height);
                    }
                  }}
                  className="w-16 h-6 px-1 rounded-[4px] bg-[#1c2028] border border-[#282d37] text-[12px] font-mono text-[#f5f5f7] focus:outline-none focus:border-[#ff4d4d] text-center"
                  placeholder="Largura"
                  autoFocus
                />
                <span className="text-[12px] font-mono text-zinc-400">×</span>
                <input
                  type="number"
                  value={customHeightInput}
                  onChange={(e) => setCustomHeightInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleApplyDimensions(Number(customWidthInput) || rect.width, Number(customHeightInput) || rect.height);
                    }
                  }}
                  className="w-16 h-6 px-1 rounded-[4px] bg-[#1c2028] border border-[#282d37] text-[12px] font-mono text-[#f5f5f7] focus:outline-none focus:border-[#ff4d4d] text-center"
                  placeholder="Altura"
                />
                <span className="text-[12px] font-mono text-zinc-400">px</span>

                {/* Presets rápidos */}
                <div className="flex items-center gap-1 border-l border-[#282d37] pl-1">
                  <button
                    type="button"
                    onClick={() => {
                      const w = 800;
                      const h = 450;
                      setCustomWidthInput(String(w));
                      setCustomHeightInput(String(h));
                      handleApplyDimensions(w, h);
                    }}
                    className="px-1.5 py-0.5 rounded-[4px] bg-[#1c2028] hover:bg-[#252a35] text-[10px] font-mono text-zinc-300 cursor-pointer"
                  >
                    16:9
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const s = Math.min(rect.width, rect.height) || 400;
                      setCustomWidthInput(String(s));
                      setCustomHeightInput(String(s));
                      handleApplyDimensions(s, s);
                    }}
                    className="px-1.5 py-0.5 rounded-[4px] bg-[#1c2028] hover:bg-[#252a35] text-[10px] font-mono text-zinc-300 cursor-pointer"
                  >
                    1:1
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleApplyDimensions(Number(customWidthInput) || rect.width, Number(customHeightInput) || rect.height)}
                  className="flex items-center justify-center w-6 h-6 rounded-[4px] bg-[#ff4d4d] text-white hover:bg-[#e04343] transition cursor-pointer"
                >
                  <Check size={12} />
                </button>
              </div>
            )}
          </div>

          {/* 8 Alças de Redimensionamento (Múltiplos de 4 estritos: w-2 h-2 = 8x8px) */}
          {completedCrop && (
            <>
              {/* Cantos */}
              <div
                onMouseDown={(e) => handleResizeStart(e, "nw")}
                className="absolute -top-1 -left-1 w-2 h-2 bg-white border border-[#ff4d4d] rounded-[2px] cursor-nwse-resize z-40"
              />
              <div
                onMouseDown={(e) => handleResizeStart(e, "ne")}
                className="absolute -top-1 -right-1 w-2 h-2 bg-white border border-[#ff4d4d] rounded-[2px] cursor-nesw-resize z-40"
              />
              <div
                onMouseDown={(e) => handleResizeStart(e, "sw")}
                className="absolute -bottom-1 -left-1 w-2 h-2 bg-white border border-[#ff4d4d] rounded-[2px] cursor-nesw-resize z-40"
              />
              <div
                onMouseDown={(e) => handleResizeStart(e, "se")}
                className="absolute -bottom-1 -right-1 w-2 h-2 bg-white border border-[#ff4d4d] rounded-[2px] cursor-nwse-resize z-40"
              />

              {/* Lados */}
              <div
                onMouseDown={(e) => handleResizeStart(e, "n")}
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-white border border-[#ff4d4d] rounded-[2px] cursor-ns-resize z-40"
              />
              <div
                onMouseDown={(e) => handleResizeStart(e, "s")}
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-white border border-[#ff4d4d] rounded-[2px] cursor-ns-resize z-40"
              />
              <div
                onMouseDown={(e) => handleResizeStart(e, "w")}
                className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-4 bg-white border border-[#ff4d4d] rounded-[2px] cursor-ew-resize z-40"
              />
              <div
                onMouseDown={(e) => handleResizeStart(e, "e")}
                className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-4 bg-white border border-[#ff4d4d] rounded-[2px] cursor-ew-resize z-40"
              />
            </>
          )}
        </div>
      )}

      {/* 2. Floating Action Dock (Aparece quando a seleção/modal é concluída) */}
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
              setHoveredWindow(null);
              setIsEditingDimensions(false);
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
