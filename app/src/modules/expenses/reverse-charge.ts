/** RC v1. Pure contract; generated for PocketBase by scripts/build-rc-hook.mjs. */
import DecimalLibrary from "decimal.js";
const Decimal = DecimalLibrary.clone({ precision: 28, rounding: DecimalLibrary.ROUND_HALF_UP });

export const RC_PUBLIC_ENABLED = true;
export const RC_PAYMENT_ERROR = "Unbezahlte, teilbezahlte oder in mehreren Zahlungen ausgeglichene Reverse-Charge-Belege werden derzeit nicht unterstützt und können nicht festgeschrieben werden. Die steuerliche Erklärung muss gegebenenfalls separat erfolgen.";
export function assertRcFreigegeben(): void {
  if (!RC_PUBLIC_ENABLED) throw new Error("Reverse Charge ist bis zur vollständigen Abnahme noch nicht freigegeben.");
}
export type RcModus = "kleinunternehmer" | "regelbesteuerung_ist";
export type RcInput = {
  version: 1;
  tatbestand: "eu_dienstleistung" | "drittland_dienstleistung";
  waehrung: "EUR";
  satz: "7" | "19";
  abzug: "voll" | "ausgeschlossen";
  steuermodus: RcModus;
  /** Confirmation that this mode also applies at the derived tax date. */
  modus_bestaetigt: boolean;
  leistung_von: string;
  leistung_bis: string;
  /** A single completed service or separately agreed and billed service section. */
  leistungsabschnitt_bestaetigt: boolean;
  zahlungsstatus: "unbezahlt" | "teilbezahlt" | "bezahlt";
  zahlungsdatum: string;
  zahlungsbetrag: string;
  eine_zahlung: boolean;
  /** Stable reference for this economic service, shared by advance/final invoices. */
  vorgang: string;
  bereits_erklaert: boolean;
  nachweis: string;
};
export type RcSnapshot = RcInput & {
  grundlage: string;
  schuld: string;
  vorsteuer: string;
  steuerdatum: string;
  zeitregel: "eu_leistung" | "drittland_rechnung" | "drittland_folgemonat" | "vorauszahlung_abfluss";
  korrektur?: { art: "erfassungsfehler" | "vollstaendige_rueckzahlung"; original: string; datum: string; nachweis: string };
};
export type RcBeleg = {
  richtung: string; belegdatum: string; buchungsdatum: string;
  betrag_netto: string; betrag_ust: string; betrag_brutto: string; steuersatz: string;
};
const keys = ["version", "tatbestand", "waehrung", "satz", "abzug", "steuermodus", "modus_bestaetigt", "leistung_von", "leistung_bis", "leistungsabschnitt_bestaetigt", "zahlungsstatus", "zahlungsdatum", "zahlungsbetrag", "eine_zahlung", "vorgang", "bereits_erklaert", "nachweis"];
function fail(message: string): never { throw new Error(message); }
export function rcDate(value: string): boolean {
  if (typeof value !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function amount(value: string): DecimalLibrary {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,11})\.\d{2}$/.test(value)) fail("RC-Beträge müssen Cent-genaue EUR-Dezimaltexte sein.");
  return new Decimal(value);
}
/** Drafts may retain an unsupported payment state, but never calculated tax. */
export function validateRcInput(raw: unknown): RcInput | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "object" || Array.isArray(raw)) fail("Ungültige RC-Angaben.");
  const r = raw as RcInput;
  if (Object.keys(r).some(k => !keys.includes(k)) || keys.some(k => !(k in r))) fail("RC-Angaben unvollständig oder mit unerlaubten berechneten Feldern.");
  if (r.version !== 1 || !["eu_dienstleistung", "drittland_dienstleistung"].includes(r.tatbestand) || r.waehrung !== "EUR" || !["7", "19"].includes(r.satz) || !["voll", "ausgeschlossen"].includes(r.abzug) || !["kleinunternehmer", "regelbesteuerung_ist"].includes(r.steuermodus)) fail("Nicht unterstützter RC-Steuerfall, Steuersatz, Abzug oder Währung.");
  for (const k of ["modus_bestaetigt", "leistungsabschnitt_bestaetigt", "eine_zahlung", "bereits_erklaert"] as const) if (typeof r[k] !== "boolean") fail("RC-Bestätigungen fehlen.");
  if (!rcDate(r.leistung_von) || !rcDate(r.leistung_bis) || r.leistung_von > r.leistung_bis) fail("RC-Leistungsabschnitt ist ungültig.");
  if (!r.leistungsabschnitt_bestaetigt || r.leistung_bis > String(Number(r.leistung_von.slice(0, 4)) + 1) + r.leistung_von.slice(4)) fail("Nur einzelne Leistungen oder gesondert vereinbarte Leistungsabschnitte bis zu einem Jahr werden unterstützt.");
  if (!["unbezahlt", "teilbezahlt", "bezahlt"].includes(r.zahlungsstatus) || (r.zahlungsdatum !== "" && !rcDate(r.zahlungsdatum))) fail("RC-Zahlungsangaben sind ungültig.");
  amount(r.zahlungsbetrag);
  if (typeof r.vorgang !== "string" || !r.vorgang.trim() || r.vorgang.length > 160 || r.vorgang !== r.vorgang.trim()) fail("Ein eindeutiger RC-Vorgangsbezug ist erforderlich.");
  if (typeof r.nachweis !== "string" || r.nachweis.trim().length < 3 || r.nachweis.length > 2000) fail("Nachweis zu Leistung, Zahlung und steuerlicher Einordnung ist erforderlich.");
  return { ...r };
}
export function rcInputFromSnapshot(r: RcSnapshot): RcInput {
  return Object.fromEntries(keys.map(k => [k, r[k as keyof RcInput]])) as RcInput;
}
export function calculateRc(raw: unknown, b: RcBeleg, modus: RcModus, today: string): RcSnapshot {
  const r = validateRcInput(raw);
  if (!r) fail("RC-Klassifikation fehlt.");
  if (r.zahlungsstatus !== "bezahlt" || !r.eine_zahlung || !rcDate(r.zahlungsdatum) || !amount(r.zahlungsbetrag).eq(amount(b.betrag_brutto))) fail(RC_PAYMENT_ERROR);
  if (!rcDate(today) || r.zahlungsdatum > today || !rcDate(b.belegdatum) || b.belegdatum > today) fail("RC-Zahlung und Rechnung müssen bereits vorliegen.");
  if (r.bereits_erklaert) fail("Bereits separat erklärte RC-Vorgänge benötigen eine abgestimmte Berichtigung und werden nicht automatisch erneut verarbeitet.");
  if (!r.modus_bestaetigt || r.steuermodus !== modus) fail("Der Steuer-Modus wurde geändert oder gilt nicht bestätigt für den Steuerzeitpunkt. RC-Angaben neu prüfen.");
  const base = amount(b.betrag_netto);
  if (b.richtung !== "ausgabe" || b.steuersatz !== "0" || !amount(b.betrag_ust).isZero() || !base.eq(amount(b.betrag_brutto)) || !base.gt(0) || b.buchungsdatum !== r.zahlungsdatum) fail("RC benötigt eine Ausgabe ohne ausgewiesene Rechnungssteuer; Netto und Zahlbetrag bleiben gleich, Buchungsdatum ist das Zahlungsdatum.");
  let steuerdatum: string;
  let zeitregel: RcSnapshot["zeitregel"];
  if (r.zahlungsdatum < r.leistung_bis) {
    steuerdatum = r.zahlungsdatum;
    zeitregel = "vorauszahlung_abfluss";
  } else if (r.tatbestand === "eu_dienstleistung") {
    steuerdatum = r.leistung_bis;
    zeitregel = "eu_leistung";
  } else {
    if (b.belegdatum < r.leistung_bis) fail("Drittlands-Vorausrechnung ohne vollständige Vorauszahlung benötigt eine gesonderte Prüfung und wird nicht automatisch verarbeitet.");
    // Ordinary invoice after performance, bounded by the statutory following month.
    const d = new Date(r.leistung_bis + "T00:00:00Z");
    const limit = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0)).toISOString().slice(0, 10);
    steuerdatum = b.belegdatum < limit ? b.belegdatum : limit;
    zeitregel = b.belegdatum > limit ? "drittland_folgemonat" : "drittland_rechnung";
  }
  const schuld = base.times(r.satz).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
  return { ...r, grundlage: base.toFixed(2), schuld, vorsteuer: modus === "regelbesteuerung_ist" && r.abzug === "voll" ? schuld : "0.00", steuerdatum, zeitregel };
}
/** Berlin calendar date without Intl, which PocketBase's JS VM does not provide. */
export function rcToday(now: string): string {
  const d = new Date(now);
  const y = d.getUTCFullYear();
  const lastSunday = (month: number) => {
    const end = new Date(Date.UTC(y, month + 1, 0, 1));
    end.setUTCDate(end.getUTCDate() - end.getUTCDay());
    return end.getTime();
  };
  const offset = d.getTime() >= lastSunday(2) && d.getTime() < lastSunday(9) ? 2 : 1;
  return new Date(d.getTime() + offset * 3600000).toISOString().slice(0, 10);
}
export function correctRc(original: RcSnapshot, input: NonNullable<RcSnapshot["korrektur"]>, today: string): RcSnapshot {
  if (original.korrektur || !input || !["erfassungsfehler", "vollstaendige_rueckzahlung"].includes(input.art) || !input.original || !rcDate(input.datum) || input.datum > today || typeof input.nachweis !== "string" || input.nachweis.trim().length < 3 || input.nachweis.length > 2000 || Object.keys(input).some(k => !["art", "original", "datum", "nachweis"].includes(k))) fail("RC-Korrekturgrund, Original und Nachweis sind erforderlich.");
  if (input.art === "vollstaendige_rueckzahlung" && (input.datum < original.zahlungsdatum || input.datum < original.steuerdatum)) fail("Die vollständige Rückzahlung darf nicht vor Zahlung oder Steuerzeitpunkt liegen.");
  return { ...original, grundlage: new Decimal(original.grundlage).negated().toFixed(2), schuld: new Decimal(original.schuld).negated().toFixed(2), vorsteuer: new Decimal(original.vorsteuer).negated().toFixed(2), steuerdatum: input.art === "erfassungsfehler" ? original.steuerdatum : input.datum, korrektur: { ...input } };
}
