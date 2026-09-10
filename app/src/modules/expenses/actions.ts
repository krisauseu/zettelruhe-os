"use server";

import { parseBelegForm } from "./beleg-form-input";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchreibenSession } from "@/lib/session";
import {
  createBeleg,
  deleteBeleg,
  festschreibenBeleg,
  removeBelegDatei,
  updateBeleg,
} from "./repository";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function requireFirmaId(): Promise<string> {
  const session = await requireSchreibenSession();
  return session.firmaId;
}

function formFiles(formData: FormData, key: string): File[] {
  return formData
    .getAll(key)
    .filter((v): v is File => v instanceof File && v.size > 0);
}

/** Neuen Beleg-Entwurf anlegen (optional mit Datei). */
export async function createBelegAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const dateien = formFiles(formData, "datei");

  let id: string;
  try {
    const beleg = await createBeleg(firmaId, parseBelegForm(formData), {
      datei: dateien.length > 0 ? dateien : null,
    });
    id = beleg.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlegen fehlgeschlagen.";
    redirect(`/app/belege/neu?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/belege");
  redirect(`/app/belege/${id}?created=1`);
}

/** Entwurf speichern. */
export async function updateBelegAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/belege");

  try {
    await updateBeleg(firmaId, id, parseBelegForm(formData), { dateien: formFiles(formData, "datei") });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
    redirect(`/app/belege/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/belege");
  revalidatePath(`/app/belege/${id}`);
  redirect(`/app/belege/${id}?saved=1`);
}

/** Entwurf löschen. */
export async function deleteBelegAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/belege");

  try {
    await deleteBeleg(firmaId, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen.";
    redirect(`/app/belege/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/belege");
  redirect("/app/belege");
}

/** Datei vom Entwurf entfernen (eine, per name). */
export async function clearBelegDateiAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/belege");
  const name = formString(formData, "name");
  if (!name) {
    redirect(`/app/belege/${id}?error=${encodeURIComponent("Datei fehlt.")}`);
  }

  try {
    await removeBelegDatei(firmaId, id, name);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Datei konnte nicht entfernt werden.";
    redirect(`/app/belege/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath(`/app/belege/${id}`);
  redirect(`/app/belege/${id}?saved=1`);
}

/**
 * Festschreiben: Status + Journal-Eintrag (quelle_typ=beleg).
 * Danach Metadaten/Datei immutable.
 */
export async function festschreibenBelegAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/belege");

  try {
    await festschreibenBeleg(firmaId, id);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Festschreibung fehlgeschlagen.";
    redirect(`/app/belege/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/belege");
  revalidatePath("/app/journal");
  revalidatePath(`/app/belege/${id}`);
  redirect(`/app/belege/${id}?festgeschrieben=1`);
}
