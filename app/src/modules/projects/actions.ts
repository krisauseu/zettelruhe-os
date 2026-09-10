"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchreibenSession } from "@/lib/session";
import {
  createProjekt,
  deleteProjekt,
  updateProjekt,
} from "./repository";
import type { ProjektInput } from "./types";

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

function parseProjektForm(formData: FormData): ProjektInput {
  return {
    kunde: formString(formData, "kunde"),
    name: formString(formData, "name"),
    notiz: formString(formData, "notiz") || undefined,
    aktiv: formBool(formData, "aktiv"),
  };
}

/** Neues Projekt anlegen. */
export async function createProjektAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const input = parseProjektForm(formData);

  let id: string;
  try {
    const p = await createProjekt(firmaId, input);
    id = p.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlegen fehlgeschlagen.";
    redirect(`/app/projekte/neu?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/projekte");
  redirect(`/app/projekte/${id}?created=1`);
}

/** Projekt speichern. */
export async function updateProjektAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/projekte");

  const input = parseProjektForm(formData);

  try {
    await updateProjekt(firmaId, id, input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
    redirect(`/app/projekte/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/projekte");
  revalidatePath(`/app/projekte/${id}`);
  redirect(`/app/projekte/${id}?saved=1`);
}

/** Projekt löschen. */
export async function deleteProjektAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/projekte");

  try {
    await deleteProjekt(firmaId, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen.";
    redirect(`/app/projekte/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/projekte");
  redirect("/app/projekte");
}
