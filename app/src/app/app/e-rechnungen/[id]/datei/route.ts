/**
 * E-Rechnungs-Original über Next streamen (Superuser → PB Files).
 * Route unter /app/... (nicht /api/* — Caddy leitet /api an PB).
 */

import { NextResponse } from "next/server";
import { requireFirmaSession } from "@/lib/session";
import { getERechnungDateiResponse } from "@/modules/einvoice";

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
    const { response, filename } = await getERechnungDateiResponse(
      firmaId,
      id,
    );
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    const body = await response.arrayBuffer();

    const safeName = filename.replace(/"/g, "");
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Datei nicht verfügbar.";
    if (msg.includes("nicht gefunden")) {
      return new NextResponse("Nicht gefunden", { status: 404 });
    }
    if (msg.includes("Keine Originaldatei")) {
      return new NextResponse("Keine Datei", { status: 404 });
    }
    return new NextResponse(msg, { status: 400 });
  }
}
