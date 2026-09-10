import { describe, expect, it } from "vitest";
import {
  compressBelegImage,
  isPdfBelegDatei,
  isRasterBelegBild,
  jpegFilename,
  pickSmallerFile,
  shouldSkipCompression,
  targetSize,
} from "./compress-beleg-image";

function file(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("isPdfBelegDatei", () => {
  it("erkennt MIME und Endung", () => {
    expect(
      isPdfBelegDatei({ type: "application/pdf", name: "x.bin" }),
    ).toBe(true);
    expect(isPdfBelegDatei({ type: "", name: "scan.PDF" })).toBe(true);
    expect(isPdfBelegDatei({ type: "image/jpeg", name: "foto.jpg" })).toBe(
      false,
    );
  });
});

describe("isRasterBelegBild", () => {
  it("erkennt MIME und Endung inkl. HEIC", () => {
    expect(isRasterBelegBild({ type: "image/jpeg", name: "a" })).toBe(true);
    expect(isRasterBelegBild({ type: "", name: "foto.heic" })).toBe(true);
    expect(isRasterBelegBild({ type: "image/heif", name: "x" })).toBe(true);
    expect(
      isRasterBelegBild({ type: "application/pdf", name: "a.pdf" }),
    ).toBe(false);
  });
});

describe("jpegFilename", () => {
  it("ersetzt png und heic durch .jpg", () => {
    expect(jpegFilename("foto.png")).toBe("foto.jpg");
    expect(jpegFilename("foto.heic")).toBe("foto.jpg");
    expect(jpegFilename("scan.PDF")).toBe("scan.jpg");
  });
});

describe("targetSize", () => {
  it("skaliert 4000×3000 auf 2000×1500", () => {
    expect(targetSize(4000, 3000)).toEqual({ width: 2000, height: 1500 });
  });

  it("lässt kleinere Kanten unverändert", () => {
    expect(targetSize(1200, 800)).toEqual({ width: 1200, height: 800 });
  });
});

describe("shouldSkipCompression", () => {
  it("überspringt PDF", () => {
    expect(
      shouldSkipCompression({
        type: "application/pdf",
        size: 5 * 1024 * 1024,
        name: "beleg.pdf",
      }),
    ).toBe(true);
  });

  it("überspringt kleines Bild unter Schwellwert", () => {
    expect(
      shouldSkipCompression({
        type: "image/png",
        size: 400 * 1024,
        name: "screenshot.png",
        width: 1080,
        height: 1920,
      }),
    ).toBe(true);
  });

  it("komprimiert große Kante auch bei kleiner Datei", () => {
    expect(
      shouldSkipCompression({
        type: "image/jpeg",
        size: 500 * 1024,
        name: "foto.jpg",
        width: 4000,
        height: 3000,
      }),
    ).toBe(false);
  });
});

describe("pickSmallerFile", () => {
  it("behält Original wenn Blob größer oder gleich", () => {
    const original = file("a.jpg", "image/jpeg", 100);
    const compressed = file("a.jpg", "image/jpeg", 120);
    expect(pickSmallerFile(original, compressed)).toBe(original);
    const equal = file("a.jpg", "image/jpeg", 100);
    expect(pickSmallerFile(original, equal)).toBe(original);
  });

  it("nimmt die kleinere Datei", () => {
    const original = file("a.jpg", "image/jpeg", 1000);
    const compressed = file("a.jpg", "image/jpeg", 200);
    expect(pickSmallerFile(original, compressed)).toBe(compressed);
  });
});

describe("compressBelegImage", () => {
  it("gibt PDF unverändert zurück", async () => {
    const pdf = file("beleg.pdf", "application/pdf", 80);
    await expect(compressBelegImage(pdf)).resolves.toBe(pdf);
  });

  it("gibt ohne Decoder das Original zurück", async () => {
    const img = file("foto.jpg", "image/jpeg", 2 * 1024 * 1024);
    await expect(compressBelegImage(img)).resolves.toBe(img);
  });
});
