"use server";

/**
 * Auth via Server Actions (ADR-0009).
 * Fehlerfälle: redirect zurück mit Query-Param (kein Client-JS nötig).
 * Route-Handler unter /setup/submit und /login/submit bleiben als Fallback.
 */

import { redirect } from "next/navigation";
import {
  clearSessionCookie,
  setSessionCookie,
  type SessionPayload,
} from "@/lib/session";
import {
  authWithPassword,
  createEigentuemer,
  createFirma,
  isSetupRequired,
  type SkrWahl,
  type Steuermodus,
} from "@/lib/pb";
import { resolveMitgliedschaftFuerSession } from "./mitgliedschaft";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = formString(formData, "email");
  const password = formString(formData, "password");

  if (!email || !password) {
    redirect(
      `/login?error=${encodeURIComponent("E-Mail und Passwort sind erforderlich.")}`,
    );
  }

  if (await isSetupRequired()) {
    redirect("/setup");
  }

  try {
    const user = await authWithPassword(email, password);
    const mitgliedschaft = await resolveMitgliedschaftFuerSession(
      user.id,
      user.firma,
    );
    const payload: SessionPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      firmaId: mitgliedschaft?.firmaId ?? null,
    };
    await setSessionCookie(payload);
  } catch {
    redirect(
      `/login?error=${encodeURIComponent("Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.")}`,
    );
  }

  redirect("/app");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function setupAction(formData: FormData): Promise<void> {
  if (!(await isSetupRequired())) {
    redirect("/login");
  }

  const name = formString(formData, "name");
  const email = formString(formData, "email");
  const password = formString(formData, "password");
  const passwordConfirm = formString(formData, "passwordConfirm");
  const firmaName = formString(formData, "firmaName");
  const steuermodus = formString(formData, "steuermodus") as Steuermodus;
  const skr = formString(formData, "skr") as SkrWahl;

  const fail = (msg: string): never => {
    redirect(`/setup?error=${encodeURIComponent(msg)}`);
  };

  if (!name || !email || !password || !firmaName) {
    fail("Bitte alle Pflichtfelder ausfüllen.");
  }
  if (password.length < 8) {
    fail("Passwort muss mindestens 8 Zeichen haben.");
  }
  if (password !== passwordConfirm) {
    fail("Passwörter stimmen nicht überein.");
  }
  if (
    steuermodus !== "kleinunternehmer" &&
    steuermodus !== "regelbesteuerung_ist"
  ) {
    fail("Ungültiger Steuer-Modus.");
  }
  if (skr !== "skr03" && skr !== "skr04") {
    fail("Ungültige SKR-Wahl.");
  }

  try {
    const firma = await createFirma({
      name: firmaName,
      steuermodus,
      skr,
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
    const msg =
      e instanceof Error ? e.message : "Unbekannter Fehler beim Setup.";
    fail(`Setup fehlgeschlagen: ${msg}`);
  }

  redirect("/app");
}
