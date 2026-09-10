# Funktionstest Meilenstein 1 — Zettelruhe

> Historisches Meilensteinprotokoll vom August 2026. Die damaligen Ergebnisse
> bleiben erhalten. Für einen heutigen Lauf gelten die Aktualisierungen im
> [Nachtest nach M2](funktionstest-m2.md#nachtest-nach-m2-stand-2026-09-10).
> Insbesondere „Zahlung erzeugt kein Journal“ ist durch ADR-0024 abgelöst;
> Mitgliedschaften/Rollen gelten seit ADR-0025 und § 19 hat einen RC-Arbeitsfall.
> Alte Prüferwartungen und Freigabehäkchen sind kein Nachweis für heutige Features.

Checkliste vor **Meilenstein 2**. Ableitung: v1-Happy-Path (`CONTEXT.md`), Feature-Roadmap, Betrieb (`docs/betrieb.md`).

**Ziel:** Manuell verifizieren, dass die self-hosted Solo-Instanz im Alltag trägt — nicht Feature-Parität, nicht M2.

M2-Keile: eigene Checkliste [`funktionstest-m2.md`](./funktionstest-m2.md) — diese M1-Liste nicht zur M2-Liste umbauen.

| Feld | Eintrag |
|------|---------|
| Instanz / Host | lokal (self-hosted) |
| Datum | 2026-08-14 |
| Steuer-Modus getestet | ☑ Kleinunternehmerregelung · ☐ Regelbesteuerung (Ist) |
| Tester:in | kf |
| Ergebnis gesamt | ☐ bestanden · ☑ bestanden mit Mängeln · ☐ nicht bestanden |

**Legende:** `[ ]` offen · `[x]` ok · `[~]` ok mit Hinweis · `[!]` Fehler (kurz notieren)

**Erwartung zu Zahlungen (ehrlich):** Manuelle/Bank-Zahlungen erzeugen **kein** Journal. EÜR/DATEV/USt basieren auf dem **Buchungsjournal**. Offene Posten kommen aus Rechnungen/Zahlungen.

Fixtures: `app/src/modules/einvoice/fixtures/` (XRechnung/ZUGFeRD-Minimal).

---

## 0. Vorbereitung

- [ ] `cp .env.example .env` — echte Secrets, **keine** `change-me`-Werte wenn „Prod-like“
- [ ] `SESSION_SECRET` ≥ 32 Zeichen Zufall; `PB_SUPERUSER_*` stark und einzigartig
- [ ] `APP_URL` = erreichbare URL (lokal `http://localhost`, sonst Host ohne trailing slash)
- [ ] `docker compose up --build -d`
- [ ] `docker compose ps` → next + pocketbase **healthy**, caddy up
- [ ] `curl -sS "$APP_URL/health"` → `"ok":true`, `"pocketbase":"ok"` (Warnings bei Platzhaltern ok für Dev)
- [ ] Browser: App über Caddy (`APP_URL`), nicht nur Port 3000

**Smoke-Befehle (optional):**

```bash
docker compose ps
curl -sS http://localhost/health
curl -sSI http://localhost/app   # erwartet 307 → /login
```

---

## 1. Fundament: Setup, Auth, Shell

- [ ] Erster Besuch: Setup-Wizard **oder** Login (wenn schon eingerichtet)
- [ ] Setup (leere Instanz): Eigentümer:in, Firma, **Steuer-Modus**, SKR → Redirect `/app`
- [ ] Abmelden → Login mit richtigen Daten → `/app`
- [ ] Login falsch → de-DE Fehlermeldung, keine Session
- [ ] Geschützte Routen ohne Cookie → Redirect `/login` (`/app`, `/app/suche`, …)
- [ ] Sidebar: Gruppen lesbar; Theme-Toggle; Abmelden
- [ ] **Firma** (`/app/firma`): Stammdaten speichern (Name, Adresse, Steuer-Modus-Anzeige)
- [ ] Nummernkreise: Entwürfe **ohne** Nummernverbrauch (später bei Angebot/Rechnung prüfen)

---

## 2. Stammdaten: Kontakte & Katalog

### Kontakte

- [ ] Leerer State verständlich + Link „anlegen“
- [ ] Kund:in anlegen (Name, Adresse, E-Mail, optional IBAN)
- [ ] Lieferant:in anlegen
- [ ] Filter/Suche in der Liste
- [ ] Detail: Ansprechpartner light anlegen
- [ ] CSV-Export lädt Datei
- [ ] CSV-Import (Template oder Export-Runde) ohne Datenverlust der Pflichtfelder

### Katalog

- [ ] Position anlegen (Bezeichnung, Preis, Einheit; USt nur sinnvoll bei Regelbesteuerung)
- [ ] Bearbeiten / Liste / Filter
- [ ] CSV-Export / optional Import

---

## 3. Arbeit: Projekte, Zeiten, Fahrten

- [ ] Projekt optional unter Kund:in anlegen
- [ ] Zeiteintrag: Kund:in Pflicht, Dauer, Status abrechenbar
- [ ] Fahrt: km, Default abrechenbar, optional Projekt
- [ ] 1-Klick-Übernahme offener Zeiten/Fahrten → **Rechnungs-Entwurf** (kein Journal bei Zeit/Fahrt allein)
- [ ] Status nach Übernahme plausibel (z. B. abgerechnet / nicht mehr offen)

---

## 4. Verkauf: Angebot → Rechnung

### Angebot

- [ ] Entwurf mit Positionen (Menge, Preis); **keine** Angebotsnummer im Entwurf
- [ ] Entwurf: PDF-Vorschau (Wasserzeichen „Entwurf“, keine Nummer)
- [ ] Senden → Nummer + Original-PDF **ohne SMTP**; PDF öffnen/drucken; E-Mail optional
- [ ] Steuer-Modus: Kleinunternehmer → §-19-Hinweis, **ohne** USt-Zeilen; Regelbesteuerung → USt-Ausweis
- [ ] Status light: Gesendet → Angenommen (o. Ä.)
- [ ] Angenommenes Angebot → Rechnungs-Entwurf übernehmen

### Rechnung

- [ ] Freie Rechnung als Entwurf; Positionen; **keine** Rechnungsnummer im Entwurf
- [ ] Entwurf: PDF-Vorschau (Wasserzeichen „Entwurf“, keine Nummer, kein Journal)
- [ ] Festschreiben → Nummer + Original-PDF + **Journal**-Zeile (`quelle_typ` Rechnung)
- [ ] PDF: Logo/Pflichtangaben light; bei Kleinunternehmer §-19; nach Festschreibung nur Original (keine Entwurfsvorschau)
- [ ] Entwurf nach Festschreibung **nicht** still änderbar (Immutability)
- [ ] Liste Filter (Status, Datum, Suche)

### Wiederkehrend (light)

- [ ] Vorlage anlegen (Rhythmus, Positionen, Kund:in)
- [ ] Manuell erzeugen → **Rechnungs-Entwurf** (kein Auto-Festschreiben)
- [ ] Optional: Job-Tick abwarten oder manuell anstoßen (wenn SMTP/Jobs konfiguriert)

### SMTP (optional, wenn `SMTP_*` gesetzt)

- [ ] Rechnung/Angebot per E-Mail; ohne SMTP: klare de-DE-Meldung

---

## 5. Zahlungen & offene Posten

- [ ] Festgeschriebene offene Rechnung unter **Zahlungen** / Offene Posten
- [ ] Teilzahlung erfassen → Status **teilbezahlt**, offener Betrag stimmt
- [ ] Restzahlung → **bezahlt**
- [ ] **Kein** neuer Journal-Eintrag allein durch Zahlung (Stichprobe Journal)
- [ ] Zahlungserinnerung manuell light (UI), falls vorhanden — kein automatischer Mahnlauf erwartet

---

## 6. Belege, Kasse, Journal

### Belege

- [ ] Entwurf mit Datei (PDF/Bild), Kategorie, Beträge
- [ ] Festschreiben → Belegnummer + Journal; Datei danach immutable
- [ ] Datei-Download über App-Route
- [ ] Stille Änderung nach Festschreibung abgelehnt / UI read-only

### Kassenbuch

- [ ] Bareinnahme anlegen → Belegnummer + Saldo + Journal
- [ ] Barausgabe; Saldo ≥ 0 (Negativsaldo abgelehnt)
- [ ] Storno light → Gegenbuchung, Original bleibt
- [ ] Hinweis: Barzahlung an Rechnung ≠ automatischer Kassenbuch-Eintrag

### Journal

- [ ] Liste zeigt Beleg-, Rechnungs-, Kassen-Buchungen
- [ ] Manuelle Buchung = sofort festgeschrieben
- [ ] Storno → Gegenbuchung mit Bezug; kein Update/Delete am Original
- [ ] Filter Datum / Suche light

---

## 7. Bank & Matching

- [x] Bankkonto anlegen — Nachtest 2026-08-15: Sparkasse aus dem Funktionstest vorhanden und sichtbar
- [x] CSV-Import (de-DE) → Bewegungen sichtbar; Idempotenz (gleicher Import erneut ohne Duplikat-Chaos) — 2 Zeilen neu, Re-Import 0 neu / 2 Duplikat; Bestand bleibt 2. Der damalige M1-15-Redirectfehler ist mit TP-023 behoben.
- [x] Match-Vorschlag gegen offene Rechnung → Matching erzeugt Zahlung (Status Rechnung) — R-0004, Score 100, Status **bezahlt**
- [x] **Kein** Journal allein durch Match — Journal 9 → 9
- [x] MT940: nicht als v1-Pflicht erwarten (Follow-up)

---

## 8. E-Rechnung Empfang

- [x] Upload Fixture XRechnung (`fixtures/xrechnung-minimal.xml`) → Original archiviert — Nachtest 2026-08-15, Download bytegleich
- [x] Parse-Vorschau; optional Beleg-Entwurf — XR-2026-0042 geparst; Entwurf ohne Journal. Der damalige M1-15-Redirectfehler ist mit TP-023 behoben.
- [~] Kleinunternehmer: keine Vorsteuer-Vorbefüllung; Regelbesteuerung: USt wo geparst — Kleinunternehmer geprüft (Beleg USt 0,00 / Netto = Brutto). Regelbesteuerung auf dieser Instanz nicht nachgetestet
- [x] Original-Download — `xrechnung-minimal.xml`, `text/xml`
- [x] Optional ZUGFeRD-CII-Fixture; bei PDF-only light: Fehler/Hinweis ok, Original bleibt — `zugferd-cii-minimal.xml` Parse ok, Original bytegleich

---

## 9. Auswertungen, Export, Suche

- [ ] **Übersicht** (`/app`): Kennzahlen Monat; Schnellstart-Links
- [ ] **Auswertungen / EÜR**: Perioden; Summen plausibel zu Journal
- [ ] **USt-Übersicht**: nur Regelbesteuerung nutzbar; unter Kleinunternehmer klarer Hinweis
- [ ] **Export DATEV light** CSV lädt (`zettelruhe-datev-csv-light-v1`, kein Zertifizierungs-Claim)
- [ ] Journal-CSV (Semikolon, UTF-8)
- [ ] Belegarchiv-ZIP (Metadaten + Dateien festgeschriebener Belege)
- [ ] Downloads unter `/app/export/*`, **nicht** unter `/api/*`
- [ ] **Suche** (`/app/suche`): Treffer Kontakt / Rechnung / Beleg / Angebot (min. 2 Zeichen)

---

## 10. GoBD / Immutability (Stichproben)

- [ ] Festgeschriebene Journal-Zeile: kein Edit/Delete in der UI
- [ ] Festgeschriebene Belegdatei / Rechnungs-PDF: keine stille Ersetzung
- [ ] Korrektur nur Storno/Gegenbuchung bzw. neues Dokument
- [ ] `docs/verfahrensdokumentation.md` gelesen; individuelle Felder notiert (optional)

---

## 11. Betrieb, Backup, Security light

Details: [`docs/betrieb.md`](./betrieb.md).

### Health & Header

- [ ] `/health` erreichbar ohne Login
- [ ] Response-Header u. a. `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (über Caddy)
- [ ] PB-Admin `/_/` nur bewusst erreichbar (lokal ok; Prod: nicht öffentlich)

### Backup

- [ ] Stack stoppen (oder bewusstes Online-Backup)
- [ ] Volume `zettelruhe_pb_data` als tar sichern (Befehl aus `betrieb.md`)
- [ ] `.env` separat kopiert

### Restore (mind. einmal)

- [ ] Restore-Test in **frischem** Volume oder zweiter Umgebung (Prod-Daten nicht zerstören)
- [ ] Nach Restore: Login, Stichprobe Journal, Beleg-PDF/Datei, eine Rechnung
- [ ] Datum des Restore-Tests in Verfahrensdoku notieren

### Secrets

- [ ] `.env` nicht im Git; Rechte am Host angemessen
- [ ] Superuser ≠ App-Login der Eigentümer:in verstanden

---

## 12. Regression / UX light

- [ ] Leere Listen: sinnvolle de-DE-Texte + Anlege-Links (Kontakte, Rechnungen, Belege, …)
- [ ] Mobile Viewport: Sidebar/Hauptinhalt bedienbar genug (kein Profi-PWA-Anspruch)
- [ ] Dark Mode: Lesbarkeit Formulare/Tabellen
- [ ] Keine englischen Roh-Fehler auf Happy-Path-Aktionen

---

## 13. Bewusst nicht testen (v1 / M2)

Nicht als Fehler werten:

- ELSTER-Versand, UStVA-Abgabe, ZM-Abgabe, USt-IdNr.-API  
- E-Rechnungs-**Versand**  
- PSD2, OCR, REST-API, Kundenportal, automatischer Mahnlauf  
- Multi-User, Soll-Versteuerung, Abschlagskette  
  (Multi-Firma dünn ist nach M1 gebaut, ADR-0018 — nicht Teil dieser M1-Checkliste)  
- GoBD-/DATEV-**Zertifikat**  
- Journal-Eintrag **nur** durch Zahlung (Open Decision)  
- MT940 als Pflicht

---

## Ergebnis & Freigabe

### Kritische Mängel (blockieren M2-Start nur wenn Alltag unbenutzbar)

| ID | Modul / Route | Beschreibung | Schwere |
|----|---------------|--------------|---------|
| M1-01 | Auswertungen / Journal-Storno | Storno einer Ausgabe wurde als Einnahme addiert; Storno einer Rechnung als Ausgabe. **Behoben im Nachzug 2026-08-14** (EÜR/BWA/USt mindern die Ursprungskategorie). | kritisch |
| M1-02 | `/app/rechnungen` | Stornierte Rechnungen behielten Status „Bezahlt“. **Behoben:** Status `storniert` bei Journal- und Rechnungs-Storno. | hoch |
| M1-03 | Setup / `/app/firma` | Anschrift nicht im Setup; Firmendaten und Nummernkreise nicht nachträglich editierbar. **Behoben.** | hoch |

### Hinweise / Nice-to-have

| ID | Beschreibung |
|----|--------------|
| M1-04 | Kontakt-CSV ohne Ansprechpartner — **behoben** (Export löst Relation auf; Import legt ersten AP an). |
| M1-05 | Keine Toasts nach Speichern — **behoben** (globales Flash-Toast). |
| M1-06 | Keine Storno-Sicherheitsabfrage — **behoben** (Bestätigungs-Modal). |
| M1-07 | Zeiterfassung 15-Min-Raster — **behoben**. |
| M1-08 | Katalog-Einheiten-Dropdown — **behoben**. |
| M1-09 | Steuer-Modus-Wechsel nachträglich — **behoben** (`/app/firma`, mit Bestätigung). |
| M1-10 | Dokumenten-Layout & Branding (Logo, Farben, Textbausteine) — **behoben** (`/app/firma`, gilt für neue PDFs). |
| M1-11 | Bank-CSV-Import und E-Rechnung-Empfang — **nachgetestet 2026-08-15**, fachlich ok (siehe Abschn. 7–8). |
| M1-15 | **Behoben mit TP-023.** Bankimport und Beleg-Entwurf aus E-Rechnung führen den Erfolgs-Redirect außerhalb des `try/catch` aus. |
| M1-12 | UI weiter modernisieren (Akzente) — **light nachgezogen** (Badges, Primärfarbe, Abstände; kein CSS-Profi). |
| M1-13 | Angebot: PDF erzeugen/drucken ohne E-Mail — **behoben** (Vorschau am Entwurf; Original beim Senden, SMTP optional). |
| M1-14 | Rechnung: PDF-Vorschau vor Festschreibung — **behoben** (Wasserzeichen „Entwurf“, kein Nummernkreis, kein Journal). |

### Freigabe

- [x] Happy Path (Abschnitte 1–9) im gewählten Steuer-Modus grün oder nur mit dokumentierten Mängeln
- [x] Backup **und** Restore einmal nachgewiesen
- [x] Open Decisions verstanden (Zahlung ≠ Journal)
- [x] **M2 darf starten** — ja / nein: **ja**. M1-11 nachgetestet 2026-08-15. Kategorien, Multi-Firma dünn, UStVA/ELSTER-XML light, ZM-Übersicht und USt-IdNr.-Prüfung (BZSt) nachgezogen (2026-08-15). Nächster M2-Keil: E-Rechnungs-Versand.

Unterschrift / Datum: kf / 2026-08-14 · Nachtest Abschn. 7–8: 2026-08-15

---

## Kurzpfad (30–45 min)

Wenn Zeit knapp: 0 → Setup/Login → Kontakt + Katalog → Rechnung festschreiben + PDF + Journal → Beleg festschreiben → Teilzahlung → EÜR + DATEV-Download → Suche → Health + ein Backup (ohne Restore). Restore und Bank/E-Rechnung/Wiederkehrend nachziehen.

---

_Stand: nach E-Rechnungs-Versand 2026-08-15. M2-Checkliste: [`funktionstest-m2.md`](./funktionstest-m2.md). Bei Software-Updates diese M1-Liste nachziehen, nicht ersetzen._
