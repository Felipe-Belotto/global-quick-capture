import React from "react";
import { GripVertical } from "lucide-react";
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
      className={`flex items-center justify-center cursor-grab active:cursor-grabbing select-none text-[#aea69c] hover:text-[#f7f5f0] transition-colors p-1 rounded-[3px] hover:bg-[#383330] ${className}`}
    >
      <GripVertical className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" strokeWidth={1.75} />
    </div>
  );
};
