# Open-Source-Kern getrennt von der Cloud-Control-Plane; PocketBase-URL nur per Adapter

Dieses Repository (`zettelruhe`) ist der **Open-Source-Kern**: die Buchhaltungs- und Rechnungs-Anwendung für Solo-Selbstständige, self-hosted-first (ADR-0001). Sie muss out-of-the-box mit `docker compose up` oder lokal mit **einer** PocketBase-Instanz laufen. Kommerzielle SaaS-Logik kommt **nicht** in diesen Baum: kein Stripe-Abo, kein Mandanten-Provisioning (Container/Volumes pro Mandant), keine Server-/Caddy-Verwaltung, kein bezahltes Cloud-Onboarding, keine Cloud-Zusatzdienste (KI-OCR, Live-Bank/PSD2, Kundenportal/Pay-Links). Diese Ebene liegt in einem geplanten, getrennten privaten Projekt (`zettelruhe-cloud` / Control Plane).

Die einzige vorbereitete Schnittstelle im Kern ist **Stateless Multi-Tenant Readiness** am App-Tier. Next bleibt ohne eigene App-DB. Der PocketBase-Zugriff liest standardmäßig `PB_URL` (Compose intern `http://pocketbase:8090`, ADR-0007 / ADR-0023). Optional darf ein Adapter die Ziel-Instanz aus Header oder Subdomain auflösen, damit **derselbe Next.js-Build** in der Cloud ein geteiltes Frontend für viele physisch isolierte PocketBase-Instanzen sein kann. Isolation der Finanzdaten bleibt **eine PocketBase-SQLite-Instanz je Mandant**, nicht eine gemeinsame Datenbank mit Mandanten-Spalte. Multi-Firma und Mitgliedschaft (ADR-0002, ADR-0018, ADR-0025) gelten weiter **innerhalb** einer Instanz. Finanz-Writes bleiben ausschließlich Next (ADR-0006). Der Adapter ist in diesem Schnitt **entschieden, nicht gebaut**.

Begründung: Shared-Database-Multi-Tenancy für Bücher wäre nachträglich teuer und widerspricht GoBD-Vertrauen und Self-Hosted-Backup (`pb_data` als ein Volume). SaaS-Code im Kern würde `docker compose up` und den AGPL-Alltag belasten (ADR-0013) und die Control Plane an den Buchhaltungs-Release koppeln. ADR-0011 (flaches Monorepo, kein Split von `app/` und `pocketbase/`) bleibt für den Kern; das zweite Repo ist die kommerzielle Ebene, nicht eine Aufspaltung des Kerns.

## Alternatives considered

- SaaS (Stripe, Provisioner, Caddy-API) hinter Flags in diesem Repo — belastet Self-Hosted-First, vermischt AGPL-Kern und kommerzielle Betriebssteuerung.
- Eine PocketBase-Datenbank für alle Cloud-Mandanten (`tenant_id`) — Shared-Database-Multi-Tenancy für Finanzen; Backup, Isolation und Restore pro Mandant wären unehrlich; widerspricht ADR-0007.
- Eigenes Next.js-Deployment je Mandant ohne Adapter — kein geteiltes Frontend; skaliert den Betrieb, nicht den Kern.
- Adapter in diesem Schnitt bauen — kein Bedarf im Self-Hosted-Alltag; die Grenze ist die Entscheidung, nicht der Umbau.
- Die Grenze undokumentiert lassen — der nächste Keil würde SaaS in den Kern ziehen.


## Produktgrenze vom 2026-09-10

Der Betreiber legt den heutigen Funktionsumfang als Basis des Open-Source-Releases
fest. Neue Komfortfunktionen einschließlich Belegerkennung, Briefpapier und der
bisherigen Später-Liste gehören ausschließlich zum separaten Cloud-Angebot als
bezahltes Abo. Korrekturen, Sicherheitsupdates und die Pflege vorhandener
Funktionen bleiben im Kern. Eine Cloud-Kundeninstanz umfasst ihre eigene
PocketBase-Datenbank und Dateien; Multi-Firma bleibt innerhalb dieser Instanz.

Stripe-Abrechnung, Provisioning und Betrieb liegen in `zettelruhe-cloud`.
Das Pilotmodell mit eigenem Next pro Kunde ist im
[Release- und Cloud-Plan](../release-und-cloud-plan.md) eine Empfehlung, noch keine
Ablösung der obigen Adapterentscheidung. Auch die Lizenz-/Rechtegrenze für
proprietäre Erweiterungen muss vor deren Implementierung festgelegt werden.
