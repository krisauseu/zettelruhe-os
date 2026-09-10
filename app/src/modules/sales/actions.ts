"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchreibenSession } from "@/lib/session";
import { parseAngebotStatusZiel } from "./invariants";
import {
  createAngebot,
  createRechnung,
  deleteAngebot,
  deleteRechnung,
  festschreibenRechnung,
  sendenAngebot,
  storniereRechnung,
  setAngebotStatus,
  uebernehmenAlsRechnung,
  updateAngebot,
  updateRechnung,
} from "./repository";
import type {
  AngebotInput,
  AngebotspositionInput,
  RechnungInput,
  RechnungspositionInput,
  Steuersatz,
} from "./types";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function requireFirmaId(): Promise<string> {
  const session = await requireSchreibenSession();
  return session.firmaId;
}

/**
 * Positionen aus Formular: position_bezeichnung[], position_menge[], …
 * Index-parallel; leere Zeilen werden in validateRechnungInput gefiltert.
 */
function parsePositionen(formData: FormData): RechnungspositionInput[] {
  const bezeichnungen = formData.getAll("position_bezeichnung");
  const mengen = formData.getAll("position_menge");
  const einheiten = formData.getAll("position_einheit");
  const preise = formData.getAll("position_einzelpreis");
  const saetze = formData.getAll("position_steuersatz");
  const kataloge = formData.getAll("position_katalog");

  const n = Math.max(
    bezeichnungen.length,
    mengen.length,
    preise.length,
    0,
  );

  const positionen: RechnungspositionInput[] = [];
  for (let i = 0; i < n; i++) {
    const bezeichnung =
      typeof bezeichnungen[i] === "string" ? String(bezeichnungen[i]).trim() : "";
    const menge =
      typeof mengen[i] === "string" ? String(mengen[i]).trim() : "";
    const einheit =
      typeof einheiten[i] === "string" ? String(einheiten[i]).trim() : "";
    const einzelpreis =
      typeof preise[i] === "string" ? String(preise[i]).trim() : "";
    const satzRaw =
      typeof saetze[i] === "string" ? String(saetze[i]).trim() : "";
    let steuersatz: Steuersatz | "" = "";
    if (satzRaw === "0" || satzRaw === "7" || satzRaw === "19") {
      steuersatz = satzRaw;
    }
    const katalog =
      typeof kataloge[i] === "string" ? String(kataloge[i]).trim() : "";

    positionen.push({
      bezeichnung,
      menge: menge || "1",
      einheit,
      einzelpreis,
      steuersatz,
      katalog_position: katalog || null,
    });
  }
  return positionen;
}

function parseRechnungForm(formData: FormData): RechnungInput {
  const kunde = formString(formData, "kunde");
  return {
    kunde: kunde || null,
    rechnungsdatum: formString(formData, "rechnungsdatum"),
    leistungszeitraum_von:
      formString(formData, "leistungszeitraum_von") || undefined,
    leistungszeitraum_bis:
      formString(formData, "leistungszeitraum_bis") || undefined,
    faellig_am: formString(formData, "faellig_am") || undefined,
    notiz: formString(formData, "notiz") || undefined,
    positionen: parsePositionen(formData),
  };
}

/** Neuen Rechnungs-Entwurf anlegen. */
export async function createRechnungAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const input = parseRechnungForm(formData);

  let id: string;
  try {
    const rechnung = await createRechnung(firmaId, input);
    id = rechnung.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlegen fehlgeschlagen.";
    redirect(`/app/rechnungen/neu?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/rechnungen");
  redirect(`/app/rechnungen/${id}?created=1`);
}

/** Entwurf speichern. */
export async function updateRechnungAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/rechnungen");

  const input = parseRechnungForm(formData);

  try {
    await updateRechnung(firmaId, id, input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
    redirect(`/app/rechnungen/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/rechnungen");
  revalidatePath(`/app/rechnungen/${id}`);
  redirect(`/app/rechnungen/${id}?saved=1`);
}

/** Entwurf löschen. */
export async function deleteRechnungAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/rechnungen");

  try {
    await deleteRechnung(firmaId, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen.";
    redirect(`/app/rechnungen/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/rechnungen");
  redirect("/app/rechnungen");
}

/**
 * Festschreiben: Nummer + PDF + Journal (quelle_typ=rechnung).
 * Danach Metadaten/PDF immutable.
 */
export async function festschreibenRechnungAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/rechnungen");

  try {
    await festschreibenRechnung(firmaId, id);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Festschreibung fehlgeschlagen.";
    redirect(`/app/rechnungen/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/rechnungen");
  revalidatePath("/app/journal");
  revalidatePath(`/app/rechnungen/${id}`);
  redirect(`/app/rechnungen/${id}?festgeschrieben=1`);
}

/** Festgeschriebene Rechnung stornieren: Gegenbuchung + Status. */
export async function storniereRechnungAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/rechnungen");

  const buchungsdatum = formString(formData, "buchungsdatum") || undefined;

  try {
    await storniereRechnung(firmaId, id, { buchungsdatum });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Storno fehlgeschlagen.";
    redirect(`/app/rechnungen/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/rechnungen");
  revalidatePath("/app/journal");
  revalidatePath("/app/auswertungen");
  revalidatePath("/app/eur");
  revalidatePath("/app/ust");
  revalidatePath("/app/zm");
  revalidatePath(`/app/rechnungen/${id}`);
  redirect(`/app/rechnungen/${id}?storniert=1`);
}

// ---------------------------------------------------------------------------
// Angebote
// ---------------------------------------------------------------------------

function parseAngebotForm(formData: FormData): AngebotInput {
  const kunde = formString(formData, "kunde");
  return {
    kunde: kunde || null,
    angebotsdatum: formString(formData, "angebotsdatum"),
    gueltig_bis: formString(formData, "gueltig_bis") || undefined,
    notiz: formString(formData, "notiz") || undefined,
    positionen: parsePositionen(formData) as AngebotspositionInput[],
  };
}

/** Neuen Angebots-Entwurf anlegen. */
export async function createAngebotAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const input = parseAngebotForm(formData);

  let id: string;
  try {
    const angebot = await createAngebot(firmaId, input);
    id = angebot.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlegen fehlgeschlagen.";
    redirect(`/app/angebote/neu?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/angebote");
  redirect(`/app/angebote/${id}?created=1`);
}

/** Entwurf speichern. */
export async function updateAngebotAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/angebote");

  const input = parseAngebotForm(formData);

  try {
    await updateAngebot(firmaId, id, input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
    redirect(`/app/angebote/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/angebote");
  revalidatePath(`/app/angebote/${id}`);
  redirect(`/app/angebote/${id}?saved=1`);
}

/** Entwurf löschen. */
export async function deleteAngebotAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/angebote");

  try {
    await deleteAngebot(firmaId, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen.";
    redirect(`/app/angebote/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/angebote");
  redirect("/app/angebote");
}

/**
 * Senden: Nummer + PDF + Status gesendet.
 * Danach Inhalt/PDF immutable light; kein Journal.
 */
export async function sendenAngebotAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/angebote");

  try {
    await sendenAngebot(firmaId, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Senden fehlgeschlagen.";
    redirect(`/app/angebote/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/angebote");
  revalidatePath(`/app/angebote/${id}`);
  redirect(`/app/angebote/${id}?gesendet=1`);
}

/** Manueller Statuswechsel light. */
export async function setAngebotStatusAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/angebote");

  const ziel = parseAngebotStatusZiel(formString(formData, "status"));
  if (!ziel) {
    redirect(
      `/app/angebote/${id}?error=${encodeURIComponent("Ungültiger Status.")}`,
    );
  }

  try {
    await setAngebotStatus(firmaId, id, ziel);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Statuswechsel fehlgeschlagen.";
    redirect(`/app/angebote/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/angebote");
  revalidatePath(`/app/angebote/${id}`);
  redirect(`/app/angebote/${id}?status=1`);
}

/**
 * Angenommenes Angebot → Rechnungs-Entwurf.
 * Leitet zur neuen Rechnung weiter.
 */
export async function uebernehmenAlsRechnungAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/angebote");

  let rechnungId: string;
  try {
    const result = await uebernehmenAlsRechnung(firmaId, id);
    rechnungId = result.rechnung.id;
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Übernahme als Rechnung fehlgeschlagen.";
    redirect(`/app/angebote/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/angebote");
  revalidatePath(`/app/angebote/${id}`);
  revalidatePath("/app/rechnungen");
  redirect(`/app/rechnungen/${rechnungId}?fromAngebot=1`);
}
