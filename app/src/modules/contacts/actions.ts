"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchreibenSession } from "@/lib/session";
import { parseKontakteCsv } from "./csv";
import {
  createAnsprechpartner,
  createKontakt,
  deleteAnsprechpartner,
  deleteKontakt,
  getKontakt,
  updateKontakt,
} from "./repository";
import { parseSteuerstandard } from "./steuerstandard";
import type { KontaktInput } from "./types";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function formBool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true" || v === "1";
}

async function requireFirmaId(): Promise<string> {
  const session = await requireSchreibenSession();
  return session.firmaId;
}

function parseKontaktForm(formData: FormData): KontaktInput {
  return {
    name: formString(formData, "name"),
    ist_kunde: formBool(formData, "ist_kunde"),
    ist_lieferant: formBool(formData, "ist_lieferant"),
    strasse: formString(formData, "strasse"),
    plz: formString(formData, "plz"),
    ort: formString(formData, "ort"),
    land: formString(formData, "land") || "DE",
    email: formString(formData, "email"),
    telefon: formString(formData, "telefon"),
    iban: formString(formData, "iban"),
    bic: formString(formData, "bic"),
    ausgaben_steuerstandard: formString(formData, "ausgaben_steuerstandard") as KontaktInput["ausgaben_steuerstandard"],
    ust_id: formString(formData, "ust_id"),
    leitweg_id: formString(formData, "leitweg_id"),
    notiz: formString(formData, "notiz"),
  };
}

function validateKontakt(input: KontaktInput): string | null {
  try { parseSteuerstandard(input.ausgaben_steuerstandard ?? ""); } catch { return "Unbekannter Ausgaben-Steuerstandard."; }
  if (!input.name) return "Name ist erforderlich.";
  if (!input.ist_kunde && !input.ist_lieferant) {
    return "Mindestens eine Rolle (Kund:in und/oder Lieferant:in) wählen.";
  }
  return null;
}

export async function createKontaktAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const input = parseKontaktForm(formData);
  const err = validateKontakt(input);
  if (err) {
    redirect(`/app/kontakte/neu?error=${encodeURIComponent(err)}`);
  }

  let id: string;
  try {
    const k = await createKontakt(firmaId, input);
    id = k.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlegen fehlgeschlagen.";
    redirect(`/app/kontakte/neu?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/kontakte");
  redirect(`/app/kontakte/${id}?created=1`);
}

export async function updateKontaktAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) {
    redirect("/app/kontakte");
  }

  const input = parseKontaktForm(formData);
  const err = validateKontakt(input);
  if (err) {
    redirect(`/app/kontakte/${id}?error=${encodeURIComponent(err)}`);
  }

  try {
    await updateKontakt(firmaId, id, input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
    redirect(`/app/kontakte/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/kontakte");
  revalidatePath(`/app/kontakte/${id}`);
  redirect(`/app/kontakte/${id}?saved=1`);
}

export async function deleteKontaktAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/kontakte");

  try {
    await deleteKontakt(firmaId, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen.";
    redirect(`/app/kontakte/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/kontakte");
  redirect("/app/kontakte");
}

export async function createAnsprechpartnerAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const kontaktId = formString(formData, "kontaktId");
  const name = formString(formData, "name");
  if (!kontaktId) redirect("/app/kontakte");
  if (!name) {
    redirect(
      `/app/kontakte/${kontaktId}?error=${encodeURIComponent("Name des Ansprechpartners ist erforderlich.")}`,
    );
  }

  const existing = await getKontakt(firmaId, kontaktId);
  if (!existing) {
    redirect("/app/kontakte");
  }

  try {
    await createAnsprechpartner(firmaId, kontaktId, {
      name,
      email: formString(formData, "email"),
      telefon: formString(formData, "telefon"),
      position: formString(formData, "position"),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlegen fehlgeschlagen.";
    redirect(`/app/kontakte/${kontaktId}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath(`/app/kontakte/${kontaktId}`);
  redirect(`/app/kontakte/${kontaktId}?saved=1`);
}

export async function deleteAnsprechpartnerAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const kontaktId = formString(formData, "kontaktId");
  const id = formString(formData, "id");
  if (!kontaktId || !id) redirect("/app/kontakte");

  try {
    await deleteAnsprechpartner(firmaId, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen.";
    redirect(`/app/kontakte/${kontaktId}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath(`/app/kontakte/${kontaktId}`);
  redirect(`/app/kontakte/${kontaktId}`);
}

export async function importKontakteAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirect(
      `/app/kontakte/import?error=${encodeURIComponent("Bitte eine CSV-Datei wählen.")}`,
    );
  }

  const text = await file.text();
  const parsed = parseKontakteCsv(text);

  if (parsed.errors.length > 0 && parsed.items.length === 0) {
    redirect(
      `/app/kontakte/import?error=${encodeURIComponent(parsed.errors.join(" "))}`,
    );
  }

  let created = 0;
  const failures: string[] = [];

  for (const item of parsed.items) {
    try {
      const createdKontakt = await createKontakt(firmaId, item);
      created += 1;
      if (item.ansprechpartner?.name) {
        await createAnsprechpartner(firmaId, createdKontakt.id, item.ansprechpartner);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unbekannt";
      failures.push(`${item.name}: ${msg}`);
    }
  }

  revalidatePath("/app/kontakte");

  const parts = [`${created} Kontakt(e) importiert.`];
  if (parsed.skipped > 0) {
    parts.push(`${parsed.skipped} Zeile(n) übersprungen.`);
  }
  if (failures.length > 0) {
    parts.push(`${failures.length} Fehler: ${failures.slice(0, 3).join("; ")}`);
  }

  const ok = failures.length === 0;
  const q = ok
    ? `success=${encodeURIComponent(parts.join(" "))}`
    : `error=${encodeURIComponent(parts.join(" "))}`;
  redirect(`/app/kontakte/import?${q}`);
}
