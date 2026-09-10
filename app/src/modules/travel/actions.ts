"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchreibenSession } from "@/lib/session";
import { parseAbrechnungsstatus } from "./invariants";
import {
  createFahrt,
  deleteFahrt,
  setFahrtStatus,
  updateFahrt,
} from "./repository";
import type { Abrechnungsstatus, FahrtInput } from "./types";

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

function parseFahrtForm(formData: FormData): FahrtInput {
  const statusRaw = formString(formData, "status");
  const status =
    parseAbrechnungsstatus(statusRaw) || ("abrechenbar" as Abrechnungsstatus);
  const projekt = formString(formData, "projekt");

  return {
    kunde: formString(formData, "kunde"),
    projekt: projekt || null,
    datum: formString(formData, "datum"),
    km: formString(formData, "km"),
    strecke: formString(formData, "strecke") || undefined,
    status,
    steuerlich_relevant: formBool(formData, "steuerlich_relevant"),
    steuer_notiz: formString(formData, "steuer_notiz") || undefined,
    km_satz: formString(formData, "km_satz") || undefined,
  };
}

/** Neue Fahrt anlegen. */
export async function createFahrtAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const input = parseFahrtForm(formData);

  let id: string;
  try {
    const f = await createFahrt(firmaId, input);
    id = f.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlegen fehlgeschlagen.";
    redirect(`/app/fahrten/neu?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/fahrten");
  redirect(`/app/fahrten/${id}?created=1`);
}

/** Fahrt speichern. */
export async function updateFahrtAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/fahrten");

  const input = parseFahrtForm(formData);

  try {
    await updateFahrt(firmaId, id, input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
    redirect(`/app/fahrten/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/fahrten");
  revalidatePath(`/app/fahrten/${id}`);
  redirect(`/app/fahrten/${id}?saved=1`);
}

/** Fahrt löschen. */
export async function deleteFahrtAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/fahrten");

  try {
    await deleteFahrt(firmaId, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen.";
    redirect(`/app/fahrten/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/fahrten");
  redirect("/app/fahrten");
}

/** Statuswechsel light. */
export async function setFahrtStatusAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/fahrten");

  const status = parseAbrechnungsstatus(formString(formData, "status"));
  if (!status) {
    redirect(
      `/app/fahrten/${id}?error=${encodeURIComponent("Ungültiger Status.")}`,
    );
  }

  try {
    await setFahrtStatus(firmaId, id, status);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Statuswechsel fehlgeschlagen.";
    redirect(`/app/fahrten/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/fahrten");
  revalidatePath(`/app/fahrten/${id}`);
  redirect(`/app/fahrten/${id}?saved=1`);
}
