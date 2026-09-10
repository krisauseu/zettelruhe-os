/** Unverbindlicher Vorschlag, niemals eine Klassifikation bestehender Belege. */
export const STEUERBEHANDLUNGEN = {
  bisherig: "Bisherige Behandlung / Rechnungs-USt",
  eu_dienstleistung: "EU-Dienstleistung · Reverse Charge",
  drittland_dienstleistung: "Drittlandsdienstleistung · Reverse Charge",
} as const;
export type Steuerbehandlung = keyof typeof STEUERBEHANDLUNGEN;
export type AusgabenSteuerstandard = Steuerbehandlung | "";
export function parseSteuerstandard(value: string): AusgabenSteuerstandard {
  if (value === "" || Object.hasOwn(STEUERBEHANDLUNGEN, value)) return value as AusgabenSteuerstandard;
  throw new Error("Unbekannter Ausgaben-Steuerstandard.");
}
