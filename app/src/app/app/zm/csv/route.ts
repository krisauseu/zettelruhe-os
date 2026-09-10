import { NextResponse } from "next/server";
import { getSession, requireFirmaSession } from "@/lib/session";
import { exportZmCsv, zeitraumFromSearchParams } from "@/modules/reporting";

export const dynamic = "force-dynamic";

/** ZM-CSV light — lokal speichern, kein Versand, kein amtliches Format. */
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
    const { body, filename } = await exportZmCsv(firmaId, zeitraum);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export fehlgeschlagen.";
    return new NextResponse(msg, { status: 400 });
  }
}
