/**
 * GiroCode als PNG-Daten-URI für @react-pdf/renderer (ADR-0014).
 */

import QRCode from "qrcode";

export async function renderGirocodeDataUri(
  payload: string,
): Promise<string | undefined> {
  const text = (payload ?? "").trim();
  if (!text) return undefined;
  try {
    return await QRCode.toDataURL(text, {
      type: "image/png",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 192,
      color: { dark: "#111111", light: "#FFFFFF" },
    });
  } catch {
    return undefined;
  }
}
