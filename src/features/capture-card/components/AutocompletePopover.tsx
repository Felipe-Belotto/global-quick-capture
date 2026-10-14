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
      className="absolute z-50 w-68 bg-[#211d1a] border border-[#3f3a36] rounded-[4px] shadow-2xl shadow-black/90 font-mono text-xs overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Cabeçalho do Popover */}
      <div className="px-2.5 py-1.5 bg-[#262320] border-b border-[#383330] flex items-center justify-between text-[10px] text-[#aea69c] select-none">
        <span className="flex items-center gap-1.5 font-medium text-[#dad2c1]">
          {mode === "tag" ? (
            <>
              <Hash className="w-3 h-3 text-[#f7f5f0]" />
              <span>tags do cofre</span>
            </>
          ) : (
            <>
              <FileText className="w-3 h-3 text-[#f7f5f0]" />
              <span>notas & pastas [[ ]]</span>
            </>
          )}
        </span>
        <span className="text-[9px] text-[#877e74]">↑↓ navegar • ↵/tab</span>
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
              className={`w-full px-2 py-1.5 rounded-[3px] flex items-center justify-between gap-2 text-left transition cursor-pointer select-none ${
                isSelected
                  ? "bg-[#383330] text-[#f7f5f0] border border-[#3f3a36]"
                  : "text-[#dad2c1] hover:bg-[#2b2622] border border-transparent"
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                {item.type === "tag" && (
                  <Hash
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? "text-[#f7f5f0]" : "text-[#aea69c]"
                    }`}
                  />
                )}
                {item.type === "note" && (
                  <FileText
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? "text-[#f7f5f0]" : "text-[#aea69c]"
                    }`}
                  />
                )}
                {item.type === "folder" && (
                  <Folder
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? "text-[#f7f5f0]" : "text-[#aea69c]"
                    }`}
                  />
                )}
                <span className="truncate font-medium text-[11px]">{item.label}</span>
              </div>

              {item.detail && (
                <span className="text-[10px] text-[#877e74] shrink-0 truncate max-w-[80px]">
                  {item.detail}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Dica de rodapé */}
      <div className="px-2 py-1 bg-[#262320] border-t border-[#383330] text-[9px] text-[#877e74] flex items-center justify-between">
        <span>esc para fechar</span>
        <span>{items.length} sugestões</span>
      </div>
    </div>
  );
};
