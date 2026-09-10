"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSchreibenSession } from "@/lib/session";
import { parseSendProfil } from "./outbound";
import {
  EInvoiceValidationError,
  formatValidationIssues,
} from "./validate-outbound";
import {
  erzeugeERechnungVersand,
  pruefeERechnungVersand,
} from "./send-repository";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function rechnungUrl(
  id: string,
  params: Record<string, string | undefined>,
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `/app/rechnungen/${id}?${s}` : `/app/rechnungen/${id}`;
}

export async function pruefeERechnungVersandAction(
  formData: FormData,
): Promise<void> {
  const session = await requireSchreibenSession();
  const id = formString(formData, "id");
  if (!id) redirect("/app/rechnungen");

  const profil = parseSendProfil(formString(formData, "profil"));
  if (!profil) {
    redirect(
      rechnungUrl(id, {
        error: "Bitte ein E-Rechnungs-Profil wählen.",
      }),
    );
  }

  try {
    const result = await pruefeERechnungVersand(session.firmaId, id, {
      profil,
      bankkontoId: formString(formData, "bankkonto") || undefined,
      erzeugen: true,
    });
    if (result.issues.length > 0) {
      redirect(
        rechnungUrl(id, {
          error: formatValidationIssues(result.issues),
          erechnungProfil: profil,
        }),
      );
    }
    redirect(
      rechnungUrl(id, {
        erechnungOk: "1",
        erechnungProfil: profil,
      }),
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
    const msg =
      e instanceof EInvoiceValidationError
        ? formatValidationIssues(e.issues)
        : e instanceof Error
          ? e.message
          : "Prüfung fehlgeschlagen.";
    redirect(rechnungUrl(id, { error: msg, erechnungProfil: profil }));
  }
}

export async function erzeugeERechnungVersandAction(
  formData: FormData,
): Promise<void> {
  const session = await requireSchreibenSession();
  const id = formString(formData, "id");
  if (!id) redirect("/app/rechnungen");

  const profil = parseSendProfil(formString(formData, "profil"));
  if (!profil) {
    redirect(
      rechnungUrl(id, {
        error: "Bitte ein E-Rechnungs-Profil wählen.",
      }),
    );
  }

  try {
    await erzeugeERechnungVersand(session.firmaId, id, {
      profil,
      bankkontoId: formString(formData, "bankkonto") || undefined,
    });
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      String((e as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw e;
    }
    const msg =
      e instanceof EInvoiceValidationError
        ? formatValidationIssues(e.issues)
        : e instanceof Error
          ? e.message
          : "E-Rechnung konnte nicht erzeugt werden.";
    redirect(rechnungUrl(id, { error: msg, erechnungProfil: profil }));
  }

  revalidatePath(`/app/rechnungen/${id}`);
  redirect(
    rechnungUrl(id, { erechnung: "1", erechnungProfil: profil }),
  );
}
