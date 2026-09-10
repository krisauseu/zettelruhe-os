# Deploy: Docker Compose, PocketBase-SQLite, kein Postgres in v1

v1 wird als **Docker Compose**-Paket ausgeliefert (typisch: Caddy + Next.js + PocketBase), mit Named Volume für `pb_data` (SQLite + Dateien). Es gibt **kein** Postgres und keinen Kubernetes-Zwang in v1; dasselbe Compose-Set soll VPS und Homelab bedienen. Begründung: Self-hosted-first (ADR-0001), ein Volume/Backup-Pfad, und für eine Instanz mit einer:m Eigentümer:in ist SQLite Wartungs- und Backup-Vorteil statt Engpass.
