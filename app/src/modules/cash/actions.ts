"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchreibenSession } from "@/lib/session";
import {
  festschreibenKassenbuchEintrag,
  storniereKassenbuchEintrag,
} from "./repository";
import type { Buchungsrichtung, KassenbuchInput, Steuersatz } from "./types";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function requireFirmaId(): Promise<string> {
  const session = await requireSchreibenSession();
  return session.firmaId;
}

function parseKassenbuchForm(formData: FormData): KassenbuchInput {
  const richtungRaw = formString(formData, "richtung");
  const richtung: Buchungsrichtung =
    richtungRaw === "einnahme" ? "einnahme" : "ausgabe";

  const satzRaw = formString(formData, "steuersatz");
  let steuersatz: Steuersatz | "" = "";
  if (satzRaw === "0" || satzRaw === "7" || satzRaw === "19") {
    steuersatz = satzRaw;
  }

  const kontakt = formString(formData, "kontakt");

  return {
    datum: formString(formData, "datum"),
    richtung,
    betrag_netto: formString(formData, "betrag_netto") || undefined,
    betrag_ust: formString(formData, "betrag_ust") || undefined,
    betrag_brutto: formString(formData, "betrag_brutto") || undefined,
    steuersatz,
    text: formString(formData, "text"),
    kategorie: formString(formData, "kategorie") || undefined,
    notiz: formString(formData, "notiz") || undefined,
    kontakt: kontakt || null,
  };
}

/** Bareinnahme/Barausgabe erfassen (= Festschreibung + Journal). */
export async function festschreibenKassenbuchAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const input = parseKassenbuchForm(formData);
  const vorgangId = formString(formData, "vorgang_id");

  let id: string;
  try {
    const { eintrag } = await festschreibenKassenbuchEintrag(firmaId, input, {
      vorgangId,
    });
    id = eintrag.id;
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Festschreibung fehlgeschlagen.";
    redirect(
      `/app/kassenbuch/neu?error=${encodeURIComponent(msg)}&vorgang=${encodeURIComponent(vorgangId)}`,
    );
  }

  revalidatePath("/app/kassenbuch");
  revalidatePath("/app/journal");
  redirect(`/app/kassenbuch/${id}?created=1`);
}

/** Storno/Gegenbuchung zu einem festgeschriebenen Kassenbuch-Eintrag. */
export async function storniereKassenbuchAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/kassenbuch");

  const datum = formString(formData, "datum") || undefined;
  const text = formString(formData, "text") || undefined;

  let stornoId: string;
  try {
    const { eintrag } = await storniereKassenbuchEintrag(firmaId, id, {
      datum,
      text,
    });
    stornoId = eintrag.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Storno fehlgeschlagen.";
    redirect(`/app/kassenbuch/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/kassenbuch");
  revalidatePath("/app/journal");
  revalidatePath(`/app/kassenbuch/${id}`);
  redirect(`/app/kassenbuch/${stornoId}?storniert=1`);
}
