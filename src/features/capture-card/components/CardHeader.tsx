import React from "react";
import { Settings, X, Minus, Square } from "lucide-react";
import { AppConfig } from "../../../shared/types";
import { useDraggableWindow } from "../../../shared/hooks/useDraggableWindow";

interface CardHeaderProps {
  config: AppConfig | null;
  selectedRouteId: string;
  onSelectRoute: (routeId: string) => void;
  onOpenSettings: () => void;
  onOpenAbout?: () => void;
  onClose: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onMinimize?: () => void;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  config,
  selectedRouteId,
  onSelectRoute,
  onOpenSettings,
  onOpenAbout,
  onClose,
  isMaximized = false,
  onToggleMaximize,
  onMinimize,
}) => {
  const { onMouseDown: handleDrag } = useDraggableWindow();

  return (
    <div
      data-tauri-drag-region
      onMouseDown={handleDrag}
      onDoubleClick={onToggleMaximize}
      className={`h-10 pl-3 pr-0 bg-[#111317] border-b border-[#282d37] flex items-center justify-between select-none cursor-default ${
        isMaximized ? "rounded-none" : "rounded-t-md"
      }`}
    >
      {/* Logo Seta Vermelha do QCap + Rotas de Projetos */}
      <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-0.5">
        {/* Logo Oficial QCap: Seta Vermelha da UI */}
        <span
          className="font-mono text-base text-[#ff4d4d] select-none font-black tracking-tight flex items-center shrink-0 pr-0.5"
          title="QCap"
        >
          ❯
        </span>

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

      {/* Área útil central para arrastar a janela (padrão nativo do Windows) */}
      <div className="flex-1 h-full min-w-[24px]" data-tauri-drag-region />

      {/* Ações da Janela e Controles Nativos do Windows (Minimizar, Maximizar, Fechar) */}
      <div className="flex items-center h-full shrink-0" data-no-drag>
        {/* Links / Botões utilitários */}
        <div className="flex items-center gap-1 mr-2">
          {onOpenAbout && (
            <button
              type="button"
              onClick={onOpenAbout}
              className="text-[11px] font-mono text-[#86868b] hover:text-[#ff4d4d] px-2 py-0.5 rounded-md hover:bg-[#1e222a] transition cursor-pointer"
              title="Sobre, Versão & Atualizações"
            >
              v0.1.4
            </button>
          )}
          <button
            type="button"
            onClick={onOpenSettings}
            className="text-[#86868b] hover:text-[#f5f5f7] p-1.5 rounded-md hover:bg-[#1e222a] transition cursor-pointer flex items-center justify-center"
            title="Configurações (Vault e Atalhos)"
          >
            <Settings className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Botões Nativos Windows 11 */}
        <div className="flex items-center h-full border-l border-[#282d37]">
          {/* Minimizar */}
          <button
            type="button"
            onClick={onMinimize}
            className="w-11 h-full flex items-center justify-center text-[#86868b] hover:text-[#f5f5f7] hover:bg-white/10 active:bg-white/15 transition cursor-pointer"
            title="Minimizar"
          >
            <Minus size={13} strokeWidth={1.5} />
          </button>

          {/* Maximizar / Restaurar */}
          <button
            type="button"
            onClick={onToggleMaximize}
            className="w-11 h-full flex items-center justify-center text-[#86868b] hover:text-[#f5f5f7] hover:bg-white/10 active:bg-white/15 transition cursor-pointer"
            title={isMaximized ? "Restaurar" : "Maximizar"}
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
                <rect x="2.5" y="0.5" width="7" height="7" rx="0.5" />
                <path d="M0.5 2.5 V9.5 H7.5" />
              </svg>
            ) : (
              <Square size={11} strokeWidth={1.5} />
            )}
          </button>

          {/* Fechar */}
          <button
            type="button"
            onClick={onClose}
            className={`w-11 h-full flex items-center justify-center text-[#86868b] hover:text-white hover:bg-[#c42b1c] active:bg-[#a52316] transition cursor-pointer ${
              !isMaximized ? "rounded-tr-md" : ""
            }`}
            title="Fechar (Esc)"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
};
