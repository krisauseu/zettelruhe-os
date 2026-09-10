/**
 * USt-IdNr. normalisieren und Syntax light prüfen.
 * Autorität für Gültigkeit bleibt das BZSt, nicht dieses Schema.
 */

/** EU-Mitgliedstaaten inkl. XI (Nordirland); EL = USt-Präfix Griechenland. */
export const EU_UST_LAENDER = new Set([
  "AT",
  "BE",
  "BG",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "EL",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "HU",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SE",
  "SI",
  "SK",
  "XI",
]);

/** Länder, deren USt-Id das BZSt-Auslandsverfahren als angefragte Nummer bestätigt. */
export const BZST_ANGEFRAGTE_LAENDER = new Set(
  [...EU_UST_LAENDER].filter((c) => c !== "DE" && c !== "GR"),
);

const SYNTAX: Record<string, RegExp> = {
  AT: /^ATU\d{8}$/,
  BE: /^BE[01]\d{9}$/,
  BG: /^BG\d{9,10}$/,
  CY: /^CY\d{8}[A-Z]$/,
  CZ: /^CZ\d{8,10}$/,
  DE: /^DE\d{9}$/,
  DK: /^DK\d{8}$/,
  EE: /^EE\d{9}$/,
  EL: /^EL\d{9}$/,
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^FI\d{8}$/,
  FR: /^FR[A-Z0-9]{2}\d{9}$/,
  HR: /^HR\d{11}$/,
  HU: /^HU\d{8}$/,
  IE: /^IE[A-Z0-9]{7,9}$/,
  IT: /^IT\d{11}$/,
  LT: /^LT\d{9}$|^LT\d{12}$/,
  LU: /^LU\d{8}$/,
  LV: /^LV\d{11}$/,
  MT: /^MT\d{8}$/,
  NL: /^NL\d{9}B\d{2}$/,
  PL: /^PL\d{10}$/,
  PT: /^PT\d{9}$/,
  RO: /^RO\d{2,10}$/,
  SE: /^SE\d{12}$/,
  SI: /^SI\d{8}$/,
  SK: /^SK\d{10}$/,
  XI: /^XI\d{9}$|^XI\d{12}$/,
};

export function normalizeUstId(raw: string | null | undefined): string {
  return (raw ?? "").replace(/[\s.\-/]/g, "").toUpperCase();
}

export function ustIdLand(ustId: string): string {
  const id = normalizeUstId(ustId);
  return id.slice(0, 2);
}

export function isUstIdSyntaxOk(raw: string | null | undefined): boolean {
  const id = normalizeUstId(raw);
  if (id.length < 4 || id.length > 14) return false;
  const land = id.slice(0, 2);
  if (!/^[A-Z]{2}$/.test(land)) return false;
  const re = SYNTAX[land];
  if (re) return re.test(id);
  return /^[A-Z]{2}[A-Z0-9]{2,12}$/.test(id);
}

export function isDeutscheUstId(raw: string | null | undefined): boolean {
  return /^DE\d{9}$/.test(normalizeUstId(raw));
}

export function isBzstAnfragbareUstId(raw: string | null | undefined): boolean {
  const id = normalizeUstId(raw);
  if (!isUstIdSyntaxOk(id)) return false;
  return BZST_ANGEFRAGTE_LAENDER.has(ustIdLand(id));
}

export type EigeneUstIdLage =
  | { art: "leer" }
  | { art: "syntax_ungueltig"; normalisiert: string }
  | { art: "nicht_de"; normalisiert: string; land: string }
  | { art: "de_syntax_ok"; normalisiert: string };

export function eigeneUstIdLage(raw: string | null | undefined): EigeneUstIdLage {
  const id = normalizeUstId(raw);
  if (!id) return { art: "leer" };
  if (ustIdLand(id) !== "DE") {
    return { art: "nicht_de", normalisiert: id, land: ustIdLand(id) };
  }
  if (!isDeutscheUstId(id)) {
    return { art: "syntax_ungueltig", normalisiert: id };
  }
  return { art: "de_syntax_ok", normalisiert: id };
}

export type FremdeUstIdLage =
  | { art: "leer" }
  | { art: "syntax_ungueltig"; normalisiert: string }
  | { art: "de"; normalisiert: string }
  | { art: "nicht_eu"; normalisiert: string; land: string }
  | { art: "eu_ok"; normalisiert: string; land: string };

export function fremdeUstIdLage(raw: string | null | undefined): FremdeUstIdLage {
  const id = normalizeUstId(raw);
  if (!id) return { art: "leer" };
  const land = ustIdLand(id);
  if (land === "DE") return { art: "de", normalisiert: id };
  if (land === "GR") {
    return { art: "syntax_ungueltig", normalisiert: id };
  }
  if (!isUstIdSyntaxOk(id)) {
    return { art: "syntax_ungueltig", normalisiert: id };
  }
  if (!BZST_ANGEFRAGTE_LAENDER.has(land)) {
    return { art: "nicht_eu", normalisiert: id, land };
  }
  return { art: "eu_ok", normalisiert: id, land };
}
