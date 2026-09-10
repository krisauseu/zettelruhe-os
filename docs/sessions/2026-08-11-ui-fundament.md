# Session 2026-08-11 — UI-Fundament (vor Bauabschnitt 3)

## Done

- Design-System: CSS-Variablen (oklch) für light/dark in `app/src/app/globals.css`
- Tailwind v4 Theme-Bridge (`@theme inline`, `@custom-variant dark`)
- UI-Komponenten unter `components/ui/`:
  - modernisiert: Button, Input, Textarea, Label, Card (semantische Tokens)
  - neu: Table, Select (native, gestylt), Badge
- App-Shell: `bg-sidebar`, aktive Nav (`AppNav`), Theme-Toggle (localStorage + FOUC-Script)
- Alle bestehenden App-/Auth-Seiten auf Tokens + Table/Select/Badge umgestellt
- Lint, Typecheck, Unit-Tests (26), `next build` grün

## Open / Blocked

Keine.

## Next step

Bauabschnitt 3: Journal-Kern — mit dem neuen UI-Fundament weiterbauen.

## Context snapshot

- Keine Fachlogik geändert (kein Journal/Beleg).
- Dark Mode optional per Sidebar-Toggle; Default light bzw. Systempräferenz.
- Select ist bewusst natives `<select>` (kein Radix), konsistent mit dem restlichen hand-rolled shadcn-Stil.
