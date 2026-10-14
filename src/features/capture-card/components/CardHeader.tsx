import React from "react";
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
      onMouseDown={handleDrag}
      className="h-10 px-3 bg-[#0c0d10] border-b border-[#232530] flex items-center justify-between cursor-grab active:cursor-grabbing rounded-t-lg select-none"
    >
      {/* Alça de Arraste + Rotas de projetos estilo abas de terminal */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <DragHandle />
        <span className="font-mono text-xs text-[#2dd4bf] mr-1">❯</span>

        {config?.projectRoutes.map((route, idx) => {
          const isSelected = route.id === selectedRouteId;
          return (
            <button
              key={route.id}
              onClick={() => onSelectRoute(route.id)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                isSelected
                  ? "bg-[#1f222d] border border-[#323645] text-white shadow-sm"
                  : "text-[#71717a] hover:text-[#d4d4d8] hover:bg-[#16171f]"
              }`}
            >
              <span className="opacity-50">{route.keyShortcut || idx + 1}:</span>
              <span>{route.label.toLowerCase()}</span>
            </button>
          );
        })}
      </div>

      {/* Ações da Janela */}
      <div className="flex items-center gap-2 pl-2 shrink-0">
        {onOpenAbout && (
          <button
            onClick={onOpenAbout}
            className="text-xs font-mono text-[#525460] hover:text-[#2dd4bf] px-1.5 py-0.5 rounded hover:bg-[#1f222d] transition cursor-pointer"
            title="Sobre, Versão & Atualizações"
          >
            [v0.1.3]
          </button>
        )}
        <button
          onClick={onOpenSettings}
          className="text-xs font-mono text-[#71717a] hover:text-[#d4d4d8] px-1.5 py-0.5 rounded hover:bg-[#1f222d] transition cursor-pointer"
          title="Configurações (Vault e Atalhos)"
        >
          [config]
        </button>
        <button
          onClick={onClose}
          className="text-xs font-mono text-[#71717a] hover:text-[#ef4444] px-1.5 py-0.5 rounded hover:bg-[#1f222d] transition cursor-pointer"
          title="Fechar (Esc)"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
