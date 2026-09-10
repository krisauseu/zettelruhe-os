# Next.js 16 + PocketBase als v1-Stack

Die Webanwendung wird als **Next.js 16** (App Router, Server Actions) plus **PocketBase** (aktuell v0.x, SQLite, Auth, Files, Admin-UI) gebaut — nicht als Next-only mit Postgres und nicht mit einem anderen BaaS. Begründung: Self-hosted Solo-Betrieb profitiert von `pb_data` als Ein-Volume-Backup, Auth/Datei/Admin-Plumbing entfällt, und vorhandene PocketBase-Erfahrung beschleunigt den Start; die Finanz-Domain-Logik lebt trotzdem in TypeScript auf dem Next-Server (siehe ADR-0006).
