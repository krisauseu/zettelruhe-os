# Session 2026-08-15 — USt-IdNr.-Validierung (BZSt)

## Done

Eigene USt-IdNr. an der Firma, fremde am Kontakt, auf Klick Bestätigung beim BZSt. Nur was das Auslandsverfahren hergibt. Kein Versand, keine Zertifikate, keine Abgabe.

### Schnitt

- Kontakt bekommt `ust_id` (ADR-0020 hatte das Feld bewusst hierher verschoben). Firma.ust_id bleibt die anfragende Nummer.
- Prüfung nur auf ausdrücklichen Klick, nur aktive Firma (`session.firmaId`). Ergebnis = Schnappschuss (`ust_id_pruefungen`), kein Dauer-„gültig“ am Stamm.
- BZSt eVatR REST (`POST /v1/abfrage`): einfach oder qualifiziert. 4xx/5xx mit `status` sind Fachantworten. XML-RPC ist tot.
- Ehrlich: bestätigt ausländische EU-Nummern gegenüber einer eigenen DE-Nummer. DE→DE und isolierte eigene DE-Nummer: nicht dieses Verfahren (`evatr-0006` / Syntax-Lage).
- evatr-2005 bei Kontakt-Prüfung: eigene Nummer zum Anfragezeitpunkt nicht gültig — sichtbar, kein Stamm-Stempel.
- Kleinunternehmerregelung: USt-Id darf stehen; USt- und ZM-Übersicht bleiben nicht relevant.
- ZM: Stamm vor Notiz; Schnappschuss nur als Zeitpunkt, nicht als Gültigkeit zum Umsatz. Art weiter nicht geraten. Format `zettelruhe-zm-uebersicht-v2`.
- E-Rechnung-Empfang: Match über Stamm-USt-Id, Notiz Fallback. Beleg-Notiz behält die Id der Datei. Kein stilles Schreiben auf den Kontakt, keine festgeschriebenen Belege.
- Multi-Firma: nur `session.firmaId`. Kein ELSTER.

### Umsetzung

- ADR-0021. Migration `ust_id` am Kontakt + Collection `ust_id_pruefungen`.
- Modul `ustid` (Format, Gate, dünner REST-Client, Schnappschüsse).
- UI: Kontakt prüfen; Firma zeigt Syntax-Lage und letzte Verwendung als Anfragende.

### Tests

348 Unit-Tests + `tsc` grün.

### Nachzug — `/app/firma` 500 nach Speichern mit USt-IdNr.

Speichern selbst war durch (`updateFirma` + Redirect `?saved=1`). Die Seite las danach `ust_id_pruefungen` mit `sort=-created`. Die Collection hatte kein Autodate-`created` (PB 0.23+ ergänzt es nicht still) → PocketBase 400, ungefangen, 500. Ohne USt-IdNr. entfiel der Read.

Fix: Sortierung nach `anfrage_zeitpunkt`; `created`/`updated` nachgezogen (`1730001401`); Firma/Kontakt fangen Lesefehler ab und zeigen `SCHNAPPSCHUSS_NICHT_LESBAR` (Stammdaten bleiben unabhängig). ZM schluckt denselben Read.

Nachtest über Caddy: Login, Form-POST mit USt-IdNr. → 303 `?saved=1` → 200, Feld steht, Lage-Hinweis ehrlich, kein 500. Browser durch kf 2026-08-15: Eingabe und Speichern ohne Fehler. BZSt-Klick lokal nicht prüfbar (kein HTTPS). Server-Nachtest der Prüfung nach Abschluss von Meilenstein 2.

## Nicht angefasst

- E-Rechnungs-Versand, Multi-User, Einladen, Rechte-UI
- UStVA-Nachzug, ZM-Art raten
- Inländische USt-Id-Bestätigung (anderes BZSt-Verfahren)
- Open Decisions (Journal-Nachzug Zahlungen, Kassenbuch aus Barzahlung, MT940, robustes ZUGFeRD-PDF)
- M1-15 (`NEXT_REDIRECT` nach Bank-CSV / Beleg-Entwurf)

## Next step

E-Rechnungs-Versand robust (Profile, Validierung, Fehlerfeedback) — neuer Chat. Server-Nachtest M2 inkl. BZSt erst danach, wenn die Instanz HTTPS hat.
