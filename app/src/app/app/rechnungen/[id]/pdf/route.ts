/**
 * Rechnungs-Original-PDF (nach Festschreibung) über Next streamen.
 * Route unter /app/... (nicht /api/* — Caddy leitet /api an PB).
 */

import { NextResponse } from "next/server";
import { requireFirmaSession } from "@/lib/session";
import { getRechnungPdfResponse } from "@/modules/sales";
import {
  nextPdfResponse,
  pdfRouteErrorResponse,
} from "@/modules/sales/pdf-http";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(
  _request: Request,
  context: { params: Params },
): Promise<Response> {
  let firmaId: string;
  try {
    const session = await requireFirmaSession();
    firmaId = session.firmaId;
  } catch {
    return NextResponse.redirect(
      new URL("/login", process.env.APP_URL || "http://localhost"),
    );
  }

  const { id } = await context.params;

  try {
    const { response, filename } = await getRechnungPdfResponse(firmaId, id);
    const body = await response.arrayBuffer();
    return nextPdfResponse(body, filename);
  } catch (e) {
    return pdfRouteErrorResponse(e);
  }
}
