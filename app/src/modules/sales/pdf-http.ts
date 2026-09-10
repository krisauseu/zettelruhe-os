import { NextResponse } from "next/server";
import {
  PDF_ORIGINAL_NUR_NACH_FESTSCHREIBUNG_ERROR,
  PDF_ORIGINAL_NUR_NACH_SENDEN_ERROR,
  PDF_VORSCHAU_NUR_ENTWURF_ERROR,
} from "./invariants";

export function nextPdfResponse(
  body: ArrayBuffer | Buffer,
  filename: string,
): NextResponse {
  const bytes = Uint8Array.from(
    body instanceof ArrayBuffer ? new Uint8Array(body) : body,
  );
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function pdfRouteErrorResponse(e: unknown): NextResponse {
  const msg = e instanceof Error ? e.message : "PDF nicht verfügbar.";
  if (msg.includes("nicht gefunden")) {
    return new NextResponse("Nicht gefunden", { status: 404 });
  }
  if (msg.includes("Kein PDF")) {
    return new NextResponse(msg, { status: 404 });
  }
  if (
    msg === PDF_ORIGINAL_NUR_NACH_FESTSCHREIBUNG_ERROR ||
    msg === PDF_ORIGINAL_NUR_NACH_SENDEN_ERROR ||
    msg === PDF_VORSCHAU_NUR_ENTWURF_ERROR
  ) {
    return new NextResponse(msg, { status: 409 });
  }
  return new NextResponse(msg, { status: 400 });
}
