"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchreibenSession } from "@/lib/session";
import { parseAbrechnungsstatus } from "./invariants";
import {
  createZeiteintrag,
  deleteZeiteintrag,
  setZeiteintragStatus,
  updateZeiteintrag,
} from "./repository";
import type { Abrechnungsstatus, ZeiteintragInput } from "./types";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function requireFirmaId(): Promise<string> {
  const session = await requireSchreibenSession();
  return session.firmaId;
}

function parseZeiteintragForm(formData: FormData): ZeiteintragInput {
  const statusRaw = formString(formData, "status");
  const status =
    parseAbrechnungsstatus(statusRaw) || ("abrechenbar" as Abrechnungsstatus);

  const projekt = formString(formData, "projekt");

  return {
    kunde: formString(formData, "kunde"),
    projekt: projekt || null,
    datum: formString(formData, "datum"),
    stunden: formString(formData, "stunden") || undefined,
    minuten: formString(formData, "minuten") || undefined,
    dezimal_stunden: formString(formData, "dezimal_stunden") || undefined,
    beschreibung: formString(formData, "beschreibung") || undefined,
    status,
    stundensatz: formString(formData, "stundensatz") || undefined,
  };
}

/** Neuen Zeiteintrag anlegen. */
export async function createZeiteintragAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const input = parseZeiteintragForm(formData);

  let id: string;
  try {
    const e = await createZeiteintrag(firmaId, input);
    id = e.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlegen fehlgeschlagen.";
    redirect(`/app/zeiten/neu?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/zeiten");
  redirect(`/app/zeiten/${id}?created=1`);
}

/** Zeiteintrag speichern. */
export async function updateZeiteintragAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/zeiten");

  const input = parseZeiteintragForm(formData);

  try {
    await updateZeiteintrag(firmaId, id, input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
    redirect(`/app/zeiten/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/zeiten");
  revalidatePath(`/app/zeiten/${id}`);
  redirect(`/app/zeiten/${id}?saved=1`);
}

/** Zeiteintrag löschen. */
export async function deleteZeiteintragAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/zeiten");

  try {
    await deleteZeiteintrag(firmaId, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen.";
    redirect(`/app/zeiten/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/zeiten");
  redirect("/app/zeiten");
}

/** Statuswechsel light (z. B. „zur Abrechnung markieren“). */
export async function setZeiteintragStatusAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/zeiten");

  const status = parseAbrechnungsstatus(formString(formData, "status"));
  if (!status) {
    redirect(
      `/app/zeiten/${id}?error=${encodeURIComponent("Ungültiger Status.")}`,
    );
  }

  try {
    await setZeiteintragStatus(firmaId, id, status);
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Statuswechsel fehlgeschlagen.";
    redirect(`/app/zeiten/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/zeiten");
  revalidatePath(`/app/zeiten/${id}`);
  redirect(`/app/zeiten/${id}?saved=1`);
}
