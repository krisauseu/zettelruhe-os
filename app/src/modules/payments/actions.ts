"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchreibenSession } from "@/lib/session";
import { parseZahlungsweg } from "./invariants";
import { createZahlung, deleteZahlung } from "./repository";
import type { ZahlungInput } from "./types";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function requireFirmaId(): Promise<string> {
  const session = await requireSchreibenSession();
  return session.firmaId;
}

function parseZahlungForm(formData: FormData): ZahlungInput {
  return {
    rechnung: formString(formData, "rechnung"),
    datum: formString(formData, "datum"),
    betrag: formString(formData, "betrag"),
    zahlungsweg: parseZahlungsweg(formString(formData, "zahlungsweg")),
    notiz: formString(formData, "notiz") || undefined,
  };
}

/** Zahlung auf offene Rechnung erfassen (Teilzahlung erlaubt). */
export async function createZahlungAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const input = parseZahlungForm(formData);
  const vorgang = formString(formData, "vorgang");
  const rechnungId = input.rechnung;

  if (!rechnungId) {
    redirect("/app/rechnungen");
  }

  try {
    if (!/^[a-z0-9]{15}$/.test(vorgang)) throw new Error("Zahlungsformular neu laden.");
    await createZahlung(firmaId, input, { id: vorgang });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Zahlung fehlgeschlagen.";
    redirect(
      `/app/rechnungen/${rechnungId}?vorgang=${encodeURIComponent(vorgang)}&error=${encodeURIComponent(msg)}`,
    );
  }

  revalidatePath("/app/rechnungen");
  revalidatePath(`/app/rechnungen/${rechnungId}`);
  revalidatePath("/app/zahlungen");
  revalidatePath("/app/journal");
  revalidatePath("/app/eur");
  revalidatePath("/app/ust");
  revalidatePath("/app/auswertungen");
  revalidatePath("/app/zm");
  redirect(`/app/rechnungen/${rechnungId}?zahlung=1`);
}

/**
 * Zahlung löschen light (Korrektur).
 * Status der Rechnung wird neu aus verbleibenden Zahlungen abgeleitet.
 */
export async function deleteZahlungAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  const rechnungId = formString(formData, "rechnung");

  if (!id) {
    redirect(rechnungId ? `/app/rechnungen/${rechnungId}` : "/app/rechnungen");
  }

  try {
    await deleteZahlung(firmaId, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen.";
    if (rechnungId) {
      redirect(
        `/app/rechnungen/${rechnungId}?error=${encodeURIComponent(msg)}`,
      );
    }
    redirect(`/app/zahlungen?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/rechnungen");
  revalidatePath("/app/zahlungen");
  revalidatePath("/app/journal");
  revalidatePath("/app/eur");
  revalidatePath("/app/ust");
  revalidatePath("/app/auswertungen");
  revalidatePath("/app/zm");
  if (rechnungId) {
    revalidatePath(`/app/rechnungen/${rechnungId}`);
    redirect(`/app/rechnungen/${rechnungId}?zahlungGeloescht=1`);
  }
  redirect("/app/zahlungen?deleted=1");
}
