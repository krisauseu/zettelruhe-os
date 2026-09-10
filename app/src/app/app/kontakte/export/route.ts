import { NextResponse } from "next/server";
import { getSession, requireFirmaSession } from "@/lib/session";
import {
  kontakteCsvTemplate,
  listAllAnsprechpartner,
  listAllKontakte,
  serializeKontakteCsv,
} from "@/modules/contacts";

export const dynamic = "force-dynamic";

/** CSV-Export / Vorlage — Route nicht unter /api/* (Caddy → PB) */
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
  const template = url.searchParams.get("template") === "1";

  let body: string;
  let filename: string;

  if (template) {
    body = kontakteCsvTemplate();
    filename = "kontakte-vorlage.csv";
  } else {
    const items = await listAllKontakte(firmaId);
    const aps = await listAllAnsprechpartner(firmaId);
    const byKontakt = new Map<string, typeof aps>();
    for (const ap of aps) {
      const list = byKontakt.get(ap.kontakt) ?? [];
      list.push(ap);
      byKontakt.set(ap.kontakt, list);
    }
    body = serializeKontakteCsv(items, ";", byKontakt);
    filename = `kontakte-${new Date().toISOString().slice(0, 10)}.csv`;
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
