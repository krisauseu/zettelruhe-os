import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { validateNeueFirmaInput } from "@/modules/platform/firma-invariants";
import { createAndActivateFirma } from "@/modules/platform/firma-write";
import {
  KEINE_FIRMA_ANLEGEN_ERROR,
  istInstanzEigentuemer,
} from "@/modules/platform/rechte";

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
  if (!istInstanzEigentuemer(session.role)) {
    return NextResponse.redirect(
      new URL(
        `/app/firma?error=${encodeURIComponent(KEINE_FIRMA_ANLEGEN_ERROR)}`,
        appUrl,
      ),
      303,
    );
  }

  const formData = await request.formData();

  let input;
  try {
    input = validateNeueFirmaInput({
      name: str(formData, "name"),
      steuermodus: str(formData, "steuermodus"),
      skr: str(formData, "skr"),
      strasse: str(formData, "strasse"),
      plz: str(formData, "plz"),
      ort: str(formData, "ort"),
      land: str(formData, "land"),
      steuernummer: str(formData, "steuernummer"),
      ust_id: str(formData, "ust_id"),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Angaben ungültig.";
    return NextResponse.redirect(
      new URL(`/app/firma/neu?error=${encodeURIComponent(msg)}`, appUrl),
      303,
    );
  }

  try {
    await createAndActivateFirma(session, input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlegen fehlgeschlagen.";
    return NextResponse.redirect(
      new URL(`/app/firma/neu?error=${encodeURIComponent(msg)}`, appUrl),
      303,
    );
  }

  return NextResponse.redirect(new URL("/app/firma?created=1", appUrl), 303);
}
