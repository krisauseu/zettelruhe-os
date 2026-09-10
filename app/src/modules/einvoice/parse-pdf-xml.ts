/**
 * Empfang: E-Rechnungs-XML aus PDF-Attachments (ADR-0029).
 * /Type /EmbeddedFile, Filter keiner oder FlateDecode (Node zlib).
 * Kein pdf-lib, kein Mustang, kein PDF/A-3-/Factur-X-Claim, kein Hybrid-Schreiben.
 */

import { inflateSync } from "node:zlib";

/** Dateinamen laut Factur-X / ZUGFeRD 1.x–2.x / XRechnung-im-PDF */
export const EINVOICE_PDF_ATTACHMENT_NAMES = [
  "factur-x.xml",
  "zugferd-invoice.xml",
  "ZUGFeRD-invoice.xml",
  "xrechnung.xml",
] as const;

export const PDF_VERSCHLUESSELT_ERROR =
  "PDF ist verschlüsselt. Eingebettetes E-Rechnungs-XML kann nicht gelesen werden. Original wurde archiviert. Bitte XML hochladen oder Beleg manuell anlegen.";

export const PDF_OHNE_XML_ERROR =
  "PDF ohne erkennbares eingebettetes E-Rechnungs-XML. Flate-Anhänge (factur-x.xml / zugferd-invoice.xml) werden gelesen; ein Scan-PDF ohne Anhang ist keine E-Rechnung. Original wurde archiviert. Bitte XML hochladen oder Beleg manuell anlegen.";

type EmbeddedXml = { obj: number; xml: string };

function toBuffer(bytes: Uint8Array): Buffer {
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
}

export function isPdfEncrypted(bytes: Uint8Array): boolean {
  const s = toBuffer(bytes).toString("latin1");
  return /\/Encrypt(?:\s+\d+\s+\d+\s+R|\s*<<)/.test(s);
}

function looksLikeInvoiceXml(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("crossindustryinvoice") ||
    lower.includes("urn:un:unece:uncefact") ||
    lower.includes("urn:oasis:names:specification:ubl")
  );
}

function bytesToUtf8(buf: Buffer): string {
  let start = 0;
  if (
    buf.length >= 3 &&
    buf[0] === 0xef &&
    buf[1] === 0xbb &&
    buf[2] === 0xbf
  ) {
    start = 3;
  }
  return buf.subarray(start).toString("utf8");
}

function lastObjHeader(
  latin1: string,
  before: number,
): { num: number; headerEnd: number } | null {
  const slice = latin1.slice(0, before);
  const re = /(\d+)\s+(\d+)\s+obj/g;
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice)) !== null) {
    last = m;
  }
  if (!last) return null;
  return { num: Number(last[1]), headerEnd: last.index + last[0].length };
}

/** Ende des Dicts nach `start` (Index von `<<`), inkl. verschachtelter `<< >>`. */
function walkDictEnd(buf: Buffer, start: number): number | null {
  if (buf[start] !== 0x3c || buf[start + 1] !== 0x3c) return null;
  let depth = 0;
  let i = start;
  while (i < buf.length - 1) {
    if (buf[i] === 0x3c && buf[i + 1] === 0x3c) {
      depth += 1;
      i += 2;
      continue;
    }
    if (buf[i] === 0x3e && buf[i + 1] === 0x3e) {
      depth -= 1;
      i += 2;
      if (depth === 0) return i;
      continue;
    }
    i += 1;
  }
  return null;
}

function skipWs(buf: Buffer, i: number): number {
  while (i < buf.length) {
    const c = buf[i]!;
    if (c === 0x20 || c === 0x09 || c === 0x0d || c === 0x0a) {
      i += 1;
      continue;
    }
    break;
  }
  return i;
}

function parseFilters(dictLatin1: string): string[] {
  const m = /\/Filter\s*(\/[A-Za-z0-9]+|\[(?:\s*\/[A-Za-z0-9]+)+\s*\])/.exec(
    dictLatin1,
  );
  if (!m) return [];
  return [...m[1]!.matchAll(/\/([A-Za-z0-9]+)/g)].map((x) => x[1]!);
}

function inflateFlate(raw: Buffer): Buffer | null {
  try {
    return inflateSync(raw);
  } catch {
    try {
      return inflateSync(raw, { windowBits: -15 });
    } catch {
      return null;
    }
  }
}

function decodeStream(raw: Buffer, filters: string[]): Buffer | null {
  if (filters.some((f) => f !== "FlateDecode")) return null;
  let out = raw;
  for (const f of filters) {
    if (f !== "FlateDecode") return null;
    const next = inflateFlate(out);
    if (!next) return null;
    out = next;
  }
  return out;
}

function readStreamPayload(
  buf: Buffer,
  dictLatin1: string,
  afterDict: number,
): Buffer | null {
  let i = skipWs(buf, afterDict);
  const streamKw = Buffer.from("stream");
  if (buf.subarray(i, i + streamKw.length).compare(streamKw) !== 0) {
    return null;
  }
  i += streamKw.length;
  if (buf[i] === 0x0d && buf[i + 1] === 0x0a) {
    i += 2;
  } else if (buf[i] === 0x0a || buf[i] === 0x0d) {
    i += 1;
  } else {
    return null;
  }

  const directLen = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dictLatin1);
  if (directLen) {
    const n = Number(directLen[1]);
    if (!Number.isFinite(n) || n < 0 || i + n > buf.length) return null;
    return buf.subarray(i, i + n);
  }

  const end = buf.indexOf("endstream", i);
  if (end < 0) return null;
  let raw = buf.subarray(i, end);
  if (raw.length >= 2 && raw[raw.length - 2] === 0x0d && raw[raw.length - 1] === 0x0a) {
    raw = raw.subarray(0, raw.length - 2);
  } else if (
    raw.length >= 1 &&
    (raw[raw.length - 1] === 0x0a || raw[raw.length - 1] === 0x0d)
  ) {
    raw = raw.subarray(0, raw.length - 1);
  }
  return raw;
}

function extractEmbeddedInvoiceXmls(buf: Buffer): EmbeddedXml[] {
  const latin1 = buf.toString("latin1");
  const typeRe = /\/Type\s*\/EmbeddedFile/g;
  const out: EmbeddedXml[] = [];
  let hit: RegExpExecArray | null;
  while ((hit = typeRe.exec(latin1)) !== null) {
    const header = lastObjHeader(latin1, hit.index);
    if (!header) continue;
    const dictStart = skipWs(buf, header.headerEnd);
    const dictEnd = walkDictEnd(buf, dictStart);
    if (dictEnd == null) continue;
    const dictLatin1 = latin1.slice(dictStart, dictEnd);
    const filters = parseFilters(dictLatin1);
    const raw = readStreamPayload(buf, dictLatin1, dictEnd);
    if (!raw) continue;
    const decoded = decodeStream(raw, filters);
    if (!decoded) continue;
    const xml = bytesToUtf8(decoded);
    if (!looksLikeInvoiceXml(xml)) continue;
    out.push({ obj: header.num, xml });
  }
  return out;
}

function findEfObjectForName(latin1: string, name: string): number | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`/U?F\\s*\\(${escaped}\\)`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(latin1)) !== null) {
    const header = lastObjHeader(latin1, m.index);
    if (!header) continue;
    const after = latin1.slice(header.headerEnd, header.headerEnd + 900);
    const ef = /\/EF\s*<<[\s\S]{0,200}?\/F\s+(\d+)\s+\d+\s+R/.exec(after);
    if (ef) return Number(ef[1]);
  }
  return null;
}

function pickPreferredXml(attachments: EmbeddedXml[], latin1: string): string | null {
  if (attachments.length === 0) return null;
  const byObj = new Map(attachments.map((a) => [a.obj, a.xml]));
  for (const name of EINVOICE_PDF_ATTACHMENT_NAMES) {
    const obj = findEfObjectForName(latin1, name);
    if (obj != null && byObj.has(obj)) {
      return byObj.get(obj)!;
    }
  }
  return attachments[0]!.xml;
}

/**
 * Unkomprimiertes Invoice-XML im Bytestrom (BA12 light Scan).
 */
export function extractUncompressedXmlFromPdf(bytes: Uint8Array): string | null {
  const asLatin1 = toBuffer(bytes).toString("latin1");
  const patterns: RegExp[] = [
    /<\?xml[\s\S]*?<\/rsm:CrossIndustryInvoice>/i,
    /<\?xml[\s\S]*?<\/CrossIndustryInvoice>/i,
    /<rsm:CrossIndustryInvoice[\s\S]*?<\/rsm:CrossIndustryInvoice>/i,
    /<CrossIndustryInvoice[\s\S]*?<\/CrossIndustryInvoice>/i,
    /<\?xml[\s\S]*?<\/ubl:Invoice>/i,
    /<\?xml[\s\S]*?<\/Invoice>/i,
    /<Invoice[\s\S]*?xmlns[\s\S]*?<\/Invoice>/i,
  ];

  for (const re of patterns) {
    const m = asLatin1.match(re);
    if (m && m[0].length > 200) {
      return m[0].replace(/\\n/g, "\n").replace(/\\r/g, "");
    }
  }
  return null;
}

/**
 * Erstes CII-/UBL-XML aus /EmbeddedFiles (auch Flate), sonst unkomprimierter Fallback.
 * Verschlüsselte PDFs: null (kein Raten).
 */
export function extractXmlFromPdf(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return null;
  if (isPdfEncrypted(bytes)) return null;

  const buf = toBuffer(bytes);
  const attachments = extractEmbeddedInvoiceXmls(buf);
  const preferred = pickPreferredXml(attachments, buf.toString("latin1"));
  if (preferred) return preferred;

  return extractUncompressedXmlFromPdf(buf);
}
