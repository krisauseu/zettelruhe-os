import type { BelegInput, Buchungsrichtung, Steuersatz } from "./types";
import { validateRcInput } from "./reverse-charge";
import { normalizeBetragInput } from "@/modules/journal/invariants";
import { parseSteuerstandard } from "@/modules/contacts/steuerstandard";
function formString(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}
function parseRcForm(f: FormData) {
  if (f.has("rc")) throw new Error("RC-JSON ist kein zulässiges Formularfeld.");
  const treatment = parseSteuerstandard(formString(f, "steuerbehandlung") || "bisherig");
  if (treatment === "bisherig") {
    if ([...f.keys()].some(k => k.startsWith("rc_"))) throw new Error("Widersprüchliche Steuerbehandlung: RC-Angaben bei bisheriger Behandlung.");
    return null;
  }
  const text = (k: string) => formString(f, "rc_" + k);
  const bool = (k: string) => {
    const v = text(k);
    if (!["", "on", "true", "false"].includes(v)) throw new Error("Ungültige RC-Bestätigung.");
    return v === "on" || v === "true";
  };
  const zahlungsstatus = text("zahlungsstatus");
  const belegId = formString(f, "id");
  const automatischeReferenz = `beleg:${belegId || [formString(f, "lieferant") || "ohne-lieferant", formString(f, "belegdatum"), text("leistung_von"), text("leistung_bis")].join(":")}`;
  const nachweis = text("nachweis_ergaenzung") || text("nachweis") || "Rechnung sowie Leistungs- und Zahlungsdaten sind am Beleg dokumentiert.";
  const raw = {
    version: 1, tatbestand: treatment, waehrung: text("waehrung"), satz: text("satz"),
    abzug: text("abzug"), steuermodus: text("steuermodus"),
    modus_bestaetigt: bool("modus_bestaetigt"), leistung_von: text("leistung_von"),
    leistung_bis: text("leistung_bis"), leistungsabschnitt_bestaetigt: bool("leistungsabschnitt_bestaetigt"),
    zahlungsstatus, zahlungsdatum: text("zahlungsdatum"),
    zahlungsbetrag: normalizeBetragInput(zahlungsstatus === "bezahlt" ? (text("zahlungsbetrag") || formString(f, "betrag_brutto") || formString(f, "betrag_netto") || "0") : "0", "Zahlungsbetrag"),
    eine_zahlung: bool("eine_zahlung"), vorgang: text("vorgang") || automatischeReferenz,
    bereits_erklaert: bool("bereits_erklaert"), nachweis,
  };
  if ([...f.keys()].some(k => k.startsWith("rc_") && !["rc_nachweis_ergaenzung"].includes(k) && (!Object.hasOwn(raw, k.slice(3)) || ["rc_version", "rc_tatbestand"].includes(k)))) throw new Error("Unerlaubte berechnete oder unbekannte RC-Felder.");
  return validateRcInput(raw);
}

export function parseBelegForm(formData: FormData): BelegInput {
  const rc = parseRcForm(formData);
  const richtungRaw = formString(formData, "richtung");
  if (!["einnahme", "ausgabe"].includes(richtungRaw)) throw new Error("Ungültige Buchungsrichtung.");
  const richtung: Buchungsrichtung =
    richtungRaw === "einnahme" ? "einnahme" : "ausgabe";

  const satzRaw = formString(formData, "steuersatz");
  if (!["", "0", "7", "19"].includes(satzRaw)) throw new Error("Ungültiger Rechnungssteuersatz.");
  let steuersatz: Steuersatz | "" = "";
  if (satzRaw === "0" || satzRaw === "7" || satzRaw === "19") {
    steuersatz = satzRaw;
  }

  const lieferant = formString(formData, "lieferant");
  const kunde = formString(formData, "kunde");

  return {
    rc,
    belegdatum: formString(formData, "belegdatum"),
    buchungsdatum: rc?.zahlungsstatus === "bezahlt" ? rc.zahlungsdatum : formString(formData, "buchungsdatum") || undefined,
    richtung,
    lieferant: lieferant || null,
    kunde: kunde || null,
    betrag_netto: formString(formData, "betrag_netto") || undefined,
    betrag_ust: formString(formData, "betrag_ust") || undefined,
    betrag_brutto: formString(formData, "betrag_brutto") || undefined,
    steuersatz,
    kategorie: formString(formData, "kategorie") || undefined,
    notiz:
      formString(formData, "bezeichnung") ||
      formString(formData, "notiz") ||
      undefined,
    konto: formString(formData, "konto") || undefined,
  };
}
