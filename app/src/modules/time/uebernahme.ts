/**
 * Light-Übernahme: offene abrechenbare Zeiten + Fahrten → Rechnungs-Entwurf.
 * Analog Angebot → Rechnung (modules/sales createRechnung-Pattern).
 * Kein Journal hier — erst bei Festschreibung der Rechnung.
 */

import { createRechnung } from "@/modules/sales/repository";
import type { RechnungMitPositionen } from "@/modules/sales/types";
import {
  buildRechnungspositionFromFahrt,
} from "@/modules/travel/invariants";
import {
  listAbrechenbareFahrten,
  markFahrtenAbgerechnet,
} from "@/modules/travel/repository";
import {
  buildRechnungspositionFromZeit,
  todayBerlin,
} from "./invariants";
import {
  listAbrechenbareZeiteintraege,
  markZeiteintraegeAbgerechnet,
} from "./repository";

export type UebernahmeErgebnis = {
  rechnung: RechnungMitPositionen;
  zeiteintraege: number;
  fahrten: number;
};

/**
 * Nimmt alle abrechenbaren Zeiteinträge und Fahrten einer:s Kund:in
 * und erzeugt einen Rechnungs-Entwurf. Markiert Einträge als abgerechnet
 * und verknüpft die Rechnung.
 *
 * Optional: nur bestimmte IDs (Follow-up Teilmengen-UI vorbereitet).
 */
export async function uebernehmenAlsRechnung(
  firmaId: string,
  kundeId: string,
  opts?: {
    zeiteintragIds?: string[];
    fahrtIds?: string[];
    rechnungsdatum?: string;
  },
): Promise<UebernahmeErgebnis> {
  if (!kundeId.trim()) {
    throw new Error("Kund:in ist erforderlich.");
  }

  let zeiten = await listAbrechenbareZeiteintraege(firmaId, kundeId);
  let fahrten = await listAbrechenbareFahrten(firmaId, kundeId);

  if (opts?.zeiteintragIds) {
    const set = new Set(opts.zeiteintragIds);
    zeiten = zeiten.filter((z) => set.has(z.id));
  }
  if (opts?.fahrtIds) {
    const set = new Set(opts.fahrtIds);
    fahrten = fahrten.filter((f) => set.has(f.id));
  }

  if (zeiten.length === 0 && fahrten.length === 0) {
    throw new Error(
      "Keine abrechenbaren Zeiteinträge oder Fahrten für diese:n Kund:in.",
    );
  }

  const positionen = [
    ...zeiten.map((z) => {
      const p = buildRechnungspositionFromZeit(z);
      return {
        bezeichnung: p.bezeichnung,
        menge: p.menge,
        einheit: p.einheit,
        einzelpreis: p.einzelpreis,
        steuersatz: "" as const,
      };
    }),
    ...fahrten.map((f) => {
      const p = buildRechnungspositionFromFahrt(f);
      return {
        bezeichnung: p.bezeichnung,
        menge: p.menge,
        einheit: p.einheit,
        einzelpreis: p.einzelpreis,
        steuersatz: "" as const,
      };
    }),
  ];

  const rechnungsdatum = opts?.rechnungsdatum || todayBerlin();

  const rechnung = await createRechnung(firmaId, {
    kunde: kundeId,
    rechnungsdatum,
    notiz: "Übernommen aus Zeiten und Fahrten",
    positionen,
  });

  await markZeiteintraegeAbgerechnet(
    firmaId,
    zeiten.map((z) => z.id),
    rechnung.id,
  );
  await markFahrtenAbgerechnet(
    firmaId,
    fahrten.map((f) => f.id),
    rechnung.id,
  );

  return {
    rechnung,
    zeiteintraege: zeiten.length,
    fahrten: fahrten.length,
  };
}
