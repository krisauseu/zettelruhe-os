import type { SkrWahl, Steuermodus } from "./pb";
import type {
  Buchungsrichtung,
  QuelleTyp,
} from "@/modules/journal/types";
import type { BelegStatus } from "@/modules/expenses/types";
import type {
  EInvoiceFormat,
  EInvoiceParseStatus,
  ERechnungEmpfangStatus,
} from "@/modules/einvoice/types";
import type {
  AngebotStatus,
  RechnungStatus,
} from "@/modules/sales/types";
import type { WiederkehrRhythmus } from "@/modules/sales/wiederkehrend-types";
import type { Abrechnungsstatus } from "@/modules/time/types";

/** UI-Labels strikt de-DE / CONTEXT.md — keine englischen Domänenlabels */

export const STEUERMODUS_LABELS: Record<Steuermodus, string> = {
  kleinunternehmer: "Kleinunternehmerregelung (§ 19 UStG)",
  regelbesteuerung_ist: "Regelbesteuerung (Ist-Versteuerung)",
};

export const SKR_LABELS: Record<SkrWahl, string> = {
  skr03: "SKR03",
  skr04: "SKR04",
};

/** Grobe Rechte an der Mitgliedschaft (ADR-0025) */
export const MITGLIEDSCHAFT_ROLLE_LABELS: Record<
  "eigentuemer" | "bearbeiten" | "lesen",
  string
> = {
  eigentuemer: "Eigentümer:in",
  bearbeiten: "Bearbeiten",
  lesen: "Lesen",
};

/** Steuersätze unter Regelbesteuerung (Anzeige) */
export const STEUERSATZ_LABELS: Record<string, string> = {
  "0": "0 %",
  "7": "7 %",
  "19": "19 %",
};

export const BUCHUNGSRICHTUNG_LABELS: Record<Buchungsrichtung, string> = {
  einnahme: "Einnahme",
  ausgabe: "Ausgabe",
};

export const QUELLE_TYP_LABELS: Record<QuelleTyp, string> = {
  manuell: "Manuell",
  beleg: "Beleg",
  rechnung: "Rechnung",
  zahlung: "Zahlung",
  kasse: "Kassenbuch",
  storno: "Storno",
  system: "System",
};

export const BELEG_STATUS_LABELS: Record<BelegStatus, string> = {
  entwurf: "Entwurf",
  festgeschrieben: "Festgeschrieben",
};

export const RECHNUNG_STATUS_LABELS: Record<RechnungStatus, string> = {
  entwurf: "Entwurf",
  offen: "Offen",
  teilbezahlt: "Teilbezahlt",
  bezahlt: "Bezahlt",
  ueberfaellig: "Überfällig",
  storniert: "Storniert",
};

/** Zahlungsweg light (CONTEXT: Zahlung manuell) */
export const ZAHLUNGSWEG_LABELS: Record<string, string> = {
  bar: "Bar",
  ueberweisung: "Überweisung",
  sonstiges: "Sonstiges",
};

/** Bank-Auszugszeile: Richtung (CONTEXT: Bankkonto / Kontoauszug) */
export const BANK_RICHTUNG_LABELS: Record<string, string> = {
  eingang: "Eingang",
  ausgang: "Ausgang",
};

/** Bank-Auszugszeile: Match-Status */
export const BANK_BEWEGUNG_STATUS_LABELS: Record<string, string> = {
  offen: "Offen",
  gematcht: "Gematcht",
  ignoriert: "Ignoriert",
};

/** E-Rechnung Empfang: Workflow-Status */
export const E_RECHNUNG_EMPFANG_STATUS_LABELS: Record<
  ERechnungEmpfangStatus,
  string
> = {
  neu: "Neu",
  beleg_erstellt: "Beleg angelegt",
  archiviert: "Archiviert",
};

/** E-Rechnung Empfang: Parse-Status */
export const E_RECHNUNG_PARSE_STATUS_LABELS: Record<
  EInvoiceParseStatus,
  string
> = {
  ok: "Geparst",
  fehler: "Parse-Fehler",
};

/** E-Rechnung: erkanntes Format light */
export const E_RECHNUNG_FORMAT_LABELS: Record<EInvoiceFormat, string> = {
  xrechnung_ubl: "XRechnung (UBL)",
  zugferd_cii: "ZUGFeRD (CII)",
  unbekannt: "Unbekannt",
};

/** E-Rechnung Versand: wählbare Profile (XML, kein Hybrid-PDF) */
export const E_RECHNUNG_PROFIL_LABELS: Record<
  Exclude<EInvoiceFormat, "unbekannt">,
  string
> = {
  xrechnung_ubl: "XRechnung 3.0 (UBL-XML)",
  zugferd_cii: "ZUGFeRD EN 16931 (CII-XML)",
};

export const ANGEBOT_STATUS_LABELS: Record<AngebotStatus, string> = {
  entwurf: "Entwurf",
  gesendet: "Gesendet",
  angenommen: "Angenommen",
  abgelehnt: "Abgelehnt",
  abgelaufen: "Abgelaufen",
  abgerechnet: "Abgerechnet",
};

/** Rhythmus Wiederkehrende Rechnung (CONTEXT) */
export const WIEDERKEHR_RHYTHMUS_LABELS: Record<WiederkehrRhythmus, string> = {
  monatlich: "Monatlich",
  quartalsweise: "Quartalsweise",
  jaehrlich: "Jährlich",
  tage: "Tage",
};

/** Zeiteintrag / Fahrt — Abrechnungsstatus (CONTEXT) */
export const ABRECHNUNGSSTATUS_LABELS: Record<Abrechnungsstatus, string> = {
  abrechenbar: "Abrechenbar",
  nicht_abrechenbar: "Nicht abrechenbar",
  abgerechnet: "Abgerechnet",
};

/** YYYY-MM-DD → de-DE Anzeige */
export function formatDateDe(isoDate: string): string {
  if (!isoDate || isoDate.length < 10) return "—";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}.${m}.${y}`;
}

/** ISO-Zeitstempel → de-DE Datum+Zeit (Europe/Berlin) */
export function formatDateTimeDe(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function kontaktRollenLabel(opts: {
  ist_kunde: boolean;
  ist_lieferant: boolean;
}): string {
  const parts: string[] = [];
  if (opts.ist_kunde) parts.push("Kund:in");
  if (opts.ist_lieferant) parts.push("Lieferant:in");
  return parts.length > 0 ? parts.join(" · ") : "—";
}
