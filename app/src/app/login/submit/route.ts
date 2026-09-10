import { NextResponse } from "next/server";
import { authWithPassword, isSetupRequired } from "@/lib/pb";
import { setSessionCookie } from "@/lib/session";
import { resolveMitgliedschaftFuerSession } from "@/modules/platform/mitgliedschaft";

export const dynamic = "force-dynamic";

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(request: Request) {
  const appUrl = process.env.APP_URL || "http://localhost";

  if (await isSetupRequired()) {
    return NextResponse.redirect(new URL("/setup", appUrl), 303);
  }

  const formData = await request.formData();
  const email = str(formData, "email");
  const password = str(formData, "password");

  if (!email || !password) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("E-Mail und Passwort sind erforderlich.")}`,
        appUrl,
      ),
      303,
    );
  }

  try {
    const user = await authWithPassword(email, password);
    const mitgliedschaft = await resolveMitgliedschaftFuerSession(
      user.id,
      user.firma,
    );
    await setSessionCookie({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      firmaId: mitgliedschaft?.firmaId ?? null,
    });
  } catch {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.")}`,
        appUrl,
      ),
      303,
    );
  }

  return NextResponse.redirect(new URL("/app", appUrl), 303);
}
