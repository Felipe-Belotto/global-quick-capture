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
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 cursor-zoom-out select-none"
    >
      <div
        className="relative max-w-full max-h-full flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-between pb-2 text-xs font-mono text-[#86868b]">
          <span>Preview da Captura</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenAnnotation();
              }}
              className="px-3 py-1.5 rounded-md bg-[#16181d] hover:bg-[#1e222a] border border-[#282d37] hover:border-[#ff4d4d]/50 text-[#f5f5f7] cursor-pointer flex items-center gap-1.5 transition text-xs font-mono"
            >
              <PenTool size={13} className="text-[#ff4d4d]" />
              <span>Anotar</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md bg-[#16181d] hover:bg-[#1e222a] text-[#86868b] hover:text-[#f5f5f7] border border-[#282d37] cursor-pointer flex items-center gap-1.5 transition text-xs font-mono"
            >
              <X size={13} />
              <span>Fechar</span>
            </button>
          </div>
        </div>
        <img
          src={imageBase64}
          alt="Preview Completo"
          className="max-w-[85vw] max-h-[75vh] object-contain rounded-xl border border-[#282d37] shadow-2xl bg-[#0a0c0e]"
        />
      </div>
    </div>
  );
};
