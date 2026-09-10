# Flaches Monorepo mit versionierten PocketBase-Migrationen

Repository-Layout v1: `app/` (Next.js), `pocketbase/` (`pb_migrations`, optionale `pb_hooks`, Dockerfile), `Caddyfile`, `docker-compose.yml` im Root — ohne Turborepo/Workspace-Pflicht und ohne Zwei-Repo-Split. PocketBase-Schema liegt als **Migrationen im Git**, nicht nur als Klickpfad im Admin-UI. Begründung: Solo+AI-Geschwindigkeit, reproduzierbare Self-Hosted-Installationen für Open-Source-Nutzer:innen.
