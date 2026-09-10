/**
 * Encoding für Kontoauszugs-Dateien.
 * DE-Auszüge sind oft Windows-1252/Latin-1, nicht nur UTF-8.
 */

export type BankImportEncoding = "utf-8" | "windows-1252";

export function decodeBankImportBytes(bytes: Uint8Array): {
  text: string;
  encoding: BankImportEncoding;
} {
  let offset = 0;
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    offset = 3;
  }
  const payload = offset > 0 ? bytes.subarray(offset) : bytes;
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(payload),
      encoding: "utf-8",
    };
  } catch {
    return {
      text: new TextDecoder("windows-1252").decode(payload),
      encoding: "windows-1252",
    };
  }
}
