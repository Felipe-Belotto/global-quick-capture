import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppConfig, VaultNode } from "../../../shared/types";

export type AutocompleteMode = "tag" | "link";

export interface AutocompleteItem {
  id: string;
  label: string;
  insertValue: string;
  detail?: string;
  type: "tag" | "note" | "folder";
}

export interface UseVaultAutocompleteOptions {
  value: string;
  onChange: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  config: AppConfig | null;
}

export interface CaretCoordinates {
  top: number;
  left: number;
  lineHeight: number;
}

/**
 * Calcula as coordenadas exatas do cursor no textarea via elemento espelho (mirror DOM).
 * Altamente performático e sem dependências externas.
 */
function getCaretCoordinates(textarea: HTMLTextAreaElement, position: number): CaretCoordinates {
  const mirror = document.createElement("div");
  const style = window.getComputedStyle(textarea);

  const propertiesToCopy = [
    "direction",
    "boxSizing",
    "width",
    "overflowX",
    "overflowY",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "borderStyle",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "fontStretch",
    "fontSize",
    "fontSizeAdjust",
    "lineHeight",
    "fontFamily",
    "textAlign",
    "textTransform",
    "textIndent",
    "textDecoration",
    "letterSpacing",
    "wordSpacing",
    "tabSize",
  ];

  mirror.style.position = "absolute";
  mirror.style.top = "-9999px";
  mirror.style.left = "-9999px";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";

  for (const prop of propertiesToCopy) {
    // @ts-expect-error style property assignment
    mirror.style[prop] = style.getPropertyValue(prop);
  }

  mirror.style.width = `${textarea.clientWidth}px`;

  const textBefore = textarea.value.substring(0, position);
  mirror.textContent = textBefore;

  const span = document.createElement("span");
  span.textContent = textarea.value.substring(position, position + 1) || ".";
  mirror.appendChild(span);

  document.body.appendChild(mirror);

  const spanOffsetTop = span.offsetTop;
  const spanOffsetLeft = span.offsetLeft;
  const borderTop = parseInt(style.borderTopWidth, 10) || 0;
  const borderLeft = parseInt(style.borderLeftWidth, 10) || 0;
  const lineHeight = parseInt(style.lineHeight, 10) || 18;

  document.body.removeChild(mirror);

  return {
    top: spanOffsetTop + borderTop - textarea.scrollTop,
    left: spanOffsetLeft + borderLeft - textarea.scrollLeft,
    lineHeight,
  };
}

const DEFAULT_VAULT_TAGS = [
  "bug",
  "qa",
  "reuniao",
  "ideia",
  "projeto",
  "task",
  "inbox",
  "docs",
  "fix",
];

const FALLBACK_NODES: VaultNode[] = [
  { name: "Inbox.md", path: "Inbox.md", isFolder: false },
  { name: "Daily.md", path: "Daily.md", isFolder: false },
  { name: "Projetos", path: "Projetos", isFolder: true },
  { name: "Ideias.md", path: "Ideias.md", isFolder: false },
  { name: "Reuniões.md", path: "Reuniões.md", isFolder: false },
];

export function useVaultAutocomplete({
  value,
  onChange,
  textareaRef,
  config,
}: UseVaultAutocompleteOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AutocompleteMode | null>(null);
  const [items, setItems] = useState<AutocompleteItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [triggerRange, setTriggerRange] = useState<{ start: number; end: number } | null>(null);

  const [vaultNodes, setVaultNodes] = useState<VaultNode[]>([]);
  const isInteractingWithKeyboardRef = useRef(false);

  // Carrega nós do cofre em background (cache em memória para zero lag)
  useEffect(() => {
    let isMounted = true;
    const fetchNodes = async () => {
      if (!config?.vaultPath) return;
      try {
        const nodes = await invoke<VaultNode[]>("list_vault_nodes_cmd", {
          vaultPath: config.vaultPath,
        });
        if (isMounted && Array.isArray(nodes) && nodes.length > 0) {
          setVaultNodes(nodes);
        }
      } catch (err) {
        console.warn("Falha ao carregar nós do cofre para autocomplete:", err);
      }
    };

    fetchNodes();
    return () => {
      isMounted = false;
    };
  }, [config?.vaultPath]);

  // Lista consolidada de tags: padrões do cofre + tags das rotas de projeto
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    DEFAULT_VAULT_TAGS.forEach((t) => set.add(t.toLowerCase().replace(/^#/, "")));

    if (config?.projectRoutes) {
      for (const route of config.projectRoutes) {
        if (route.defaultTags && Array.isArray(route.defaultTags)) {
          for (const tag of route.defaultTags) {
            set.add(tag.toLowerCase().replace(/^#/, ""));
          }
        }
      }
    }

    return Array.from(set);
  }, [config?.projectRoutes]);

  // Aplica a sugestão selecionada no texto
  const applySuggestion = useCallback(
    (item: AutocompleteItem) => {
      const el = textareaRef.current;
      if (!el || !triggerRange) return;

      const currentValue = el.value;
      const { start, end } = triggerRange;

      let textAfter = currentValue.slice(end);

      // Ao fechar wikilink, evita duplicar ]] se já existir logo após o cursor
      if (mode === "link" && textAfter.startsWith("]]")) {
        textAfter = textAfter.slice(2);
      }

      // Ao inserir tag, evita espaço duplo se já existir após o cursor
      if (mode === "tag" && textAfter.startsWith(" ") && item.insertValue.endsWith(" ")) {
        textAfter = textAfter.slice(1);
      }

      const nextValue = currentValue.slice(0, start) + item.insertValue + textAfter;
      const nextCursor = start + item.insertValue.length;

      onChange(nextValue);
      setIsOpen(false);
      setItems([]);
      setTriggerRange(null);
      setMode(null);

      // Reposiciona o cursor após a inserção de forma imediata
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(nextCursor, nextCursor);
        }
      }, 0);
    },
    [textareaRef, triggerRange, mode, onChange]
  );

  // Analisa o cursor e verifica se disparou `#` ou `[[`
  const checkTrigger = useCallback(() => {
    const el = textareaRef.current;
    if (!el) {
      setIsOpen(false);
      return;
    }

    const cursor = el.selectionStart;
    const text = el.value;
    const textBefore = text.slice(0, cursor);

    // 1. Detectar trigger de link: [[ seguido de caracteres válidos (não fecha com ] nem pula linha)
    const linkMatch = textBefore.match(/\[\[([^\]\r\n]*)$/);

    // 2. Detectar trigger de tag: # no início ou após espaço, seguido de caracteres alfanuméricos/hífen
    const tagMatch = textBefore.match(/(?:^|\s)(#[\w\u00C0-\u017F-]*)$/);

    let activeMode: AutocompleteMode | null = null;
    let query = "";
    let triggerStart = 0;

    // Se ambos derem match por algum motivo, vence o que estiver mais próximo do cursor
    if (linkMatch && (!tagMatch || (linkMatch.index ?? 0) >= (tagMatch.index ?? 0))) {
      activeMode = "link";
      query = linkMatch[1];
      triggerStart = cursor - (query.length + 2); // 2 para '[['
    } else if (tagMatch) {
      activeMode = "tag";
      const rawTag = tagMatch[1];
      query = rawTag.slice(1);
      triggerStart = cursor - rawTag.length;
    }

    if (!activeMode) {
      setIsOpen(false);
      setItems([]);
      setTriggerRange(null);
      setMode(null);
      return;
    }

    let newItems: AutocompleteItem[] = [];

    if (activeMode === "tag") {
      const q = query.toLowerCase();
      const filtered = availableTags
        .filter((tag) => !q || tag.toLowerCase().includes(q))
        .sort((a, b) => {
          const aStarts = a.toLowerCase().startsWith(q);
          const bStarts = b.toLowerCase().startsWith(q);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return a.localeCompare(b);
        });

      newItems = filtered.slice(0, 8).map((tag) => ({
        id: `tag-${tag}`,
        label: `#${tag}`,
        insertValue: `#${tag} `,
        detail: "tag do cofre",
        type: "tag" as const,
      }));

      // Se o usuário digitou uma tag personalizada que não está na lista, permite sugerir a criação dela
      if (q && !filtered.some((t) => t.toLowerCase() === q)) {
        newItems.push({
          id: `tag-custom-${q}`,
          label: `#${query}`,
          insertValue: `#${query} `,
          detail: "nova tag",
          type: "tag" as const,
        });
      }
    } else if (activeMode === "link") {
      const q = query.trim().toLowerCase();
      const sourceNodes = vaultNodes.length > 0 ? vaultNodes : FALLBACK_NODES;

      const filtered = sourceNodes
        .filter((node) => {
          if (!q) return true;
          const cleanName = node.name.replace(/\.md$/i, "").toLowerCase();
          const cleanPath = node.path.replace(/\.md$/i, "").toLowerCase();
          return cleanName.includes(q) || cleanPath.includes(q);
        })
        .sort((a, b) => {
          const aName = a.name.replace(/\.md$/i, "").toLowerCase();
          const bName = b.name.replace(/\.md$/i, "").toLowerCase();
          const aStarts = aName.startsWith(q);
          const bStarts = bName.startsWith(q);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          // Notas têm prioridade sobre pastas ao linkar
          if (a.isFolder !== b.isFolder) return a.isFolder ? 1 : -1;
          return aName.localeCompare(bName);
        });

      newItems = filtered.slice(0, 10).map((node) => {
        const cleanName = node.name.replace(/\.md$/i, "");
        return {
          id: `${node.isFolder ? "folder" : "note"}-${node.path}`,
          label: node.isFolder ? `${cleanName}/` : cleanName,
          insertValue: node.isFolder ? `[[${cleanName}/]] ` : `[[${cleanName}]] `,
          detail: node.isFolder ? "pasta" : node.path !== node.name ? node.path : "nota",
          type: node.isFolder ? ("folder" as const) : ("note" as const),
        };
      });

      // Se o usuário digitou o nome de uma nota ainda inexistente, permite fechar o link normalmente com ]]
      if (q && !filtered.some((n) => n.name.replace(/\.md$/i, "").toLowerCase() === q)) {
        newItems.push({
          id: `note-new-${q}`,
          label: query,
          insertValue: `[[${query}]] `,
          detail: "criar link",
          type: "note" as const,
        });
      }
    }

    if (newItems.length === 0) {
      setIsOpen(false);
      setItems([]);
      return;
    }

    // Calcula coordenadas para o popover flutuante
    const coords = getCaretCoordinates(el, cursor);
    const popoverWidth = 270;
    const estimatedHeight = Math.min(newItems.length * 36 + 40, 240);

    let left = coords.left;
    let top = coords.top + coords.lineHeight + 6;

    // Ajusta para não vazar a largura do textarea
    const maxLeft = Math.max(10, el.clientWidth - popoverWidth - 10);
    left = Math.max(8, Math.min(left, maxLeft));

    // Se estiver muito embaixo no textarea, abre acima do cursor
    if (top + estimatedHeight > el.clientHeight + 45 && coords.top > estimatedHeight) {
      top = Math.max(8, coords.top - estimatedHeight - 4);
    }

    setMode(activeMode);
    setItems(newItems);
    setTriggerRange({ start: triggerStart, end: cursor });
    setPosition({ top, left });
    setSelectedIndex(0);
    setIsOpen(true);
  }, [availableTags, vaultNodes, textareaRef]);

  // Dispara checagem quando o valor muda
  useEffect(() => {
    checkTrigger();
  }, [value, checkTrigger]);

  // Escuta cliques ou movimentações de cursor no textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const handleCursorChange = () => {
      if (!isInteractingWithKeyboardRef.current) {
        checkTrigger();
      }
    };

    el.addEventListener("click", handleCursorChange);
    el.addEventListener("keyup", handleCursorChange);

    return () => {
      el.removeEventListener("click", handleCursorChange);
      el.removeEventListener("keyup", handleCursorChange);
    };
  }, [textareaRef, checkTrigger]);

  // Interceptador de teclado para navegação no popover
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!isOpen || items.length === 0) return false;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        isInteractingWithKeyboardRef.current = true;
        setSelectedIndex((prev) => (prev + 1) % items.length);
        setTimeout(() => {
          isInteractingWithKeyboardRef.current = false;
        }, 50);
        return true;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        isInteractingWithKeyboardRef.current = true;
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        setTimeout(() => {
          isInteractingWithKeyboardRef.current = false;
        }, 50);
        return true;
      }

      if (e.key === "Enter" || e.key === "Tab") {
        // Se for Ctrl+Enter ou Meta+Enter, deixa o card salvar
        if (e.ctrlKey || e.metaKey) return false;

        e.preventDefault();
        e.stopPropagation();
        const selected = items[selectedIndex];
        if (selected) {
          applySuggestion(selected);
        }
        return true;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        setItems([]);
        return true;
      }

      return false;
    },
    [isOpen, items, selectedIndex, applySuggestion]
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setItems([]);
  }, []);

  return {
    isOpen,
    mode,
    items,
    selectedIndex,
    position,
    handleKeyDown,
    applySuggestion,
    setSelectedIndex,
    close,
  };
}
