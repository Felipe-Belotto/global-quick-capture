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
      className="h-10 px-3 bg-[#111317] border-b border-[#282d37] flex items-center justify-between cursor-grab active:cursor-grabbing rounded-t-xl select-none"
    >
      {/* Alça de Arraste + Rotas de projetos estilo abas de terminal editorial */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <DragHandle />
        <span className="font-mono text-xs text-[#ff4d4d] mr-1 select-none font-bold">❯</span>

        {config?.projectRoutes.map((route, idx) => {
          const isSelected = route.id === selectedRouteId;
          return (
            <button
              key={route.id}
              onClick={() => onSelectRoute(route.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition cursor-pointer flex items-center gap-1.5 shrink-0 border ${
                isSelected
                  ? "bg-[#1e222a] border-[#363d4a] text-[#f5f5f7] shadow-xs"
                  : "bg-transparent border-transparent text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#16181d]"
              }`}
            >
              <span className="opacity-50">{route.keyShortcut || idx + 1}:</span>
              <span>{route.label.toLowerCase()}</span>
            </button>
          );
        })}
      </div>

      {/* Ações da Janela */}
      <div className="flex items-center gap-1.5 pl-2 shrink-0">
        {onOpenAbout && (
          <button
            onClick={onOpenAbout}
            className="text-[11px] font-mono text-[#86868b] hover:text-[#ff4d4d] px-2 py-0.5 rounded-md hover:bg-[#1e222a] transition cursor-pointer"
            title="Sobre, Versão & Atualizações"
          >
            v0.1.4
          </button>
        )}
        <button
          onClick={onOpenSettings}
          className="text-[#86868b] hover:text-[#f5f5f7] p-1 rounded-md hover:bg-[#1e222a] transition cursor-pointer flex items-center justify-center"
          title="Configurações (Vault e Atalhos)"
        >
          <Settings className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
        <button
          onClick={onClose}
          className="text-[#86868b] hover:text-[#ff4d4d] p-1 rounded-md hover:bg-[#1e222a] transition cursor-pointer flex items-center justify-center"
          title="Fechar"
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
};
