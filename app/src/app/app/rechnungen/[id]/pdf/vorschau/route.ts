/**
 * Rechnungs-Entwurfsvorschau on-the-fly — kein Persistieren,
 * kein Nummernkreis, kein Journal.
 */

import { NextResponse } from "next/server";
import { requireFirmaSession } from "@/lib/session";
import { renderRechnungVorschauPdf } from "@/modules/sales";
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
    const { buffer, filename } = await renderRechnungVorschauPdf(firmaId, id);
    return nextPdfResponse(buffer, filename);
  } catch (e) {
    return pdfRouteErrorResponse(e);
  }
}
