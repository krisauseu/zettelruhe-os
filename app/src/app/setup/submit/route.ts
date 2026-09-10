import { NextResponse } from "next/server";
import {
  createEigentuemer,
  createFirma,
  isSetupRequired,
  type SkrWahl,
  type Steuermodus,
} from "@/lib/pb";
import { setSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(request: Request) {
  const appUrl = process.env.APP_URL || "http://localhost";

  if (!(await isSetupRequired())) {
    return NextResponse.redirect(new URL("/login", appUrl), 303);
  }

  const formData = await request.formData();
  const name = str(formData, "name");
  const email = str(formData, "email");
  const password = str(formData, "password");
  const passwordConfirm = str(formData, "passwordConfirm");
  const firmaName = str(formData, "firmaName");
  const strasse = str(formData, "strasse");
  const plz = str(formData, "plz");
  const ort = str(formData, "ort");
  const steuernummer = str(formData, "steuernummer");
  const steuermodus = str(formData, "steuermodus") as Steuermodus;
  const skr = str(formData, "skr") as SkrWahl;

  const fail = (msg: string) =>
    NextResponse.redirect(
      new URL(`/setup?error=${encodeURIComponent(msg)}`, appUrl),
      303,
    );

  if (!name || !email || !password || !firmaName) {
    return fail("Bitte alle Pflichtfelder ausfüllen.");
  }
  if (password.length < 8) {
    return fail("Passwort muss mindestens 8 Zeichen haben.");
  }
  if (password !== passwordConfirm) {
    return fail("Passwörter stimmen nicht überein.");
  }
  if (
    steuermodus !== "kleinunternehmer" &&
    steuermodus !== "regelbesteuerung_ist"
  ) {
    return fail("Ungültiger Steuer-Modus.");
  }
  if (skr !== "skr03" && skr !== "skr04") {
    return fail("Ungültige SKR-Wahl.");
  }

  try {
    const firma = await createFirma({
      name: firmaName,
      steuermodus,
      skr,
      strasse,
      plz,
      ort,
      steuernummer,
    });
    const user = await createEigentuemer({
      email,
      password,
      name,
      firmaId: firma.id,
    });
    await setSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      firmaId: firma.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler.";
    return fail(`Setup fehlgeschlagen: ${msg}`);
  }

  return NextResponse.redirect(new URL("/app", appUrl), 303);
}
