"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchreibenSession } from "@/lib/session";
import {
  createKategorie,
  deleteKategorie,
  updateKategorie,
} from "./repository";
import type { Buchungsrichtung, KategorieInput } from "./types";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function formCheckbox(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true" || v === "1";
}

async function requireFirmaId(): Promise<string> {
  const session = await requireSchreibenSession();
  return session.firmaId;
}

function parseForm(formData: FormData): KategorieInput {
  const aktivPresent = formData.has("aktiv_present");
  const richtungRaw = formString(formData, "richtung");
  const richtung: Buchungsrichtung =
    richtungRaw === "einnahme" ? "einnahme" : "ausgabe";
  return {
    name: formString(formData, "name"),
    richtung,
    notiz: formString(formData, "notiz"),
    aktiv: aktivPresent ? formCheckbox(formData, "aktiv") : true,
  };
}

export async function createKategorieAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const input = parseForm(formData);

  let id: string;
  try {
    const k = await createKategorie(firmaId, input);
    id = k.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlegen fehlgeschlagen.";
    redirect(`/app/kategorien/neu?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/kategorien");
  revalidatePath("/app/belege");
  revalidatePath("/app/kassenbuch");
  redirect(`/app/kategorien/${id}?created=1`);
}

export async function updateKategorieAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/kategorien");

  const input = parseForm(formData);
  try {
    await updateKategorie(firmaId, id, input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
    redirect(`/app/kategorien/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/kategorien");
  revalidatePath(`/app/kategorien/${id}`);
  revalidatePath("/app/belege");
  revalidatePath("/app/kassenbuch");
  redirect(`/app/kategorien/${id}?saved=1`);
}

export async function deleteKategorieAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/kategorien");

  try {
    await deleteKategorie(firmaId, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen.";
    redirect(`/app/kategorien/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/kategorien");
  revalidatePath("/app/belege");
  revalidatePath("/app/kassenbuch");
  redirect("/app/kategorien?deleted=1");
}
