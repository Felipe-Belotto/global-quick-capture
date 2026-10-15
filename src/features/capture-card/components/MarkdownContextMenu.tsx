import React, { useEffect, useRef, useState } from "react";
import {
  Link2,
  ExternalLink,
  Bold,
  Italic,
  Highlighter,
  Strikethrough,
  Code,
  CheckSquare,
  List,
  ListOrdered,
  Quote,
  FileCode2,
  Scissors,
  Copy,
  ClipboardPaste,
  CheckCheck,
  ChevronRight,
} from "lucide-react";

export interface MarkdownContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onApplyFormat: (prefix: string, suffix?: string) => void;
  onInsertTemplate: (template: string) => void;
  onClipboardAction: (action: "cut" | "copy" | "paste" | "select_all") => void;
  hasSelection: boolean;
}

export const MarkdownContextMenu: React.FC<MarkdownContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  onApplyFormat,
  onInsertTemplate,
  onClipboardAction,
  hasSelection,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<"format" | "insert" | null>(null);

  // Fechar ao clicar fora ou ao pressionar Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Ajusta a posição para não vazar a tela
  const menuWidth = 210;
  const menuHeight = 280;
  const clampedX = Math.max(10, Math.min(position.x, window.innerWidth - menuWidth - 10));
  const clampedY = Math.max(10, Math.min(position.y, window.innerHeight - menuHeight - 10));

  return (
    <div
      ref={menuRef}
      style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
      className="fixed z-50 w-52 bg-[#181a1f] border border-[#2b303c] rounded-md shadow-2xl py-1 text-xs font-mono text-[#f5f5f7] select-none backdrop-blur-md"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 1. Links estilo Obsidian */}
      <button
        onClick={() => {
          onApplyFormat("[[", "]]");
          onClose();
        }}
        className="w-full px-3 py-1.5 hover:bg-[#262a34] text-left flex items-center gap-2.5 transition cursor-pointer"
      >
        <Link2 className="w-3.5 h-3.5 text-[#ff4d4d]" />
        <span>Add link</span>
        <span className="ml-auto text-[10px] text-[#86868b]">[[ ]]</span>
      </button>

      <button
        onClick={() => {
          onApplyFormat("[", "](url)");
          onClose();
        }}
        className="w-full px-3 py-1.5 hover:bg-[#262a34] text-left flex items-center gap-2.5 transition cursor-pointer"
      >
        <ExternalLink className="w-3.5 h-3.5 text-[#86868b]" />
        <span>Add external link</span>
      </button>

      <div className="h-[1px] bg-[#282d37] my-1" />

      {/* 2. Menu Formatação */}
      <div
        className="relative"
        onMouseEnter={() => setActiveSubmenu("format")}
        onMouseLeave={() => setActiveSubmenu(null)}
      >
        <div className="w-full px-3 py-1.5 hover:bg-[#262a34] text-left flex items-center justify-between transition cursor-pointer">
          <div className="flex items-center gap-2.5">
            <Bold className="w-3.5 h-3.5 text-[#86868b]" />
            <span>Format</span>
          </div>
          <ChevronRight className="w-3 h-3 text-[#86868b]" />
        </div>

        {activeSubmenu === "format" && (
          <div className="absolute left-full top-0 ml-0.5 w-48 bg-[#181a1f] border border-[#2b303c] rounded-md shadow-2xl py-1">
            <button
              onClick={() => {
                onApplyFormat("**", "**");
                onClose();
              }}
              className="w-full px-3 py-1.5 hover:bg-[#262a34] text-left flex items-center gap-2.5 transition cursor-pointer font-bold"
            >
              <Bold className="w-3 h-3" />
              <span>Bold</span>
              <span className="ml-auto text-[10px] text-[#86868b]">**</span>
            </button>
            <button
              onClick={() => {
                onApplyFormat("*", "*");
                onClose();
              }}
              className="w-full px-3 py-1.5 hover:bg-[#262a34] text-left flex items-center gap-2.5 transition cursor-pointer italic"
            >
              <Italic className="w-3 h-3" />
              <span>Italic</span>
              <span className="ml-auto text-[10px] text-[#86868b]">*</span>
            </button>
            <button
              onClick={() => {
                onApplyFormat("==", "==");
                onClose();
              }}
              className="w-full px-3 py-1.5 hover:bg-[#262a34] text-left flex items-center gap-2.5 transition cursor-pointer text-[#eab308]"
            >
              <Highlighter className="w-3 h-3" />
              <span>Highlight</span>
              <span className="ml-auto text-[10px] text-[#86868b]">==</span>
            </button>
            <button
              onClick={() => {
                onApplyFormat("~~", "~~");
                onClose();
              }}
              className="w-full px-3 py-1.5 hover:bg-[#262a34] text-left flex items-center gap-2.5 transition cursor-pointer line-through"
            >
              <Strikethrough className="w-3 h-3" />
              <span>Strikethrough</span>
              <span className="ml-auto text-[10px] text-[#86868b]">~~</span>
            </button>
            <button
              onClick={() => {
                onApplyFormat("`", "`");
                onClose();
              }}
              className="w-full px-3 py-1.5 hover:bg-[#262a34] text-left flex items-center gap-2.5 transition cursor-pointer text-[#38bdf8]"
            >
              <Code className="w-3 h-3" />
              <span>Inline code</span>
              <span className="ml-auto text-[10px] text-[#86868b]">`</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Menu Inserção */}
      <div
        className="relative"
        onMouseEnter={() => setActiveSubmenu("insert")}
        onMouseLeave={() => setActiveSubmenu(null)}
      >
        <div className="w-full px-3 py-1.5 hover:bg-[#262a34] text-left flex items-center justify-between transition cursor-pointer">
          <div className="flex items-center gap-2.5">
            <CheckSquare className="w-3.5 h-3.5 text-[#86868b]" />
            <span>Insert</span>
          </div>
          <ChevronRight className="w-3 h-3 text-[#86868b]" />
        </div>

        {activeSubmenu === "insert" && (
          <div className="absolute left-full top-0 ml-0.5 w-52 bg-[#181a1f] border border-[#2b303c] rounded-md shadow-2xl py-1">
            <button
              onClick={() => {
                onInsertTemplate("- [ ] ");
                onClose();
              }}
              className="w-full px-3 py-1.5 hover:bg-[#262a34] text-left flex items-center gap-2.5 transition cursor-pointer"
            >
              <CheckSquare className="w-3 h-3 text-[#10b981]" />
              <span>Task</span>
              <span className="ml-auto text-[10px] text-[#86868b]">- [ ]</span>
            </button>
            <button
              onClick={() => {
                onInsertTemplate("- ");
                onClose();
              }}
              className="w-full px-3 py-1.5 hover:bg-[#262a34] text-left flex items-center gap-2.5 transition cursor-pointer"
            >
              <List className="w-3 h-3" />
              <span>Bullet list</span>
              <span className="ml-auto text-[10px] text-[#86868b]">-</span>
            </button>
            <button
              onClick={() => {
                onInsertTemplate("1. ");
                onClose();
              }}
              className="w-full px-3 py-1.5 hover:bg-[#262a34] text-left flex items-center gap-2.5 transition cursor-pointer"
            >
              <ListOrdered className="w-3 h-3" />
              <span>Numbered list</span>
              <span className="ml-auto text-[10px] text-[#86868b]">1.</span>
            </button>
            <button
              onClick={() => {
                onInsertTemplate("> [!NOTE]\n> ");
                onClose();
              }}
              className="w-full px-3 py-1.5 hover:bg-[#262a34] text-left flex items-center gap-2.5 transition cursor-pointer text-[#38bdf8]"
            >
              <Quote className="w-3 h-3" />
              <span>Callout</span>
            </button>
            <button
              onClick={() => {
                onInsertTemplate("```\n\n```");
                onClose();
              }}
              className="w-full px-3 py-1.5 hover:bg-[#262a34] text-left flex items-center gap-2.5 transition cursor-pointer text-[#a855f7]"
            >
              <FileCode2 className="w-3 h-3" />
              <span>Code block</span>
              <span className="ml-auto text-[10px] text-[#86868b]">```</span>
            </button>
          </div>
        )}
      </div>

      <div className="h-[1px] bg-[#282d37] my-1" />

      {/* 4. Ações padrão de edição / clipboard */}
      <button
        disabled={!hasSelection}
        onClick={() => {
          onClipboardAction("cut");
          onClose();
        }}
        className="w-full px-3 py-1.5 hover:bg-[#262a34] disabled:opacity-40 text-left flex items-center gap-2.5 transition cursor-pointer"
      >
        <Scissors className="w-3.5 h-3.5 text-[#86868b]" />
        <span>Cut</span>
        <span className="ml-auto text-[10px] text-[#86868b]">Ctrl+X</span>
      </button>

      <button
        disabled={!hasSelection}
        onClick={() => {
          onClipboardAction("copy");
          onClose();
        }}
        className="w-full px-3 py-1.5 hover:bg-[#262a34] disabled:opacity-40 text-left flex items-center gap-2.5 transition cursor-pointer"
      >
        <Copy className="w-3.5 h-3.5 text-[#86868b]" />
        <span>Copy</span>
        <span className="ml-auto text-[10px] text-[#86868b]">Ctrl+C</span>
      </button>

      <button
        onClick={() => {
          onClipboardAction("paste");
          onClose();
        }}
        className="w-full px-3 py-1.5 hover:bg-[#262a34] text-left flex items-center gap-2.5 transition cursor-pointer"
      >
        <ClipboardPaste className="w-3.5 h-3.5 text-[#86868b]" />
        <span>Paste</span>
        <span className="ml-auto text-[10px] text-[#86868b]">Ctrl+V</span>
      </button>

      <button
        onClick={() => {
          onClipboardAction("select_all");
          onClose();
        }}
        className="w-full px-3 py-1.5 hover:bg-[#262a34] text-left flex items-center gap-2.5 transition cursor-pointer"
      >
        <CheckCheck className="w-3.5 h-3.5 text-[#86868b]" />
        <span>Select all</span>
        <span className="ml-auto text-[10px] text-[#86868b]">Ctrl+A</span>
      </button>
    </div>
  );
};
