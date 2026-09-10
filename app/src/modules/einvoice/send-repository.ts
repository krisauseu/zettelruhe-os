/**
 * Persistenz E-Rechnungs-Versand.
 * Schreibt nur e_rechnungen_versand — nie rechnungen.pdf (ADR-0012).
 */

import {
  createRecordMultipart,
  fetchRecordFile,
  getFirmaById,
  getRecord,
  listRecords,
  pbEq,
} from "@/lib/pb";
import { getBankkonto, listBankkonten } from "@/modules/banking";
import { getKontakt } from "@/modules/contacts";
import { getRechnungMitPositionen } from "@/modules/sales/repository";
import { parseEInvoiceXml } from "./parse";
import {
  EInvoiceValidationError,
  assertKnownProfil,
  formatValidationIssues,
  prepareEInvoiceOutbound,
} from "./validate-outbound";
import {
  assertCanErzeugenVersand,
  erzeugtAmUtc,
  renderEInvoiceXml,
  versandDateiname,
  VERSAND_BEREITS_ERROR,
} from "./send-invariants";
import type {
  EInvoicePrepareResult,
  EInvoiceSendProfil,
  ERechnungVersand,
} from "./outbound-types";

const COL = "e_rechnungen_versand";

type PbVersand = {
  id: string;
  firma: string;
  rechnung: string;
  profil: string;
  original_datei?: string | string[];
  original_dateiname?: string;
  iban?: string;
  erzeugt_am: string;
  notiz?: string;
  created?: string;
  updated?: string;
};

function fileNameFromPb(raw: string | string[] | undefined): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return String(raw[0]);
  return "";
}

function mapVersand(r: PbVersand): ERechnungVersand {
  const profil: EInvoiceSendProfil =
    r.profil === "zugferd_cii" ? "zugferd_cii" : "xrechnung_ubl";
  return {
    id: r.id,
    firma: r.firma,
    rechnung: r.rechnung,
    profil,
    original_datei: fileNameFromPb(r.original_datei),
    original_dateiname: r.original_dateiname ?? "",
    iban: r.iban ?? "",
    erzeugt_am: r.erzeugt_am,
    notiz: r.notiz ?? "",
    created: r.created,
    updated: r.updated,
  };
}

export async function listERechnungVersandForRechnung(
  firmaId: string,
  rechnungId: string,
): Promise<ERechnungVersand[]> {
  const result = await listRecords<PbVersand>(COL, {
    page: 1,
    perPage: 20,
    filter: `${pbEq("firma", firmaId)} && ${pbEq("rechnung", rechnungId)}`,
    sort: "profil,id",
  });
  return result.items.map(mapVersand);
}

export async function getERechnungVersand(
  firmaId: string,
  id: string,
): Promise<ERechnungVersand | null> {
  try {
    const r = await getRecord<PbVersand>(COL, id);
    if (r.firma !== firmaId) return null;
    return mapVersand(r);
  } catch {
    return null;
  }
}

async function loadVersandKontext(
  firmaId: string,
  rechnungId: string,
  opts: { profil: EInvoiceSendProfil; bankkontoId?: string },
) {
  const rechnung = await getRechnungMitPositionen(firmaId, rechnungId);
  if (!rechnung) {
    throw new Error("Rechnung nicht gefunden.");
  }
  const firma = await getFirmaById(firmaId);
  if (!firma) {
    throw new Error("Firma nicht gefunden.");
  }
  if (!rechnung.kunde) {
    throw new Error("Rechnung hat keine:n Kund:in.");
  }
  const kunde = await getKontakt(firmaId, rechnung.kunde);
  if (!kunde) {
    throw new Error("Kund:in nicht gefunden.");
  }

  let bankkonto = opts.bankkontoId
    ? await getBankkonto(firmaId, opts.bankkontoId)
    : null;
  if (opts.bankkontoId && !bankkonto) {
    throw new Error("Bankkonto nicht gefunden.");
  }
  if (!bankkonto) {
    const konten = await listBankkonten(firmaId, { aktiv: true }, 1, 20);
    const mitIban = konten.items.filter((k) => k.iban);
    if (mitIban.length === 1) {
      bankkonto = mitIban[0];
    }
  }

  return { rechnung, firma, kunde, bankkonto };
}

export async function pruefeERechnungVersand(
  firmaId: string,
  rechnungId: string,
  opts: { profil: EInvoiceSendProfil; bankkontoId?: string; erzeugen?: boolean },
): Promise<EInvoicePrepareResult> {
  assertKnownProfil(opts.profil);
  const ctx = await loadVersandKontext(firmaId, rechnungId, opts);
  return prepareEInvoiceOutbound(
    {
      profil: opts.profil,
      rechnung: ctx.rechnung,
      positionen: ctx.rechnung.positionen,
      firma: ctx.firma,
      kunde: ctx.kunde,
      bankkonto: ctx.bankkonto,
    },
    { erzeugen: opts.erzeugen !== false },
  );
}

/**
 * Erzeugt und archiviert das XML-Original.
 * Schreibt nicht auf rechnungen.pdf.
 */
export async function erzeugeERechnungVersand(
  firmaId: string,
  rechnungId: string,
  opts: { profil: EInvoiceSendProfil; bankkontoId?: string; now?: Date },
): Promise<ERechnungVersand> {
  assertKnownProfil(opts.profil);

  const existing = await listERechnungVersandForRechnung(firmaId, rechnungId);
  const already = existing.some((v) => v.profil === opts.profil);

  const ctx = await loadVersandKontext(firmaId, rechnungId, opts);
  assertCanErzeugenVersand(ctx.rechnung, already);

  const prepared = prepareEInvoiceOutbound(
    {
      profil: opts.profil,
      rechnung: ctx.rechnung,
      positionen: ctx.rechnung.positionen,
      firma: ctx.firma,
      kunde: ctx.kunde,
      bankkonto: ctx.bankkonto,
    },
    { erzeugen: true },
  );
  if (prepared.issues.length > 0) {
    throw new EInvoiceValidationError(prepared.issues);
  }

  const xml = renderEInvoiceXml(prepared.draft);
  const parsed = parseEInvoiceXml(xml);
  if (!parsed.ok) {
    throw new Error(
      `Erzeugte E-Rechnung ist intern nicht lesbar: ${parsed.error}`,
    );
  }

  const filename = versandDateiname(
    prepared.draft.rechnungsnummer,
    opts.profil,
  );
  const file = new File([new Uint8Array(Buffer.from(xml, "utf8"))], filename, {
    type: "application/xml",
  });

  try {
    const r = await createRecordMultipart<PbVersand>(COL, {
      firma: firmaId,
      rechnung: rechnungId,
      profil: opts.profil,
      original_datei: file,
      original_dateiname: filename,
      iban: prepared.draft.iban,
      erzeugt_am: erzeugtAmUtc(opts.now),
    });
    return mapVersand(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate|idx_e_re_versand/i.test(msg)) {
      throw new Error(VERSAND_BEREITS_ERROR);
    }
    throw e;
  }
}

export async function getERechnungVersandDateiResponse(
  firmaId: string,
  versandId: string,
): Promise<{ response: Response; filename: string; versand: ERechnungVersand }> {
  const versand = await getERechnungVersand(firmaId, versandId);
  if (!versand) {
    throw new Error("E-Rechnung nicht gefunden.");
  }
  if (!versand.original_datei) {
    throw new Error("Keine Originaldatei an der E-Rechnung.");
  }
  const response = await fetchRecordFile(COL, versandId, versand.original_datei);
  const filename = versand.original_dateiname || versand.original_datei;
  return { response, filename, versand };
}

export { formatValidationIssues };
