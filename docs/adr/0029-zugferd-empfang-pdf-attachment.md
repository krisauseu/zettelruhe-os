# Empfang liest PDF-Attachments (Flate), kein Hybrid

Empfang extrahiert das erste CII- oder UBL-Invoice-XML aus `/EmbeddedFiles`: Objekt mit `/Type /EmbeddedFile` (Whitespace egal, `/Params` darf verschachtelt sein), Stream-Filter keiner oder `/FlateDecode` (Node `zlib`). Bekannte Dateinamen (`factur-x.xml`, `zugferd-invoice.xml`, `ZUGFeRD-invoice.xml`, `xrechnung.xml`) wählen, wenn das Filespec `/EF` auf den Stream zeigt; sonst das erste Invoice-XML. Unkomprimiertes XML im Bytestrom bleibt Fallback. Domain hängt am DTO `ParsedEInvoice` (ADR-0015). Das Original bleibt unverändert archiviert, auch bei Parse-Fehler (ADR-0012). Empfang allein schreibt kein Journal. Bereits archivierte Empfänge werden nicht nachgezogen. Kein `pdf-lib`, kein Mustang, kein PDF/A-3- oder Factur-X-Konformitätsclaim, kein Schreiben eines Hybrids (ADR-0026). Verschlüsselte PDFs (`/Encrypt`) und PDFs ohne Anhang scheitern ehrlich — XML hochladen oder Beleg manuell. Beträge kommen nicht aus sichtbarem PDF-Text. Begründung: typische Factur-X-Attachments sind Flate; der light Byte-Scan findet sie nicht; raten wäre unehrlich.

## Alternatives considered

- `pdf-lib` nur zum Lesen — keine `getAttachments()`-API; `attach()` schreibt und läge an ADR-0026. Der gehaltene Ausschnitt braucht die Lib nicht.
- Light Scan belassen und nur den UI-Text ehrlich machen — Alltag (Flate-Anhang) bleibt tot.
- Kitchen-Sink / KoSIT / Schematron / Mustang — widerspricht ADR-0015; würde ein Niveau tragen, das wir nicht halten.
- Inbox-Nachparse bereits archivierter Empfänge — stilles Ändern geparster Felder; Anlegen ≠ Ändern.
- Unbekannte Filter oder alle Flate-Content-Streams aufblasen — Raten; nur `/EmbeddedFile` plus bekannter Filter.
