"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchreibenSession } from "@/lib/session";
import { uebernehmenAlsRechnung } from "./uebernahme";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/**
 * 1-Klick: alle abrechenbaren Zeiten/Fahrten einer:s Kund:in → Rechnungs-Entwurf.
 * Form: kunde (required), optional return_to.
 */
export async function uebernehmenZeitenFahrtenAlsRechnungAction(
  formData: FormData,
): Promise<void> {
  const session = await requireSchreibenSession();
  const firmaId = session.firmaId;
  const kunde = formString(formData, "kunde");
  const returnTo = formString(formData, "return_to") || "/app/zeiten";

  if (!kunde) {
    redirect(
      `${returnTo}?error=${encodeURIComponent("Kund:in ist erforderlich.")}`,
    );
  }

  let rechnungId: string;
  try {
    const result = await uebernehmenAlsRechnung(firmaId, kunde);
    rechnungId = result.rechnung.id;
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Übernahme fehlgeschlagen.";
    redirect(`${returnTo}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/zeiten");
  revalidatePath("/app/fahrten");
  revalidatePath("/app/rechnungen");
  redirect(`/app/rechnungen/${rechnungId}`);
}
