import { NextResponse } from "next/server";
import { getSession, requireFirmaSession } from "@/lib/session";
import {
  katalogCsvTemplate,
  listAllKatalog,
  serializeKatalogCsv,
} from "@/modules/catalog";

export const dynamic = "force-dynamic";

/** CSV-Export / Vorlage Katalog — nicht unter /api/* */
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
    body = katalogCsvTemplate();
    filename = "katalog-vorlage.csv";
  } else {
    const items = await listAllKatalog(firmaId);
    body = serializeKatalogCsv(items);
    filename = `katalog-${new Date().toISOString().slice(0, 10)}.csv`;
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
