# Caddy nativ auf dem Server, Compose-Caddy nur lokal

Auf dem öffentlichen Host terminiert Caddy TLS (Let’s Encrypt, Name `app.zettelruhe.de`) und proxied auf Next (`127.0.0.1:3000`) und PocketBase (`127.0.0.1:8090`). Compose-Caddy bleibt der lokale HTTP-Eingang (Port 80, kein TLS) und ist auf dem Server nicht der öffentliche Proxy. PocketBase-Admin `/_/` bleibt über denselben Host erreichbar (explizit). Next spricht PocketBase weiter nur intern (`PB_URL=http://pocketbase:8090`). Begründung: Port 80/443 braucht der Host für ACME; ein Compose-Caddy als öffentlicher Eingang würde kollidieren; lokal soll `docker compose up` unverändert HTTP liefern.

## Alternatives considered

- Caddy im Compose mit 443 und internem ACME — ein Stack, aber Port 80/443 am Host wären weg; lokal würde TLS stören.
- Host-Caddy nur auf Compose-Caddy `:80` — zusätzlicher Hop, Compose-Caddy müsste auf dem Server weiter laufen; widerspricht dem Schnitt „auf Next/PocketBase an localhost“.
- `/_/` nicht öffentlich — in `betrieb.md` die härtere Empfehlung; hier bewusst nicht, Admin bleibt über denselben Host.
