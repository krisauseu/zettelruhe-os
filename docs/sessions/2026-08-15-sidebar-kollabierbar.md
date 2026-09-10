# Session 2026-08-15 — Sidebar kollabierbar

## Done

Linke App-Navigation: Abschnitte auf-/zuklappen, Persistenz, Favoriten. Reines UI, kein Fach- oder Schema-Schnitt.

### Verhalten

- Gruppen (Stammdaten, Zeit & Fahrten, Verkauf, Belege & Kasse, Auswertungen) per Überschrift + Chevron
- Default: alle offen
- Zustand in `localStorage` (`zettelruhe-nav`): zugeklappte Gruppen, Favoriten, Filter
- Aktive Route öffnet ihren Abschnitt (Anzeige + Persistenz; Hydration-sicher über abgeleiteten View-State)
- Zugeklappte Gruppe zeigt die aktive Seite weiter
- „Alle öffnen“ / „Alle schließen“
- Stern am Eintrag, Toggle „Nur Favoriten“ (aktive Seite bleibt sichtbar)

### Umsetzung

- Logik in `app/src/components/app-nav-state.ts` + 14 Unit-Tests
- UI in `AppNav`; Theme-Toggle-Muster (`useSyncExternalStore`)
- Menüstruktur unverändert in `app-shell.tsx`

### Tests

291 Unit-Tests + `tsc` + ESLint grün.  
Browser (headless Chrome gegen lokale Compose-Instanz): Default offen, Alle schließen, Auto-Open nach Navigation + Reload, Favoritenfilter, kurzer Viewport ohne Nav-Scroll, Mobil 390px. Keine Konsolenfehler.

## Nicht angefasst

- UStVA/ELSTER-XML, ZM, USt-IdNr., E-Rechnungs-Versand
- Sidebar-Breite / mobiles Off-Canvas
- Open Decisions

## Next step

UStVA-Zahlen / ELSTER-XML light (Self-File, kein Versand).
