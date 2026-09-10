/**
 * E-Rechnungs-Versand-Original über Next streamen.
 * Route unter /app/... (nicht /api/* — Caddy leitet /api an PB).
 */

import { NextResponse } from "next/server";
import { requireFirmaSession } from "@/lib/session";
import { getERechnungVersandDateiResponse } from "@/modules/einvoice";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string; versandId: string }>;

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

  const { id, versandId } = await context.params;

  try {
    const { response, filename, versand } =
      await getERechnungVersandDateiResponse(firmaId, versandId);
    if (versand.rechnung !== id) {
      return new NextResponse("Nicht gefunden", { status: 404 });
    }
    const contentType =
      response.headers.get("content-type") || "application/xml";
    const body = await response.arrayBuffer();
    const safeName = filename.replace(/"/g, "");
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType.includes("xml")
          ? "application/xml; charset=utf-8"
          : contentType,
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Datei nicht verfügbar.";
    if (msg.includes("nicht gefunden")) {
      return new NextResponse("Nicht gefunden", { status: 404 });
    }
    return new NextResponse(msg, { status: 400 });
  }
}
