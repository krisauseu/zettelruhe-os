# Zettelruhe — Feature-Roadmap

Abgeleitet aus dem Grill-with-Docs (Scope: Solo-Selbstständige DE, self-hosted, EÜR).  
Glossary: [`CONTEXT.md`](../CONTEXT.md) · ADRs: [`docs/adr/`](./adr/)

---

## v1 — Erster brauchbarer Stand (Must)

*Happy Path ohne OCR, PSD2, API, Kundenportal, automatischen Mahnlauf.*

Stand: 2026-09-10, Releasevorbereitung ab `f48be21`.
M1 und M2 sind abgeschlossen. Die Listen beschreiben den vorhandenen Umfang;
noch fehlende frühere v1-Wünsche stehen gesondert außerhalb des Releaseumfangs. Abnahme und Betriebsstand stehen ausschließlich im [Status](90-status.md).
Reverse Charge ist implementiert, freigegeben und laut Betreiberbestätigung vom
2026-09-10 auf dem Produktions-VPS getestet und live. Die ELSTER-Prüfsperre entfällt.
Der heutige Open-Source-Umfang wird als Release abgeschlossen; neue Komfort- und
Abofunktionen gehören in `zettelruhe-cloud`. Korrekturen, Sicherheits- und
notwendige Pflegeupdates vorhandener Funktionen bleiben im Kern.
[Release- und Cloud-Plan](release-und-cloud-plan.md).
Die [RC-Referenz](reverse-charge-umsetzung.md) beschreibt Grenzen und Bedienung.

### Fundament & Stammdaten

- Mehrere Firmen in einer Instanz betreiben (anlegen + Session-Wechsel; Schema firma-gebunden)
- Mehrere Nutzer:innen je Firma über Mitgliedschaft; grobe Rollen Eigentümer:in / Bearbeiten / Lesen; Einladen im UI (ADR-0025)
- Unternehmensdaten, Logo
- Nummernkreise: Angebot, Rechnung, Gutschrift/Storno, optional Beleg, Kassenbuch-Belegnr.
- **Nummernvergabe erst bei Festschreiben/Senden** (Entwürfe ohne Nummernkreis-Verbrauch)
- Kontenrahmen wählbar: SKR03 / SKR04
- **Steuer-Modus (Firmeneinstellung, greift global):**
  - **Kleinunternehmerregelung (§ 19 UStG)** — eigene Umsätze ohne USt-Ausweis; §-13b-Eingangsleistungen können dennoch Steuerschuld und Erklärungspflichten auslösen
  - **Regelbesteuerung** — nur **Ist-Versteuerung** (keine Soll-Versteuerung in v1)
- Folgen des Steuer-Modus in allen Abläufen: Angebots-/Rechnungs-PDF und E-Rechnung, Positionslogik (mit/ohne USt), Belegerfassung (Vorsteuer ja/nein), Dashboard, EÜR-Zuordnung, Ein-/Ausblenden der USt-Übersicht, Pflichttexte (§-19-Hinweis)
- Wechsel des Steuer-Modus nur bewusst (Einstellung); bestehende festgeschriebene Belege bleiben historisch korrekt
- Produkt- & Leistungskatalog (Preise; Steuersätze relevant nur unter Regelbesteuerung), CSV-Import
- Bankkonten als Stammdaten (mehrere möglich) neben dem Kassenbuch

### Kontakte, Projekte, Zeit & Fahrten

- Kontaktverwaltung: Kund:innen & Lieferant:innen; Kontaktnummer je Kontakt (ein Kreis, Prefix an der Firma; PocketBase-ID bleibt Verknüpfung)
- Ansprechpartner, Adressen, Bankdaten (IBAN)
- CSV-Import/Export Kontakte
- **Projekt** optional je Kund:in (keine Budget-Pflicht)
- **Zeiteinträge** (Kunde Pflicht, Projekt optional; abrechenbar / nicht / abgerechnet)
- **Fahrten** (km; Default abrechenbar an Kund:in; alternativ/zusätzlich steuerlich)
- 1-Klick: offene Zeiten/Fahrten eines Kunden in Rechnungspositionen

### Angebote & Rechnungen

- Layout Angebot/Rechnung: DIN-ähnlicher Briefkopf, Logo, Akzentfarbe, Textbausteine, Sichtbarkeit Header/Fuß/Zahlblock; GiroCode auf der Rechnung bei IBAN. Briefpapier-Hintergrund, Font-Upload, Mehrvorlagen → Cloud
- Dokumente folgen Steuer-Modus: **ohne USt + §-19-Hinweis** bzw. **mit USt-Ausweis** (Regelbesteuerung)
- Angebote: Positionen, Mengen, Preise, Freitext; PDF und Übersicht
- Angebotsstatus: Entwurf → Gesendet → Angenommen / Abgelehnt / Abgelaufen → Abgerechnet
- Rechnungen: aus Angebot, aus Zeiten/Fahrten, oder frei; PDF und Übersicht
- **Wiederkehrende Rechnungen** (Abo/Dauerrechnung): atomare Entwurfsanlage mit Datumsfortschritt; alle Firmen/fälligen Vorlagen paginiert, höchstens zwölf Nachholperioden je Vorlage und Aufruf
- Rechnungsstatus: Entwurf → Offen → Teilbezahlt → Bezahlt → Überfällig → Storniert
- Zahlung, Bankzuordnung und Rechnungsstorno mit atomaren Journal-/Statusänderungen; Replay-/Parallelitätskorrekturen lokal abgenommen. Ein eigenes Gutschrift-/Stornorechnungsdokument fehlt noch
- RC-Ausbau betrifft Eingangsbelege für Auslandsdienstleistungen; kein allgemeiner Ausbau von Auslands-Ausgangsrechnungen
- GiroCode (EPC-QR) auf PDF
- SMTP-Versand für Angebote, Rechnungen, Zahlungserinnerungen
- Zahlungserinnerung manuell (kein 1.–3.-Mahnlauf, kein Status „Gemahnt“)
- Fälligkeit aus Zahlungsziel; Überfällig-Status

### Belege, Kasse, Bank

- Manuelle Belegerfassung mit Bezeichnung, Datum und Kategorie nach Richtung; Ausgaben an Lieferant:innen, Einnahmen an Kund:innen. Normale Rechnungssteuer folgt dem Steuer-Modus; RC ist gesondert erfasst
- Datei-Upload am Beleg (PDF/Bild)
- Filterbare Belegübersicht; Export über Journal-CSV und Belegarchiv
- **Kassenbuch**: Bareinnahmen/-ausgaben, fortlaufender Saldo, Belegnummern; manuell, nicht aus Rechnungs-Barzahlung (ADR-0027)
- **Buchungsjournal** unveränderbar (Belege + Kasse + Rechnungs-Festschreibung + Zahlungs-Zufluss)
- Zahlung manuell markieren (inkl. Teilzahlung); **Zufluss-Journal** (Ist-Versteuerung / EÜR, ADR-0024)
- Bank: CSV/MT940-Import je Bankkonto + Eingangsmatching gegen offene Rechnungen (Match schreibt Zahlung inkl. Journal)

### E-Rechnung

- **Empfang**: XRechnung-UBL / ZUGFeRD-CII als XML; PDF mit `/EmbeddedFiles` (auch Flate) → Beleg vorbefüllen. Kein Scan-PDF ohne Anhang, kein PDF/A-3-Claim (ADR-0029)
- Revisionssicheres Ablegen der Originaldatei
- **Versand**: XRechnung-UBL / ZUGFeRD-CII als XML-Original aus festgeschriebener Rechnung; Validierung mit Fehlerliste; kein Hybrid-PDF/A-3 (ADR-0026: erst mit eigener PDF/A-3-Pipeline)

### Auswertungen & Export

- Dashboard light: Umsatz, offene Posten, Ausgaben-Trend (ohne USt-Zahllast-Widgets im Kleinunternehmer-Modus)
- EÜR light mit einfachem Quellen-/Kategorie-Mapping in beiden Steuer-Modi; kein vollständiger amtlicher Kategorienplan
- USt-Übersicht (Monat/Quartal/Jahr) — Regelbesteuerung; unter § 19 nur begrenzter RC-Arbeitsfall. UStVA-Kennzahlen + ELSTER-XML light (Self-File), kein ELSTER-Versand; RC im Code freigegeben, XML nur 2026 und Monat/Quartal
- Zusammenfassende Meldung (ZM) Übersicht — **nur Regelbesteuerung**; Kandidaten aus 0-USt-Einnahmen + Kontakt-Land (Self-File), kein ELSTER-Versand
- BWA light / einfache Einnahmen-Ausgaben-Sicht je Zeitraum
- DATEV light, EXTF-ähnlicher CSV; RC-Zeiträume werden vollständig abgelehnt
- Journal-CSV und Kontakte-/Katalog-CSV; kein allgemeiner Export aller Tabellen
- Belegarchiv-Export (ZIP) für Prüfung
- GoBD-Mindeststandard: Festschreibung, keine stille Änderung, Beleg↔Buchung, Verfahrensdoku-Vorlage

### Betrieb & Härten (BA14)

- Backup/Restore PocketBase-Volume (`docs/betrieb.md`)
- Security light: Secrets in `.env`, Session/CSRF-Hinweise, Header light
- Healthcheck `/health` + Compose-Healthchecks
- UX-Polish: leere States, Nav-Gruppen, Übersicht-Schnellstart

### Suche

- Volltextsuche light über Rechnungen, Belege, Kontakte, Angebote (BA14; kein eigener Suchindex)

---

## Meilenstein 2 — Steuer & Compliance vertiefen

**Einstieg (vereinbart 2026-08-15, nach M1-11):** nicht mit UStVA starten.

1. **Kategorien** — gemeinsame Auswahlliste für Belege und Kassenbuch, CRUD in den Stammdaten (vor M2-Steuerkeilen) ← erledigt
2. **Multi-Firma dünn** — Firma anlegen + wechseln (ADR-0018); später durch Mitgliedschaften und Rollen ergänzt (ADR-0025) ← erledigt
3. **UStVA-Zahlen / ELSTER-XML light** (Self-File-Vorbereitung) ← erledigt (ADR-0019)
4. Zusammenfassende Meldung (ZM) Übersicht ← erledigt (ADR-0020)
5. USt-IdNr.-Validierung (BZSt) ← erledigt (ADR-0021)
6. E-Rechnungs-Versand robust (Profile, Validierung, Fehlerfeedback) ← erledigt (ADR-0022); Browser kf 2026-08-15 ohne Fehler
7. Funktionstest M2 ← **bestanden** ([`funktionstest-m2.md`](./funktionstest-m2.md), [`issues/ergebnis-funktionstest-m2.md`](./issues/ergebnis-funktionstest-m2.md)); HTTPS ADR-0023 in Betrieb. **M2-01** nachgetestet (`13da9e7`). Freigabe **M2 Alltag trägt**. Blocker keine.

**Meilenstein 2 abgeschlossen.**

Erledigt und nicht vermischen: Kategorien, Multi-Firma dünn, UStVA/ZM light, USt-IdNr., E-Rechnungs-Versand, Dokumenten-Layout (Angebot/Rechnung über light hinaus), Marke (Logo/Favicon), Ist-Versteuerung (Journal-Nachzug Zahlungen), Multi-User / grobe Rechte, eigenes Passwort.

---

## Nach Meilenstein 2

Nicht durch den aktuellen Server-Stand verengen. Produktziel: Tool für jedermann — verschiedene Steuer-Modi, verschiedene Firmagrößen, mehrere Nutzer:innen. Die Arbeitsfirma auf `app.zettelruhe.de` ist Betrieb, nicht Scope-Deckel.

1. **Eigenes Passwort ändern** ← erledigt. `/app/passwort`; jede angemeldete Nutzer:in ändert nur das eigene (alt + neu + Bestätigung, 8 Zeichen). Fremdes Passwort unter `/app/nutzer` unverändert. Next-Session bleibt gültig.
2. **UX/UI (App-Layout / CSS-Modernisierung)** — erster Keil erledigt (Tokens, Tinte-Sidebar, Primitives, PageHeader, Übersicht, Login). Rest erledigt: Sidebar mobil Off-Canvas, PageHeader auf Firma / Nutzer:innen / Passwort (nur Optik) / Dokument-Details. Nicht Marke, nicht das erledigte Dokumenten-Layout Angebot/Rechnung, nicht M1-12 zurückbauen. Briefpapier-Hintergrund, Font-Upload, Mehrvorlagen und CSS-Profi-Layouts der Dokumente sind seit der Entscheidung vom 2026-09-10 Cloud-Ausbau.
3. **Multi-User / grobe Rechte** ← erledigt (ADR-0025); Server-Nachtest inkl. SMTP durch kf ohne Fehler. Eigenes Passwort (Punkt 1) nachgezogen.
4. **Übersicht / Dashboard** — erster Keil erledigt: Fälligkeiten, §-19-Jahresbalken (nur Kleinunternehmerregelung, Grenzen aus geltendem § 19 Abs. 1), Verlauf 6/Jahr/12. Follow-up erledigt: Ausgaben nach Kategorien (Donut, Monat/Quartal), letzte Buchungen aus dem Journal.

Daneben separat: **Kassenbuch aus Barzahlung** ← erledigt als Schnitt, kein Bau (ADR-0027). **MT940** ← erledigt (ADR-0028, klassisches SWIFT/STA). **ZUGFeRD-Empfang-Parsing** ← erledigt (ADR-0029, PDF-Attachment Flate). Hybrid-PDF Schnitt erledigt, Bau zurückgestellt (ADR-0026). Ist-Versteuerung (Journal-Nachzug) ist erledigt (ADR-0024). **OS-Kern vs. Cloud-Control-Plane** ← erledigt als Schnitt, kein Bau (ADR-0030); Release-Tag `meilenstein-2`. Open Decisions nach M2 leer.

---

## Reverse Charge nach M2

Umgesetzt sind betriebliche EU-/Drittlandsdienstleistungen in EUR, Lieferantenvorschläge,
Belegerfassung, atomare Festschreibung und Korrektur, UStVA-Kennzahlen 46/47,
84/85 und 67 sowie RC-Daten in Journal-CSV und Belegarchiv. Auch unter § 19
ist ein begrenzter RC-Arbeitsfall verfügbar. Schuld und Vorsteuer folgen dem
Steuerdatum; EÜR und Geldberichte bleiben am Buchungsdatum.

Die Festschreibung unterstützt eine vollständige Zahlung und vollen oder
ausgeschlossenen Vorsteuerabzug. Unbezahlte/teilbezahlte Belege bleiben Entwürfe;
mehrere Zahlungen, Warenfälle, Fremdwährungen, Mischbelege und teilweise
Abziehbarkeit sind nicht unterstützt. RC-Hinweise im E-Rechnungsempfang führen
zur manuellen Erfassung. Der lokale XML-Export ist kein Abgabeweg.
Details und Abnahmen: [RC-Umsetzung](reverse-charge-umsetzung.md).

## Frühere v1-Wünsche außerhalb des aktuellen Releaseumfangs

Beim Codeabgleich weiterhin nicht als eigene Funktionen vorhanden. Die frühere
Aufnahme in die v1-Liste war kein Implementierungsnachweis. Diese Erweiterungen
sind Kandidaten für die Cloud-Version, keine Voraussetzungen für den heutigen
Open-Source-Release. Notwendige Fehlerkorrekturen am vorhandenen Umfang bleiben
Kernpflege; die Cloud-Reihenfolge ist noch nicht beschlossen.

- Eigene Rabattfelder an Angeboten/Rechnungen.
- Eigenes Gutschrift-/Stornorechnungsdokument.
- CSV-Listenexporte für Angebote, Rechnungen und Belege sowie allgemeiner Tabellenexport.
- Bankmatching gegen Ausgabenbelege.
- Vollständiger amtlicher EÜR-Kategorienplan.

## Geplanter Komfortausbau ausschließlich für Zettelruhe Cloud

- Mengeneinheiten in den Firmeneinstellungen pflegen (analog Kategorien und Katalog): eigene Liste je Firma, Bezeichnungen/Abkürzungen, optional Einzahl und Mehrzahl je nach Menge; Standardliste vorbefüllt. Bis dahin feste Auswahlliste; Stunden als „Std.“ (TP-008/TP-009)
- Dokumenten-Layout nochmal ansehen (Schnitt 2026-08-16 bewusst schlank): Briefpapier-Hintergrund (PNG sowie PDF-Stempel Seite 1 / Folgeseiten), Schrift-Upload und mitgelieferte Hausschrift, Inhaber:in an der Firma, Kunden-Nr. auf Angebot/Rechnung-PDF (Vergabe am Kontakt steht), Ansprechpartner „z. Hd.“ auf dem PDF, AGB als weitere Seiten, Live-Vorschau/Studio in den Einstellungen, Mehrvorlagen, CSS-Profi-Layouts
- Automatischer Mahnlauf (1.–3., Gebühren, Zinsen)
- Abschlags- & Schlussrechnungskette
- Lieferscheine
- SEPA-Mandate
- Verpflegungspauschalen / erweiterte Reisekosten
- Anlagenverzeichnis, GWG, AfA
- Projekt-Budgets / Stundendeckel
- Mobile-optimierte Erfassung (PWA o. Ä.)
- Steuerberater-Lesezugriff / DATEV-Services-Push
- REST-API (Shop-Anbindung etc.)
- Stateless PocketBase-URL-Adapter (ADR-0030): technische Ausnahme bei tatsächlichem Cloud-Bedarf, kein neues Self-hosting-Produktfeature. Pilotmodell im Releaseplan noch zu entscheiden.

---

## Separates Projekt: Cloud-Plattform (Control Plane & Managed Hosting)

Nicht in diesem Repository (ADR-0030). Geplantes separates Projekt (`zettelruhe-cloud`), angeboten als bezahltes Managed-Hosting-Abo. Pro Kunde eine eigene PocketBase-Instanz mit eigener Datenbank und Dateien. Die oben genannten Komfortwünsche einschließlich TP-009 werden hier weitergeplant, nicht im Open-Source-Angebot.

Vor proprietären Änderungen am AGPL-Kern Lizenz-/Rechtegrenze festlegen, siehe [Releaseplan](release-und-cloud-plan.md). Noch kein Projekt angelegt. Zusätzlich erforderlich:

- Stripe Checkout & Subscription Billing
- Tenant Provisioner (Docker- und Volume-Management pro Mandant, eine PocketBase-Instanz je Mandant)
- Caddy-API für Wildcard-Subdomains (`kunde.app.zettelruhe.de`)
- Cloud-Zusatzdienste: KI-OCR-Belegerkennung, Live-Bank-PSD2-Gateway
- Kundenportal / Pay-Links
- Automatisierte getrennte Backups, Restore pro Kunde, Update-/Migrationssteuerung, Monitoring und Supportabläufe
- Optionaler Hybrid-PDF/A-3-Ausbau nur mit geeigneter Pipeline; Entscheidung gegen einen bloßen XML-Anhang bleibt bestehen

---

## Bewusst nicht (vorerst)

- Shared-Database-Multi-Tenancy für Finanzen (physische DB-Isolation bleibt gesetzt, ADR-0030)
- Feature-Parität zu Papierkram
- Bilanz / vollständige doppelte Buchführung als Produktversprechen
- Soll-Versteuerung
- DACH/EU-Steuerprofile von Tag 1
- Mitarbeiter-HR / Lohn
- Kanzlei-Mandantenverwaltung
- GoBD-Zertifikat als Kaufargument v1
- SaaS-Plattform-Code in diesem Repo (Self-hosted first; Cloud nur als separates Projekt, ADR-0030)
- „Kleingewerbe“ als eigener Gewerberecht-Workflow (Handelsregister o. Ä.) — steuermäßig zählt der **Steuer-Modus** (§ 19 vs. Regelbesteuerung), nicht der Gewerbestatus-Label

---

## Abgelöste Phasen-Skizze

Die frühere Datei `Umsetzungsentwurf Papierkram.de v1.md` bleibt als Rohidee; **verbindlich für Scope ist diese Roadmap** plus `CONTEXT.md`.
