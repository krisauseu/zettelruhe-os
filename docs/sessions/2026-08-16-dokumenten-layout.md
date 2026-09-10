# Session 2026-08-16 — Dokumenten-Layout Angebot/Rechnung

## Done

Angebots- und Rechnungs-PDF über M1-10 light (Logo, Akzent, Kopf-/Fußtext) hinaus, ohne Vermischung mit Marke, Hybrid-PDF oder E-Rechnungs-XML.

- Gemeinsames Gerüst in `pdf.tsx`: DIN-ähnliche Fenstertasche, Firmenblock rechts in der Akzentfarbe, Titel mit Nummer erst nach Festschreibung/Senden, Meta-Zeile, Akzent-Tabellenkopf, Zebrastreifen, Summen.
- Beide Steuer-Modi: Kleinunternehmerregelung ohne USt-Zeilen + §-19-Hinweis; Regelbesteuerung mit Ausweis (einheitlicher Satz in der USt-Zeile).
- Erstes aktives Bankkonto mit IBAN → Fußzeile; GiroCode (EPC 002) nur auf der Rechnung, wenn Zahlblock an und IBAN da. Angebot ohne Zahlblock.
- Schalter an der Firma (`1730001700`): Header/Logo, Fußzeile, Zahlblock. Defaults an; bestehende Firmen nachgezogen.
- Entwurf unverändert: Wasserzeichen „Entwurf“, kein Nummernkreis, on-the-fly. Originale erst bei Senden/Festschreibung, bestehende Dateien unangetastet (ADR-0012).
- Roadmap „Später“: Dokumenten-Layout nochmal ansehen (Briefpapier, Font-Upload, Inhaber:in, Kunden-Nr., AGB, Studio-Vorschau, Mehrvorlagen).

## Verifikation

- 389 Unit-Tests inkl. GiroCode-Payload, Bankwahl, PDF-Render-Rauchtest (`%PDF`) + `tsc --noEmit`.
- Kein Browser-Nachtest in dieser Session (localhost von außen nicht erreichbar). Einstellungen: `/app/firma`, Fieldset Dokumenten-Layout.

## Nicht angefasst

- Logo/Favicon der Marke (nächster Chat)
- Briefpapier-Hintergrund, Schrift-Upload, Inhaber:in, Kunden-Nr., Ansprechpartner auf dem PDF, AGB-Anhang, Live-Studio
- Multi-User, Open Decisions, Hybrid-PDF, M1-15, UStVA/ZM-Logik, Ist-Versteuerung, Setup-verified
- Commit/Push

## Next step

Marke: Zettelruhe-Logo und Favicon, oben links in der Shell.
