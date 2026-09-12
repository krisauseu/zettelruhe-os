"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchreibenSession } from "@/lib/session";
import {
  archiveERechnung,
  createBelegFromERechnungSafe,
  uploadERechnung,
} from "./repository";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function formFile(formData: FormData, key: string): File | null {
  const v = formData.get(key);
  if (v instanceof File && v.size > 0) return v;
  return null;
}

async function requireFirmaId(): Promise<string> {
  const session = await requireSchreibenSession();
  return session.firmaId;
}

/** E-Rechnung hochladen und parsen (Original archivieren). */
export async function uploadERechnungAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const file = formFile(formData, "datei");
  if (!file) {
    redirect(
      `/app/e-rechnungen/neu?error=${encodeURIComponent("Bitte eine Datei wählen.")}`,
    );
  }

  let id: string;
  try {
    const empfang = await uploadERechnung(firmaId, file, {
      notiz: formString(formData, "notiz"),
    });
    id = empfang.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload fehlgeschlagen.";
    redirect(`/app/e-rechnungen/neu?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/e-rechnungen");
  redirect(`/app/e-rechnungen/${id}`);
}

/** Beleg-Entwurf aus geparster E-Rechnung anlegen (expenses). */
export async function createBelegFromERechnungAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/e-rechnungen");

  const lieferant = formString(formData, "lieferant");

  let belegId: string;
  try {
    const { beleg } = await createBelegFromERechnungSafe(firmaId, id, {
      lieferantId: lieferant || null,
    });
    belegId = beleg.id;
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : "Beleg konnte nicht angelegt werden. Bitte prüfen Sie die Datei oder laden Sie sie erneut hoch.";
    redirect(`/app/e-rechnungen/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/e-rechnungen");
  revalidatePath(`/app/e-rechnungen/${id}`);
  revalidatePath("/app/belege");
  redirect(`/app/belege/${belegId}`);
}

/** Empfang als archiviert markieren (Original bleibt). */
export async function archiveERechnungAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/e-rechnungen");

  try {
    await archiveERechnung(firmaId, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Archivieren fehlgeschlagen.";
    redirect(`/app/e-rechnungen/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/e-rechnungen");
  revalidatePath(`/app/e-rechnungen/${id}`);
  redirect(`/app/e-rechnungen/${id}?saved=1`);
}
