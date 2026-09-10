import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { switchActiveFirma } from "@/modules/platform/firma-write";

export const dynamic = "force-dynamic";

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(request: Request) {
  const appUrl = process.env.APP_URL || "http://localhost";

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", appUrl), 303);
  }

  const formData = await request.formData();
  try {
    await switchActiveFirma(session, str(formData, "firmaId"));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Wechsel fehlgeschlagen.";
    return NextResponse.redirect(
      new URL(`/app/firma?error=${encodeURIComponent(msg)}`, appUrl),
      303,
    );
  }

  return NextResponse.redirect(new URL("/app?firma=1", appUrl), 303);
}
