/**
 * Lädt Layout der Firma für PDF-Erzeugung (Logo, Texte, Schalter, Bankkonto).
 * Fehlt das Logo oder die Felder (alte Instanz), fällt auf Defaults zurück.
 */

import { fetchRecordFile, type FirmaRecord } from "@/lib/pb";
import { listBankkonten } from "@/modules/banking";
import type { Bankkonto } from "@/modules/banking";
import {
  defaultDokumentPdfLayout,
  dokumentSchalterWert,
  guessImageMime,
  pickDokumentBankkonto,
  validateDokumentAkzentfarbe,
  validateDokumentTexte,
  type DokumentPdfLayout,
} from "./pdf-layout";

export async function loadDokumentLayout(
  firma: FirmaRecord,
): Promise<DokumentPdfLayout> {
  const layout = defaultDokumentPdfLayout();
  try {
    layout.akzentfarbe = validateDokumentAkzentfarbe(
      firma.dokument_akzentfarbe,
    );
  } catch {
    /* Default behalten */
  }
  const texte = validateDokumentTexte({
    kopftext: firma.dokument_kopftext,
    fusstext: firma.dokument_fusstext,
  });
  layout.kopftext = texte.kopftext;
  layout.fusstext = texte.fusstext;
  layout.headerDrucken = dokumentSchalterWert(firma.dokument_header_drucken);
  layout.fussDrucken = dokumentSchalterWert(firma.dokument_fuss_drucken);
  layout.zahlblock = dokumentSchalterWert(firma.dokument_zahlblock);

  try {
    const konten = await listBankkonten(firma.id, { aktiv: true }, 1, 50);
    const bank = pickDokumentBankkonto(konten.items);
    if (bank) layout.bank = bank;
  } catch {
    /* PDF ohne Bankzeile */
  }

  const logoName = (firma.logo ?? "").trim();
  if (!logoName) return layout;

  try {
    const res = await fetchRecordFile("firmen", firma.id, logoName);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return layout;
    const mime = guessImageMime(logoName, res.headers.get("content-type"));
    layout.logoDataUri = `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    /* PDF ohne Logo */
  }
  return layout;
}

/**
 * Verbindlicher PDF-Stand für die Festschreibung. Fehlende optionale Daten sind
 * erlaubt; ein fehlgeschlagener Read darf das Original dagegen nicht verändern.
 */
export async function loadDokumentLayoutVerbindlich(
  firma: FirmaRecord,
): Promise<{ layout: DokumentPdfLayout; bankkonten: Bankkonto[] }> {
  const layout = defaultDokumentPdfLayout();
  try {
    layout.akzentfarbe = validateDokumentAkzentfarbe(
      firma.dokument_akzentfarbe,
    );
  } catch {
    // Eine historisch ungültige Farbe hat schon bisher den festen Default benutzt.
  }
  const texte = validateDokumentTexte({
    kopftext: firma.dokument_kopftext,
    fusstext: firma.dokument_fusstext,
  });
  layout.kopftext = texte.kopftext;
  layout.fusstext = texte.fusstext;
  layout.headerDrucken = dokumentSchalterWert(firma.dokument_header_drucken);
  layout.fussDrucken = dokumentSchalterWert(firma.dokument_fuss_drucken);
  layout.zahlblock = dokumentSchalterWert(firma.dokument_zahlblock);

  const bankkonten: Bankkonto[] = [];
  let page = 1;
  do {
    const result = await listBankkonten(firma.id, { aktiv: true }, page, 200);
    bankkonten.push(...result.items);
    if (page >= result.totalPages) break;
    page += 1;
  } while (true);
  const bank = pickDokumentBankkonto(bankkonten);
  if (bank) layout.bank = bank;

  const logoName = (firma.logo ?? "").trim();
  if (!logoName) return { layout, bankkonten };
  const response = await fetchRecordFile("firmen", firma.id, logoName);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error("Firmenlogo ist leer und kann nicht ins PDF übernommen werden.");
  }
  const mime = guessImageMime(logoName, response.headers.get("content-type"));
  layout.logoDataUri = `data:${mime};base64,${bytes.toString("base64")}`;
  return { layout, bankkonten };
}
