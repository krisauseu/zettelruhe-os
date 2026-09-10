import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { UebersichtVerlauf } from "./uebersicht-verlauf";
import { UebersichtKategorien } from "./uebersicht-kategorien";
import type { AusgabenKategorienBlick } from "./uebersicht";

it("rendert den SVG-Monatstitel als zusammenhängenden Text für die Hydrierung", () => {
  const html = renderToString(createElement(UebersichtVerlauf, {
    kalenderjahr: 2026,
    monate: [{ key: "2026-09", von: "2026-09-01", bis: "2026-09-30", jahr: 2026, monat: 9, label_kurz: "Sep.", label_lang: "September 2026",
      einnahmen_brutto: "119.00", ausgaben_brutto: "42.00", ueberschuss_brutto: "77.00" }],
  }));
  expect(html).toContain("<title>September 2026: Einnahmen 119,00 €, Ausgaben 42,00 €, Überschuss 77,00 €</title>");
});

it("liefert auch die Donut-Titel bereits im Server-HTML", () => {
  const blick: AusgabenKategorienBlick = {
    zeitraum: { von: "2026-09-01", bis: "2026-09-30" }, label: "September 2026",
    summe_brutto: "150.00", anzahl: 2,
    zeilen: [{ key: "software", label: "Software", summe_brutto: "100.00", anteil: 2 / 3 },
      { key: "buero", label: "Büro", summe_brutto: "50.00", anteil: 1 / 3 }],
  };
  const html = renderToString(createElement(UebersichtKategorien, { monat: blick, quartal: blick }));
  expect(html).toContain("<title>Software: 100,00 €</title>");
  expect(html).toContain("<title>Büro: 50,00 €</title>");
});
