# Zettelruhe

Open-Source-Webanwendung unter [zettelruhe.de](https://zettelruhe.de) für die Buchhaltung und Abrechnung von Solo-Selbstständigen in Deutschland — self-hosted, EÜR-orientiert, Papierkram-Alternative mit bewusstem 80%-Fokus.

## Language

### Akteure & Organisation

**Firma**:
Die rechtliche Wirtschaftseinheit, deren Bücher und Belege geführt werden. Das Datenmodell ist firma-gebunden. Die Instanz-Eigentümer:in kann mehrere Firmen anlegen; der Zugang anderer Nutzer:innen läuft über eine Mitgliedschaft. In der Session ist immer eine Firma aktiv. In den Firmeneinstellungen ist der Steuer-Modus zentral (u. a. umsatzsteuerfrei über Kleinunternehmerregelung — typisch auch für Kleingewerbe am Anfang).
_Avoid_: Account, Tenant, Workspace (im Fachvokabular)

**Steuer-Modus**:
Firmeneinstellung, die alle Belege, Rechnungen, Auswertungen und Pflichttexte steuert. v1 kennt zwei Ausprägungen: **Kleinunternehmerregelung** (§ 19 UStG) und **Regelbesteuerung** (nur Ist-Versteuerung).
_Avoid_: Steuertyp (unscharf), VAT mode (im UI)

**Kleinunternehmerregelung**:
Steuer-Modus mit Umsatzsteuerbefreiung der eigenen Umsätze und Rechnungen ohne USt-Ausweis mit gesetzlichem Hinweis. Für bezogene §-13b-Leistungen können trotzdem Steuerschuld und Erklärungspflichten entstehen; für den hier unterstützten Kleinunternehmerfall entfällt der Vorsteuerabzug.
_Avoid_: Keine USt (als alleiniger Label-Text ohne §-19-Bezug), umsatzsteuerbefreit (als Rechtsbegriff ohne § 19)

**Reverse Charge**:
Steuerschuld des Leistungsempfängers nach § 13b UStG, getrennt von ausgewiesener Rechnungssteuer und Lieferantenzahlung. Der Vorsteuerabzug hängt von der Berechtigung ab; 0 % Rechnungssteuer allein ist keine RC-Klassifikation.
_Avoid_: 0-Prozent-Steuer (als Synonym), zusätzliche Lieferantenzahlung

**Regelbesteuerung**:
Steuer-Modus mit Umsatzsteuer auf Ausgangsrechnungen und Vorsteuer auf Belegen; in v1 ausschließlich **Ist-Versteuerung** (keine Soll-Versteuerung).
_Avoid_: Normalbesteuerung (wenn Regelbesteuerung gemeint ist)

**Eigentümer:in**:
Zwei Ebenen, derselbe Fachbegriff. **Instanz-Eigentümer:in**: die Person aus dem Setup-Wizard; sie legt weitere Firmen an (`users.role=eigentuemer`). **Eigentümer:in der Firma**: Mitgliedschaftsrolle mit allen Rechten an dieser Firma, einschließlich Einladen und Firmeneinstellungen.
_Avoid_: Admin (allein als Domänenbegriff), Teammitglied

**Nutzer:in**:
Ein Login. Zugang zu Firmen nur über Mitgliedschaft. Eingeladene Konten haben `users.role=nutzer`. Das eigene Passwort ändert jede angemeldete Person selbst.
_Avoid_: User (im UI), Teammitglied, Mitarbeiter:in (als Rollenlabel)

**Mitgliedschaft**:
Verbindung Nutzer:in ↔ Firma mit einer groben Rolle. `users.firma` bleibt die zuletzt aktive Firma (Login-Landung), keine Mehrfachrelation.
_Avoid_: Membership (im UI), Tenant-Zuordnung

**Rolle**:
Grobes Recht an der Firma: **Eigentümer:in** (verwalten, einladen), **Bearbeiten** (Alltag schreiben), **Lesen** (nur sehen). Keine Feinrechte je Modul. Rolle Lesen ist die Grundlage für späteren Steuerberater-Lesezugriff, kein Kanzlei-Portal.
_Avoid_: Permission, Admin, Teamrolle

**Einladen**:
Eigentümer:in der Firma legt einen Zugang an (Name, E-Mail, Startpasswort, Rolle) oder ordnet eine bestehende E-Mail dieser Firma zu. Ohne SMTP-Pflicht.
_Avoid_: Invite-only per Mail, Onboarding (als Produktwort)

**Solo-Selbstständige:r**:
Die primäre Nutzer:in — der Alltag, den die Software löst. Weitere Nutzer:innen (z. B. Mithilfe, Lesezugriff) sind möglich; kein Kanzlei-Mandantenbetrieb.
_Avoid_: Team, Multi-User-Organisation, Kanzlei-Mandant

**Kontakt**:
Eine Person oder Organisation, mit der die Firma geschäftlich zu tun hat. Oberbegriff für Kund:innen und Lieferant:innen.
_Avoid_: Account, Partner (alleinstehend)

**Kund:in**:
Ein Kontakt, an den Angebote und Rechnungen gehen und dem Zeiten, Fahrten und Projekte zugeordnet werden.
_Avoid_: Client, Buyer

**Lieferant:in**:
Ein Kontakt, von dem Ausgabenbelege stammen.
_Avoid_: Vendor, Creditor (im UI)

**Kontaktnummer**:
Fortlaufende Nummer je Kontakt der Firma (Kund:in und Lieferant:in), vergeben bei Neuanlage aus dem Nummernkreis der Firma. Die PocketBase-ID bleibt die interne Verknüpfung.
_Avoid_: Kundennummer (als alleiniger Name), Debitorennummer, Account-Nr.

### Arbeit & Abrechnung

**Projekt**:
Eine optionale Arbeitseinheit unter einer:m Kund:in. Zeiten und Fahrten hängen primär an der:m Kund:in; ein Projekt bündelt sie nur, wenn gewünscht.
_Avoid_: Job, Auftrag (solange nicht als eigener Status/Workflow definiert)

**Zeiteintrag**:
Erfasste Arbeitszeit mit Pflichtbezug zu Kund:in und optionalem Projekt; Status abrechenbar, nicht abrechenbar oder abgerechnet.
_Avoid_: Timesheet (als Entität), Timer-only

**Fahrt**:
Erfasste dienstliche Kilometer mit Pflichtbezug zu Kund:in und optionalem Projekt. Dient der Weiterberechnung an Kund:innen und/oder der steuerlichen Reisekosten; Standard ist abrechenbar.
_Avoid_: Trip, Mileage (im UI)

### Dokumente & Zahlungen

**Angebot**:
Noch nicht verbindliches Verkaufsdokument an eine:n Kund:in. Status: Entwurf, Gesendet, Angenommen, Abgelehnt, Abgelaufen, Abgerechnet.
_Avoid_: Quote (im UI)

**Rechnung**:
Zahlungsaufforderung an eine:n Kund:in; aus Angebot, Zeiten/Fahrten, wiederkehrendem Rhythmus oder frei. Status: Entwurf, Offen, Teilbezahlt, Bezahlt, Überfällig, Storniert. Die endgültige Rechnungsnummer wird erst bei Festschreiben/Senden vergeben (Entwürfe verbrauchen keinen Nummernkreis). Darstellung und Pflichtangaben folgen dem Steuer-Modus der Firma (mit/ohne USt).
_Avoid_: Bill, Invoice (im UI)

**Wiederkehrende Rechnung**:
Vorlage bzw. Rhythmus, aus dem periodisch Rechnungen erzeugt werden (Abo/Dauerrechnung) — Bestandteil von v1.
_Avoid_: Subscription (im UI)

**Gutschrift / Stornorechnung**:
Korrekturdokument zu einer Rechnung. Ein eigenes Gutschrift-/Stornorechnungsdokument ist noch offen; vorhanden ist Rechnungsstorno mit Gegenbuchung statt stiller Änderung. Keine Abschlags-/Schlussrechnungskette in v1.
_Avoid_: Credit note (im UI), Abschlagsrechnung (als v1-Feature)

**Zahlungserinnerung**:
Manuell erzeugtes Mahn-Dokument bei überfälliger Rechnung; kein automatischer 1.–3.-Mahnlauf und kein Status „Gemahnt“ in v1.
_Avoid_: Mahnlauf (als v1-Automatik)

**E-Rechnung**:
Strukturierte elektronische Rechnung nach EN 16931 (XRechnung und/oder ZUGFeRD). Empfang archiviert das Original unverändert und parst XRechnung-UBL, CII-XML sowie PDF-Anhänge (`factur-x.xml` / `zugferd-invoice.xml`, auch Flate; ADR-0029). Ein Scan-PDF ohne Anhang ist keine E-Rechnung. Versand erzeugt XML-Originale (XRechnung-UBL / ZUGFeRD-CII) aus der festgeschriebenen Rechnung — kein Hybrid-PDF/A-3, kein Zertifizierungs-Claim. Ein Factur-X-/ZUGFeRD-Hybrid erst, wenn eine eigene PDF/A-3-Pipeline das Niveau hält (ADR-0026); kein XML-Anhang auf dem Alltags-PDF als Ersatz.
_Avoid_: PDF-Rechnung (als Synonym — PDF allein ist keine E-Rechnung), ZUGFeRD-PDF (solange kein PDF/A-3-Hybrid existiert)

**Beleg**:
Nachweis einer Ausgabe oder Einnahme (Datei + Metadaten), der ins Buchungsjournal eingeht.
_Avoid_: Receipt (im UI), Dokument (allein zu unscharf)

**Kategorie**:
Firma-gebundene Auswahlliste für Belege und Kassenbuch (`/app/kategorien`). Am Beleg und am Kassenbuch-Eintrag bleibt `kategorie` ein Text-Schnappschuss; Umbenennen ändert nicht die Historie.
_Avoid_: Tag, Label (im UI)

**Zahlung**:
Ausgleich einer offenen Rechnung; manuell markierbar (inkl. Teilzahlung) oder per Kontoauszugs-Import (CSV/MT940) gematcht. Erzeugt eine Zufluss-Buchung im Journal (Ist-Versteuerung / EÜR); die Forderungsbuchung der Rechnung bleibt bei der Festschreibung.
_Avoid_: Transaction (allein)

**Nummernkreis**:
Konfigurierbare, fortlaufende Nummerierung je Dokumentart (Angebot, Rechnung, Gutschrift/Storno, optional Beleg, Kassenbuch-Belegnummer) und für die Kontaktnummer.

### Buchhaltung & Compliance

**EÜR**:
Einnahmen-Überschuss-Rechnung als primäres Auswertungsziel — nicht Bilanz/GuV-Vollbuchhaltung.
_Avoid_: Doppelte Buchführung (als Nutzerversprechen v1), Bilanzbuchhaltung

**Buchungsjournal**:
Unveränderbare, fortlaufende Aufzeichnung der Buchungen aus Belegen, Rechnungen, Zahlungen und Kasse; Grundlage unter der belegorientierten UX. Auswertungen (EÜR, USt, ZM, DATEV) zählen Einnahmen aus Rechnungen nach Zufluss (Quelle Zahlung), nicht nach der Forderungsbuchung der Festschreibung.
_Avoid_: Ledger (im UI), Hauptbuch (als v1-Versprechen)

**Kassenbuch**:
Eigenständiges, fortlaufendes Verzeichnis von Bareinnahmen und -ausgaben mit Saldo; fließt ins Buchungsjournal; GoBD-tauglich fortgeschrieben.
_Avoid_: Cash register, Kasse (allein, wenn das Buch gemeint ist)

**Festschreibung**:
Zeitpunkt, ab dem eine Buchung oder ein Beleg nicht mehr still geändert werden darf; Korrekturen nur über Storno/Gegenbuchung.
_Avoid_: Soft delete, überschreiben

**USt-Übersicht**:
Zusammenstellung der Umsatzsteuer-Zahllast je Zeitraum zur Vorbereitung der eigenen UStVA. Der normale Arbeitsflow betrifft Regelbesteuerung; §-13b-Eingangsleistungen können auch bei Kleinunternehmern eine Erklärung erfordern. Unter Regelbesteuerung: typische UStVA-Kennzahlen zum Selbst-Eintragen in Mein Elster plus optionaler XML-Download (light, lokal) — kein ELSTER-Versand, keine Abgabe aus der App.
_Avoid_: UStVA-Abgabe (als Versprechen), ELSTER-Versand

**Zusammenfassende Meldung (ZM)**:
Übersicht zur Vorbereitung der Zusammenfassenden Meldung in Mein Elster (innergemeinschaftliche Lieferungen/sonstige Leistungen). Nur Regelbesteuerung; Zahlen aus dem Buchungsjournal der aktiven Firma plus aktuellem Land am Kontakt. 0-USt-Einnahmen an Kontakte im übrigen EU-Gebiet erscheinen als Kandidaten — Art (Lieferung/Leistung/Dreieck) wird nicht geraten. Die USt-IdNr. kommt aus dem Kontakt-Stamm (Notiz nur Fallback); ein BZSt-Schnappschuss gilt nur für den Anfragezeitpunkt, nicht für den Umsatz. Unter Kleinunternehmerregelung typisch nicht relevant. Kein ELSTER-Versand, keine Abgabe aus der App.
_Avoid_: ZM-Abgabe (als Versprechen), ELSTER-Versand, ig. Lieferung (als festgestellte Buchungsart)

**USt-IdNr.**:
Umsatzsteuer-Identifikationsnummer. Die eigene steht an der Firma, die fremde am Kontakt. Optional in beiden Steuer-Modi. Ihr Vorliegen allein entscheidet weder Steuerbehandlung noch Erklärungspflicht; §-13b-Eingangsleistungen sind gesondert zu prüfen.
_Avoid_: VAT ID (im UI), UID (allein, außer als Import-Alias)

**BZSt-Bestätigung**:
Punktuelle Abfrage des BZSt-Auslandsverfahrens (eVatR REST) zur fremden EU-USt-IdNr. gegenüber der eigenen DE-Nummer. Ergebnis ist ein Schnappschuss zum Anfragezeitpunkt (einfach oder qualifiziert), kein Dauer-„gültig“-Stempel und keine Abgabe. DE→DE und eine isolierte Bestätigung der eigenen DE-Nummer gibt das Verfahren nicht her.
_Avoid_: USt-Id gültig (als Stammdaten-Flag), VIES (als Produktname), ELSTER-Versand

**Bankkonto**:
Zahlweg der Firma für unbare Zahlungseingänge/-ausgänge; Stammdaten für CSV/MT940-Import. Das Modell erlaubt mehrere Bankkonten; Kassenbuch bleibt davon getrennt.
_Avoid_: Konto (allein — kollidiert mit SKR-Konto)

**DATEV-Export**:
Übergabe der Buchungsdaten an die Steuerkanzlei als DATEV light. RC-Zeiträume werden vollständig abgelehnt; für sie steht der Journal-CSV mit RC-Daten zur Verfügung.
_Avoid_: ELSTER (als v1-Kernfeature)

## Scope-Grenzen (bewusst)

- **Produkt**: Zettelruhe / zettelruhe.de
- **v1-Betrieb**: Self-hosted; Instanz-Eigentümer:in plus eingeladene Nutzer:innen mit groben Rechten je Firma (Mitgliedschaft); mehrere Firmen in einer Instanz (Session wechselt die aktive Firma); Schema firma-gebunden
- **Repo-Grenze**: Dieses Repository ist der Open-Source-Kern (eine PocketBase-Instanz, `docker compose up`). SaaS-Plattform (Stripe, Mandanten-Provisioning, Subdomains, Cloud-OCR/PSD2, Kundenportal) gehört in ein separates Control-Plane-Projekt. Keine Shared-Database-Multi-Tenancy für Finanzen. Generische Kern-Schnittstelle: serverseitiger Instanzkontext mit gebundenem PB-/Session-Zugriff, umgesetzt nach v1.0.0 für Cloud-TP-002. Siehe `docs/instance-context.md`; die historische Adapterentscheidung steht in ADR-0030.
- **Markt**: Deutschland (UStG, EÜR, DATEV, XRechnung/ZUGFeRD, GoBD-Mindeststandard ohne externe Zertifizierung)
- **Steuer v1**: Kleinunternehmerregelung (§ 19, eigene Umsätze ohne USt-Ausweis; §-13b-Eingangsleistungen gesondert) **oder** Regelbesteuerung nur Ist-Versteuerung; Wechsel muss in Einstellungen und allen Dokument-/Auswertungsflüssen greifen
- **v1-Happy-Path**: Stammdaten inkl. Steuer-Modus → Kontakte/optionale Projekte → Zeiten/Fahrten → Angebot/Rechnung (inkl. wiederkehrend, Nummern erst bei Senden) → Belege + Kassenbuch (Kategorie aus Stammliste) + Bankkonten → Zahlung (manuell/CSV/MT940) → E-Rechnung-Empfang → EÜR (+ USt- und ZM-Übersicht bei Regelbesteuerung; begrenzte RC-USt-Übersicht auch unter § 19) → DATEV + Journal + Belegarchiv-Export
- **Meilenstein 2**: Kategorien, Multi-Firma dünn, UStVA/ELSTER-XML light, ZM-Übersicht, USt-IdNr.-Prüfung und E-Rechnungs-Versand. Checkliste: `docs/funktionstest-m2.md`. HTTPS: Host-Caddy, `app.zettelruhe.de` (ADR-0023). Funktionstest M2 (lokal + Server) **bestanden**; M2-01 nachgetestet. Freigabe **M2 Alltag trägt**. Blocker keine. Dokumenten-Layout Angebot/Rechnung (über light hinaus) steht; Vertiefung wie Briefpapier und Font-Upload ist seit 2026-09-10 für Zettelruhe Cloud vorgesehen. Marke (Logo/Favicon der App, nicht firmen.logo) steht. **Ist-Versteuerung:** Zahlung erzeugt eine Zufluss-Buchung im Journal (ADR-0024). **Multi-User / grobe Rechte:** Mitgliedschaft je Firma, Einladen und Rollen im UI (ADR-0025).
- **Nicht v1**: Soll-Versteuerung, Abschlagskette, automatischer Mahnlauf, PSD2, OCR-Pflicht, REST-API-Pflicht, Kundenportal, Lieferschein, CSS-Profi-Layouts, SEPA-Mandate, PayPal/Stripe-Links, Verpflegungspauschalen, Anlagen/AfA-Vollmodul, Steuerberater-Portal, Bilanz, DACH

- **Weiterentwicklung ab 2026-09-10**: Der heutige Open-Source-Umfang wird als Release abgeschlossen. Fehlerkorrekturen, Sicherheit und Pflege vorhandener Funktionen bleiben im Kern. Neue Komfortfunktionen wie Belegerkennung, Briefpapier und die bisherige Später-Liste gehören in das separate Managed-Hosting-Abo `zettelruhe-cloud`, mit eigener PocketBase-Instanz samt Datenbank und Dateien pro Kunde. Stripe verwaltet dort das Hosting-Abo, nicht die Rechnungszahlungen der Kundenfirmen.
