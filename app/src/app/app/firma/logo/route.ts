/**
 * Logo der Firma für die Einstellungsvorschau (nicht das Dokumenten-PDF).
 */

import { NextResponse } from "next/server";
import { requireFirmaSession } from "@/lib/session";
import { fetchRecordFile, getFirmaById } from "@/lib/pb";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let firmaId: string;
  try {
    const session = await requireFirmaSession();
    firmaId = session.firmaId;
  } catch {
    return NextResponse.redirect(
      new URL("/login", process.env.APP_URL || "http://localhost"),
    );
  }

  const firma = await getFirmaById(firmaId);
  const name = firma?.logo?.trim();
  if (!firma || !name) {
    return new NextResponse("Kein Logo", { status: 404 });
  }

  try {
    const response = await fetchRecordFile("firmen", firma.id, name);
    const body = await response.arrayBuffer();
    const contentType =
      response.headers.get("content-type") || "application/octet-stream";
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new NextResponse("Logo nicht ladbar", { status: 404 });
  }
}
