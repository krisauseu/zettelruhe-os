# Jobs in-process im Next-Container, SMTP aus Next

Wiederkehrende Läufe und ähnliche Hintergrundarbeit laufen in v1 als **In-Process-Scheduler** im dauerhaft laufenden Next.js-Container (Compose), abgesichert durch einen **DB-Lock in PocketBase** gegen Doppelausführung. E-Mail (Angebot, Rechnung, Zahlungserinnerung) geht per **SMTP/Nodemailer** aus Next, konfiguriert über ENV — nicht als Finanz-Worker in PocketBase. Begründung: Ein Service weniger bei Solo-Compose; ADR-0006 bleibt eingehalten; bei Bedarf später ein separater `worker`-Service mit gleichem Image.
