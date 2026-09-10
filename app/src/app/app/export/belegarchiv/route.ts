import { NextResponse } from "next/server";
import { getSession, requireFirmaSession } from "@/lib/session";
import {
  exportBelegArchivZip,
  zeitraumFromSearchParams,
} from "@/modules/reporting";

export const dynamic = "force-dynamic";

/** Belegarchiv-ZIP — Route nicht unter /api/* (Caddy → PB) */
export async function GET(request: Request) {
  const bare = await getSession();
  if (!bare) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let firmaId: string;
  try {
    const session = await requireFirmaSession();
    firmaId = session.firmaId;
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = new URL(request.url);
  const zeitraum = zeitraumFromSearchParams({
    preset: url.searchParams.get("preset") ?? undefined,
    von: url.searchParams.get("von") ?? undefined,
    bis: url.searchParams.get("bis") ?? undefined,
  });

  try {
    const { bytes, filename } = await exportBelegArchivZip(firmaId, zeitraum);
    // Copy into a fresh ArrayBuffer-backed Uint8Array for BodyInit typing
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return new NextResponse(copy, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export fehlgeschlagen.";
    return new NextResponse(msg, { status: 400 });
  }
}
