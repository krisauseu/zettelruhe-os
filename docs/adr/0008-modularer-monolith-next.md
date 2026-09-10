# Modularer Monolith in Next.js

Die Anwendung ist ein **modularer Monolith** in einem Next.js-Prozess: Domain-Ordner (z. B. invoices, journal, contacts), keine Microservices, kein Event-Sourcing-Pflicht und keine hexagonale Vollarchitektur von Tag 1. PocketBase ist Beistelldienst (Daten/Auth/Files), nicht ein zweites Domänen-Backend. Begründung: Solo+AI-Entwicklung braucht hohe Geschwindigkeit und eine deploybare Einheit; Modulgrenzen im Repo genügen für spätere Schärfung, ohne verteilte Komplexität vorzuziehen.
