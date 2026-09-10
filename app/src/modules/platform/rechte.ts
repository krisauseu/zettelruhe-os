/**
 * Grobe Rechte an der Mitgliedschaft (ADR-0025).
 * Reine Invarianten, kein I/O.
 */

export const MITGLIEDSCHAFT_ROLLEN = [
  "eigentuemer",
  "bearbeiten",
  "lesen",
] as const;

export type MitgliedschaftRolle = (typeof MITGLIEDSCHAFT_ROLLEN)[number];

export type Recht = "lesen" | "schreiben" | "verwalten";

export const INSTANZ_ROLLE_EIGENTUEMER = "eigentuemer";
export const INSTANZ_ROLLE_NUTZER = "nutzer";

export const KEINE_AENDERUNG_ERROR = "Keine Berechtigung zum Ändern.";
export const KEINE_VERWALTUNG_ERROR = "Keine Berechtigung zum Verwalten.";
export const KEINE_FIRMA_ANLEGEN_ERROR =
  "Nur die Instanz-Eigentümer:in kann weitere Firmen anlegen.";
export const KEIN_FIRMA_ZUGANG_ERROR = "Kein Zugang zu dieser Firma.";
export const KEIN_FIRMA_MITGLIED_ERROR = "Kein Zugang zu einer Firma.";
export const BEREITS_MITGLIED_ERROR =
  "Diese Person ist bereits Mitglied dieser Firma.";
export const LETZTE_EIGENTUEMERIN_ERROR =
  "Die letzte Eigentümer:in der Firma kann nicht entfernt oder herabgestuft werden.";
export const EIGENE_ROLLE_LETZTE_ERROR =
  "Die eigene Rolle als letzte Eigentümer:in kann nicht geändert werden.";
export const EIGENES_PASSWORT_HIER_NICHT_ERROR =
  "Das eigene Passwort wird hier nicht geändert.";
export const FALSCHES_ALTES_PASSWORT_ERROR =
  "Altes Passwort ist nicht korrekt.";
export const PASSWOERTER_STIMMEN_NICHT_ERROR =
  "Passwörter stimmen nicht überein.";
export const PASSWORT_UNVERAENDERT_ERROR =
  "Das neue Passwort muss sich vom alten unterscheiden.";

export function isMitgliedschaftRolle(
  value: string,
): value is MitgliedschaftRolle {
  return (MITGLIEDSCHAFT_ROLLEN as readonly string[]).includes(value);
}

export function hatRecht(
  rolle: MitgliedschaftRolle,
  recht: Recht,
): boolean {
  if (recht === "lesen") return true;
  if (recht === "schreiben") {
    return rolle === "bearbeiten" || rolle === "eigentuemer";
  }
  return rolle === "eigentuemer";
}

export function istInstanzEigentuemer(usersRole: string): boolean {
  return usersRole === INSTANZ_ROLLE_EIGENTUEMER;
}

export function validateEinladenInput(input: {
  name: string;
  email: string;
  password: string;
  rolle: string;
  bestehendesKonto: boolean;
}): {
  name: string;
  email: string;
  password: string;
  rolle: MitgliedschaftRolle;
} {
  const name = (input.name ?? "").trim().replace(/\s+/g, " ");
  const email = (input.email ?? "").trim().toLowerCase();
  const password = input.password ?? "";

  if (!name) {
    throw new Error("Name ist erforderlich.");
  }
  if (name.length > 200) {
    throw new Error("Name ist zu lang (max. 200 Zeichen).");
  }
  if (!email || !email.includes("@") || email.length > 200) {
    throw new Error("Eine gültige E-Mail-Adresse ist erforderlich.");
  }
  if (!isMitgliedschaftRolle(input.rolle)) {
    throw new Error("Ungültige Rolle.");
  }
  if (!input.bestehendesKonto) {
    if (password.length < 8) {
      throw new Error("Passwort muss mindestens 8 Zeichen haben.");
    }
  } else if (password.length > 0 && password.length < 8) {
    throw new Error("Passwort muss mindestens 8 Zeichen haben.");
  }

  return { name, email, password, rolle: input.rolle };
}

export function validateRollenwechsel(input: {
  handelndeUserId: string;
  zielUserId: string;
  bisherigeRolle: MitgliedschaftRolle;
  neueRolle: string;
  eigentuemerAnzahl: number;
}): MitgliedschaftRolle {
  if (!isMitgliedschaftRolle(input.neueRolle)) {
    throw new Error("Ungültige Rolle.");
  }
  if (input.bisherigeRolle === input.neueRolle) {
    return input.neueRolle;
  }
  const stuftLetzteHerab =
    input.bisherigeRolle === "eigentuemer" &&
    input.neueRolle !== "eigentuemer" &&
    input.eigentuemerAnzahl <= 1;
  if (stuftLetzteHerab) {
    if (input.handelndeUserId === input.zielUserId) {
      throw new Error(EIGENE_ROLLE_LETZTE_ERROR);
    }
    throw new Error(LETZTE_EIGENTUEMERIN_ERROR);
  }
  return input.neueRolle;
}

export function assertKannMitgliedschaftEntfernen(input: {
  handelndeUserId: string;
  zielUserId: string;
  zielRolle: MitgliedschaftRolle;
  eigentuemerAnzahl: number;
}): void {
  if (input.zielRolle === "eigentuemer" && input.eigentuemerAnzahl <= 1) {
    throw new Error(LETZTE_EIGENTUEMERIN_ERROR);
  }
}

export function validateNeuesPasswort(password: string): string {
  if (password.length < 8) {
    throw new Error("Passwort muss mindestens 8 Zeichen haben.");
  }
  return password;
}

/** Fremdes Passwort unter /app/nutzer — nie das eigene. */
export function assertFremdesPasswortZiel(
  handelndeUserId: string,
  zielUserId: string,
): void {
  if (handelndeUserId === zielUserId) {
    throw new Error(EIGENES_PASSWORT_HIER_NICHT_ERROR);
  }
}

/** Eigenes Passwort: alt + neu + Bestätigung, mindestens 8 Zeichen. */
export function validateEigenesPasswortAendern(input: {
  altesPasswort: string;
  neuesPasswort: string;
  neuesPasswortConfirm: string;
}): { altesPasswort: string; neuesPasswort: string } {
  const altesPasswort = (input.altesPasswort ?? "").trim();
  const neuesPasswort = (input.neuesPasswort ?? "").trim();
  const confirm = (input.neuesPasswortConfirm ?? "").trim();

  if (!altesPasswort) {
    throw new Error("Altes Passwort ist erforderlich.");
  }
  validateNeuesPasswort(neuesPasswort);
  if (neuesPasswort !== confirm) {
    throw new Error(PASSWOERTER_STIMMEN_NICHT_ERROR);
  }
  if (neuesPasswort === altesPasswort) {
    throw new Error(PASSWORT_UNVERAENDERT_ERROR);
  }
  return { altesPasswort, neuesPasswort };
}
