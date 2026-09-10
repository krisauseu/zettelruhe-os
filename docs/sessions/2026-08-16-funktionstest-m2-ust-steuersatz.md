# Session 2026-08-16 — Funktionstest M2 auswerten + M2-01 USt-Satz

## Done

M2 lokal und auf dem Server (HTTPS) durch kf: **bestanden mit Mängeln**, ein Blocker.

Auswertung: [`issues/ergebnis-funktionstest-m2.md`](../issues/ergebnis-funktionstest-m2.md). Screenshot: [Historischer Beleg aus Datenschutzgründen aus dem Releasebestand entfernt; siehe Materialprüfung](../issues/release-materialpruefung-2026-09-10.md).

### M2-01 (Blocker)

Festgeschriebene Rechnung unter Regelbesteuerung: Satz in den Positionen gewählt, Beträge richtig (95,00 € netto / 18,05 € USt), Journal-`steuersatz` leer. USt-Übersicht „ohne Satz“, Kz 81 = 0, ELSTER-XML ohne Umsatz.

- Schreiben: `einheitlicherSteuersatz` aus den Positionen → Journal bei Festschreibung.
- Lesen: USt-Übersicht/UStVA inferiert 19/7 aus Beträgen, wenn das Feld leer und die Rundung exakt trifft. Journal unverändert.
- Gemischt bleibt leer; 0 % wird nicht geraten; Kleinunternehmerregelung unverändert ohne Satz.

Keine stillen Journal-Updates. Setup-`verified`, Layout, Logo/Favicon, Multi-User, Open Decisions, Hybrid-PDF nicht angefasst. Commit/Push auf ausdrückliche Bitte.

### Tests

370 Unit-Tests + `tsc` grün.

## Nicht angefasst

- Commit/Push
- Gemischte Sätze auf einer Rechnung (weiter eine Journal-Zeile, Satz leer)
- DATEV-BU-Schlüssel für Alt-Zeilen ohne Satz
- Follow-ups aus Protokoll Abschnitt 9

## Nachtest M2-01 (kf, 2026-08-16)

Deployed und nachgetestet auf `app.zettelruhe.de` (HEAD `13da9e7`). Freigabe **M2 Alltag trägt**. Blocker keine. Meilenstein 2 **abgeschlossen**. Zahlung erzeugt in v1 kein Journal.

## Next step

Setup-verified (eigener Schnitt), danach Dokumenten-Layout, dann Logo/Favicon. Open Decisions / Multi-User / Ist-Versteuerung / Hybrid-PDF weiter separat.
