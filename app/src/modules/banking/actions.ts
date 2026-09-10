"use server";

import { appReturnPath } from "@/lib/app-return-path";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchreibenSession } from "@/lib/session";
import { decodeBankImportBytes } from "./encoding";
import {
  createBankkonto,
  deleteBankkonto,
  ignoreBankBewegung,
  importBankAuszug,
  matchBewegungToRechnung,
  reopenBankBewegung,
  updateBankkonto,
} from "./repository";
import type { BankkontoInput } from "./types";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

async function requireFirmaId(): Promise<string> {
  const session = await requireSchreibenSession();
  return session.firmaId;
}

function parseBankkontoForm(formData: FormData): BankkontoInput {
  const aktivRaw = formData.get("aktiv");
  // Checkbox: absent = false when explicit field "aktiv_present"
  const aktivPresent = formData.has("aktiv_present");
  const aktiv = aktivPresent
    ? aktivRaw === "on" || aktivRaw === "true" || aktivRaw === "1"
    : true;

  return {
    name: formString(formData, "name"),
    iban: formString(formData, "iban") || undefined,
    bic: formString(formData, "bic") || undefined,
    kontoinhaber: formString(formData, "kontoinhaber") || undefined,
    aktiv,
    notiz: formString(formData, "notiz") || undefined,
  };
}

export async function createBankkontoAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const input = parseBankkontoForm(formData);

  let id: string;
  try {
    const k = await createBankkonto(firmaId, input);
    id = k.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlegen fehlgeschlagen.";
    redirect(`/app/bankkonten/neu?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/bankkonten");
  redirect(`/app/bankkonten/${id}?created=1`);
}

export async function updateBankkontoAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/bankkonten");

  const input = parseBankkontoForm(formData);
  try {
    await updateBankkonto(firmaId, id, input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
    redirect(`/app/bankkonten/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/bankkonten");
  revalidatePath(`/app/bankkonten/${id}`);
  redirect(`/app/bankkonten/${id}?saved=1`);
}

export async function deleteBankkontoAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const id = formString(formData, "id");
  if (!id) redirect("/app/bankkonten");

  try {
    await deleteBankkonto(firmaId, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Löschen fehlgeschlagen.";
    redirect(`/app/bankkonten/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/bankkonten");
  redirect("/app/bankkonten?deleted=1");
}

export async function importBankAuszugAction(
  formData: FormData,
): Promise<void> {
  const firmaId = await requireFirmaId();
  const bankkontoId = formString(formData, "bankkonto");
  if (!bankkontoId) redirect("/app/bankkonten");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(
      `/app/bankkonten/${bankkontoId}/import?error=${encodeURIComponent("Bitte eine CSV- oder MT940-Datei wählen.")}`,
    );
  }

  let text: string;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    text = decodeBankImportBytes(bytes).text;
  } catch {
    redirect(
      `/app/bankkonten/${bankkontoId}/import?error=${encodeURIComponent("Datei konnte nicht gelesen werden.")}`,
    );
  }

  let result;
  try {
    result = await importBankAuszug(firmaId, bankkontoId, text, {
      dateiname: file.name,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Import fehlgeschlagen.";
    redirect(
      `/app/bankkonten/${bankkontoId}/import?error=${encodeURIComponent(msg)}`,
    );
  }

  const formatLabel = result.lauf.format === "mt940" ? "MT940" : "CSV";
  const msg = `${formatLabel}: ${result.neu} neu, ${result.duplikat} Duplikat(e), ${result.gesamt} Zeile(n)${
    result.parseFehler.length
      ? ` · ${result.parseFehler.length} Zeile(n) übersprungen`
      : ""
  }${
    result.warnungen.length ? ` · ${result.warnungen.join(" · ")}` : ""
  }`;
  revalidatePath("/app/bankkonten");
  revalidatePath(`/app/bankkonten/${bankkontoId}`);
  revalidatePath("/app/kontoauszug");
  redirect(
    `/app/bankkonten/${bankkontoId}?import=${encodeURIComponent(msg)}`,
  );
}

/** Alias: bestehender Form-Name, derselbe Auszug-Import. */
export async function importBankCsvAction(formData: FormData): Promise<void> {
  return importBankAuszugAction(formData);
}

export async function matchBewegungAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const bewegungId = formString(formData, "bewegung");
  const rechnungId = formString(formData, "rechnung");
  const bankkontoId = formString(formData, "bankkonto");
  const returnTo = appReturnPath(formString(formData, "returnTo"), "/app/kontoauszug");

  if (!bewegungId || !rechnungId) {
    redirect(
      `${returnTo}?error=${encodeURIComponent("Auszugszeile und Rechnung sind erforderlich.")}`,
    );
  }

  try {
    await matchBewegungToRechnung(firmaId, bewegungId, rechnungId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Zuordnung fehlgeschlagen.";
    redirect(`${returnTo}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/kontoauszug");
  revalidatePath("/app/zahlungen");
  revalidatePath("/app/rechnungen");
  revalidatePath(`/app/rechnungen/${rechnungId}`);
  if (bankkontoId) {
    revalidatePath(`/app/bankkonten/${bankkontoId}`);
  }
  redirect(`${returnTo}?matched=1`);
}

export async function ignoreBewegungAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const bewegungId = formString(formData, "bewegung");
  const returnTo = appReturnPath(formString(formData, "returnTo"), "/app/kontoauszug");

  if (!bewegungId) {
    redirect(returnTo);
  }

  try {
    await ignoreBankBewegung(firmaId, bewegungId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ignorieren fehlgeschlagen.";
    redirect(`${returnTo}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/kontoauszug");
  redirect(`${returnTo}?ignored=1`);
}

export async function reopenBewegungAction(formData: FormData): Promise<void> {
  const firmaId = await requireFirmaId();
  const bewegungId = formString(formData, "bewegung");
  const returnTo = appReturnPath(formString(formData, "returnTo"), "/app/kontoauszug");

  if (!bewegungId) {
    redirect(returnTo);
  }

  try {
    await reopenBankBewegung(firmaId, bewegungId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Öffnen fehlgeschlagen.";
    redirect(`${returnTo}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app/kontoauszug");
  redirect(`${returnTo}?reopened=1`);
}
