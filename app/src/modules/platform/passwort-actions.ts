"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { aendereEigenesPasswort } from "./passwort";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Jede angemeldete Nutzer:in, unabhängig von Rolle und Firma-Recht. */
export async function aendereEigenesPasswortAction(
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  try {
    await aendereEigenesPasswort({
      userId: session.userId,
      email: session.email,
      altesPasswort: formString(formData, "oldPassword"),
      neuesPasswort: formString(formData, "password"),
      neuesPasswortConfirm: formString(formData, "passwordConfirm"),
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Passwort konnte nicht geändert werden.";
    redirect(`/app/passwort?error=${encodeURIComponent(msg)}`);
  }
  redirect("/app/passwort?saved=1");
}
