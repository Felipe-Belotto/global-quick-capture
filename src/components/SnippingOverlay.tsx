import React, { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const SnippingOverlay: React.FC = () => {
  const [screenImage, setScreenImage] = useState<string>("");
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Escutar o evento start_snip que traz o print da tela real
  useEffect(() => {
    const unlisten = listen<string>("start_snip", (event) => {
      if (event.payload) {
        setScreenImage(event.payload);
      }
      setIsSelecting(false);
      setStartPos(null);
      setCurrentPos(null);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

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
    if (e.button !== 0) return;
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

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);

    if (width < 10 || height < 10) {
      setStartPos(null);
      setCurrentPos(null);
      return;
    }

    // Recortar os pixels da imagem real
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

      // Calcular proporção de escala entre resolução real e tela (DPI / Scaling)
      const scaleX = img.naturalWidth / window.innerWidth;
      const scaleY = img.naturalHeight / window.innerHeight;

      const sx = x * scaleX;
      const sy = y * scaleY;
      const sw = width * scaleX;
      const sh = height * scaleY;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
      const croppedBase64 = cropCanvas.toDataURL("image/png");

      try {
        await invoke("finish_snip", { croppedBase64 });
      } catch (err) {
        console.error("Erro ao enviar recorte:", err);
      }
    } else {
      // Fallback caso a imagem não esteja pronta
      try {
        await invoke("finish_snip", { croppedBase64: screenImage || "" });
      } catch (err) {
        console.error("Erro ao finalizar recorte:", err);
      }
    }

    setStartPos(null);
    setCurrentPos(null);
  };

  const rect = startPos && currentPos ? {
    left: Math.min(startPos.x, currentPos.x),
    top: Math.min(startPos.y, currentPos.y),
    width: Math.abs(currentPos.x - startPos.x),
    height: Math.abs(currentPos.y - startPos.y),
  } : null;

  return (
    <div
      className="fixed inset-0 select-none cursor-crosshair overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Imagem real congelada da tela de fundo */}
      {screenImage && (
        <img
          ref={imgRef}
          src={screenImage}
          alt="Frozen Screen"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        />
      )}

      {/* Máscara semi-escura uniforme estilo terminal */}
      <div className="absolute inset-0 bg-black/45 pointer-events-none" />

      {/* Barra de Guia Superior Estilo Warp */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-[#0c0d10]/95 border border-[#232530] text-xs font-mono text-[#d4d4d8] shadow-2xl flex items-center gap-2 pointer-events-none z-50">
        <span className="w-2 h-2 rounded-full bg-[#2dd4bf] animate-pulse" />
        <span>quick-capture // arraste para recortar • [esc] cancelar</span>
      </div>

      {/* Retângulo de Seleção com Recorte Visível */}
      {rect && (
        <div
          className="absolute border border-[#2dd4bf] shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] pointer-events-none"
          style={{
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          }}
        >
          {/* Badge com Dimensões Monospace */}
          <div className="absolute -bottom-6 left-0 px-2 py-0.5 rounded bg-[#0c0d10] border border-[#232530] text-[10px] text-[#2dd4bf] font-mono whitespace-nowrap">
            {rect.width} × {rect.height} px
          </div>
        </div>
      )}
    </div>
  );
};
