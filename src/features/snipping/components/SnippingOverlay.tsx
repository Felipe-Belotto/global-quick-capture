import React, { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const SnippingOverlay: React.FC = () => {
  const [screenImage, setScreenImage] = useState<string>("");
  const [isSelecting, setIsSelecting] = useState(false);
  const [isCtrlHeld, setIsCtrlHeld] = useState<boolean>(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const unlisten = listen<string>("start_snip", (event) => {
      if (event.payload) {
        setScreenImage(event.payload);
      }
      setIsSelecting(false);
      setIsCtrlHeld(false);
      setStartPos(null);
      setCurrentPos(null);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const handleCancel = useCallback(async () => {
    setIsSelecting(false);
    setIsCtrlHeld(false);
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
      } else if (e.key === "Control" || e.ctrlKey) {
        setIsCtrlHeld(true);
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
  }, [handleCancel]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
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

    if (width < 10 || height < 10) {
      setStartPos(null);
      setCurrentPos(null);
      return;
    }

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
      const croppedBase64 = cropCanvas.toDataURL("image/png");

      try {
        if (isQuickSave) {
          await invoke("quick_save_and_copy_cmd", { croppedBase64 });
        } else {
          await invoke("finish_snip", { croppedBase64 });
        }
      } catch (err) {
        console.error("Erro ao enviar recorte:", err);
      }
    } else {
      try {
        if (isQuickSave) {
          await invoke("quick_save_and_copy_cmd", { croppedBase64: screenImage || "" });
        } else {
          await invoke("finish_snip", { croppedBase64: screenImage || "" });
        }
      } catch (err) {
        console.error("Erro ao finalizar recorte:", err);
      }
    }

    setStartPos(null);
    setCurrentPos(null);
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

      <div className="absolute inset-0 bg-black/45 pointer-events-none" />

      <div
        className={`absolute top-5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full border text-xs font-mono shadow-2xl flex items-center gap-2 pointer-events-none z-50 transition-all ${
          isCtrlHeld
            ? "bg-[#0f172a]/95 border-[#38bdf8] text-[#7dd3fc] shadow-[0_0_20px_rgba(56,189,248,0.3)]"
            : "bg-[#0c0d10]/95 border-[#232530] text-[#d4d4d8]"
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            isCtrlHeld ? "bg-[#38bdf8] animate-ping" : "bg-[#2dd4bf] animate-pulse"
          }`}
        />
        <span>
          {isCtrlHeld
            ? "⚡ MODO RÁPIDO [CTRL] // solte para salvar na nota diária & copiar para a área de transferência"
            : "quick-capture // arraste para recortar • segure [ctrl] para salvar direto & copiar • [esc] cancelar"}
        </span>
      </div>

      {rect && (
        <div
          className={`absolute border pointer-events-none transition-[border-color] ${
            isCtrlHeld
              ? "border-[#38bdf8] shadow-[0_0_0_9999px_rgba(0,0,0,0.55),0_0_15px_rgba(56,189,248,0.4)]"
              : "border-[#2dd4bf] shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
          }`}
          style={{
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          }}
        >
          <div
            className={`absolute -bottom-6 left-0 px-2 py-0.5 rounded border text-[10px] font-mono whitespace-nowrap flex items-center gap-1.5 ${
              isCtrlHeld
                ? "bg-[#0b1329] border-[#38bdf8] text-[#38bdf8]"
                : "bg-[#0c0d10] border-[#232530] text-[#2dd4bf]"
            }`}
          >
            <span>
              {rect.width} × {rect.height} px
            </span>
            {isCtrlHeld && <span className="text-[#93c5fd]">⚡ salvar + copiar</span>}
          </div>
        </div>
      )}
    </div>
  );
};
