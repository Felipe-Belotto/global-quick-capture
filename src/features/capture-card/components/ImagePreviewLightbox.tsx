import React from "react";

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
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 cursor-zoom-out select-none"
    >
      <div
        className="relative max-w-full max-h-full flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-between pb-2 text-xs font-mono text-[#a1a1aa]">
          <span>preview da captura</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenAnnotation();
              }}
              className="px-2.5 py-0.5 rounded bg-[#162725] border border-[#2dd4bf]/40 hover:bg-[#1a3834] text-[#2dd4bf] cursor-pointer"
            >
              ✏️ anotar imagem
            </button>
            <button
              onClick={onClose}
              className="px-2 py-0.5 rounded bg-[#1f222d] hover:bg-[#2e3343] text-white cursor-pointer"
            >
              fechar [esc]
            </button>
          </div>
        </div>
        <img
          src={imageBase64}
          alt="Preview Completo"
          className="max-w-[85vw] max-h-[75vh] object-contain rounded border border-[#323645] shadow-2xl bg-[#0c0d10]"
        />
      </div>
    </div>
  );
};
