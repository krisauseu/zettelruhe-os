"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchreibenSession } from "@/lib/session";
import {
  createWiederkehrendeRechnung,
  deleteWiederkehrendeRechnung,
  erzeugeFaelligeAusVorlage,
  erzeugeRechnungAusVorlage,
  setWiederkehrAktiv,
  updateWiederkehrendeRechnung,
} from "./wiederkehrend-repository";
import { parseRhythmus } from "./wiederkehrend-invariants";
import type {
  WiederkehrInput,
  WiederkehrPositionInput,
  WiederkehrRhythmus,
} from "./wiederkehrend-types";
import type { Steuersatz } from "./types";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function requireFirmaId(): Promise<string> {
  const session = await requireSchreibenSession();
  return session.firmaId;
}

function parsePositionen(formData: FormData): WiederkehrPositionInput[] {
  const bezeichnungen = formData.getAll("position_bezeichnung");
  const mengen = formData.getAll("position_menge");
  const einheiten = formData.getAll("position_einheit");
  const preise = formData.getAll("position_einzelpreis");
  const saetze = formData.getAll("position_steuersatz");
  const kataloge = formData.getAll("position_katalog");

  const n = Math.max(bezeichnungen.length, mengen.length, preise.length, 0);
  const positionen: WiederkehrPositionInput[] = [];
  for (let i = 0; i < n; i++) {
    const bezeichnung =
      typeof bezeichnungen[i] === "string"
        ? String(bezeichnungen[i]).trim()
        : "";
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

function parseWiederkehrForm(formData: FormData): WiederkehrInput {
  const kunde = formString(formData, "kunde");
  const rhythmusRaw = formString(formData, "rhythmus");
  const rhythmus = (parseRhythmus(rhythmusRaw) ||
    "monatlich") as WiederkehrRhythmus;
  const intervallRaw = formString(formData, "intervall_tage");
  const zielRaw = formString(formData, "zahlungsziel_tage");
  const aktivRaw = formString(formData, "aktiv");

  return {
    bezeichnung: formString(formData, "bezeichnung"),
    kunde: kunde || null,
    naechstes_datum: formString(formData, "naechstes_datum"),
    rhythmus,
    intervall_tage: intervallRaw
      ? Number.parseInt(intervallRaw, 10)
      : undefined,
    zahlungsziel_tage: zielRaw ? Number.parseInt(zielRaw, 10) : undefined,
    aktiv: aktivRaw === "0" || aktivRaw === "false" ? false : true,
    notiz: formString(formData, "notiz") || undefined,
    positionen: parsePositionen(formData),
  };
}

export async function createWiederkehrAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const input = parseWiederkehrForm(formData);

  let id: string;
  try {
    const wr = await createWiederkehrendeRechnung(firmaId, input);
    id = wr.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlegen fehlgeschlagen.";
    redirect(
      `/app/wiederkehrende-rechnungen/neu?error=${encodeURIComponent(msg)}`,
    );
  }

  revalidatePath("/app/wiederkehrende-rechnungen");
  redirect(`/app/wiederkehrende-rechnungen/${id}`);
}

export async function updateWiederkehrAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/wiederkehrende-rechnungen");

  const input = parseWiederkehrForm(formData);
  try {
    await updateWiederkehrendeRechnung(firmaId, id, input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
    redirect(
      `/app/wiederkehrende-rechnungen/${id}?error=${encodeURIComponent(msg)}`,
    );
  }

  revalidatePath("/app/wiederkehrende-rechnungen");
  revalidatePath(`/app/wiederkehrende-rechnungen/${id}`);
  redirect(`/app/wiederkehrende-rechnungen/${id}?saved=1`);
}

export async function deleteWiederkehrAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/wiederkehrende-rechnungen");

  try {
    await deleteWiederkehrendeRechnung(firmaId, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen.";
    redirect(
      `/app/wiederkehrende-rechnungen/${id}?error=${encodeURIComponent(msg)}`,
    );
  }

  revalidatePath("/app/wiederkehrende-rechnungen");
  redirect("/app/wiederkehrende-rechnungen");
}

export async function setWiederkehrAktivAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/wiederkehrende-rechnungen");
  const aktiv = formString(formData, "aktiv") !== "0";

  try {
    await setWiederkehrAktiv(firmaId, id, aktiv);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Status ändern fehlgeschlagen.";
    redirect(
      `/app/wiederkehrende-rechnungen/${id}?error=${encodeURIComponent(msg)}`,
    );
  }

  revalidatePath("/app/wiederkehrende-rechnungen");
  revalidatePath(`/app/wiederkehrende-rechnungen/${id}`);
  redirect(`/app/wiederkehrende-rechnungen/${id}?saved=1`);
}

/** Manuell jetzt erzeugen (ein Draft + Datum vorschieben). */
export async function erzeugeJetztAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/wiederkehrende-rechnungen");

  let rechnungId = "";
  try {
    const result = await erzeugeRechnungAusVorlage(firmaId, id, {
      advance: true,
    });
    rechnungId = result.rechnungen[0]?.id ?? "";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erzeugen fehlgeschlagen.";
    redirect(
      `/app/wiederkehrende-rechnungen/${id}?error=${encodeURIComponent(msg)}`,
    );
  }

  revalidatePath("/app/wiederkehrende-rechnungen");
  revalidatePath(`/app/wiederkehrende-rechnungen/${id}`);
  revalidatePath("/app/rechnungen");
  if (rechnungId) {
    redirect(
      `/app/wiederkehrende-rechnungen/${id}?erzeugt=${encodeURIComponent(rechnungId)}`,
    );
  }
  redirect(`/app/wiederkehrende-rechnungen/${id}?saved=1`);
}

/** Alle fälligen Perioden dieser Vorlage nachholen (Catch-up). */
export async function erzeugeFaelligeAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/wiederkehrende-rechnungen");

  let count = 0;
  try {
    const result = await erzeugeFaelligeAusVorlage(firmaId, id);
    count = result.rechnungen.length;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erzeugen fehlgeschlagen.";
    redirect(
      `/app/wiederkehrende-rechnungen/${id}?error=${encodeURIComponent(msg)}`,
    );
  }

  revalidatePath("/app/wiederkehrende-rechnungen");
  revalidatePath(`/app/wiederkehrende-rechnungen/${id}`);
  revalidatePath("/app/rechnungen");
  redirect(
    `/app/wiederkehrende-rechnungen/${id}?erzeugtCount=${encodeURIComponent(String(count))}`,
  );
}
