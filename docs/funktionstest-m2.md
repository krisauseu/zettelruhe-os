# Funktionstest Meilenstein 2 — Zettelruhe

> Historisches Meilensteinprotokoll vom August 2026. Die damaligen Ergebnisse
> bleiben erhalten. Für einen heutigen Lauf gelten die Aktualisierungen im
> [Nachtest nach M2](funktionstest-m2.md#nachtest-nach-m2-stand-2026-09-10).
> Insbesondere „Zahlung erzeugt kein Journal“ ist durch ADR-0024 abgelöst;
> Mitgliedschaften/Rollen gelten seit ADR-0025 und § 19 hat einen RC-Arbeitsfall.
> Alte Prüferwartungen und Freigabehäkchen sind kein Nachweis für heutige Features.

Checkliste für die **M2-Keile** (ADR-0017–0022). Ableitung: `CONTEXT.md`, Feature-Roadmap, Betrieb (`docs/betrieb.md`). M1-Checkliste bleibt [`funktionstest-m1.md`](./funktionstest-m1.md) — nicht hierher umbauen.

**Ziel:** Manuell verifizieren, dass die M2-Keile auf der self-hosted Instanz tragen — nicht Feature-Parität, nicht Follow-ups.

| Feld | Eintrag |
|------|---------|
| Instanz / Host | lokal + Server `app.zettelruhe.de` |
| `APP_URL` | lokal HTTP · Server `https://app.zettelruhe.de` |
| Datum | 2026-08-15/16 |
| Steuer-Modi getestet | ☑ Kleinunternehmerregelung · ☑ Regelbesteuerung (Ist) |
| Tester:in | kf |
| TLS / eVatR | ☑ eingehendes HTTPS · (BZSt-Klick nicht als Mangel gemeldet) |
| Ergebnis gesamt | ☑ bestanden · ☐ bestanden mit Mängeln · ☐ nicht bestanden |

**Legende:** `[ ]` offen · `[x]` ok · `[~]` ok mit Hinweis · `[!]` Fehler (kurz notieren)

**Zwei Läufe, nicht vermischen**

1. **Lokal / HTTP** (Abschnitte 0–7, ohne 5.2): Keile klicken, Isolation, Downloads. Klick-Prüfung beim BZSt hier nicht als Fehler werten, wenn ausgehendes eVatR fehlt.
2. **Server / HTTPS** (Abschnitt 8, inkl. 5.2): dieselbe Checkliste auf der öffentlichen Instanz, plus eingehendes TLS und BZSt-Klick.

Eingehendes TLS (Browser → App) und ausgehendes HTTPS zum BZSt (`EVATR_URL`, Default `https://api.evatr.vies.bzst.de/app`) sind zwei Dinge.

**Erwartung (ehrlich)**

- Isolation nur über `session.firmaId`. `users.firma` bleibt 1:1 und speichert die zuletzt aktive Firma (Login-Landung).
- Manuelle/Bank-Zahlungen erzeugen **kein** Journal. UStVA und ZM lesen nur das Buchungsjournal der aktiven Firma.
- USt-Übersicht, UStVA-XML und ZM nur unter **Regelbesteuerung**. Unter der **Kleinunternehmerregelung** ehrlich „nicht relevant“.
- E-Rechnungs-**Versand** legt XML-Originale ab; das Rechnungs-PDF bleibt unangetastet. Empfang (`/app/e-rechnungen`) unverändert.
- BZSt-Bestätigung ist ein Schnappschuss zum Anfragezeitpunkt, kein Dauer-„gültig“-Stempel.
- Kein ELSTER-Versand, keine Abgabe aus der App.

Vorhandene Instanz (z. B. **Beispiel GmbH** / Kleinunternehmerregelung und **Regel UG Test** / Regelbesteuerung) wiederverwenden. Kein Wipe.

---

## 0. Vorbereitung

- [ ] `.env` vorhanden; keine `change-me`-Werte wenn „Prod-like“
- [ ] `SESSION_SECRET` ≥ 32 Zeichen Zufall; `PB_SUPERUSER_*` stark und einzigartig
- [ ] `APP_URL` = erreichbare URL **ohne** trailing slash (lokal typisch `http://localhost`)
- [ ] `PB_URL=http://pocketbase:8090` (intern im Docker-Netz; nicht über Caddy)
- [ ] `docker compose up --build -d` (oder laufender Stack)
- [ ] `docker compose ps` → next + pocketbase **healthy**, caddy up
- [ ] `curl -sS "$APP_URL/health"` → `"ok":true` (PocketBase `"ok"`)
- [ ] Browser: App über Caddy (`APP_URL`), nicht nur Port 3000
- [ ] Login als Eigentümer:in; zwei Steuer-Modi erreichbar (zweite Firma anlegen, falls noch keine)

**Smoke-Befehle (optional):**

```bash
docker compose ps
curl -sS "${APP_URL:-http://localhost}/health"
curl -sSI "${APP_URL:-http://localhost}/app"   # erwartet 307 → /login
```

---

## 1. Kategorien (ADR-0017)

Route: `/app/kategorien` (Sidebar Stammdaten). Gemeinsame Auswahlliste für Beleg und Kassenbuch. Am Beleg und am Kassenbuch-Eintrag bleibt `kategorie` ein **Text-Schnappschuss**.

- [ ] Leerer State verständlich + „Kategorie anlegen“, oder bestehende Liste lesbar
- [ ] Anlegen (z. B. „Büromaterial“); Detail `/app/kategorien/{id}`; in der Liste **Aktiv**
- [ ] Beleg neu: Select zeigt den Namen (nicht Freitext-only); Beleg speichern — Name steht am Beleg
- [ ] Kassenbuch neu: dieselbe Liste; Eintrag speichern — Name steht an der Zeile
- [ ] Umbenennen (z. B. „Bürobedarf“): Hinweis gelesen, dass Historie nicht folgt
- [ ] Nach dem Speichern: Select für **neue** Belege/Kasse zeigt den neuen Namen
- [ ] Alter Beleg und alte Kassenbuch-Zeile behalten den **alten** Namen (kein stilles Umschreiben)
- [ ] Löschen bei Verwendung gesperrt (Text: in Verwendung, deaktivieren statt löschen)
- [ ] Deaktivieren: nicht mehr in neuen Auswahllisten; Historie behält den gespeicherten Text
- [ ] „Inaktive zeigen“ listet den Eintrag
- [ ] Unbenutzte Kategorie lässt sich löschen (Bestätigung)
- [ ] Doppelter Name (auch Groß/Klein) wird abgelehnt
- [ ] Isolation: Kategorie der Firma A erscheint nicht im Select der Firma B

---

## 2. Multi-Firma dünn (ADR-0018)

Eine Eigentümer:in, mehrere Firmen. Anlegen: `/app/firma/neu` oder Link in der Shell. Wechsel: Select in der Sidebar (`POST /app/firma/wechseln`).

- [ ] „Weitere Firma anlegen“ sichtbar (Shell und/oder `/app/firma`)
- [ ] Zweite Firma mit **anderem Steuer-Modus** anlegen (Name eindeutig); Button „Firma anlegen und wechseln“
- [ ] Danach ist die neue Firma aktiv (Shell zeigt den Namen)
- [ ] Listen Journal / Rechnungen / Belege / Kontakte / Kassenbuch der neuen Firma leer bzw. nur deren Daten
- [ ] URL einer Rechnung oder eines Belegs der **anderen** Firma → **404**, kein Inhalt
- [ ] USt-Übersicht und ZM folgen dem Steuer-Modus der **aktiven** Firma (nicht der anderen)
- [ ] E-Rechnungs-Download einer fremden Rechnung → 404 / Login-fremd, kein XML
- [ ] Zurückwechseln: Daten der ersten Firma wieder da; USt/ZM wieder zu deren Steuer-Modus
- [ ] Abmelden → Login landet auf der **zuletzt aktiven** Firma
- [ ] Doppelter Firmenname → Fehler „bereits“ (o. Ä.), nichts überschrieben
- [ ] Kein Einladen, keine zweite Login-Rolle, keine Rechte-UI
- [ ] Setup-Wizard nicht erneut (Erst-Firma bleibt Erst-Firma)

---

## 3. UStVA / ELSTER-XML light (ADR-0019)

Route: `/app/ust`. Download: `/app/ust/elster-xml` (**nicht** `/api/*`). Self-File: Werte selbst in Mein Elster eintragen oder XML lokal speichern — **kein Versand**.

Zahlen nur aus dem Buchungsjournal der aktiven Firma. Wenn unter Regelbesteuerung das Journal leer ist: eine Rechnung 19 % festschreiben und optional einen Ausgabebeleg mit Vorsteuer — sonst Nullmeldung (Kz 83 = 0) ist zulässig.

### Kleinunternehmerregelung

- [ ] Aktive Firma im Steuer-Modus Kleinunternehmerregelung
- [ ] `/app/ust`: Karte **„Nicht relevant unter Kleinunternehmerregelung“**, kein Kennzahlen-Block, kein Download-Button
- [ ] `GET /app/ust/elster-xml` → 400, Hinweis § 19 / Kleinunternehmerregelung

### Regelbesteuerung

- [ ] Aktive Firma Regelbesteuerung (Ist)
- [ ] Zeitraum-Filter (Monat Default); Steuer-Modus in der Karte sichtbar
- [ ] USt / Vorsteuer / Zahllast light plausibel zum Journal (Zahlung ändert die Zahlen nicht)
- [ ] Tabelle UStVA-Kennzahlen: **Kz 81** (19 %), **Kz 86** (7 %), **Kz 66** (Vorsteuer), **Kz 83** (Zahllast light)
- [ ] Bemessungsgrundlagen 81/86 volle Euro; Journal-Cent daneben sichtbar
- [ ] Block **Nicht geführt** (u. a. Kz 41, 43, 48, § 13b, EUSt) — nichts davon in der XML als Tatsache
- [ ] **Monat:** Button „ELSTER-XML light herunterladen“; Datei `UStVA_…xml`
- [ ] XML: Wurzel/Datensatz `Anmeldungssteuern`; Format-ID `zettelruhe-ustva-elster-xml-light-v1`; Zeichensatz ISO-8859-15 (Umlaute); **kein** Versand, keine Hersteller-ID
- [ ] **Quartal:** Download möglich (Zeitraum-Code, Dateiname mit `Q`)
- [ ] **Jahr** (und custom, falls kein Kalendermonat/-quartal): Kennzahlen ja, **kein** Download-Button; direkter XML-Abruf 400
- [ ] Ohne Steuernummer an der Firma: Hinweis; XML ohne `Steuernummer` (kein erfundener Wert)
- [ ] Export-Seite (`/app/export`) verweist auf die USt-Übersicht, startet keinen Versand
- [ ] Unauth `/app/ust` und `/app/ust/elster-xml` → Redirect `/login`
- [ ] Isolation: XML/Kennzahlen nur der aktiven Firma

---

## 4. ZM-Übersicht (ADR-0020)

Route: `/app/zm`. CSV: `/app/zm/csv` (**nicht** `/api/*`). Self-File, **kein** ELSTER-XML, **kein Versand**. Format `zettelruhe-zm-uebersicht-v2`.

Kandidaten = wirtschaftliche **0-USt-Einnahmen** an Kontakte mit Land im **übrigen EU-Gebiet**. Art (Lieferung / sonstige Leistung / Dreieck) wird **nicht** geraten.

Testdaten falls nötig (Regelbesteuerung): Kontakt Land z. B. `FR` (optional USt-IdNr. am Stamm); festgeschriebene Rechnung mit USt 0,00 € an diesen Kontakt. Zusätzlich eine 0-USt-Einnahme an einen DE-Kontakt — die gehört zu „Andere“, nicht zu den Kandidaten.

### Kleinunternehmerregelung

- [ ] `/app/zm`: **„Nicht relevant unter Kleinunternehmerregelung“**, keine Kandidaten-Tabelle, kein CSV-Button
- [ ] `GET /app/zm/csv` → 400, Hinweis § 19

### Regelbesteuerung

- [ ] Kandidaten-Summe und Anzahl Kontakte; Spalte **Art** durchgängig „nicht geführt“
- [ ] USt-IdNr. aus dem Kontakt-Stamm (Badge Stamm ungeprüft) oder „nicht geführt“ — nicht aus dem Journal geraten
- [ ] BZSt-Schnappschuss — falls vorhanden — nur als Zeitpunkt, nicht als Gültigkeit zum Umsatz
- [ ] Andere 0-USt-Einnahmen (DE, Drittland, ohne Land) sichtbar, **nicht** still als ZM geführt
- [ ] Leerer Zeitraum: Hinweis „Keine ZM-Kandidaten“ ist **keine** amtliche Nullmeldung
- [ ] **CSV light** lädt (`ZM_….csv`); Semikolon/UTF-8; Art nicht als Tatsache befüllt
- [ ] Monat = typischer Meldezeitraum; Quartal möglich; Jahr/custom Übersicht (kein Abgabe-Claim)
- [ ] Export- und USt-Seite verweisen auf `/app/zm`
- [ ] Unauth `/app/zm` und `/app/zm/csv` → `/login`
- [ ] Isolation: nur Journal + Kontakte der aktiven Firma

---

## 5. USt-IdNr. und BZSt (ADR-0021)

Eigene Nummer an der **Firma**, fremde am **Kontakt**. Prüfung nur auf **Klick**. Ergebnis = Schnappschuss (`ust_id_pruefungen`), kein Dauer-Stempel am Stamm, keine stille Änderung festgeschriebener Belege.

### 5.1 Stamm und Syntax-Lage (auch lokal HTTP)

- [ ] Firma (`/app/firma`): USt-IdNr. speichern; Feld bleibt nach Reload
- [ ] Unter Kleinunternehmerregelung: Nummer zulässig; USt- und ZM-Übersicht bleiben „nicht relevant“
- [ ] Karte „Eigene USt-IdNr. und das BZSt“: Syntax-Lage ehrlich (DE + 9 Ziffern / fehlt / nicht DE)
- [ ] Button **„Gespeicherte Nummer prüfen (Syntax, kein BZSt-Stempel)“** — keine isolierte BZSt-Bestätigung der eigenen DE-Nummer
- [ ] Kontakt: fremde USt-IdNr. speichern; Hinweis gelesen (kein Dauer-„gültig“)
- [ ] DE-Nummer am Kontakt: Gate lehnt BZSt-Klick ab (`evatr-0006` / Auslandsverfahren bestätigt keine DE-Nummer als angefragte)
- [ ] Speichern allein löst **keine** BZSt-Abfrage aus
- [ ] Festgeschriebene Belege/Rechnungen unverändert (kein stilles Schreiben der Id ins Journal)

### 5.2 Klick-Prüfung beim BZSt — erst mit HTTPS / ausgehendem eVatR

Lokal hinter HTTP oft nicht prüfbar. Nicht als Mangel der Keile werten, wenn der Host `api.evatr.vies.bzst.de` nicht erreicht. Nachziehen in Abschnitt 8.

Voraussetzung: eigene DE-USt-IdNr. syntax-ok an der Firma; fremde EU-Nummer (nicht DE) am Kontakt; ausgehendes HTTPS zum eVatR. Kein API-Key.

- [ ] Gate am Kontakt gibt den Button „Beim BZSt prüfen“ frei (sonst ehrlicher Grund + Link zur Firma)
- [ ] Einfache Bestätigung: Schnappschuss mit Status, Meldung, Anfragezeitpunkt; Badge **zum Anfragezeitpunkt**, kein Stamm-Flag „gültig“
- [ ] Qualifizierte Bestätigung (Häkchen): Name/Ort mitgeprüft, Ergebniscodes sichtbar
- [ ] Wiederholte Prüfung legt einen **neuen** Schnappschuss an, überschreibt den Stamm nicht
- [ ] Fachantworten 4xx (z. B. ungültig, anfragende Nummer abgelehnt) erscheinen als Text, kein 500
- [ ] ZM: Schnappschuss höchstens als Zeitpunkt, nicht als Gültigkeit zum Umsatz
- [ ] Isolation: Schnappschüsse der anderen Firma nicht gemischt

---

## 6. E-Rechnungs-Versand (ADR-0022)

Karte **E-Rechnung** auf der **festgeschriebenen** Rechnung. Profile: **XRechnung 3.0 (UBL-XML)** und **ZUGFeRD EN 16931 (CII-XML)**. Original in `e_rechnungen_versand`. Download `/app/rechnungen/{id}/e-rechnung/{versandId}` (**nicht** `/api/*`). Kein Hybrid-PDF/A-3, kein KoSIT-Claim.

Stammdaten light: Firma Anschrift + Steuernummer oder USt-IdNr.; Bankkonto mit IBAN; für XRechnung zusätzlich Firma-E-Mail, Kontakt-E-Mail, Leitweg-ID/Käuferreferenz am Kontakt.

- [ ] Entwurf: keine Erzeugung (Karte erst nach Festschreibung bzw. Erzeugen scheitert ehrlich)
- [ ] Festgeschriebene Rechnung: Karte sichtbar; Hinweis „PDF bleibt unverändert“
- [ ] Ohne Bank-IBAN: Hinweis + Link `/app/bankkonten/neu`, nichts geschrieben
- [ ] **Prüfen** XRechnung ohne Leitweg/E-Mails → de-DE-**Fehlerliste**, kein Datensatz
- [ ] **Prüfen** ZUGFeRD-CII ohne diese Extra-Pflichten kann ok sein (gleiche fachliche Rechnung)
- [ ] Kleinunternehmerregelung: erzeugt ohne USt-Zeilen, Kategorie **E**, gesetzlicher **§-19-Hinweis**
- [ ] Regelbesteuerung: Ausweis aus den Positionen (S 7/19); 0 % nicht als Reverse Charge geraten
- [ ] Erzeugen XRechnung → Datei `{Nummer}-xrechnung.xml`; Customization/Profile XRechnung 3.0; BT-10/Käuferreferenz; Endpoint `EM`
- [ ] Erzeugen ZUGFeRD-CII → `{Nummer}-zugferd.xml`; EN-16931-Guideline
- [ ] Rechnungs-PDF: gleicher Dateiname/Inhalt wie vor der Erzeugung (Download weiter `{Nummer}.pdf`)
- [ ] Zweites Erzeugen **desselben** Profils abgewiesen („bereits … Original wird nicht überschrieben“)
- [ ] Zweites Profil zusätzlich möglich; beide Downloads unabhängig
- [ ] Unauth Download → `/login`
- [ ] Isolation: andere Firma → Rechnung und XML 404
- [ ] Empfang unverändert: `/app/e-rechnungen` listet weiter nur Inbox; bestehende Originale bytegleich ladbar
- [ ] Optional SMTP: Mail hängt vorhandene XML an; ohne SMTP de-DE-Hinweis — kein Pflichtpunkt

---

## 7. Gezielte Regression (nicht der ganze M1-Lauf)

- [ ] Login / geschützte Routen / Health wie M1-Smoke
- [ ] Sidebar: Kategorien, USt-Übersicht, ZM-Übersicht erreichbar; Empfang weiter unter „E-Rechnungen“
- [ ] Zahlung an einer offenen Rechnung ändert den Status, **Journal-Anzahl unverändert**
- [ ] Festgeschriebene Journal-Zeile / Belegdatei weiter ohne stilles Edit
- [x] Früherer Mangel **M1-15** (`NEXT_REDIRECT` nach Bank-CSV / Beleg-Entwurf): mit TP-023 behoben

---

## 8. Server-Nachtest (HTTPS-Instanz)

Erst wenn Host-Caddy TLS terminiert und `APP_URL=https://app.zettelruhe.de` (ohne Slash am Ende). Next↔PocketBase bleibt `PB_URL=http://pocketbase:8090`. Compose lokal auf HTTP:80 nicht kaputtmachen. Overlay: `docker-compose.server.yml`. Site-Block: `deploy/Caddyfile.host` (ADR-0023).

- [ ] `curl -sSI https://app.zettelruhe.de/health` über **HTTPS**, Zertifikat gültig (kein Browser-Ausnahme-Klick im Alltag)
- [ ] Nach Login: Cookie `zettelruhe_session` mit **Secure** (weil `APP_URL` mit `https://`)
- [ ] App über `app.zettelruhe.de`, nicht über `:3000` und nicht über Roh-HTTP
- [ ] `/_/` über denselben Host erreichbar (expliziter Schnitt); Superuser ≠ App-Login, Passwort stark
- [ ] Abschnitt 1 Kategorien auf dieser Instanz stichprobenartig
- [ ] Abschnitt 2 Wechsel + Isolation
- [ ] Abschnitt 3 UStVA Monat-XML
- [ ] Abschnitt 4 ZM CSV
- [ ] Abschnitt 5.1 Speichern + Syntax, **und** Abschnitt 5.2 BZSt-Klick (einfach, besser auch qualifiziert)
- [ ] Abschnitt 6 ein Profil erzeugen + PDF unverändert + Empfangsliste
- [ ] Ausgehendes eVatR und eingehendes TLS beide notiert (beide ok oder ehrlich getrennt dokumentiert)

---

## 9. Bewusst nicht testen

Nicht als Fehler werten:

- ELSTER-**Versand**, UStVA-**Abgabe**, ZM-**Abgabe**
- Hybrid-ZUGFeRD-PDF/A-3, KoSIT-/Schematron-/Zertifizierungs-Claim
- Multi-User, Einladen, Rechte-UI
- Open Decisions nach M2 (erledigt: Journal-Nachzug, Kassenbuch-Schnitt, MT940, ZUGFeRD-Empfang ADR-0029)
- M1-15 (`NEXT_REDIRECT`) ist seit TP-023 behoben
- Setup-`verified` (eigener Schnitt nach M2-Freigabe; nicht Teil dieses Protokolls)
- Dokumenten-Profi-Layout, Logo/Favicon der Marke
- Empfangspfad umbauen
- Feature-Parität zu Papierkram; den kompletten M1-Happy-Path von vorn

---

## Ergebnis & Freigabe

### Mängel (M2)

| ID | Modul / Route | Beschreibung | Schwere |
|----|---------------|--------------|---------|
| M2-01 | `/app/ust` | Steuersatz der festgeschriebenen Rechnung fehlte im Journal → „Nach Steuersatz“ ohne Satz, Kz 81/XML ohne Umsatz. Screenshot `issues/Fehler.UST-Auswertung.png`. **Behoben und nachgetestet** (`13da9e7`, 2026-08-16). | — |

### Hinweise

| ID | Beschreibung |
|----|--------------|
|    |              |

### Freigabe

- [x] Abschnitte 1–7 im lokalen/HTTP-Lauf grün oder nur mit dokumentierten Mängeln (5.2 darf hier offen bleiben)
- [x] Beide Steuer-Modi angefasst (Kleinunternehmerregelung **und** Regelbesteuerung)
- [x] Isolation über `session.firmaId` stichprobenartig (Rechnung, USt/ZM, E-Rechnung)
- [x] Kein Versand-/Abgabe-Claim in der UI missverstanden
- [x] **Server-Nachtest inkl. BZSt-Klick** (Abschnitt 8) — ja (HTTPS `app.zettelruhe.de`; BZSt nicht als Mangel gemeldet)
- [x] **M2 Alltag trägt** — ja (M2-01 nachgetestet, HEAD `13da9e7`)

Unterschrift / Datum: kf / 2026-08-16

Auswertung: [`issues/ergebnis-funktionstest-m2.md`](./issues/ergebnis-funktionstest-m2.md).

---

## Kurzpfad (30–40 min)

Wenn Zeit knapp: 0 → Kategorie anlegen + an Beleg und Kasse + umbenennen (Historie alt) → zweite Firma + Isolation einer Rechnungs-URL → Regelbesteuerung: `/app/ust` Monat-XML + `/app/zm` CSV → Firma/Kontakt USt-IdNr. speichern + Syntax (BZSt-Klick merken) → festgeschriebene Rechnung: Prüfen (Fehlerliste) + ein XML-Profil erzeugen + PDF unverändert + `/app/e-rechnungen` unverändert. Abschnitt 8 nachziehen, sobald HTTPS steht.

---

_Stand: Durchführung 2026-08-15/16, Auswertung + Nachtest M2-01 2026-08-16. Freigabe **M2 Alltag trägt**. HEAD Nachtest `13da9e7`. Blocker keine._


## Nachtest nach M2, Stand 2026-09-10

Aktuelle Ergänzung für künftige Regressionen, beim Dokumentationsabgleich nicht
als Browserlauf ausgeführt. Die ursprüngliche M2-Freigabe oben bleibt historisch.
Für jeden neuen Lauf Datum, Commit, Tester:in und Zielumgebung gesondert erfassen.
Vor dem Start gilt [Sicher prüfen](entwicklung.md#sicher-prüfen-entwickeln-und-betreiben).

- [ ] Manuelle Zahlung und bestätigter Bank-Eingangsmatch erzeugen Zufluss-Journal;
  EÜR/USt zählen den Zufluss, nicht die Rechnungs-Forderungsbuchung doppelt.
- [ ] Firmenwechsel und Lesen/Bearbeiten/Eigentümer:in prüfen; keine fremden
  Daten oder Dateien sichtbar, Lesen ohne Finanz-Schreibrecht.
- [ ] Kategorie nach Einnahme/Ausgabe und zugehörige Kunden-/Lieferantenauswahl
  prüfen; Übersicht/EÜR/Auswertungen starten im Kalenderjahr.
- [ ] RC-Lieferantenvorschlag übernehmen oder bewusst übersteuern. Entwurf speichern
  und neu laden; Leistungszeitraum, Vorsteuerwahl und weitere Details bleiben erhalten.
- [ ] EU-RC unter Regelbesteuerung vollständig in einer Zahlung erfassen und
  festschreiben: Rechnungsbetrag unverändert, getrennte Schuld/Vorsteuer,
  Kz 46/47/67 in der gespeicherten Steuerperiode, auch bei späterem Abfluss.
- [ ] Drittlands-RC unter § 19 prüfen: Kz 84/85, keine RC-Vorsteuer; begrenzter
  USt-Arbeitsfall sichtbar. §-19-Periode ohne RC sowie ZM weiter gesondert prüfen.
- [ ] Unbezahlte, Teil-/Mehrfachzahlungs- und bereits separat erklärte RC-Fälle
  werden nicht festgeschrieben; Entwurfsstatus und Fehlermeldung nachvollziehbar.
- [ ] RC-Erfassungsfehler und vollständige Rückzahlung mit eigenem Datum/Nachweis
  korrigieren; Original bleibt erhalten, Geld- und Steuerperioden stimmen.
- [ ] E-Rechnungsübernahme mit RC-Hinweis verweist zur manuellen Erfassung;
  Nicht-EUR/fehlende Währung wird abgewiesen, Original bleibt archiviert.
- [ ] UStVA-XML nur für 2026 Monat/Quartal; kein ELSTER-Versand oder amtlicher
  Importerfolg aus einem bloß erfolgreichen Download ableiten.
- [ ] Journal-CSV und Belegarchiv enthalten RC-Schnappschüsse; DATEV lehnt
  RC-Zeiträume als Ganzes ab. Periodenbasis beachten: Journal nach Buchungsdatum,
  Belegarchiv nach Belegdatum, USt nach Steuerperiode.
- [ ] TP-024-Exportregressionen für Pagination, fehlende Dateien und Größenlimit
  mit den automatisierten Tests auf isoliertem Testbestand prüfen.
- [ ] Beleg-, Rechnungs- und Kassenabschluss mit passenden isolierten Hook-Tests
  prüfen; Health-Smoke wertet JSON aus, nicht nur HTTP 200.

Ergebnisse in `testphase.md` beziehungsweise der RC-Referenz verlinken und den
Umgebungsstand in `90-status.md` fortschreiben. Keine neuen Ergebnisse in die
historischen Rohberichte vom August zurückdatieren.
