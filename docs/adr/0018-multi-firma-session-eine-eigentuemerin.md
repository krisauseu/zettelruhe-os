# Eine Eigentümer:in, mehrere Firmen in der Session

Die Instanz hat eine:n Eigentümer:in. Weitere Firmen anlegen und in der Session wechseln ist erlaubt; Isolation bleibt die `firma`-Spalte plus `session.firmaId`. `users.firma` bleibt 1:1 und speichert die zuletzt aktive Firma (Login-Landung). Keine Mitgliedschaftstabelle, kein Einladen, keine zweite Rolle; der Setup-Wizard bleibt Erst-Firma plus Erst-User. Begründung: Kleinunternehmerregelung und Regelbesteuerung in einer Instanz testen, ohne zweiten Compose-Stack. Multi-User kommt später.

## Alternatives considered

- Mitgliedschaftstabelle User↔Firma — Multi-User-Schnitt, nicht nötig solange es eine Eigentümer:in gibt.
- `users.firma` auf Mehrfachrelation — bricht die 1:1-Landung und sieht nach Rechten aus.
- Zweiter Compose-Stack pro Steuer-Modus — der Anlass für diesen Keil, kein Alltag.

## Standverweis vom 2026-09-10

Die damalige Beschränkung auf eine Eigentümer:in ohne Mitgliedschaften ist durch [ADR-0025](0025-multi-user-grobe-rechte.md) abgelöst. Firmenwechsel und zuletzt aktive Firma bleiben bestehen.
