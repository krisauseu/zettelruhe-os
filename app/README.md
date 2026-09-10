# Zettelruhe App

Next.js-Oberfläche und Fachmodule des Self-hosting-Kerns. Installation des gesamten
Stacks: [Root-README](../README.md). Vor Codeänderungen [AGENTS.md](AGENTS.md)
und [Entwicklung](../docs/entwicklung.md) lesen.

```sh
npm ci
npm test
npm run typecheck
npm run lint -- --max-warnings=0
npm run build
```

`npm run dev` startet auch den Scheduler, sofern `JOBS_DISABLED` nicht gesetzt ist.
Weitere Lesewege können Zahlungsjournale nachtragen. Entwicklung und Browsertests
brauchen deshalb eine eigene PocketBase mit synthetischen Daten. Das Projekt ist
für einen dauerhaft laufenden Next-Container mit PocketBase vorgesehen.
