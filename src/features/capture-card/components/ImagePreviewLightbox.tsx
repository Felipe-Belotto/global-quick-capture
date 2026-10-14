import React from "react";
import { PenTool, X } from "lucide-react";

interface ImagePreviewLightboxProps {
  imageBase64: string;
  onClose: () => void;
  onOpenAnnotation: () => void;
}

export const ImagePreviewLightbox: React.FC<ImagePreviewLightboxProps> = ({
  imageBase64,
  onClose,
  onOpenAnnotation,
}) => {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 cursor-zoom-out select-none"
    >
      <div
        className="relative max-w-full max-h-full flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-between pb-2 text-xs font-mono text-[#aea69c]">
          <span>preview da captura</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenAnnotation();
              }}
              className="px-2.5 py-1 rounded-[3px] bg-[#2b2622] hover:bg-[#383330] border border-[#3f3a36] text-[#f7f5f0] cursor-pointer flex items-center gap-1.5 transition"
            >
              <PenTool size={12} />
              <span>anotar imagem</span>
            </button>
            <button
              onClick={onClose}
              className="px-2.5 py-1 rounded-[3px] bg-[#262320] hover:bg-[#383330] text-[#dad2c1] hover:text-[#f7f5f0] border border-[#383330] cursor-pointer flex items-center gap-1.5 transition"
            >
              <X size={12} />
              <span>fechar [esc]</span>
            </button>
          </div>
        </div>
        <img
          src={imageBase64}
          alt="Preview Completo"
          className="max-w-[85vw] max-h-[75vh] object-contain rounded-[4px] border border-[#3f3a36] shadow-2xl bg-[#181513]"
        />
      </div>
    </div>
  );
};
