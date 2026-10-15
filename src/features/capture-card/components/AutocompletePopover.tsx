import React, { useEffect, useRef } from "react";
import { Hash, FileText, Folder } from "lucide-react";
import { AutocompleteItem, AutocompleteMode } from "../hooks/useVaultAutocomplete";

interface AutocompletePopoverProps {
  isOpen: boolean;
  mode: AutocompleteMode | null;
  items: AutocompleteItem[];
  selectedIndex: number;
  position: { top: number; left: number };
  onSelect: (item: AutocompleteItem) => void;
  onHover: (index: number) => void;
}

export const AutocompletePopover: React.FC<AutocompletePopoverProps> = ({
  isOpen,
  mode,
  items,
  selectedIndex,
  position,
  onSelect,
  onHover,
}) => {
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  // Garante que o item selecionado via setas do teclado fique sempre visível no scroll
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  if (!isOpen || items.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      className="absolute z-50 w-68 bg-[#111317] border border-[#282d37] rounded-xl shadow-2xl shadow-black/90 font-mono text-xs overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Cabeçalho do Popover */}
      <div className="px-2.5 py-1.5 bg-[#16181d] border-b border-[#282d37] flex items-center justify-between text-[10px] text-[#86868b] select-none">
        <span className="flex items-center gap-1.5 font-medium text-[#f5f5f7]">
          {mode === "tag" ? (
            <>
              <Hash className="w-3 h-3 text-[#ff4d4d]" />
              <span>tags do cofre</span>
            </>
          ) : (
            <>
              <FileText className="w-3 h-3 text-[#ff4d4d]" />
              <span>notas & pastas [[ ]]</span>
            </>
          )}
        </span>
        <span className="text-[9px] text-[#585e6a]">↑↓ navegar • ↵/tab</span>
      </div>

      {/* Lista de Sugestões */}
      <div
        ref={listRef}
        className="max-h-48 overflow-y-auto p-1 flex flex-col gap-0.5 no-scrollbar"
      >
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;

          return (
            <button
              key={item.id}
              ref={isSelected ? activeItemRef : null}
              onMouseDown={(e) => {
                // Impede que o textarea perca o foco durante o clique
                e.preventDefault();
                onSelect(item);
              }}
              onMouseEnter={() => onHover(idx)}
              className={`w-full px-2 py-1.5 rounded-md flex items-center justify-between gap-2 text-left transition cursor-pointer select-none ${
                isSelected
                  ? "bg-[#1e222a] text-[#f5f5f7] border border-[#ff4d4d]/40"
                  : "text-[#86868b] hover:text-[#f5f5f7] hover:bg-[#16181d] border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                {item.type === "tag" && (
                  <Hash
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? "text-[#ff4d4d]" : "text-[#86868b]"
                    }`}
                  />
                )}
                {item.type === "note" && (
                  <FileText
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? "text-[#ff4d4d]" : "text-[#86868b]"
                    }`}
                  />
                )}
                {item.type === "folder" && (
                  <Folder
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? "text-[#ff4d4d]" : "text-[#86868b]"
                    }`}
                  />
                )}
                <span className="truncate font-medium text-[11px]">{item.label}</span>
              </div>

              {item.detail && (
                <span className="text-[10px] text-[#585e6a] shrink-0 truncate max-w-[80px]">
                  {item.detail}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Dica de rodapé */}
      <div className="px-2 py-1 bg-[#16181d] border-t border-[#282d37] text-[9px] text-[#585e6a] flex items-center justify-between">
        <span>esc para fechar</span>
        <span>{items.length} sugestões</span>
      </div>
    </div>
  );
};
