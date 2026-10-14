import React, { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

export function useDraggableWindow() {
  const onMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    if (target?.closest("button, input, textarea, a, select, [data-no-drag]")) {
      return;
    }

    try {
      const appWindow = getCurrentWindow();
      await appWindow.startDragging();
    } catch {
      try {
        await invoke("start_dragging_window");
      } catch (err) {
        console.warn("Falha ao iniciar arraste da janela nativa:", err);
      }
    }
  }, []);

  const triggerDrag = useCallback(async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.startDragging();
    } catch {
      try {
        await invoke("start_dragging_window");
      } catch (err) {
        console.warn("Falha ao arrastar janela:", err);
      }
    }
  }, []);

  return { onMouseDown, triggerDrag };
}
