/**
 * Client-seitige Bildverkleinerung für Beleg-Uploads (nur Entwurf).
 * PDF bleibt unverändert; Raster wird JPEG (max. lange Kante, q=0.82).
 */

export const BELEG_BILD_MAX_KANTE = 2000;
export const BELEG_BILD_JPEG_QUALITAET = 0.82;
export const BELEG_BILD_SKIP_MAX_BYTES = 800 * 1024;

const PDF_MIME = "application/pdf";
const RASTER_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const RASTER_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

type DateiMeta = { type: string; size: number; name?: string };
type DateiMitMass = DateiMeta & { width?: number; height?: number };

type DecodedBild = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  close: () => void;
};

export function isPdfBelegDatei(file: { type: string; name?: string }): boolean {
  const mime = (file.type || "").toLowerCase();
  if (mime === PDF_MIME) return true;
  return (file.name ?? "").toLowerCase().endsWith(".pdf");
}

export function isRasterBelegBild(file: { type: string; name?: string }): boolean {
  const mime = (file.type || "").toLowerCase();
  if (RASTER_MIME.has(mime)) return true;
  return RASTER_EXT.test(file.name ?? "");
}

export function jpegFilename(name: string): string {
  const trimmed = name.trim() || "beleg";
  const base = trimmed.replace(/\.[^.]+$/, "");
  return `${base || "beleg"}.jpg`;
}

export function targetSize(
  width: number,
  height: number,
  maxKante = BELEG_BILD_MAX_KANTE,
): { width: number; height: number } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const lang = Math.max(w, h);
  if (lang <= maxKante) return { width: w, height: h };
  const scale = maxKante / lang;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

/** PDF, Nicht-Bild, oder schon klein genug (nach Decode: Kante und Bytes). */
export function shouldSkipCompression(file: DateiMitMass): boolean {
  if (isPdfBelegDatei(file)) return true;
  if (!isRasterBelegBild(file)) return true;
  if (file.width == null || file.height == null) return false;
  const kante = Math.max(file.width, file.height);
  return kante <= BELEG_BILD_MAX_KANTE && file.size <= BELEG_BILD_SKIP_MAX_BYTES;
}

export function pickSmallerFile(original: File, compressed: File): File {
  return compressed.size >= original.size ? original : compressed;
}

export async function compressBelegImage(file: File): Promise<File> {
  if (shouldSkipCompression(file) || !isRasterBelegBild(file)) {
    return file;
  }

  try {
    const decoded = await decodeBelegBild(file);
    try {
      if (
        shouldSkipCompression({
          type: file.type,
          size: file.size,
          name: file.name,
          width: decoded.width,
          height: decoded.height,
        })
      ) {
        return file;
      }
      const dims = targetSize(decoded.width, decoded.height);
      const blob = await drawJpeg(decoded, dims);
      if (!blob || blob.size <= 0) return file;
      const compressed = new File([blob], jpegFilename(file.name), {
        type: "image/jpeg",
        lastModified: file.lastModified,
      });
      return pickSmallerFile(file, compressed);
    } finally {
      decoded.close();
    }
  } catch {
    return file;
  }
}

async function decodeBelegBild(file: File): Promise<DecodedBild> {
  if (typeof createImageBitmap === "function") {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
    } catch {
      bitmap = await createImageBitmap(file);
    }
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw(ctx, width, height) {
        ctx.drawImage(bitmap, 0, 0, width, height);
      },
      close() {
        bitmap.close();
      },
    };
  }
  return decodeViaHtmlImage(file);
}

function decodeViaHtmlImage(file: File): Promise<DecodedBild> {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return Promise.reject(new Error("Kein Bilddecoder."));
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  return new Promise((resolve, reject) => {
    const fail = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Bild konnte nicht gelesen werden."));
    };
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        draw(ctx, width, height) {
          ctx.drawImage(img, 0, 0, width, height);
        },
        close() {
          URL.revokeObjectURL(url);
        },
      });
    };
    img.onerror = fail;
    img.src = url;
  });
}

function drawJpeg(
  decoded: DecodedBild,
  dims: { width: number; height: number },
): Promise<Blob | null> {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("Kein Canvas."));
  }
  const canvas = document.createElement("canvas");
  canvas.width = dims.width;
  canvas.height = dims.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  decoded.draw(ctx, dims.width, dims.height);
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      "image/jpeg",
      BELEG_BILD_JPEG_QUALITAET,
    );
  });
}
