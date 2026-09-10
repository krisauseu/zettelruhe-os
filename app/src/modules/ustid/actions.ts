"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFirmaById } from "@/lib/pb";
import { requireSchreibenSession } from "@/lib/session";
import { getKontakt } from "@/modules/contacts";
import { evatrAbfrage } from "./evatr";
import { eigeneUstIdLage } from "./format";
import { eigeneLageHinweis, kannBzstAbfrage } from "./invariants";
import { createUstIdPruefung } from "./repository";
import type { UstIdPruefungArt } from "./types";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function formBool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true" || v === "1";
}

/**
 * Kontakt: einfache oder qualifizierte Bestätigung der gespeicherten fremden Nummer.
 * Schreibt nur einen Schnappschuss — kein Stamm-Stempel, keine Belege.
 */
export async function pruefeKontaktUstIdAction(
  formData: FormData,
): Promise<void> {
  const session = await requireSchreibenSession();
  const kontaktId = formString(formData, "kontaktId");
  if (!kontaktId) redirect("/app/kontakte");

  const kontakt = await getKontakt(session.firmaId, kontaktId);
  if (!kontakt) redirect("/app/kontakte");

  const firma = await getFirmaById(session.firmaId);
  if (!firma) {
    redirect(
      `/app/kontakte/${kontaktId}?error=${encodeURIComponent("Firma nicht gefunden.")}`,
    );
  }

  const gate = kannBzstAbfrage(firma.ust_id, kontakt.ust_id);
  if (!gate.ok) {
    redirect(
      `/app/kontakte/${kontaktId}?error=${encodeURIComponent(gate.grund)}`,
    );
  }

  const qualifiziert = formBool(formData, "qualifiziert");
  const name = kontakt.name.trim();
  const ort = kontakt.ort.trim();
  if (qualifiziert && (!name || !ort)) {
    redirect(
      `/app/kontakte/${kontaktId}?error=${encodeURIComponent(
        "Qualifizierte Bestätigung braucht Name und Ort am Kontakt. Bitte speichern, dann erneut prüfen — oder einfache Bestätigung wählen.",
      )}`,
    );
  }

  const art: UstIdPruefungArt =
    qualifiziert && name && ort ? "qualifiziert" : "einfach";

  let antwort;
  try {
    antwort = await evatrAbfrage({
      anfragendeUstid: gate.anfragende,
      angefragteUstid: gate.angefragte,
      firmenname: art === "qualifiziert" ? name : undefined,
      ort: art === "qualifiziert" ? ort : undefined,
      strasse: art === "qualifiziert" ? kontakt.strasse : undefined,
      plz: art === "qualifiziert" ? kontakt.plz : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "BZSt-Abfrage fehlgeschlagen.";
    redirect(`/app/kontakte/${kontaktId}?error=${encodeURIComponent(msg)}`);
  }

  try {
    await createUstIdPruefung(session.firmaId, {
      ziel_typ: "kontakt",
      ziel_id: kontaktId,
      art,
      anfragende_ust_id: gate.anfragende,
      abgefragte_ust_id: gate.angefragte,
      antwort,
      anfrage_name: art === "qualifiziert" ? name : "",
      anfrage_strasse: art === "qualifiziert" ? kontakt.strasse : "",
      anfrage_plz: art === "qualifiziert" ? kontakt.plz : "",
      anfrage_ort: art === "qualifiziert" ? ort : "",
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Schnappschuss konnte nicht gespeichert werden.";
    redirect(`/app/kontakte/${kontaktId}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath(`/app/kontakte/${kontaktId}`);
  revalidatePath("/app/zm");
  revalidatePath("/app/firma");
  redirect(
    `/app/kontakte/${kontaktId}?success=${encodeURIComponent(
      `BZSt ${antwort.status} — ${antwort.statusMeldung}`,
    )}`,
  );
}

/**
 * Firma: keine isolierte BZSt-Abfrage der eigenen DE-Nummer.
 * Zeigt die ehrliche Lage der gespeicherten Syntax.
 */
export async function pruefeEigeneUstIdAction(): Promise<void> {
  const session = await requireSchreibenSession();
  const firma = await getFirmaById(session.firmaId);
  if (!firma) {
    redirect(`/app/firma?error=${encodeURIComponent("Firma nicht gefunden.")}`);
  }
  const lage = eigeneUstIdLage(firma.ust_id);
  const hinweis = eigeneLageHinweis(lage);
  if (lage.art === "de_syntax_ok") {
    redirect(`/app/firma?success=${encodeURIComponent(hinweis)}`);
  }
  redirect(`/app/firma?error=${encodeURIComponent(hinweis)}`);
}
