"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchreibenSession } from "@/lib/session";
import {
  sendeAngebotPerMail,
  sendeRechnungPerMail,
  sendeZahlungserinnerungPerMail,
} from "./mail";
import { runWiederkehrendTick } from "./runner";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Manueller Job-Tick (geschützt) — z. B. von Vorlagen-Liste. */
export async function runJobsTickAction(formData: FormData): Promise<void> {
  const session = await requireSchreibenSession();
  const returnTo =
    formString(formData, "returnTo") || "/app/wiederkehrende-rechnungen";

  try {
    const result = await runWiederkehrendTick({
      firmaId: session.firmaId,
    });
    revalidatePath("/app/wiederkehrende-rechnungen");
    revalidatePath("/app/rechnungen");
    const q = new URLSearchParams();
    q.set("job", result.status);
    q.set("jobMsg", result.ergebnis);
    redirect(`${returnTo}?${q.toString()}`);
  } catch (e) {
    // redirect wirft; echte Fehler:
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw e;
    }
    const msg = e instanceof Error ? e.message : "Job-Lauf fehlgeschlagen.";
    redirect(
      `${returnTo}?error=${encodeURIComponent(msg)}`,
    );
  }
}

export async function sendeRechnungMailAction(
  formData: FormData,
): Promise<void> {
  const session = await requireSchreibenSession();
  const id = formString(formData, "id");
  if (!id) redirect("/app/rechnungen");

  try {
    const result = await sendeRechnungPerMail(session.firmaId, id);
    revalidatePath(`/app/rechnungen/${id}`);
    redirect(
      `/app/rechnungen/${id}?mail=1&mailTo=${encodeURIComponent(result.to)}`,
    );
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw e;
    }
    const msg = e instanceof Error ? e.message : "Versand fehlgeschlagen.";
    redirect(`/app/rechnungen/${id}?error=${encodeURIComponent(msg)}`);
  }
}

export async function sendeAngebotMailAction(
  formData: FormData,
): Promise<void> {
  const session = await requireSchreibenSession();
  const id = formString(formData, "id");
  if (!id) redirect("/app/angebote");

  try {
    const result = await sendeAngebotPerMail(session.firmaId, id);
    revalidatePath(`/app/angebote/${id}`);
    redirect(
      `/app/angebote/${id}?mail=1&mailTo=${encodeURIComponent(result.to)}`,
    );
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw e;
    }
    const msg = e instanceof Error ? e.message : "Versand fehlgeschlagen.";
    redirect(`/app/angebote/${id}?error=${encodeURIComponent(msg)}`);
  }
}

export async function sendeZahlungserinnerungAction(
  formData: FormData,
): Promise<void> {
  const session = await requireSchreibenSession();
  const id = formString(formData, "id");
  if (!id) redirect("/app/rechnungen");

  try {
    const result = await sendeZahlungserinnerungPerMail(session.firmaId, id);
    revalidatePath(`/app/rechnungen/${id}`);
    redirect(
      `/app/rechnungen/${id}?erinnerung=1&mailTo=${encodeURIComponent(result.to)}`,
    );
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw e;
    }
    const msg = e instanceof Error ? e.message : "Versand fehlgeschlagen.";
    redirect(`/app/rechnungen/${id}?error=${encodeURIComponent(msg)}`);
  }
}
