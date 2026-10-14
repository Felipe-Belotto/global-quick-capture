import Tesseract from "tesseract.js";

export interface OcrProgressInfo {
  progress: number; // 0 to 100
  status: string;
}

export type OcrProgressCallback = (info: OcrProgressInfo) => void;

/**
 * Normaliza uma string de imagem para o formato data URI se necessário.
 */
function normalizeImageSource(imageSource: string): string {
  if (
    imageSource.startsWith("data:") ||
    imageSource.startsWith("blob:") ||
    imageSource.startsWith("http://") ||
    imageSource.startsWith("https://")
  ) {
    return imageSource;
  }
  return `data:image/png;base64,${imageSource}`;
}

/**
 * Extrai texto de uma imagem usando Tesseract.js (suporte multilíngue leve: português e inglês).
 */
export async function extractTextFromImage(
  imageSource: string,
  onProgress?: OcrProgressCallback
): Promise<string> {
  if (!imageSource || imageSource.trim() === "") {
    throw new Error("Nenhuma imagem fornecida para OCR.");
  }

  const formattedSource = normalizeImageSource(imageSource.trim());

  try {
    const result = await Tesseract.recognize(formattedSource, "por+eng", {
      logger: (m) => {
        if (!onProgress) return;
        const progressVal =
          typeof m.progress === "number" ? Math.min(100, Math.max(0, Math.round(m.progress * 100))) : 0;

        let statusText = "reconhecendo texto...";
        if (m.status === "loading tesseract core") {
          statusText = "carregando motor OCR...";
        } else if (m.status === "initializing tesseract") {
          statusText = "inicializando...";
        } else if (m.status === "loading language traineddata") {
          statusText = "carregando dicionários...";
        } else if (m.status === "recognizing text") {
          statusText = progressVal > 0 ? `reconhecendo... ${progressVal}%` : "reconhecendo texto...";
        }

        onProgress({
          progress: progressVal,
          status: statusText,
        });
      },
    });

    const recognizedText = result?.data?.text ? result.data.text.trim() : "";
    return recognizedText;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Falha no OCR: ${message}`);
  }
}

/**
 * Formata o texto fornecido como um bloco de código Markdown.
 */
export function formatAsMarkdownCodeBlock(text: string, language: string = ""): string {
  const clean = text.trim();
  if (!clean) return "";
  return `\`\`\`${language}\n${clean}\n\`\`\``;
}

/**
 * Copia texto para a área de transferência com suporte resiliente a fallback.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("navigator.clipboard.writeText falhou, tentando fallback legado...", err);
  }

  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "-9999px";
    textArea.style.left = "-9999px";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    textArea.remove();
    return successful;
  } catch (fallbackErr) {
    console.error("Falha ao copiar para o clipboard:", fallbackErr);
    return false;
  }
}
