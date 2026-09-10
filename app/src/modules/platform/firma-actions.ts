"use server";

import { nummernkreiseKonfigurieren, type NummernkreisAenderungen } from "@/lib/finanz-transaktion";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getFirmaById,
  mergeNummernkreise,
  updateFirma,
  type NummernkreisConfig,
  type Nummernkreise,
  type Steuermodus,
} from "@/lib/pb";
import {
  requireInstanzEigentuemerSession,
  requireSession,
  requireVerwaltenSession,
} from "@/lib/session";
import {
  assertLogoUpload,
  parseDokumentSchalterForm,
  validateDokumentAkzentfarbe,
  validateDokumentTexte,
} from "@/modules/sales/pdf-layout";
import {
  FIRMA_NAME_DOPPELT_ERROR,
  isDuplicateFirmaNameError,
  validateNeueFirmaInput,
} from "./firma-invariants";
import { createAndActivateFirma, switchActiveFirma } from "./firma-write";

function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function parseNummernkreis(
  formData: FormData,
  key: keyof Nummernkreise,
  current: NummernkreisConfig,
): NummernkreisConfig {
  const prefix = formString(formData, `nk_${key}_prefix`) || current.prefix;
  const digitsRaw = Number(formString(formData, `nk_${key}_digits`));
  const nextRaw = Number(formString(formData, `nk_${key}_next`));
  const digits = Number.isFinite(digitsRaw)
    ? Math.min(8, Math.max(1, Math.trunc(digitsRaw)))
    : current.digits;
  let next = Number.isFinite(nextRaw) ? Math.max(1, Math.trunc(nextRaw)) : current.next;
  if (next < current.next) {
    next = current.next;
  }
  return { prefix: prefix.slice(0, 16), digits, next };
}

export async function updateFirmaAction(formData: FormData): Promise<void> {
  const session = await requireVerwaltenSession();
  const existing = await getFirmaById(session.firmaId);
  if (!existing) {
    redirect("/app/firma?error=" + encodeURIComponent("Firma nicht gefunden."));
  }

  const name = formString(formData, "name");
  if (!name) {
    redirect(
      `/app/firma?error=${encodeURIComponent("Name der Firma ist erforderlich.")}`,
    );
  }

  const steuermodusRaw = formString(formData, "steuermodus");
  if (
    steuermodusRaw !== "kleinunternehmer" &&
    steuermodusRaw !== "regelbesteuerung_ist"
  ) {
    redirect(
      `/app/firma?error=${encodeURIComponent("Ungültiger Steuer-Modus.")}`,
    );
  }
  const steuermodus: Steuermodus = steuermodusRaw;

  if (steuermodus !== existing.steuermodus) {
    const confirmed = formString(formData, "steuermodus_bestaetigt");
    if (confirmed !== "1" && confirmed !== "on" && confirmed !== "true") {
      redirect(
        `/app/firma?error=${encodeURIComponent(
          "Steuer-Modus-Wechsel bitte bestätigen. Festgeschriebene Belege bleiben historisch korrekt.",
        )}`,
      );
    }
  }

  const currentNk = mergeNummernkreise(existing.nummernkreise);
  const nummernkreise: Nummernkreise = {
    angebot: parseNummernkreis(formData, "angebot", currentNk.angebot),
    rechnung: parseNummernkreis(formData, "rechnung", currentNk.rechnung),
    gutschrift: parseNummernkreis(formData, "gutschrift", currentNk.gutschrift),
    beleg: parseNummernkreis(formData, "beleg", currentNk.beleg),
    kasse: parseNummernkreis(formData, "kasse", currentNk.kasse),
    kontakt: parseNummernkreis(formData, "kontakt", currentNk.kontakt),
  };

  let dokument_akzentfarbe = "";
  let kopftext = "";
  let fusstext = "";
  try {
    dokument_akzentfarbe = validateDokumentAkzentfarbe(
      formString(formData, "dokument_akzentfarbe"),
    );
    const texte = validateDokumentTexte({
      kopftext: formString(formData, "dokument_kopftext"),
      fusstext: formString(formData, "dokument_fusstext"),
    });
    kopftext = texte.kopftext;
    fusstext = texte.fusstext;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Layout ungültig.";
    redirect(`/app/firma?error=${encodeURIComponent(msg)}`);
  }

  const logoRaw = formData.get("logo");
  let logo: Blob | undefined;
  if (logoRaw instanceof File && logoRaw.size > 0) {
    try {
      assertLogoUpload(logoRaw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Logo ungültig.";
      redirect(`/app/firma?error=${encodeURIComponent(msg)}`);
    }
    logo = logoRaw;
  }
  const logo_entfernen =
    formString(formData, "logo_entfernen") === "1" ||
    formString(formData, "logo_entfernen") === "on";

  try {
    // The rendered form supplies the expected state so a fresh read cannot hide stale edits.
    const expected = JSON.parse(formString(formData, "nummernkreise_expected")) as Nummernkreise;
    const changes: NummernkreisAenderungen = {};
    for (const key of Object.keys(nummernkreise) as Array<keyof Nummernkreise>) {
      if (!expected[key]) throw new Error("Nummernkreise bitte neu laden.");
      const submitted = parseNummernkreis(formData, key, expected[key]);
      if (JSON.stringify(submitted) !== JSON.stringify(expected[key])) {
        changes[key] = { expected: expected[key], value: submitted };
      }
    }
    await nummernkreiseKonfigurieren(session.firmaId, session.userId, changes);
    await updateFirma(session.firmaId, {
      name,
      steuermodus,
      skr: existing.skr,
      strasse: formString(formData, "strasse"),
      plz: formString(formData, "plz"),
      ort: formString(formData, "ort"),
      land: formString(formData, "land") || "DE",
      steuernummer: formString(formData, "steuernummer"),
      ust_id: formString(formData, "ust_id"),
      email: formString(formData, "email"),
      telefon: formString(formData, "telefon"),
      webseite: formString(formData, "webseite"),
      dokument_akzentfarbe,
      dokument_kopftext: kopftext,
      dokument_fusstext: fusstext,
      dokument_header_drucken: parseDokumentSchalterForm(
        formData.get("dokument_header_drucken"),
      ),
      dokument_fuss_drucken: parseDokumentSchalterForm(
        formData.get("dokument_fuss_drucken"),
      ),
      dokument_zahlblock: parseDokumentSchalterForm(
        formData.get("dokument_zahlblock"),
      ),
      logo,
      logo_entfernen: logo_entfernen && !logo,
    });
  } catch (e) {
    const msg = isDuplicateFirmaNameError(e)
      ? FIRMA_NAME_DOPPELT_ERROR
      : e instanceof Error
        ? e.message
        : "Speichern fehlgeschlagen.";
    redirect(`/app/firma?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app");
  revalidatePath("/app/firma");
  revalidatePath("/app/ust");
  revalidatePath("/app/zm");
  redirect("/app/firma?saved=1");
}

export async function switchFirmaAction(formData: FormData): Promise<void> {
  const session = await requireSession();
  try {
    await switchActiveFirma(session, formString(formData, "firmaId"));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Wechsel fehlgeschlagen.";
    redirect(`/app/firma?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app", "layout");
  redirect("/app?firma=1");
}

export async function createFirmaAction(formData: FormData): Promise<void> {
  const session = await requireInstanzEigentuemerSession();

  let input;
  try {
    input = validateNeueFirmaInput({
      name: formString(formData, "name"),
      steuermodus: formString(formData, "steuermodus"),
      skr: formString(formData, "skr"),
      strasse: formString(formData, "strasse"),
      plz: formString(formData, "plz"),
      ort: formString(formData, "ort"),
      land: formString(formData, "land"),
      steuernummer: formString(formData, "steuernummer"),
      ust_id: formString(formData, "ust_id"),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Angaben ungültig.";
    redirect(`/app/firma/neu?error=${encodeURIComponent(msg)}`);
  }

  try {
    await createAndActivateFirma(session, input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Anlegen fehlgeschlagen.";
    redirect(`/app/firma/neu?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/app", "layout");
  revalidatePath("/app/firma");
  redirect("/app/firma?created=1");
}
