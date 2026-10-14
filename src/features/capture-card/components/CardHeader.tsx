import React from "react";
import { Settings, X } from "lucide-react";
import { AppConfig } from "../../../shared/types";
import { DragHandle } from "../../../shared/components/DragHandle";
import { useDraggableWindow } from "../../../shared/hooks/useDraggableWindow";

interface CardHeaderProps {
  config: AppConfig | null;
  selectedRouteId: string;
  onSelectRoute: (routeId: string) => void;
  onOpenSettings: () => void;
  onOpenAbout?: () => void;
  onClose: () => void;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  config,
  selectedRouteId,
  onSelectRoute,
  onOpenSettings,
  onOpenAbout,
  onClose,
}) => {
  const { onMouseDown: handleDrag } = useDraggableWindow();

  return (
    <div
      data-tauri-drag-region
      onMouseDown={handleDrag}
      className="h-10 px-3 bg-[#211d1a] border-b border-[#3f3a36] flex items-center justify-between cursor-grab active:cursor-grabbing rounded-t-[4px] select-none"
    >
      {/* Alça de Arraste + Rotas de projetos estilo abas de terminal Warp */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <DragHandle />
        <span className="font-mono text-xs text-[#2dd4bf] mr-1 select-none font-bold">❯</span>

        {config?.projectRoutes.map((route, idx) => {
          const isSelected = route.id === selectedRouteId;
          return (
            <button
              key={route.id}
              onClick={() => onSelectRoute(route.id)}
              className={`px-2.5 py-1 rounded-[3px] text-xs font-mono transition cursor-pointer flex items-center gap-1.5 shrink-0 border ${
                isSelected
                  ? "bg-[#383330] border-[#4f4843] text-[#f7f5f0] shadow-sm"
                  : "bg-transparent border-transparent text-[#aea69c] hover:text-[#dad2c1] hover:bg-[#2b2622]"
              }`}
            >
              <span className="opacity-50">{route.keyShortcut || idx + 1}:</span>
              <span>{route.label.toLowerCase()}</span>
            </button>
          );
        })}
      </div>

      {/* Ações da Janela com ícones SVG nativos */}
      <div className="flex items-center gap-1.5 pl-2 shrink-0">
        {onOpenAbout && (
          <button
            onClick={onOpenAbout}
            className="text-[11px] font-mono text-[#aea69c] hover:text-[#2dd4bf] px-1.5 py-0.5 rounded-[3px] hover:bg-[#383330] transition cursor-pointer"
            title="Sobre, Versão & Atualizações"
          >
            v0.1.3
          </button>
        )}
        <button
          onClick={onOpenSettings}
          className="text-[#aea69c] hover:text-[#f7f5f0] p-1 rounded-[3px] hover:bg-[#383330] transition cursor-pointer flex items-center justify-center"
          title="Configurações (Vault e Atalhos)"
        >
          <Settings className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
        <button
          onClick={onClose}
          className="text-[#aea69c] hover:text-[#f43f5e] p-1 rounded-[3px] hover:bg-[#383330] transition cursor-pointer flex items-center justify-center"
          title="Fechar (Esc)"
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
};
