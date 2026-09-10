# Zettelruhe — Projektaktivitäten und Aufwand

| | |
|---|---|
| **Produkt** | Zettelruhe (`zettelruhe.de`) — self-hosted Buchhaltung und Abrechnung für Solo-Selbstständige in Deutschland |
| **Lizenz** | AGPL-3.0 |
| **Stand der Auswertung** | 15. August 2026 |
| **Aktuelle Phase** | Meilenstein 1 hartbar abgeschlossen; Meilenstein 2 fachlich gebaut, Server-Nachtest (HTTPS / BZSt) ausstehend |
| **Quellen** | `CONTEXT.md`, `docs/90-status.md`, `docs/feature-roadmap.md`, `docs/adr/`, Session-Logs, Funktionstestprotokolle, README, Betrieb, Verfahrensdokumentation |
| **Charakter dieser Datei** | Reine Auswertung. Kein Arbeitspaket, kein Statusersatz. Die verbindlichen Projektdateien bleiben unverändert. |

---

## 1. Kurzfassung

Zettelruhe ist vom ersten Feature-Braindump (Papierkram-Orientierung) über einen verbindlichen Produkt-Schnitt (Glossar, Roadmap, 23 Architekturentscheidungen) bis zu einem betriebsfähigen v1-Stand plus Steuer-/Compliance-Keilen des zweiten Meilensteins geführt worden.

Gebaut sind 14 Bauabschnitte (Fundament bis Härten), der Nachzug aus dem manuellen Funktionstest M1, sechs M2-Keile (Kategorien, Multi-Firma, UStVA/ELSTER-XML, ZM-Übersicht, USt-IdNr./BZSt, E-Rechnungs-Versand) sowie der HTTPS-Schnitt im Repository. Offen auf der Maschine: Host-Caddy, DNS und der Server-Nachtest inklusive BZSt-Klick.

**Klassischer Gesamtaufwand (Schätzung):** ca. **910 Personenstunden** — rund **114 Personentage** bzw. **5,5–6 Personenmonate** fokussierter Fach- und Entwicklungsarbeit. Bandbreite typisch ±25 % (ca. 680–1.140 h).

---

## 2. Schätzmethode

Die Stunden sind **klassische Personenstunden**, wie man sie für Angebot, Nachkalkulation oder eine Projektbilanz ansetzt. Sie beschreiben, was eine erfahrene Full-Stack-Person (TypeScript, Next.js, Docker) für Analyse, Entwurf, Umsetzung, Unit-Tests, Selbstprüfung und knappe Dokumentation je Paket braucht. Die Einarbeitung in deutsches Steuerrecht, GoBD-Mindeststandard, DATEV-light, ELSTER-Nutzdaten und EN-16931 (XRechnung/ZUGFeRD) steckt in den jeweiligen Paketen.

| Festlegung | Wert |
|---|---|
| Personentag (PT) | 8 Stunden |
| Personenmonat (PM) | 20 PT / 160 h |
| Rolle | 1 erfahrene Full-Stack-Person, Fachdomäne Steuer/GoBD muss mitgelernt werden |
| Je Paket enthalten | Fachanalyse, Schnitt, Schema/UI, Invarianten, Tests, kurze Doku |
| Nicht enthalten | Zertifizierungen (GoBD, DATEV, KoSIT), Steuerberatung, Marketing, Dauerbetrieb, Hosting-Alltag |
| Genauigkeit | Punktwert, realistisch ±25 % |

Die Kalenderdaten unten zeigen, *wann* die Arbeit im Repo sichtbar wurde. Die Stundenzahl ist davon unabhängig: sie misst den **klassischen Inhalt** der Arbeitspakete, nicht die Kalenderstauchung.

---

## 3. Ist-Stand (15. August 2026)

| Bereich | Stand |
|---|---|
| Happy Path v1 | Stammdaten inkl. Steuer-Modus → Kontakte/Projekte → Zeiten/Fahrten → Angebot/Rechnung (inkl. wiederkehrend) → Belege + Kassenbuch + Bank → Zahlung → E-Rechnung Empfang → EÜR / USt / ZM → DATEV + Journal + Belegarchiv |
| Bauabschnitte 1–14 | erledigt |
| Funktionstest M1 | bestanden mit Mängeln (14.08.); Bank-CSV und E-Rechnung-Empfang nachgetestet (15.08.) |
| Meilenstein 2 (Fachkeile) | gebaut und lokal nachgetestet; Protokoll liegt vor |
| Unit-Tests | 362 grün (Stand nach E-Rechnungs-Versand) |
| HTTPS auf dem Server | Repo vorbereitet (ADR-0023); Host-Caddy + DNS + `APP_URL` auf der Maschine fehlen |
| Blocker | keine |
| Nächster vereinbarter Schritt | Host-Caddy auf dem Server, danach Server-Nachtest inkl. BZSt-Klick |

**Invarianten, die durchgängig gelten:** Anlegen ≠ stilles Ändern festgeschriebener Dokumente. Rechnungsnummer und Journal erst bei Festschreibung. Zahlung erzeugt in v1 kein Journal. Eine Eigentümer:in, mehrere Firmen über die Session. UI nur de-DE.

---

## 4. Chronologie

| Datum | Phase | Was sichtbar wurde |
|---|---|---|
| vor 11.08.2026 | Idee | Feature-Braindump `Umsetzungsentwurf Papierkram.de v1.md` (später als Rohidee abgelöst) |
| 11.08.2026 | Planung | Grill-with-Docs: Produkt-Scope, Glossar, Roadmap, ADR 0001–0004; Tech-Stack und Baustrategie ADR 0005–0016 |
| 11.08.2026 | Bau M1 | Bauabschnitt 1 Fundament, UI-Fundament, Bauabschnitte 2–5 (Kontakte/Katalog, Journal, Belege, Rechnungen) |
| 12.08.2026 | Bau M1 | Bauabschnitte 6–14 (Angebote bis Härten); erster Commit des v1-Standes; Checkliste Funktionstest M1 |
| 14.08.2026 | Validierung M1 | Manueller Funktionstest durch kf: bestanden mit Mängeln; Nachzug Prio 1–3; PDF-Vorschau, Layout light, UI-Akzente |
| 15.08.2026 | Nachtest + M2 | Nachtest Bank/E-Rechnung; Kategorien; Multi-Firma dünn; Sidebar; UStVA; ZM; USt-IdNr./BZSt; E-Rechnungs-Versand; Protokoll M2; HTTPS-Schnitt ADR-0023 |

---

## 5. Aufwand nach Phase (Übersicht)

| Phase | Pakete | Aufwand (h) | PT | Anteil |
|---|---:|---:|---:|---:|
| A — Planung und Architektur | 2 | 72 | 9,0 | 8 % |
| B — Meilenstein 1, Bauabschnitte 1–14 | 15 | 572 | 71,5 | 63 % |
| C — Validierung M1 und Nachzug | 4 | 82 | 10,3 | 9 % |
| D — Meilenstein 2 (Steuer & Compliance) | 8 | 188 | 23,5 | 21 % |
| **Summe bisher** | **29** | **914** | **114** | **100 %** |

Entspricht rund **5,7 Personenmonaten**. Gerundet für die Kommunikation: **ca. 910 Stunden / 5,5–6 PM**.

---

## 6. Arbeitspakete im Detail

### A — Planung und Architektur

| Nr | Arbeitspaket | Inhalt | Status | h | PT |
|---|---|---|---|---:|---:|
| A1 | Produkt-Scope und Fachsprache | Abgrenzung gegen Papierkram-Parität; Zielgruppe Solo-DE; Steuer-Modi (Kleinunternehmerregelung / Regelbesteuerung nur Ist); Glossar in `CONTEXT.md`; Feature-Roadmap v1 / M2 / später / bewusst nicht | erledigt | 40 | 5,0 |
| A2 | Architektur und Tech-Stack | ADR 0001–0016: Self-hosted EÜR, Schema firma-gebunden, Empfang vor Versand, GoBD ohne Zertifikat, Next.js 16 + PocketBase, Next-only Finanz-Writes, Compose/SQLite, modularer Monolith, Auth/Session, In-Process-Jobs, flaches Repo, Datei-Immutability, AGPL-3.0, PDF-Renderer, E-Invoice-ACL, Decimal/Europe/Berlin/de-DE | erledigt | 32 | 4,0 |
| | **Summe Planung** | | | **72** | **9,0** |

Die frühere Datei `Umsetzungsentwurf Papierkram.de v1.md` bleibt Rohidee. Verbindlich sind Roadmap und Glossar.

---

### B — Meilenstein 1: Bauabschnitte 1–14

Verbindliche Reihenfolge aus `docs/90-status.md`. Jeder Abschnitt umfasst PocketBase-Migration (wo nötig), Domain-Modul, Server Actions, UI, Invarianten und Tests.

| Nr | Bauabschnitt | Fachlicher Schnitt | Wesentliche Lieferungen | Status | h | PT |
|---|---|---|---|---|---:|---:|
| B1 | Fundament | Instanz startet, Eigentümer:in, erste Firma, Steuer-Modus | Compose Caddy + Next + PocketBase; Volume `zettelruhe_pb_data`; Migration `users`/`firmen`; Setup-Wizard; Login/Logout; httpOnly-Session; Modul-Skelette; `money`/`session`/`pb`; AGPL, README, `.env.example` | erledigt | 48 | 6,0 |
| B1b | UI-Fundament | Bedienbare Shell vor dem Journal | Design-Tokens light/dark; UI-Kit (Button, Form, Table, Select, Badge, Card); App-Nav; Theme-Toggle | erledigt | 20 | 2,5 |
| B2 | Kontakte + Katalog | Stammdaten für Verkauf und Belege | `kontakte`, `ansprechpartner`, `katalog_positionen`; Listen/Filter; CSV Import/Export; USt-Felder nur bei Regelbesteuerung | erledigt | 36 | 4,5 |
| B3 | Journal-Kern | Unveränderbare Buchungsbasis | Collection `buchungsjournal`; Anlegen = Festschreibung; Storno nur als Gegenbuchung; Client-Writes gesperrt; UI Liste/Neu/Detail | erledigt | 40 | 5,0 |
| B4 | Belege + Dateien | Ausgabe/Einnahme mit Nachweis | Collection `belege`; Entwurf vs. Festschreibung; Datei PDF/Bild; Belegnummer erst bei Festschreibung; Journal `quelle_typ=beleg`; Datei danach immutable | erledigt | 36 | 4,5 |
| B5 | Sales light (Rechnung) | Zahlungsaufforderung + Journal | `rechnungen` + Positionen; Summen/USt beider Steuer-Modi; PDF (`@react-pdf/renderer`, §-19-Hinweis); Nummer erst bei Festschreibung; Journal `quelle_typ=rechnung` | erledigt | 56 | 7,0 |
| B6 | Angebote | Noch nicht verbindlich, kein Journal | `angebote` + Positionen; Statusmaschine Entwurf→…→abgerechnet; Senden = Nummer + PDF; Übernahme als Rechnungs-Entwurf | erledigt | 32 | 4,0 |
| B7 | Zeit & Fahrten | Arbeit erfassen, später abrechnen | `projekte`, `zeiteintraege`, `fahrten`; Status abrechenbar/nicht/abgerechnet; 1-Klick-Übernahme in Rechnungs-Entwurf; kein Journal vor der Rechnung | erledigt | 40 | 5,0 |
| B8 | Zahlungen manuell | Offene Posten, Teilzahlung | Collection `zahlungen`; Status offen/teilbezahlt/bezahlt/überfällig; **kein Journal** (bewusste Open Decision); UI Offene Posten | erledigt | 20 | 2,5 |
| B9 | Kassenbuch | Bar, fortlaufender Saldo | `kassenbuch_eintraege`; Anlegen = Festschreibung; Saldo ≥ 0; Storno mit Journal-Gegenbuchung; getrennt von Bankkonten | erledigt | 28 | 3,5 |
| B10 | Wiederkehrend + SMTP + Jobs | Abo/Dauerrechnung, Versand | Vorlagen + Rhythmus; Job erzeugt **Rechnungs-Entwurf**; In-Process-Scheduler, Locks, `job_runs`; Nodemailer optional; Zahlungserinnerung manuell | erledigt | 40 | 5,0 |
| B11 | Bank-Import + Matching | Auszug gegen offene Rechnung | `bankkonten`, Import-Läufe, `bank_bewegungen`; CSV de-DE; Idempotenz SHA-256; Match-Score; Matching schreibt Zahlung, **kein Journal**; MT940 bewusst Follow-up | erledigt | 36 | 4,5 |
| B12 | E-Rechnung Empfang | Original archivieren, Beleg vorfüllen | `e_rechnungen_empfang`; Adapter UBL + CII + light PDF-Scan; stabiles DTO (ADR-0015); Original auch bei Parse-Fehler; Beleg-Entwurf nur bei Parse ok | erledigt | 56 | 7,0 |
| B13 | Reporting / Export | EÜR und Übergabe an die Kanzlei | Perioden Europe/Berlin; EÜR, USt-Übersicht, BWA light, Dashboard; DATEV-CSV light; Journal-CSV; Belegarchiv-ZIP; Verfahrensdoku-Vorlage | erledigt | 56 | 7,0 |
| B14 | Härten | Alltag und Betrieb | `betrieb.md` Backup/Restore/Secrets; `/health`; Compose-Healthchecks; Caddy-Header; ENV-Check; Nav-Gruppen; Empty States; Suche light | erledigt | 28 | 3,5 |
| | **Summe Bau M1** | | | | **572** | **71,5** |

---

### C — Validierung Meilenstein 1 und Nachzug

| Nr | Arbeitspaket | Inhalt | Status | h | PT |
|---|---|---|---|---:|---:|
| C1 | Funktionstest M1 | Manuelle Checkliste über Happy Path, GoBD-Stichproben, Backup/Restore; Tester:in kf; Ergebnis **bestanden mit Mängeln**; Steuer-Modus im Lauf: Kleinunternehmerregelung | erledigt 14.08.2026 | 12 | 1,5 |
| C2 | Nachzug Prio 1–3 | Storno mindert in EÜR/BWA/USt die Ursprungskategorie; Rechnungsstatus `storniert`; Firma editierbar (Anschrift, Nummernkreise, Steuer-Modus-Wechsel); Kontakt-CSV mit Ansprechpartner; Katalog-Einheiten; Toasts; Storno-Bestätigung; Zeiten 15-Min-Raster | erledigt 14.08.2026 | 32 | 4,0 |
| C3 | PDF-Vorschau, Layout, UI | Entwurfs-PDF on-the-fly (Wasserzeichen, kein Nummernkreis, kein Journal); Original erst bei Senden/Festschreibung; Logo, Akzentfarbe, Kopf-/Fußtext an der Firma; UI-Akzente light | erledigt 14.08.2026 | 32 | 4,0 |
| C4 | Nachtest M1-11 | Bank-CSV Idempotenz + Match gegen R-0004; beide E-Rechnungs-Fixtures; Zahlung ohne Journal; Mangel M1-15 (`NEXT_REDIRECT`) dokumentiert, nicht blockierend | erledigt 15.08.2026 | 6 | 0,8 |
| | **Summe Validierung M1** | | | **82** | **10,3** |

Mängel aus dem Funktionstest (siehe `docs/issues/ergebnis-funktionstest-m1.md` und Freigabe in `docs/funktionstest-m1.md`):

| ID | Thema | Ausgang |
|---|---|---|
| M1-01 | Storno in Auswertungen mit falschem Vorzeichen | behoben |
| M1-02 | Rechnungsstatus nach Storno nicht `storniert` | behoben |
| M1-03 | Firma/Nummernkreise nicht editierbar, Anschrift fehlte im Setup | behoben |
| M1-04–M1-09 | CSV-Ansprechpartner, Toasts, Storno-Modal, 15-Min-Raster, Einheiten, Steuer-Modus-Wechsel | behoben |
| M1-10, M1-12–M1-14 | Layout, UI-Akzente, Entwurfs-PDF Angebot/Rechnung | behoben |
| M1-11 | Bank-CSV und E-Rechnung-Empfang im ersten Lauf nicht tief getestet | nachgetestet, fachlich ok |
| M1-15 | `NEXT_REDIRECT` nach Import / Beleg-Entwurf | offen, nicht blockierend |

---

### D — Meilenstein 2: Steuer und Compliance

Vereinbarte Reihenfolge ab 15.08.2026, nicht vermischt mit Open Decisions und nicht mit Multi-User.

| Nr | Keil | ADR | Fachlicher Schnitt | Status | h | PT |
|---|---|---|---|---|---:|---:|
| D1 | Kategorien | 0017 | Gemeinsame Auswahlliste Beleg + Kassenbuch; `kategorie` bleibt Text-Schnappschuss; CRUD `/app/kategorien`; Löschen nur ohne Verwendung | erledigt; Browser kf | 12 | 1,5 |
| D2 | Multi-Firma dünn | 0018 | Zweite Firma anlegen + in der Shell wechseln; Isolation `session.firmaId`; `users.firma` = zuletzt aktiv; kein Einladen, keine zweite Rolle | erledigt; Browser kf | 20 | 2,5 |
| D3 | Sidebar kollabierbar | — | Gruppen auf/zuklappen, Favoriten, Persistenz in localStorage; reines UI | erledigt; Browser-Nachtest | 12 | 1,5 |
| D4 | UStVA / ELSTER-XML light | 0019 | Unter Regelbesteuerung Kz 81/86/66/83 aus dem Journal; XML-Download (Mein-Elster-Nutzdaten); kein Versand; Kleinunternehmer „nicht relevant“ | erledigt; Browser kf | 32 | 4,0 |
| D5 | ZM-Übersicht | 0020 | Kandidaten aus 0-USt-Einnahmen + Land am Kontakt; Art nicht geführt; CSV light; kein Versand | erledigt; Browser kf | 20 | 2,5 |
| D6 | USt-IdNr. / BZSt | 0021 | Eigene Nummer an der Firma, fremde am Kontakt; eVatR-REST einfach/qualifiziert als Schnappschuss; kein Dauer-Stempel | erledigt lokal (Speichern); BZSt-Klick erst mit HTTPS | 24 | 3,0 |
| D7 | E-Rechnungs-Versand | 0022 | Aus festgeschriebener Rechnung XML (XRechnung 3.0 UBL / ZUGFeRD-CII); Pflichtfeldprüfung de-DE; Archiv `e_rechnungen_versand`; PDF unangetastet; kein Hybrid-PDF/A-3 | erledigt; Browser kf | 56 | 7,0 |
| D8 | Protokoll M2 + HTTPS-Schnitt | 0023 | Checkliste `funktionstest-m2.md`; Host-Caddy + Let’s Encrypt + `app.zettelruhe.de`; Compose-Caddy bleibt lokal HTTP; Overlay `docker-compose.server.yml` | Protokoll und Repo erledigt; Maschine offen | 12 | 1,5 |
| | **Summe M2** | | | | **188** | **23,5** |

---

## 7. Architekturentscheidungen (ADR 0001–0023)

| ADR | Titel | Phase |
|---|---|---|
| 0001 | Self-hosted, Deutschland, EÜR, Solo-Selbstständige | Planung |
| 0002 | Multi-Firma im Schema, zunächst eine Firma in der UX (später durch 0018 ergänzt) | Planung |
| 0003 | E-Rechnung: Empfang und Archiv vor Versand | Planung |
| 0004 | GoBD-Mindeststandard ohne externe Zertifizierung | Planung |
| 0005 | Next.js 16 + PocketBase | Planung |
| 0006 | Finanz-Aggregate nur über Next.js schreiben | Planung |
| 0007 | Docker Compose, PocketBase-SQLite, kein Postgres in v1 | Planung |
| 0008 | Modularer Monolith in Next.js | Planung |
| 0009 | Auth: PocketBase als Quelle, Next als Session-Gate | Planung |
| 0010 | Jobs in-process im Next-Container, SMTP aus Next | Planung |
| 0011 | Flaches Monorepo, versionierte PocketBase-Migrationen | Planung |
| 0012 | Beleg- und Rechnungsdateien immutable nach Festschreibung | Planung |
| 0013 | Lizenz AGPL-3.0 | Planung |
| 0014 | PDF mit `@react-pdf/renderer` | Planung |
| 0015 | E-Rechnung: Anti-Corruption-Layer statt Lib-Lock-in | Planung |
| 0016 | Decimal-Geld, Fachzeit Europe/Berlin, UI nur Deutsch | Planung |
| 0017 | Gemeinsame Kategorien für Beleg und Kassenbuch | M2 |
| 0018 | Eine Eigentümer:in, mehrere Firmen in der Session | M2 |
| 0019 | UStVA-Kennzahlen und ELSTER-XML light als Self-File | M2 |
| 0020 | ZM-Übersicht als Self-File ohne Umsatzart | M2 |
| 0021 | USt-IdNr. plus BZSt-Bestätigungsschnappschuss | M2 |
| 0022 | E-Rechnungs-Versand: XML-Profile hinter dem ACL | M2 |
| 0023 | Caddy nativ auf dem Server, Compose-Caddy nur lokal | M2 / Betrieb |

---

## 8. Was konkret entstanden ist

Zahlen zur Einordnung des Schätzgegenstands (Stand 15.08.2026, ohne `node_modules`):

| Größe | Umfang |
|---|---|
| Anwendungscode `app/src` | ca. 47.000 Zeilen TypeScript/TSX |
| Domain-Module | ca. 31.000 Zeilen in 18 Modulen |
| PocketBase-Migrationen | 19 Dateien, ca. 3.800 Zeilen |
| App-Seiten (`page.tsx`) | 59 |
| Unit-Test-Dateien | 35; zuletzt 362 Tests grün |
| Projektdokumentation `docs/` | ca. 2.350 Zeilen plus Glossar und README |

**Module (Codeumfang als Komplexitätsindikator, nicht als Stundenformel):**

| Modul | ca. LOC | Entstanden in |
|---|---:|---|
| `sales` (Rechnung, Angebot, wiederkehrend, PDF) | 6.620 | B5, B6, B10, C3 |
| `reporting` (EÜR, USt, BWA, DATEV, UStVA, ZM) | 4.377 | B13, D4, D5 |
| `einvoice` (Empfang + Versand) | 4.087 | B12, D7 |
| `banking` | 1.995 | B11 |
| `cash` | 1.414 | B9 |
| `contacts` | 1.327 | B2 |
| `time` | 1.300 | B7 |
| `expenses` | 1.284 | B4 |
| `ustid` | 1.244 | D6 |
| `journal` | 1.177 | B3 |
| `payments` | 1.109 | B8 |
| `platform` (Firma, Setup) | 1.050 | B1, C2, D2 |
| `jobs` | 984 | B10 |
| `travel` | 923 | B7 |
| `catalog` | 866 | B2 |
| `categories` | 646 | D1 |
| `projects` | 494 | B7 |
| `search` | 127 | B14 |

**Fachliche Collections (Auswahl):** `firmen`, `users`, `kontakte`, `ansprechpartner`, `katalog_positionen`, `kategorien`, `buchungsjournal`, `belege`, `rechnungen`, `rechnungspositionen`, `angebote`, `angebotspositionen`, `projekte`, `zeiteintraege`, `fahrten`, `zahlungen`, `kassenbuch_eintraege`, `wiederkehrende_rechnungen`, `bankkonten`, `bank_import_laeufe`, `bank_bewegungen`, `e_rechnungen_empfang`, `e_rechnungen_versand`, `ust_id_pruefungen`, `job_locks`, `job_runs`.

---

## 9. Validierung — wie geprüft wurde

| Art | Was | Ergebnis |
|---|---|---|
| Unit-Tests | Invarianten Geld, Journal, Sales, Kasse, Bank-CSV, Parser, UStVA, ZM, Outbound-E-Rechnung, Session, SMTP-Guard, Nav-State | 362 grün (nach D7) |
| Compose-Smoke je Bauabschnitt | Image-Build, Migration, Client-Write 403, Login, Routen-Gate | jeweils mitgeführt |
| Funktionstest M1 | Manuelle Checkliste Happy Path + Betrieb; Backup/Restore nachgewiesen | bestanden mit Mängeln; M2 durfte starten |
| Nachtest M1-11 | Bank-CSV + beide E-Rechnungs-Fixtures an laufender Instanz | fachlich ok; M1-15 Hinweis |
| Browser-Nachtests kf (15.08.) | Kategorien, Multi-Firma, UStVA, ZM, USt-Id speichern, E-Rechnungs-Versand | keine Fehler gemeldet |
| Funktionstest M2 | Protokoll geschrieben; lokaler HTTP-Lauf ohne BZSt-Klick vorgesehen | Server-Lauf (Abschnitt 8) ausstehend |

---

## 10. Noch offen — Restaufwand (Schätzung)

Nur das, was in Status und Roadmap als Nächstes oder als Follow-up steht. Keine Feature-Parität zu Papierkram.

### Vereinbart als Nächstes

| Paket | Bemerkung | h | PT |
|---|---|---:|---:|
| Host-Caddy auf dem Server | DNS `app.zettelruhe.de`, Let’s Encrypt, Overlay, `APP_URL=https://app.zettelruhe.de`, Rebuild | 6 | 0,8 |
| Server-Nachtest M2 inkl. BZSt-Klick | Checkliste Abschnitt 8; eingehendes TLS und ausgehendes eVatR | 8 | 1,0 |
| **Zwischensumme nächster Schnitt** | | **14** | **1,8** |

### Follow-up ohne M2-Prio

| Paket | Bemerkung | h | PT |
|---|---|---:|---:|
| Setup: `users.verified` automatisch | Sonst Login nach Erst-Registrierung oft gesperrt, bis PocketBase manuell gesetzt wird | 6 | 0,8 |
| Dokumenten-Layout überarbeiten | Über das heutige light (Logo, Akzent, Kopf-/Fußtext) hinaus | 24 | 3,0 |
| Marke: Logo und Favicon | Entwurf und Einsatz in der Shell | 12 | 1,5 |
| Mangel M1-15 | `redirect()` in `try/catch` nach Bank-Import / Beleg aus E-Rechnung | 4 | 0,5 |
| **Zwischensumme Follow-up** | | **46** | **5,8** |

### Open Decisions (bewusst nicht gebaut)

| Thema | Wenn man es später klassisch nachzieht | h | PT |
|---|---|---:|---:|
| Journal-Nachzug für Zahlungen (Ist-Versteuerung / EÜR) | Betrifft Zahlungen, Reporting, Verfahrensdoku | 24 | 3,0 |
| Automatische Kassenbuch-Zeile aus Barzahlung | Kopplung Zahlung ↔ Kasse | 10 | 1,3 |
| MT940-Parser | Format ist vorbereitet, Parser fehlt | 24 | 3,0 |
| Robustes ZUGFeRD-PDF-Attachment-Parsing | Heute nur light Byte-Scan | 20 | 2,5 |
| **Zwischensumme Open Decisions** | | **78** | **9,8** |

Später laut Roadmap, hier **nicht** geschätzt: OCR, REST-API, PSD2, automatischer Mahnlauf, Abschlagskette, Kundenportal, Multi-User/Rechte, Anlagen/AfA, Steuerberater-Portal, Soll-Versteuerung, DACH.

---

## 11. Aufwand — Gesamtschau

| Block | h | PT | PM |
|---|---:|---:|---:|
| Planung und Architektur | 72 | 9,0 | 0,5 |
| Bau Meilenstein 1 (Abschnitte 1–14 + UI-Fundament) | 572 | 71,5 | 3,6 |
| Validierung M1 und Nachzug | 82 | 10,3 | 0,5 |
| Meilenstein 2 (Keile + Protokoll + HTTPS-Repo) | 188 | 23,5 | 1,2 |
| **Bisher geleistet (Schätzung)** | **914** | **114** | **5,7** |
| Nächster Schnitt (Host-Caddy + Server-Nachtest) | 14 | 1,8 | 0,1 |
| Follow-up ohne Prio (Setup, Layout, Marke, M1-15) | 46 | 5,8 | 0,3 |
| Open Decisions (falls alle vier) | 78 | 9,8 | 0,5 |
| **Projekt bis „M2 auf dem Server grün“** | **928** | **116** | **5,8** |
| **Projekt inkl. Follow-up und Open Decisions** | **1.052** | **132** | **6,6** |

### Lesart für Angebot oder Nachkalkulation

Ein klassisches Festpreis- oder Budgetgespräch würde diesen Stand so rahmen:

- **Kernprodukt v1 + Steuerkeile M2, fachlich fertig, lokal nachgewiesen:** rund **6 Personenmonate**.
- **Plus Go-Live HTTPS und Server-Nachtest:** knapp eine weitere Personenwoche.
- **Plus die vier offenen Fachentscheidungen:** noch einmal gut **2 Personenwochen**.
- Die großen Roadmap-Themen danach (OCR, PSD2, Multi-User, Portal, …) wären eigene Phasen, nicht Nacharbeit an v1.

Teure Pakete im klassischen Sinn — weil Fachrecht, Formate und Invarianten, nicht weil „viele Screens“:

1. Rechnung + PDF + Steuer-Modi (B5)
2. E-Rechnung Empfang (B12) und Versand (D7) — zusammen ca. 112 h
3. Reporting / DATEV / EÜR (B13) plus UStVA-XML (D4)
4. Journal + Belege + Kasse als GoBD-Kern (B3, B4, B9)

Günstiger, weil Muster schon lagen: Angebote (B6), Zahlungen (B8), Kategorien (D1), Sidebar (D3).

---

## 12. Quellen

| Datei | Rolle in dieser Auswertung |
|---|---|
| `CONTEXT.md` | Glossary, Scope, bewusste Nicht-Ziele |
| `docs/feature-roadmap.md` | v1 / M2 / später |
| `docs/90-status.md` | Ist, Reihenfolge, Open Decisions |
| `docs/adr/0001`–`0023` | Verbindliche Technik- und Produktschnitte |
| `docs/sessions/2026-08-11-*` bis `2026-08-15-*` | Was je Session geliefert wurde |
| `docs/funktionstest-m1.md` | Checkliste und Freigabe M1 |
| `docs/issues/ergebnis-funktionstest-m1.md` | Rohbericht Mängel |
| `docs/funktionstest-m2.md` | Checkliste M2, Server-Nachtest offen |
| `docs/betrieb.md` | Backup, Secrets, HTTPS-Schnitt |
| `docs/verfahrensdokumentation.md` | GoBD-Vorlage |
| `README.md` | Stack, Start, Status der Keile |
| `Umsetzungsentwurf Papierkram.de v1.md` | Abgelöster erster Braindump |

---

_Ende der Auswertung. Keine bestehende Projektdatei wurde für dieses Dokument geändert._
