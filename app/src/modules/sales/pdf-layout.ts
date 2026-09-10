/**
 * Reine Helfer für Angebots-/Rechnungs-PDF: Entwurf vs. Original, Dateiname,
 * Layout (Akzentfarbe, Kopf-/Fußtext, Sichtbarkeit, Fuß-Spalten).
 * Kein I/O, kein Nummernkreis.
 */

import { formatMoneyDe } from "@/lib/money";

function ibanCompact(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export const PDF_WASSERZEICHEN_ENTWURF = "Entwurf";

export const DEFAULT_DOKUMENT_AKZENTFARBE = "#1F2937";

export const DOKUMENT_KOPFTEXT_MAX = 500;
export const DOKUMENT_FUSSTEXT_MAX = 1000;
export const DOKUMENT_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const DOKUMENT_LOGO_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

/** Max. Logo auf Angebot/Rechnung (pt). Seitenverhältnis bleibt, rechtsbündig. ~56 × 25 mm. */
export const PDF_LOGO_WIDTH = 160;
export const PDF_LOGO_HEIGHT = 72;

/** 1 mm in PDF-Punkten (1 in = 25,4 mm = 72 pt). */
export const PDF_PT_PER_MM = 72 / 25.4;

export function mmToPt(mm: number): number {
  return mm * PDF_PT_PER_MM;
}

/**
 * DIN 5008 Form B: Adressfeld 85 × 45 mm, 45 mm unter der Blattkante,
 * 20 mm vom linken Rand. Absenderzeile oben, Empfängeradresse darunter.
 * Firmenlogo/-adresse bleiben am bisherigen oberen rechten Rand.
 */
export const PDF_ADRESSFELD_LEFT = mmToPt(20);
export const PDF_ADRESSFELD_TOP = mmToPt(45);
export const PDF_ADRESSFELD_WIDTH = mmToPt(85);
export const PDF_ADRESSFELD_HEIGHT = mmToPt(45);

export const PDF_PAGE_PADDING_TOP = 44;
export const PDF_PAGE_PADDING_RIGHT = 48;
/** Abstand zwischen letztem Inhaltsblock und konfigurierbarem Fußtext (pt). */
export const PDF_FUSSTEXT_MARGIN_TOP = 16;
/** Platz für die fixierte 3-Spalten-Stammdatenzeile am unteren Rand. */
export const PDF_PAGE_PADDING_BOTTOM = 72;
export const PDF_PAGE_PADDING_LEFT = PDF_ADRESSFELD_LEFT;

/** In-flow-Höhe bis Unterkante Adressfeld, damit Betreff und Text darunter beginnen. */
export const PDF_KOPF_RESERVE_HEIGHT =
  PDF_ADRESSFELD_TOP + PDF_ADRESSFELD_HEIGHT - PDF_PAGE_PADDING_TOP;

export type DokumentArt = "angebot" | "rechnung";

export type DokumentBank = {
  name: string;
  iban: string;
  bic: string;
  kontoinhaber: string;
};

export type DokumentPdfLayout = {
  /** data:image/…;base64,… — fehlt, wenn kein Logo */
  logoDataUri?: string;
  /** Immer ein gültiges #RRGGBB */
  akzentfarbe: string;
  kopftext: string;
  fusstext: string;
  headerDrucken: boolean;
  fussDrucken: boolean;
  zahlblock: boolean;
  bank?: DokumentBank;
};

export function defaultDokumentPdfLayout(): DokumentPdfLayout {
  return {
    akzentfarbe: DEFAULT_DOKUMENT_AKZENTFARBE,
    kopftext: "",
    fusstext: "",
    headerDrucken: true,
    fussDrucken: true,
    zahlblock: true,
  };
}

/** Fehlend oder nicht false → an (bisheriges Verhalten). */
export function dokumentSchalterWert(
  raw: boolean | undefined | null,
): boolean {
  return raw !== false;
}

export function parseDokumentSchalterForm(raw: unknown): boolean {
  return raw === "1" || raw === "on" || raw === true || raw === "true";
}

/**
 * Erstes aktives Bankkonto mit IBAN (Liste bereits sortiert).
 * Ohne IBAN kein GiroCode und keine Bankzeile.
 */
export function pickDokumentBankkonto(
  konten: Array<{
    name: string;
    iban?: string;
    bic?: string;
    kontoinhaber?: string;
    aktiv?: boolean;
  }>,
): DokumentBank | undefined {
  for (const k of konten) {
    if (k.aktiv === false) continue;
    const iban = ibanCompact(k.iban ?? "");
    if (!iban) continue;
    return {
      name: (k.name ?? "").trim(),
      iban,
      bic: (k.bic ?? "").replace(/\s+/g, "").toUpperCase(),
      kontoinhaber: (k.kontoinhaber ?? "").trim(),
    };
  }
  return undefined;
}

export function formatIbanAnzeige(iban: string): string {
  const n = ibanCompact(iban);
  return n.replace(/(.{4})/g, "$1 ").trim();
}

export function formatPdfDateDe(iso: string): string {
  if (!iso || iso.length < 10) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function formatLeistungszeitraum(von?: string, bis?: string): string {
  const a = formatPdfDateDe(von ?? "");
  const b = formatPdfDateDe(bis ?? "");
  if (a && b && a !== b) return `${a} – ${b}`;
  return a || b;
}

export function firmaAbsenderzeile(opts: {
  name: string;
  strasse?: string;
  plz?: string;
  ort?: string;
}): string {
  const city = [opts.plz, opts.ort].filter(Boolean).join(" ");
  return [opts.name, opts.strasse, city].filter(Boolean).join(" · ");
}

export function footerBankzeile(bank?: DokumentBank): string {
  if (!bank?.iban) return "";
  const parts: string[] = [];
  if (bank.name) parts.push(`Bank: ${bank.name}`);
  if (bank.kontoinhaber) parts.push(`Kontoinhaber: ${bank.kontoinhaber}`);
  parts.push(`IBAN: ${formatIbanAnzeige(bank.iban)}`);
  if (bank.bic) parts.push(`BIC: ${bank.bic}`);
  return parts.join("  ·  ");
}

/** Leere Zeilen im konfigurierbaren Fußtext verwerfen — kompakter Satz. */
export function footerTextZeilen(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export type FooterFirmaStammdaten = {
  name?: string;
  telefon?: string;
  email?: string;
  webseite?: string;
  steuernummer?: string;
  ust_id?: string;
};

/** Protokoll und trailing Slash für die Fußzeile entfernen. */
export function formatWebseiteAnzeige(raw: string): string {
  return (raw ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

export type FooterSpalte = {
  zeilen: string[];
};

/**
 * Fußbereich unter dem Fußtext: Firma/Kontakt, Bank, Steuer — leere Spalten weg.
 */
export function footerStammdatenSpalten(opts: {
  firma: FooterFirmaStammdaten;
  bank?: DokumentBank;
}): FooterSpalte[] {
  const tel = (opts.firma.telefon ?? "").trim();
  const mail = (opts.firma.email ?? "").trim();
  const web = formatWebseiteAnzeige(opts.firma.webseite ?? "");
  const firmaZeilen = [
    (opts.firma.name ?? "").trim(),
    tel ? `Tel. ${tel}` : "",
    mail ? `E-Mail ${mail}` : "",
    web ? `Web ${web}` : "",
  ].filter(Boolean);

  const bankZeilen: string[] = [];
  if (opts.bank?.iban) {
    const bankname = (opts.bank.name ?? "").trim();
    if (bankname) bankZeilen.push(bankname);
    const inhaber = (opts.bank.kontoinhaber ?? "").trim();
    if (inhaber) bankZeilen.push(`Kontoinhaber ${inhaber}`);
    bankZeilen.push(`IBAN ${formatIbanAnzeige(opts.bank.iban)}`);
    const bic = (opts.bank.bic ?? "").trim();
    if (bic) bankZeilen.push(`BIC ${bic}`);
  }

  const stnr = (opts.firma.steuernummer ?? "").trim();
  const ust = (opts.firma.ust_id ?? "").trim();
  const steuerZeilen = [
    stnr ? `St.-Nr. ${stnr}` : "",
    ust ? `USt-IdNr. ${ust}` : "",
  ].filter(Boolean);

  return [firmaZeilen, bankZeilen, steuerZeilen]
    .filter((zeilen) => zeilen.length > 0)
    .map((zeilen) => ({ zeilen }));
}

export function dokumentTitel(opts: {
  art: DokumentArt;
  entwurf: boolean;
  nummer?: string | null;
}): string {
  const label = opts.art === "angebot" ? "Angebot" : "Rechnung";
  if (opts.entwurf) return `${label} (Entwurf)`;
  const n = (opts.nummer ?? "").trim();
  return n ? `${label} Nr. ${n}` : label;
}

export function zahlungshinweisRechnung(opts: {
  betrag: string;
  faelligAm?: string;
  entwurf: boolean;
  hatBank: boolean;
}): string {
  const betrag = formatMoneyDe(opts.betrag, { currency: true });
  const bis = formatPdfDateDe(opts.faelligAm ?? "");
  const nr = opts.entwurf
    ? "unter Angabe der späteren Rechnungsnummer"
    : "unter Angabe der Rechnungsnummer";
  const ziel = opts.hatBank ? " auf unser Bankkonto" : "";
  if (bis) {
    return `Bitte überweisen Sie den Betrag von ${betrag} bis zum ${bis} ${nr}${ziel}.`;
  }
  return `Bitte überweisen Sie den Betrag von ${betrag} ${nr}${ziel}.`;
}

/** Weiß auf dunklem Akzent, sonst dunkel — Tabellenkopf. */
export function kontrastTextAuf(hex: string): "#FFFFFF" | "#111111" {
  const n = normalizeAkzentfarbe(hex) ?? DEFAULT_DOKUMENT_AKZENTFARBE;
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l > 0.55 ? "#111111" : "#FFFFFF";
}

/**
 * Nummer auf dem PDF: Entwurf zeigt nie eine Kreisnummer.
 */
export function pdfNummerAnzeige(opts: {
  entwurf: boolean;
  nummer?: string | null;
}): string {
  if (opts.entwurf) return PDF_WASSERZEICHEN_ENTWURF;
  const n = (opts.nummer ?? "").trim();
  return n || "—";
}

export function pdfDateiname(opts: {
  art: DokumentArt;
  entwurf: boolean;
  nummer?: string | null;
}): string {
  if (opts.entwurf) {
    return opts.art === "angebot"
      ? "Angebot-Entwurf.pdf"
      : "Rechnung-Entwurf.pdf";
  }
  const n = (opts.nummer ?? "").trim();
  if (n) return `${n}.pdf`;
  return opts.art === "angebot" ? "Angebot.pdf" : "Rechnung.pdf";
}

/** #RGB oder #RRGGBB → #RRGGBB; leer → Default; ungültig → null */
export function normalizeAkzentfarbe(
  raw: string | undefined | null,
): string | null {
  const s = (raw ?? "").trim();
  if (!s) return DEFAULT_DOKUMENT_AKZENTFARBE;
  const hex = s.startsWith("#") ? s.slice(1) : s;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const [r, g, b] = hex.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return `#${hex.toUpperCase()}`;
  }
  return null;
}

export function validateDokumentTexte(input: {
  kopftext?: string;
  fusstext?: string;
}): { kopftext: string; fusstext: string } {
  const kopftext = (input.kopftext ?? "").trim();
  const fusstext = (input.fusstext ?? "").trim();
  if (kopftext.length > DOKUMENT_KOPFTEXT_MAX) {
    throw new Error(
      `Kopftext ist zu lang (max. ${DOKUMENT_KOPFTEXT_MAX} Zeichen).`,
    );
  }
  if (fusstext.length > DOKUMENT_FUSSTEXT_MAX) {
    throw new Error(
      `Fußtext ist zu lang (max. ${DOKUMENT_FUSSTEXT_MAX} Zeichen).`,
    );
  }
  return { kopftext, fusstext };
}

export function validateDokumentAkzentfarbe(
  raw: string | undefined | null,
): string {
  const n = normalizeAkzentfarbe(raw);
  if (!n) {
    throw new Error(
      "Akzentfarbe muss leer bleiben oder #RGB / #RRGGBB sein.",
    );
  }
  return n;
}

export function guessImageMime(
  filename: string,
  contentType?: string | null,
): string {
  const ct = (contentType ?? "").split(";")[0]?.trim().toLowerCase();
  if (ct && (DOKUMENT_LOGO_MIME as readonly string[]).includes(ct)) {
    return ct;
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

export function assertLogoUpload(file: {
  size: number;
  type: string;
}): void {
  if (file.size <= 0) {
    throw new Error("Logo-Datei ist leer.");
  }
  if (file.size > DOKUMENT_LOGO_MAX_BYTES) {
    throw new Error("Logo darf höchstens 2 MB groß sein.");
  }
  const type = (file.type || "").toLowerCase();
  if (!(DOKUMENT_LOGO_MIME as readonly string[]).includes(type)) {
    throw new Error("Logo: nur PNG, JPEG oder WebP.");
  }
}

/**
 * Skaliert Pixelmaße in die Logo-Max-Box, ohne das Seitenverhältnis zu strecken.
 * Die resultierende Box ist so breit wie das sichtbare Logo — damit sitzt sie
 * in der Firmen-Spalte rechtsbündig.
 */
export function fitPdfLogo(
  pixelWidth: number,
  pixelHeight: number,
): { width: number; height: number } {
  if (!(pixelWidth > 0) || !(pixelHeight > 0)) {
    return { width: PDF_LOGO_WIDTH, height: PDF_LOGO_HEIGHT };
  }
  const scale = Math.min(
    PDF_LOGO_WIDTH / pixelWidth,
    PDF_LOGO_HEIGHT / pixelHeight,
  );
  return {
    width: pixelWidth * scale,
    height: pixelHeight * scale,
  };
}

export function imageSizeFromBytes(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (bytes.length < 16) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) {
    return pngSize(bytes);
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return jpegSize(bytes);
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return webpSize(bytes);
  }
  return null;
}

export function pdfLogoBoxFromDataUri(
  dataUri: string | undefined,
): { width: number; height: number } {
  const size = imageSizeFromDataUri(dataUri);
  if (!size) return { width: PDF_LOGO_WIDTH, height: PDF_LOGO_HEIGHT };
  return fitPdfLogo(size.width, size.height);
}

function imageSizeFromDataUri(
  dataUri: string | undefined,
): { width: number; height: number } | null {
  if (!dataUri) return null;
  const comma = dataUri.indexOf(",");
  if (comma < 0) return null;
  const bytes = bytesFromBase64(dataUri.slice(comma + 1));
  if (!bytes) return null;
  return imageSizeFromBytes(bytes);
}

function bytesFromBase64(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function u16be(b: Uint8Array, o: number): number {
  return (b[o]! << 8) | b[o + 1]!;
}

function u32be(b: Uint8Array, o: number): number {
  return (
    ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0
  );
}

function u16le(b: Uint8Array, o: number): number {
  return b[o]! | (b[o + 1]! << 8);
}

function u24le(b: Uint8Array, o: number): number {
  return b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16);
}

function pngSize(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const width = u32be(bytes, 16);
  const height = u32be(bytes, 20);
  if (width < 1 || height < 1) return null;
  return { width, height };
}

function jpegSize(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  let pos = 2;
  while (pos + 8 < bytes.length) {
    if (bytes[pos] !== 0xff) {
      pos += 1;
      continue;
    }
    while (pos < bytes.length && bytes[pos] === 0xff) pos += 1;
    if (pos >= bytes.length) return null;
    const marker = bytes[pos]!;
    pos += 1;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (marker === 0x01) continue;
    if (pos + 1 >= bytes.length) return null;
    const length = u16be(bytes, pos);
    if (length < 2 || pos + length > bytes.length) return null;
    const sof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (sof && length >= 7) {
      const height = u16be(bytes, pos + 3);
      const width = u16be(bytes, pos + 5);
      if (width < 1 || height < 1) return null;
      return { width, height };
    }
    pos += length;
  }
  return null;
}

function u32le(b: Uint8Array, o: number): number {
  return (
    b[o]! |
    (b[o + 1]! << 8) |
    (b[o + 2]! << 16) |
    (b[o + 3]! << 24)
  ) >>> 0;
}

function webpSize(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (bytes.length < 16) return null;
  if (
    bytes[8] !== 0x57 ||
    bytes[9] !== 0x45 ||
    bytes[10] !== 0x42 ||
    bytes[11] !== 0x50
  ) {
    return null;
  }
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const tag = String.fromCharCode(
      bytes[pos]!,
      bytes[pos + 1]!,
      bytes[pos + 2]!,
      bytes[pos + 3]!,
    );
    const chunkSize = u32le(bytes, pos + 4);
    const payload = pos + 8;
    if (tag === "VP8X" && payload + 10 <= bytes.length) {
      const width = u24le(bytes, payload + 4) + 1;
      const height = u24le(bytes, payload + 7) + 1;
      if (width < 1 || height < 1) return null;
      return { width, height };
    }
    if (tag === "VP8 " && payload + 10 <= bytes.length) {
      const start = payload + 3;
      if (
        bytes[start] === 0x9d &&
        bytes[start + 1] === 0x01 &&
        bytes[start + 2] === 0x2a
      ) {
        const width = u16le(bytes, start + 3) & 0x3fff;
        const height = u16le(bytes, start + 5) & 0x3fff;
        if (width < 1 || height < 1) return null;
        return { width, height };
      }
    }
    if (tag === "VP8L" && payload + 5 <= bytes.length && bytes[payload] === 0x2f) {
      const bits = u32le(bytes, payload + 1);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      if (width < 1 || height < 1) return null;
      return { width, height };
    }
    const padded = chunkSize + (chunkSize % 2);
    if (padded === 0) break;
    pos = payload + padded;
  }
  return null;
}
