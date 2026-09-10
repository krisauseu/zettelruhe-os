# E-Rechnung: Anti-Corruption-Layer statt Lib-Lock-in

Das Modul `einvoice` exponiert ein stabiles internes DTO (z. B. `ParsedEInvoice`) und Adapter für XRechnung/ZUGFeRD (UBL/CII, PDF-embedded XML). Domain und Belegvorausfüllung hängen nicht an einer konkreten Parser-Bibliothek; kein Java-Mustang-Sidecar in v1. Begründung: Node-Parser-Ökosystem ist heterogen/teilweise beta; Empfang+Raw-Archiv (ADR-0003, ADR-0012) muss austauschbare Implementierung erlauben.
