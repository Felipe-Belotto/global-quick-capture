import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { SnippingOverlay } from "./features/snipping";
import { QuickCaptureCard } from "./features/capture-card";
import { AppInfoModal } from "./features/updater";
import "./App.css";

export function App() {
  const [viewMode, setViewMode] = useState<"overlay" | "card" | "about" | "auto">("auto");
  const [windowLabel, setWindowLabel] = useState<string>("");

  useEffect(() => {
    try {
      const appWindow = getCurrentWindow();
      setWindowLabel(appWindow.label);
      if (appWindow.label === "snipping_overlay") {
        setViewMode("overlay");
      } else if (appWindow.label === "capture_card") {
        setViewMode("card");
      } else if (appWindow.label === "about_window") {
        setViewMode("about");
      }
    } catch {
      // Fallback para navegador/dev
      const urlParams = new URLSearchParams(window.location.search);
      const mode = urlParams.get("mode");
      if (mode === "overlay") setViewMode("overlay");
      else if (mode === "card") setViewMode("card");
      else if (mode === "about") setViewMode("about");
      else setViewMode("card");
    }
  }, []);

  return (
    <main className="w-screen h-screen overflow-hidden bg-transparent">
      {/* Botões de alternância rápida apenas em modo de desenvolvimento web (fora do runtime nativo) */}
      {!windowLabel && (
        <div className="fixed top-2 right-2 z-50 flex gap-2 bg-zinc-900/90 border border-zinc-700 p-1.5 rounded-lg text-xs">
          <button
            onClick={() => setViewMode("card")}
            className={`px-2 py-1 rounded cursor-pointer ${
              viewMode === "card" ? "bg-indigo-600 text-white" : "text-zinc-400"
            }`}
          >
            Modo Card
          </button>
          <button
            onClick={() => setViewMode("overlay")}
            className={`px-2 py-1 rounded cursor-pointer ${
              viewMode === "overlay" ? "bg-indigo-600 text-white" : "text-zinc-400"
            }`}
          >
            Modo Overlay
          </button>
          <button
            onClick={() => setViewMode("about")}
            className={`px-2 py-1 rounded cursor-pointer ${
              viewMode === "about" ? "bg-indigo-600 text-white" : "text-zinc-400"
            }`}
          >
            Modo Sobre / Versão
          </button>
        </div>
      )}

      {viewMode === "overlay" ? (
        <SnippingOverlay />
      ) : viewMode === "about" ? (
        <AppInfoModal isWindowView />
      ) : (
        <QuickCaptureCard />
      )}
    </main>
  );
}

export default App;

