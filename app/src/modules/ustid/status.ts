/**
 * Statusmeldungen der BZSt-eVatR-REST-API (Stand Abfrage 2026-08-15).
 * Quelle: https://api.evatr.vies.bzst.de/v1/info/statusmeldungen
 * Kein Dauer-Stempel — Texte beschreiben den Anfragezeitpunkt.
 */

export const EVATR_STATUS_MELDUNGEN: Record<string, string> = {
  "evatr-0000":
    "Die angefragte USt-IdNr. ist zum Anfragezeitpunkt gültig.",
  "evatr-0002": "Mindestens eins der Pflichtfelder ist nicht besetzt.",
  "evatr-0003":
    "Die angefragte USt-IdNr. ist zum Anfragezeitpunkt gültig. Mindestens eines der Pflichtfelder für eine qualifizierte Bestätigungsanfrage ist nicht besetzt.",
  "evatr-0004":
    "Die anfragende DE USt-IdNr. ist syntaktisch falsch. Sie passt nicht in das deutsche Erzeugungsschema.",
  "evatr-0005": "Die angegebene angefragte USt-IdNr. ist syntaktisch falsch.",
  "evatr-0006":
    "Die anfragende DE USt-IdNr. ist nicht berechtigt eine DE USt-IdNr. anzufragen.",
  "evatr-0007": "Fehlerhafter Aufruf.",
  "evatr-0008":
    "Die maximale Anzahl von qualifizierten Bestätigungsabfragen für diese Session wurde erreicht. Bitte starten Sie erneut mit einer einfachen Bestätigungsabfrage.",
  "evatr-0011":
    "Eine Bearbeitung Ihrer Anfrage ist zurzeit nicht möglich. Bitte versuchen Sie es später noch einmal.",
  "evatr-0012":
    "Die angefragte USt-IdNr. ist syntaktisch falsch. Sie passt nicht in das Erzeugungsschema.",
  "evatr-0013":
    "Eine Bearbeitung Ihrer Anfrage ist zurzeit nicht möglich. Bitte versuchen Sie es später noch einmal.",
  "evatr-1001":
    "Eine Bearbeitung Ihrer Anfrage ist zurzeit nicht möglich. Bitte versuchen Sie es später noch einmal.",
  "evatr-1002":
    "Eine Bearbeitung Ihrer Anfrage ist zurzeit nicht möglich. Bitte versuchen Sie es später noch einmal.",
  "evatr-1003":
    "Eine Bearbeitung Ihrer Anfrage ist zurzeit nicht möglich. Bitte versuchen Sie es später noch einmal.",
  "evatr-1004":
    "Eine Bearbeitung Ihrer Anfrage ist zurzeit nicht möglich. Bitte versuchen Sie es später noch einmal.",
  "evatr-2001":
    "Die angefragte USt-IdNr. ist zum Anfragezeitpunkt nicht vergeben.",
  "evatr-2002":
    "Die angefragte USt-IdNr. ist zum Anfragezeitpunkt nicht gültig. Sie ist erst gültig ab dem Datum im Feld gueltigAb.",
  "evatr-2003":
    "Das angegebene Länderkennzeichen der angefragten USt-IdNr. ist nicht gültig.",
  "evatr-2004":
    "Eine Bearbeitung Ihrer Anfrage ist zurzeit nicht möglich. Bitte versuchen Sie es später noch einmal.",
  "evatr-2005":
    "Die angegebene eigene DE USt-IdNr. ist zum Anfragezeitpunkt nicht gültig.",
  "evatr-2006":
    "Die angefragte USt-IdNr. ist zum Anfragezeitpunkt nicht gültig. Sie war gültig im Zeitraum, der durch die Werte in den Feldern gueltigAb und gueltigBis beschrieben ist.",
  "evatr-2007":
    "Bei der Verarbeitung der Daten aus dem angefragten EU-Mitgliedstaat ist ein Fehler aufgetreten. Ihre Anfrage kann deshalb nicht bearbeitet werden.",
  "evatr-2008":
    "Die angefragte USt-IdNr. ist zum Anfragezeitpunkt gültig. Für die qualifizierte Bestätigungsanfrage liegt eine Besonderheit vor. Für Rückfragen wenden Sie sich an das BZSt.",
  "evatr-2011":
    "Eine Bearbeitung Ihrer Anfrage ist zurzeit nicht möglich. Bitte versuchen Sie es später noch einmal.",
  "evatr-3011":
    "Eine Bearbeitung Ihrer Anfrage ist zurzeit nicht möglich. Bitte versuchen Sie es später noch einmal.",
};

export const QUALIFIZIERT_ERGEBNIS: Record<"A" | "B" | "C" | "D", string> = {
  A: "Die Angaben stimmen mit den registrierten Daten überein.",
  B: "Die Angaben stimmen mit den registrierten Daten nicht überein.",
  C: "Die Angaben wurden nicht angefragt.",
  D: "Die Angaben wurden vom EU-Mitgliedstaat nicht mitgeteilt.",
};

export function evatrStatusMeldung(status: string): string {
  return (
    EVATR_STATUS_MELDUNGEN[status] ??
    `Unbekannter BZSt-Status ${status || "—"}.`
  );
}

/** evatr-0000 und evatr-2008: angefragte Nummer zum Anfragezeitpunkt gültig. */
export function istGueltigZumAnfragezeitpunkt(status: string): boolean {
  return status === "evatr-0000" || status === "evatr-2008";
}

/** Die eigene DE-Nummer als Anfragende wurde abgelehnt. */
export function istAnfragendeAbgelehnt(status: string): boolean {
  return status === "evatr-0004" || status === "evatr-2005";
}

export function qualifiziertErgebnisLabel(code: string | undefined): string {
  if (code === "A" || code === "B" || code === "C" || code === "D") {
    return QUALIFIZIERT_ERGEBNIS[code];
  }
  return "";
}
