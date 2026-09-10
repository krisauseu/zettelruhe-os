---
name: testphase-fix
description: >
  Fixes small bugs and implements small improvements or changes in Zettelruhe during the post-M2 test phase. Loads stack, repo layout, and invariants so they need not be restated, then applies a scoped change and logs it in docs/testphase.md. Use when the user reports a small bug, UI glitch, wording fix, or small change found while testing; when they say Testphase, Bugfix, Fehler beheben, Verbesserung, Änderung, Kleinigkeit, hotfix; or when they run /testphase-fix.
---

# Testphase-Fix

Kleine Bugs, Verbesserungen und Änderungen an Zettelruhe nach Meilenstein 2. Stack, Layout und Invarianten stehen hier; der User muss sie nicht wiederholen. Jeder Fund wird in `docs/testphase.md` getrackt.

## Wann stoppen

Der Schnitt bleibt in einem bestehenden Modul. Stoppe und sage es, wenn der Wunsch ein neues Modul, eine neue ADR, Roadmap „Später“, die Control-Plane (ADR-0030) oder einen dokumentierten Nicht-Bau braucht (ADR-0026 Hybrid-PDF, ADR-0027 Kassenbuch aus Barzahlung). Dann nur klären, ob der Fund als offen notiert werden soll.

Nur notieren (kein Code), wenn der User ausdrücklich merken, notieren oder später sagt.

## Ablauf

### 1. Einordnen

Art: `Bug` | `Verbesserung` | `Änderung`. Bereich = Modul oder Route. Nächste freie ID in `docs/testphase.md` (`TP-001`, `TP-002`, …).

Fertig, wenn Art, Bereich und ID feststehen.

### 2. Ort finden

Route oder Symptom → Tabelle unten. Im getroffenen Modul die Datei lesen, die das Verhalten besitzt (`invariants.ts` Regeln, `repository.ts` PocketBase-I/O, `actions.ts` Session und Rechte, `*-form.tsx` / `src/app/app/.../page.tsx` UI). Fachbegriffe nur aus `CONTEXT.md`. Steuert der Schnitt eine Invariante unten oder eine ADR im Dateikopf, diese ADR lesen.

Nicht nach Stack oder Projektstruktur fragen.

Fertig, wenn die Owner-Datei und die zu ändernde Stelle benannt sind.

### 3. Ändern

Am Owner ändern, nicht in einem Downstream-Workaround. Nachbarn im selben Modul kopieren (Form-Parse, `redirect` mit `error=`, `revalidatePath`, Rechte-Gate). UI-Texte über `@/lib/labels` bzw. bestehende de-DE-Strings; Geldbeträge über `@/lib/money` (`decimal.js`). Schema nur über eine neue Datei in `pocketbase/pb_migrations/` (nächste Nummer im Ordner), und nur wenn der Fund ohne Schema nicht heilbar ist.

Fertig, wenn der Slice das gemeldete Verhalten erfüllt und nichts daneben aufreißt.

### 4. Prüfen

Logik oder Invarianten: Test in derselben Nachbarschaft `*.test.ts` erweitern oder anlegen; ausführen:

```bash
cd app && npx vitest run <betroffene-test-dateien>
```

UI, Layout oder Routing: im Browser den geänderten Flow und die anderen Surfaces, die denselben State lesen. Copy-only: Testsuite nur, wenn schon ein Test den String hält.

Fertig, wenn die betroffenen Tests grün sind und UI-Änderungen im Browser nachvollzogen wurden — oder begründet ist, warum kein Browser möglich war.

### 5. Tracken

`docs/testphase.md` ist das Log. Nicht `docs/90-status.md`, nicht `docs/sessions/`, nicht GitHub-Issues.

- Umgesetzt in diesem Turn: Zeile nach **Erledigt**.
- Nur notiert oder blockiert: Zeile nach **Offen**.
- Datei fehlt: anlegen nach dem Format, das in `docs/testphase.md` selbst steht.

Spalten wie in der Datei. Datum = `YYYY-MM-DD`. In **Notiz** Owner-Datei und Testkommando. Kein Commit, außer der User verlangt ihn.

Fertig, wenn die Zeile mit der vergebenen ID in der richtigen Tabelle steht.

### 6. Kurz antworten

ID, was geändert wurde, Tests, Tracking-Zeile. Kein Stack-Vortrag.

## Stack und Layout

Flaches Monorepo (ADR-0011). Next.js 16 App Router + Server Actions, React 19, PocketBase/SQLite, Caddy, Docker Compose. Finanz-Writes nur über Next (ADR-0006), nicht per Client-PB-SDK. Auth: PB-Login, Next-Session httpOnly-Cookie (ADR-0009). Jobs in-process + optional SMTP (ADR-0010). PDF: `@react-pdf/renderer` (ADR-0014). UI nur de-DE, Fachzeit `Europe/Berlin` (ADR-0016).

```
app/src/app/app/          Routen unter /app/...
app/src/modules/<id>/     Domain: types, invariants, repository, actions, Form, *.test.ts
app/src/components/       Shell, Nav, Sidebar, ui/
app/src/lib/              session, money, labels, pb, smtp, env
pocketbase/pb_migrations/ Schema im Git
docs/adr/                 Entscheidungen
CONTEXT.md                Glossar
docs/testphase.md         dieses Log
```

Lokal: `docker compose up --build` → http://localhost (Caddy). Dev ohne Compose: PocketBase lokal, `cd app && npm run dev`. Tests: `cd app && npm test` (Vitest, `src/**/*.test.ts`).

Schreib-Gates: `requireSchreibenSession` / `requireVerwaltenSession` / `requireInstanzEigentuemerSession` in `app/src/lib/session.ts`. Isolation immer `session.firmaId`.

## Modul → Route

| Bereich | Modul | Route |
|---------|-------|-------|
| Firma, Nutzer, Passwort, Einladen | `platform` | `/app/firma`, `/app/nutzer`, `/app/passwort` |
| Kontakte | `contacts` | `/app/kontakte` |
| Katalog | `catalog` | `/app/katalog` |
| Kategorien | `categories` | `/app/kategorien` |
| Projekte | `projects` | `/app/projekte` |
| Zeiten | `time` | `/app/zeiten` |
| Fahrten | `travel` | `/app/fahrten` |
| Angebote, Rechnungen, PDF, Wiederkehrend | `sales` | `/app/angebote`, `/app/rechnungen`, `/app/wiederkehrende-rechnungen` |
| Zahlungen | `payments` | `/app/zahlungen` |
| Belege | `expenses` | `/app/belege` |
| E-Rechnung Empfang/Versand | `einvoice` | `/app/e-rechnungen` |
| Kassenbuch | `cash` | `/app/kassenbuch` |
| Bank, CSV, MT940 | `banking` | `/app/bankkonten`, `/app/kontoauszug` |
| Buchungsjournal | `journal` | `/app/journal` |
| Übersicht, EÜR, USt, ZM, DATEV | `reporting` | `/app`, `/app/auswertungen`, `/app/eur`, `/app/ust`, `/app/zm`, `/app/export` |
| USt-IdNr. / BZSt | `ustid` | Kontakt + Firma |
| Jobs, Mail | `jobs` | in-process |
| Suche | `search` | `/app/suche` |
| Shell, Nav | `app/src/components/` | AppShell / AppNav |

Login/Setup: `app/src/app/login/`, `app/src/app/setup/`. Middleware: `app/src/middleware.ts` (Cookie-Gate für `/app`).

## Invarianten

- Anlegen ≠ stilles Ändern festgeschriebener Dokumente; Korrektur über Storno/Gegenbuchung (ADR-0004, ADR-0012).
- Rechnungsnummer und Journal-Forderung erst bei Festschreibung/Senden.
- Zahlung erzeugt Zufluss-Journal `quelle_typ=zahlung` (ADR-0024). EÜR/USt/ZM/DATEV/Übersicht zählen den Zufluss.
- Zahlungsweg `bar` schreibt kein Kassenbuch (ADR-0027).
- Zugang zur Firma nur über Mitgliedschaft; Rollen `eigentuemer` / `bearbeiten` / `lesen` (ADR-0025).
- Steuer-Modus der Firma steuert Belege, Rechnungen, Auswertungen; Kleinunternehmerregelung ohne USt-Ausweis, Regelbesteuerung nur Ist-Versteuerung.
- Keine JS-Floats für Geld.
- PocketBase-Admin (`/_/`) ist Betrieb, nicht App-Login.

Domäne und Vermeidungsliste: `CONTEXT.md`. ADR im Zweifel: `docs/adr/`. Meilenstein-Status: `docs/90-status.md` (lesen erlaubt, hier nicht fortschreiben).
