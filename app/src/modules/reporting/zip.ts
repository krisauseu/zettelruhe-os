/**
 * Minimaler ZIP-Writer (Store / keine Kompression).
 * Ausreichend für Belegarchiv (PDF/Bilder oft schon komprimiert).
 * Keine externe Abhängigkeit.
 */

import { crc32 } from "./crc32";

export type ZipEntry = {
  /** Pfad im Archiv, z. B. dateien/B-0001.pdf */
  name: string;
  data: Uint8Array;
};

function encUtf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  b[2] = (n >>> 16) & 0xff;
  b[3] = (n >>> 24) & 0xff;
  return b;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/**
 * Baut ein ZIP (PKZIP Store) aus Einträgen.
 * Dateinamen als UTF-8 mit Language Encoding Flag (Bit 11).
 */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encUtf8(entry.name.replace(/\\/g, "/"));
    const data = entry.data;
    const crc = crc32(data);
    const size = data.length;
    // general purpose bit 11 = UTF-8
    const gpFlag = 0x0800;
    const method = 0; // store
    const modTime = 0;
    const modDate = 0;

    const localHeader = concat([
      u32(0x04034b50),
      u16(20), // version needed
      u16(gpFlag),
      u16(method),
      u16(modTime),
      u16(modDate),
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBytes.length),
      u16(0), // extra
      nameBytes,
    ]);

    const localOffset = offset;
    localParts.push(localHeader, data);
    offset += localHeader.length + data.length;

    const central = concat([
      u32(0x02014b50),
      u16(20), // version made by
      u16(20), // version needed
      u16(gpFlag),
      u16(method),
      u16(modTime),
      u16(modDate),
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBytes.length),
      u16(0), // extra
      u16(0), // comment
      u16(0), // disk start
      u16(0), // int attrs
      u32(0), // ext attrs
      u32(localOffset),
      nameBytes,
    ]);
    centralParts.push(central);
  }

  const centralDir = concat(centralParts);
  const localAll = concat(localParts);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralDir.length),
    u32(localAll.length),
    u16(0),
  ]);

  return concat([localAll, centralDir, end]);
}
