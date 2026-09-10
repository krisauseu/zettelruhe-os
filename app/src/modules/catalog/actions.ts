"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireFirmaSession, requireSchreibenSession } from "@/lib/session";
import { getFirmaById, type Steuermodus } from "@/lib/pb";
import { parseKatalogCsv } from "./csv";
import {
  createKatalogPosition,
  deleteKatalogPosition,
  normalizePreisInput,
  updateKatalogPosition,
} from "./repository";
import type { KatalogPositionInput, Steuersatz } from "./types";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Checkbox: nur gesetzt, wenn angehakt */
function formCheckbox(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true" || v === "1";
}

async function requireFirmaId(): Promise<string> {
  const session = await requireSchreibenSession();
  return session.firmaId;
}

async function getSteuermodus(): Promise<Steuermodus> {
  const session = await requireFirmaSession();
  const firma = await getFirmaById(session.firmaId);
  return firma?.steuermodus ?? "kleinunternehmer";
}

function parseForm(
  formData: FormData,
  steuermodus: Steuermodus,
): KatalogPositionInput {
  const satzRaw = formString(formData, "steuersatz");
  let steuersatz: Steuersatz | "" = "";
  if (steuermodus === "regelbesteuerung_ist") {
    if (satzRaw === "0" || satzRaw === "7" || satzRaw === "19") {
      steuersatz = satzRaw;
    } else {
      steuersatz = "19";
    }
  }

  return {
    bezeichnung: formString(formData, "bezeichnung"),
    einheit: formString(formData, "einheit") || "Stück",
    preis: formString(formData, "preis"),
    steuersatz,
    notiz: formString(formData, "notiz"),
    aktiv: formCheckbox(formData, "aktiv"),
  };
}

function validate(input: KatalogPositionInput): string | null {
  if (!input.bezeichnung) return "Bezeichnung ist erforderlich.";
  if (!input.einheit) return "Einheit ist erforderlich.";
  try {
    normalizePreisInput(input.preis);
  } catch (e) {
    return e instanceof Error ? e.message : "Ungültiger Preis.";
  }
  return null;
}

export async function createKatalogAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const steuermodus = await getSteuermodus();
  const input = parseForm(formData, steuermodus);
  const err = validate(input);
  if (err) {
    redirect(`/app/katalog/neu?error=${encodeURIComponent(err)}`);
  }

  let id: string;
  try {
    const p = await createKatalogPosition(firmaId, input);
    id = p.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlegen fehlgeschlagen.";
    redirect(`/app/katalog/neu?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/katalog");
  redirect(`/app/katalog/${id}?created=1`);
}

export async function updateKatalogAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/katalog");

  const steuermodus = await getSteuermodus();
  const input = parseForm(formData, steuermodus);
  const err = validate(input);
  if (err) {
    redirect(`/app/katalog/${id}?error=${encodeURIComponent(err)}`);
  }

  try {
    await updateKatalogPosition(firmaId, id, input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
    redirect(`/app/katalog/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/katalog");
  revalidatePath(`/app/katalog/${id}`);
  redirect(`/app/katalog/${id}?saved=1`);
}

export async function deleteKatalogAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/katalog");

  try {
    await deleteKatalogPosition(firmaId, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen.";
    redirect(`/app/katalog/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/katalog");
  redirect("/app/katalog");
}

export async function importKatalogAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const steuermodus = await getSteuermodus();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirect(
      `/app/katalog/import?error=${encodeURIComponent("Bitte eine CSV-Datei wählen.")}`,
    );
  }

  const text = await file.text();
  const parsed = parseKatalogCsv(text);

  if (parsed.errors.length > 0 && parsed.items.length === 0) {
    redirect(
      `/app/katalog/import?error=${encodeURIComponent(parsed.errors.join(" "))}`,
    );
  }

  let created = 0;
  const failures: string[] = [];

  for (const item of parsed.items) {
    // Unter Kleinunternehmerregelung USt nicht speichern
    const payload: KatalogPositionInput = {
      ...item,
      steuersatz:
        steuermodus === "regelbesteuerung_ist" ? item.steuersatz : "",
    };
    try {
      await createKatalogPosition(firmaId, payload);
      created += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unbekannt";
      failures.push(`${item.bezeichnung}: ${msg}`);
    }
  }

  revalidatePath("/app/katalog");

  const parts = [`${created} Position(en) importiert.`];
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
  redirect(`/app/katalog/import?${q}`);
}
