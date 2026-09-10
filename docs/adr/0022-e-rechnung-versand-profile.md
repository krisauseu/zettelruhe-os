# E-Rechnungs-Versand: XML-Profile hinter dem Anti-Corruption-Layer

Ausgang ist die festgeschriebene Rechnung der aktiven Firma. Next erzeugt ein strukturiertes EN-16931-XML — Profil **XRechnung 3.0 (UBL)** oder **ZUGFeRD/Factur-X EN 16931 (CII)** — und archiviert es als eigenes Original. Das menschliche Rechnungs-PDF bleibt unangetastet. Ein Hybrid-ZUGFeRD-PDF/A-3 gibt es in diesem Keil nicht: `@react-pdf/renderer` liefert kein PDF/A-3 (ADR-0014), ein Mustang-Sidecar bleibt ausgeschlossen (ADR-0015). Validierung ist eine eigene Pflichtfeld- und Steuer-Modus-Prüfung mit de-DE-Fehlerliste, plus Round-Trip durch den bestehenden Parser — kein KoSIT-, kein Schematron-, kein Zertifizierungs-Claim. Kleinunternehmerregelung: keine USt-Zeilen, gesetzlicher Hinweis; Regelbesteuerung: Ausweis aus den Positionen. 0-%-Zeilen unter Regelbesteuerung werden nicht als Reverse Charge geraten. Begründung: Empfang (ADR-0003/0015) kennt dieselben zwei XML-Formate; Versand muss ehrlich dasselbe können, ohne festgeschriebene Dateien zu überschreiben (ADR-0012).

## Alternatives considered

- Hybrid-ZUGFeRD (PDF/A-3 + eingebettetes CII) in diesem Keil — unehrlich ohne PDF/A-3-Pipeline oder Mustang.
- Nur XRechnung oder nur CII — die Roadmap nennt beide; Empfang parst beide.
- KoSIT-/Mustang-Validator als Sidecar — widerspricht ADR-0015; würde einen Zertifizierungs-Schein tragen, den wir nicht halten.
- E-Rechnung still ins Rechnungs-PDF schreiben oder bei jeder Erzeugung überschreiben — verstößt gegen Festschreibung.
- Leitweg-ID / Käuferreferenz still als „NA“ füllen — XRechnung verlangt BT-10; fehlende Angabe muss sichtbar scheitern.
