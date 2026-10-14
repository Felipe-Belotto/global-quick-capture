import React from "react";
import { useDraggableWindow } from "../hooks/useDraggableWindow";

interface DragHandleProps {
  className?: string;
  title?: string;
}

export const DragHandle: React.FC<DragHandleProps> = ({
  className = "",
  title = "Segure e arraste para mover",
}) => {
  const { onMouseDown } = useDraggableWindow();

  return (
    <div
      data-tauri-drag-region
      onMouseDown={onMouseDown}
      title={title}
      className={`flex items-center justify-center cursor-grab active:cursor-grabbing select-none text-[#525460] hover:text-[#2dd4bf] transition-colors p-1 rounded hover:bg-[#1a1c24] ${className}`}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="opacity-70 group-hover:opacity-100"
      >
        <circle cx="8.5" cy="6" r="2" />
        <circle cx="15.5" cy="6" r="2" />
        <circle cx="8.5" cy="12" r="2" />
        <circle cx="15.5" cy="12" r="2" />
        <circle cx="8.5" cy="18" r="2" />
        <circle cx="15.5" cy="18" r="2" />
      </svg>
    </div>
  );
};
