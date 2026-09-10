# Mitgliedschaft je Firma, drei grobe Rollen

Nutzer:innen kommen über eine Mitgliedschaft an eine Firma (`user` + `firma` + Rolle). Drei Rollen: **Eigentümer:in** (verwalten inkl. Einladen), **Bearbeiten** (Alltag schreiben), **Lesen** (nur sehen). `users.firma` bleibt die zuletzt aktive Firma (Login-Landung, ADR-0018). Die Instanz-Eigentümer:in aus dem Setup legt weitere Firmen an; eingeladene Logins bekommen `users.role=nutzer`. Einladen setzt Name, E-Mail, Startpasswort und Rolle — ohne SMTP-Pflicht, analog Setup-verified. Ist SMTP eingerichtet, geht eine Hinweis-Mail ohne Startpasswort raus; ohne SMTP bleibt das Einladen gültig. Isolation: Session nur mit Mitgliedschaft; der Wechsler zeigt nur Mitgliedsfirmen. Bestehende Instanz-Eigentümer:innen erhalten Mitgliedschaft Eigentümer:in auf allen vorhandenen Firmen. Begründung: ADR-0018 hat die Mitgliedschaft bewusst für diesen Schnitt gelassen; grobe Rollen reichen für Alltag und späteren Lesezugriff, ohne Kanzlei- oder Feinrechte.

## Alternatives considered

- Rechte nur an `users.role`, alle sehen alle Firmen — bricht die Firma-Grenze und sieht nach Instanz-Team aus.
- Feinrechte je Modul — nicht grob, später kaum zurückzubauen.
- Einladen nur per E-Mail-Link — hängt an SMTP; Login und Setup tun das bewusst nicht.
- `users.firma` auf Mehrfachrelation — bricht die 1:1-Landung (ADR-0018).
- Steuerberater-Portal / DATEV-Push — Roadmap „Später“, hier nur Rolle Lesen als Grundlage.
