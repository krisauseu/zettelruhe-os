/**
 * Ob eine BZSt-Abfrage ehrlich möglich ist — ohne I/O.
 */

import {
  eigeneUstIdLage,
  fremdeUstIdLage,
  type EigeneUstIdLage,
  type FremdeUstIdLage,
} from "./format";

export const EIGENE_UST_ID_FEHLT =
  "Eigene USt-IdNr. der Firma fehlt. Das BZSt bestätigt ausländische Nummern nur gegenüber einer eigenen DE-USt-IdNr.";

export const EIGENE_UST_ID_NICHT_DE =
  "Die eigene USt-IdNr. der Firma ist keine DE-Nummer. Das Auslandsverfahren nimmt nur eine deutsche anfragende USt-IdNr.";

export const EIGENE_UST_ID_SYNTAX =
  "Die eigene USt-IdNr. der Firma passt nicht ins deutsche Schema (DE + 9 Ziffern).";

export const FREMDE_UST_ID_FEHLT =
  "Am Kontakt ist keine USt-IdNr. gespeichert. Bitte speichern, dann prüfen.";

export const FREMDE_UST_ID_DE =
  "Das BZSt-Auslandsverfahren bestätigt keine DE-USt-IdNr. als angefragte Nummer (evatr-0006).";

export const FREMDE_UST_ID_SYNTAX =
  "Die USt-IdNr. am Kontakt passt nicht ins übliche EU-Schema.";

export const FREMDE_UST_ID_NICHT_EU =
  "Die USt-IdNr. am Kontakt gehört nicht zum übrigen EU-Gebiet. Das BZSt bestätigt hier nur ausländische EU-Nummern.";

export const EIGENE_DE_NICHT_ISOLIERT =
  "Das BZSt-Auslandsverfahren bestätigt keine eigene DE-USt-IdNr. isoliert. Die Nummer wird bei Kontakt-Prüfungen als anfragende USt-IdNr. mitgeschickt.";

export const SCHNAPPSCHUSS_NICHT_LESBAR =
  "BZSt-Schnappschüsse sind gerade nicht lesbar. Die gespeicherte USt-IdNr. bleibt davon unberührt.";

export type BzstAbfrageGate =
  | {
      ok: true;
      anfragende: string;
      angefragte: string;
    }
  | { ok: false; grund: string };

export function kannBzstAbfrage(
  eigeneRaw: string | null | undefined,
  fremdeRaw: string | null | undefined,
): BzstAbfrageGate {
  const eigene = eigeneUstIdLage(eigeneRaw);
  const fremde = fremdeUstIdLage(fremdeRaw);
  const eigeneGrund = grundEigeneLage(eigene);
  if (eigeneGrund) return { ok: false, grund: eigeneGrund };
  const fremdeGrund = grundFremdeLage(fremde);
  if (fremdeGrund) return { ok: false, grund: fremdeGrund };
  if (eigene.art !== "de_syntax_ok" || fremde.art !== "eu_ok") {
    return { ok: false, grund: "Prüfung beim BZSt ist so nicht möglich." };
  }
  return {
    ok: true,
    anfragende: eigene.normalisiert,
    angefragte: fremde.normalisiert,
  };
}

export function grundEigeneLage(lage: EigeneUstIdLage): string | null {
  if (lage.art === "leer") return EIGENE_UST_ID_FEHLT;
  if (lage.art === "nicht_de") return EIGENE_UST_ID_NICHT_DE;
  if (lage.art === "syntax_ungueltig") return EIGENE_UST_ID_SYNTAX;
  return null;
}

export function grundFremdeLage(lage: FremdeUstIdLage): string | null {
  if (lage.art === "leer") return FREMDE_UST_ID_FEHLT;
  if (lage.art === "de") return FREMDE_UST_ID_DE;
  if (lage.art === "syntax_ungueltig") return FREMDE_UST_ID_SYNTAX;
  if (lage.art === "nicht_eu") return FREMDE_UST_ID_NICHT_EU;
  return null;
}

export function eigeneLageHinweis(lage: EigeneUstIdLage): string {
  if (lage.art === "leer") {
    return "Keine eigene USt-IdNr. — Kontakt-Prüfungen beim BZSt sind nicht möglich.";
  }
  if (lage.art === "syntax_ungueltig") {
    return `${EIGENE_UST_ID_SYNTAX} Gespeichert: ${lage.normalisiert}.`;
  }
  if (lage.art === "nicht_de") {
    return `${EIGENE_UST_ID_NICHT_DE} Gespeichert: ${lage.normalisiert}.`;
  }
  return `${EIGENE_DE_NICHT_ISOLIERT} Syntax der gespeicherten Nummer ${lage.normalisiert} passt zum deutschen Schema.`;
}
