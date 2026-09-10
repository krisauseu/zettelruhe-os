/**
 * UStVA-Kennzahlen + ELSTER-XML light (Self-File, ADR-0019).
 *
 * Quelle: bestehende USt-Übersicht (Buchungsjournal der aktiven Firma).
 * Einnahmen aus Rechnungen über Zahlungsjournal (Zufluss, ADR-0024).
 * Der normale Arbeitsflow ist Regelbesteuerung. Gespeicherte RC-Schnappschüsse
 * bleiben auch unter Kleinunternehmerregelung auswertbar.
 *
 * Ehrliche Felder aus Journal-Sätzen 19 / 7 / Vorsteuer:
 *   Kz 81/86 — normale Bemessungsgrundlagen (volle Euro)
 *   Kz 66 — normale Vorsteuer aus Ausgaben (Cent)
 *   Kz 46/47 und 84/85 — RC-Grundlagen/Steuer
 *   Kz 67 — tatsächlich abziehbare RC-Vorsteuer
 *   Kz 83 — normale Steuer + RC-Steuer − Kz 66 − Kz 67
 * Alles andere: weglassen bzw. „nicht geführt“ — nichts erfinden.
 *
 * XML: Nutzdaten `Anmeldungssteuern` zum lokalen Speichern / Hochladen in
 * Mein Elster. Kein ERiC, keine Hersteller-ID, kein Versand.
 */

import {
  Decimal,
  money,
  moneyToString,
  percentOf,
  subMoney,
  sumMoney,
} from "@/lib/money";
import type { MoneyInput } from "@/lib/money";
import {
  lastDayOfMonth,
  parseYmd,
  quarterOfMonth,
  todayBerlin,
} from "./periods";
import type {
  UstUebersicht,
  UstvaDatensatz,
  UstvaFirmaAngaben,
  UstvaKennzahlZeile,
  UstvaVoranmeldung,
  Zeitraum,
} from "./types";

export const USTVA_FORMAT_ID = "zettelruhe-ustva-elster-xml-light-v1" as const;

export const USTVA_HINWEIS =
  "UStVA light aus dem Buchungsjournal. Werte selbst in Mein Elster eintragen oder XML lokal speichern, kein ELSTER-Versand und keine Abgabe aus der App. " +
  "Bemessungsgrundlagen werden erst nach der Periodensumme auf volle Euro gegen null gekürzt. Normale Umsätze folgen dem Buchungsdatum, Reverse Charge dem unveränderbaren Steuerdatum.";

const MONAT_NAMEN = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Schema-Reihenfolge der Kz-Knoten (ohne Kz09/Kz10/Kz22/Kz23/Kz26/Kz29). */
const XML_KZ_ORDER = [
  21, 35, 36, 37, 39, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 59, 60, 61, 62,
  63, 64, 65, 66, 67, 69, 73, 74, 76, 77, 80, 81, 83, 84, 85, 86, 89, 91, 93,
  94, 95, 96, 98,
] as const;

/** Typische UStVA-Felder, die das Journal nicht unterscheiden kann. */
export const USTVA_NICHT_GEFUEHRT: { kz: string; bezeichnung: string }[] = [
  {
    kz: "35/36",
    bezeichnung: "Umsätze zu anderen Steuersätzen",
  },
  {
    kz: "41",
    bezeichnung: "Innergemeinschaftliche Lieferungen (§ 4 Nr. 1b UStG)",
  },
  {
    kz: "43",
    bezeichnung: "Weitere steuerfreie Umsätze mit Vorsteuerabzug (z. B. Ausfuhr)",
  },
  {
    kz: "48",
    bezeichnung: "Steuerfreie Umsätze ohne Vorsteuerabzug",
  },
  {
    kz: "21",
    bezeichnung: "Nicht steuerbare sonstige Leistungen (übriges Gemeinschaftsgebiet)",
  },
  {
    kz: "45",
    bezeichnung: "Übrige nicht steuerbare Umsätze",
  },
  {
    kz: "89/93",
    bezeichnung: "Steuerpflichtige innergemeinschaftliche Erwerbe",
  },
  {
    kz: "61",
    bezeichnung: "Vorsteuer aus innergemeinschaftlichem Erwerb",
  },
  {
    kz: "62",
    bezeichnung: "Entrichtete Einfuhrumsatzsteuer",
  },
  {
    kz: "39",
    bezeichnung: "Anrechnung (Sondervorauszahlung)",
  },
];

/** Bestehende kaufmännische Ganz-Euro-Rundung, weiterhin für die ZM verwendet. */
export function roundEuroGanz(value: MoneyInput): ReturnType<typeof money> {
  const d = money(value);
  if (d.isZero()) return money(0);
  const sign = d.isNegative() ? -1 : 1;
  return money(d.abs().toDecimalPlaces(0, Decimal.ROUND_HALF_UP)).times(sign);
}

/** UStVA-Bemessungsgrundlage: Centanteil der Periodensumme weglassen. */
export function truncateEuroGanz(value: MoneyInput): ReturnType<typeof money> {
  const d = money(value);
  if (d.isZero()) return money(0);
  return d.toDecimalPlaces(0, Decimal.ROUND_DOWN);
}

function euroGanzString(value: MoneyInput): string {
  return truncateEuroGanz(value).toFixed(0);
}

/**
 * Erkennt, ob von/bis ein amtlicher UStVA-Zeitraum ist
 * (Kalendermonat 01–12 oder Kalenderquartal 41–44). Jahr ist es nicht.
 */
export function detectUstvaVoranmeldung(zeitraum: Zeitraum): UstvaVoranmeldung {
  const von = parseYmd(zeitraum.von);
  const bis = parseYmd(zeitraum.bis);

  if (
    von.y === bis.y &&
    von.m === bis.m &&
    von.d === 1 &&
    bis.d === lastDayOfMonth(von.y, von.m)
  ) {
    return {
      art: "monat",
      jahr: String(von.y),
      zeitraum_code: pad2(von.m),
      label: `${MONAT_NAMEN[von.m - 1]} ${von.y}`,
    };
  }

  const q = quarterOfMonth(von.m);
  const startM = (q - 1) * 3 + 1;
  const endM = startM + 2;
  if (
    von.y === bis.y &&
    von.m === startM &&
    von.d === 1 &&
    bis.m === endM &&
    bis.d === lastDayOfMonth(bis.y, endM)
  ) {
    return {
      art: "quartal",
      jahr: String(von.y),
      zeitraum_code: String(40 + q),
      label: `${q}. Quartal ${von.y}`,
    };
  }

  return {
    art: "kein_voranmeldungszeitraum",
    jahr: String(von.y),
    zeitraum_code: null,
    label:
      "Kein amtlicher Voranmeldungszeitraum (UStVA ist Kalendermonat oder -quartal)",
  };
}

function emptyFirma(): UstvaFirmaAngaben {
  return { name: "", strasse: "", plz: "", ort: "", steuernummer: "" };
}

export function firmaToUstvaAngaben(
  firma: {
    name?: string;
    strasse?: string;
    plz?: string;
    ort?: string;
    steuernummer?: string;
  } | null,
): UstvaFirmaAngaben {
  if (!firma) return emptyFirma();
  return {
    name: (firma.name ?? "").trim(),
    strasse: (firma.strasse ?? "").trim(),
    plz: (firma.plz ?? "").trim(),
    ort: (firma.ort ?? "").trim(),
    steuernummer: (firma.steuernummer ?? "").trim(),
  };
}

function zeileSatz(ust: UstUebersicht, satz: "19" | "7" | "0" | "ohne") {
  return (
    ust.zeilen.find((z) => z.steuersatz === satz) ?? {
      steuersatz: satz,
      ust_einnahmen: "0.00",
      vorsteuer: "0.00",
      netto_einnahmen: "0.00",
      netto_ausgaben: "0.00",
    }
  );
}

function kennzahl(partial: UstvaKennzahlZeile): UstvaKennzahlZeile {
  return partial;
}

/**
 * Mappt die USt-Übersicht auf ehrliche UStVA-Kennzahlen.
 * Erfindet keine ig. Lieferungen, § 13b, EUSt oder andere Arten.
 */
export function buildUstvaDatensatz(
  ust: UstUebersicht,
  firma: UstvaFirmaAngaben = emptyFirma(),
): UstvaDatensatz {
  const voranmeldung = detectUstvaVoranmeldung(ust.zeitraum);
  const z19 = zeileSatz(ust, "19");
  const z7 = zeileSatz(ust, "7");
  const z0 = zeileSatz(ust, "0");
  const zOhne = zeileSatz(ust, "ohne");

  const kz81 = euroGanzString(z19.netto_einnahmen);
  const kz86 = euroGanzString(z7.netto_einnahmen);
  const kz66 = moneyToString(ust.summe_vorsteuer);
  const rc = ust.reverse_charge;
  const kz46 = euroGanzString(rc.grundlage_eu);
  const kz47 = moneyToString(rc.schuld_eu);
  const kz84 = euroGanzString(rc.grundlage_drittland);
  const kz85 = moneyToString(rc.schuld_drittland);
  const kz67 = moneyToString(rc.vorsteuer);
  const ustErrechnet = sumMoney(
    percentOf(kz81, 19),
    percentOf(kz86, 7),
    kz47,
    kz85,
  );
  const kz83 = moneyToString(subMoney(subMoney(ustErrechnet, kz66), kz67));

  const unmappedUst = money(z0.ust_einnahmen).plus(money(zOhne.ust_einnahmen));
  const unmappedNetto = money(z0.netto_einnahmen).plus(
    money(zOhne.netto_einnahmen),
  );

  const kennzahlen: UstvaKennzahlZeile[] = [
    kennzahl({
      kz: "81",
      bezeichnung: "Steuerpflichtige Umsätze zum Steuersatz 19 % (Bemessungsgrundlage)",
      status: "befuellt",
      eintrag: kz81,
      eintrag_einheit: "euro_ganz",
      journal_netto: z19.netto_einnahmen,
      journal_ust: z19.ust_einnahmen,
      hinweis:
        "Journal-Netto nach der Periodensumme gegen null auf volle Euro gekürzt. Die Steuer zu Kz 81 rechnet Mein Elster aus dieser Basis (19 %).",
    }),
    kennzahl({
      kz: "86",
      bezeichnung: "Steuerpflichtige Umsätze zum Steuersatz 7 % (Bemessungsgrundlage)",
      status: "befuellt",
      eintrag: kz86,
      eintrag_einheit: "euro_ganz",
      journal_netto: z7.netto_einnahmen,
      journal_ust: z7.ust_einnahmen,
      hinweis:
        "Journal-Netto nach der Periodensumme gegen null auf volle Euro gekürzt. Die Steuer zu Kz 86 rechnet Mein Elster aus dieser Basis (7 %).",
    }),
    kennzahl({
      kz: "66",
      bezeichnung: "Abziehbare Vorsteuerbeträge aus Rechnungen anderer Unternehmer",
      status: "befuellt",
      eintrag: kz66,
      eintrag_einheit: "euro_cent",
      journal_netto: null,
      journal_ust: ust.summe_vorsteuer,
      hinweis:
        "Normale Vorsteuer aus Rechnungen anderer Unternehmer. RC-Vorsteuer steht ausschließlich in Kz 67.",
    }),
    kennzahl({
      kz: "46",
      bezeichnung: "EU-Dienstleistungen nach § 13b Abs. 1 UStG (Bemessungsgrundlage)",
      status: "befuellt",
      eintrag: kz46,
      eintrag_einheit: "euro_ganz",
      journal_netto: rc.grundlage_eu,
      journal_ust: null,
      hinweis: "Summe der gespeicherten RC-Grundlagen, danach gegen null auf volle Euro gekürzt.",
    }),
    kennzahl({
      kz: "47",
      bezeichnung: "Steuer zu EU-Dienstleistungen nach § 13b Abs. 1 UStG",
      status: "befuellt",
      eintrag: kz47,
      eintrag_einheit: "euro_cent",
      journal_netto: null,
      journal_ust: rc.schuld_eu,
      hinweis: "Cent-genaue Summe der unveränderbaren RC-Steuerschuld.",
    }),
    kennzahl({
      kz: "84",
      bezeichnung: "Drittlandsdienstleistungen nach § 13b Abs. 2 Nr. 1 UStG (Bemessungsgrundlage)",
      status: "befuellt",
      eintrag: kz84,
      eintrag_einheit: "euro_ganz",
      journal_netto: rc.grundlage_drittland,
      journal_ust: null,
      hinweis: "Nur der unterstützte Dienstleistungsfall; die amtliche Kz 84 umfasst weitere Fälle.",
    }),
    kennzahl({
      kz: "85",
      bezeichnung: "Steuer zu Drittlandsdienstleistungen nach § 13b Abs. 2 Nr. 1 UStG",
      status: "befuellt",
      eintrag: kz85,
      eintrag_einheit: "euro_cent",
      journal_netto: null,
      journal_ust: rc.schuld_drittland,
      hinweis: "Cent-genaue Summe der unveränderbaren RC-Steuerschuld.",
    }),
    kennzahl({
      kz: "67",
      bezeichnung: "Abziehbare Vorsteuer aus Leistungen im Sinne des § 13b UStG",
      status: "befuellt",
      eintrag: kz67,
      eintrag_einheit: "euro_cent",
      journal_netto: null,
      journal_ust: rc.vorsteuer,
      hinweis: "Nur die im damaligen RC-Schnappschuss tatsächlich abziehbare Vorsteuer; nicht zusätzlich in Kz 66.",
    }),
    kennzahl({
      kz: "83",
      bezeichnung: "Verbleibende Umsatzsteuer-Vorauszahlung / Überschuss",
      status: "befuellt",
      eintrag: kz83,
      eintrag_einheit: "euro_cent",
      journal_netto: null,
      journal_ust: ust.zahllast,
      hinweis:
        kz83 === ust.zahllast
          ? "Kz 83 light = normale Umsatzsteuer + Kz 47 + Kz 85 − Kz 66 − Kz 67. Negativ bedeutet Erstattung light."
          : `Kz 83 light (${kz83} €) weicht von der Journal-Zahllast (${ust.zahllast} €) ab. Ursache kann die Kürzung normaler Bemessungsgrundlagen auf volle Euro sein.`,
    }),
  ];

  const nicht_gefuehrt = [...USTVA_NICHT_GEFUEHRT];
  if (!unmappedNetto.isZero() || !unmappedUst.isZero()) {
    nicht_gefuehrt.unshift({
      kz: "0 / ohne",
      bezeichnung: `Umsätze mit Satz 0 % oder ohne Satz im Journal (Netto ${moneyToString(unmappedNetto)} €, USt ${moneyToString(unmappedUst)} €) — keine Zuordnung zu Kz 41/43/48 möglich`,
    });
  }

  if (!ust.verfuegbar) {
    return {
      format_id: USTVA_FORMAT_ID,
      steuermodus: ust.steuermodus,
      verfuegbar: false,
      zeitraum: ust.zeitraum,
      voranmeldung,
      firma,
      kennzahlen: [],
      nicht_gefuehrt: [],
      kz83: "0.00",
      zahllast_journal: ust.zahllast,
      xml_download_erlaubt: false,
      xml_blockgrund:
        "Unter der Kleinunternehmerregelung (§ 19 UStG) liegt im gewählten Zeitraum kein unterstützter RC-Fall vor.",
      hinweis: ust.hinweis,
    };
  }

  const xmlOk =
    voranmeldung.art !== "kein_voranmeldungszeitraum" &&
    voranmeldung.jahr === "2026";
  return {
    format_id: USTVA_FORMAT_ID,
    steuermodus: ust.steuermodus,
    verfuegbar: true,
    zeitraum: ust.zeitraum,
    voranmeldung,
    firma,
    kennzahlen,
    nicht_gefuehrt,
    kz83,
    zahllast_journal: ust.zahllast,
    xml_download_erlaubt: xmlOk,
    xml_blockgrund: xmlOk
      ? ""
      : voranmeldung.jahr !== "2026"
        ? "Der XML-Serializer ist ausschließlich für das amtlich geprüfte Jahr 2026 freigegeben."
        : "XML-Download nur für einen amtlichen Voranmeldungszeitraum (Kalendermonat oder Kalenderquartal).",
    hinweis: USTVA_HINWEIS,
  };
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** ISO-8859-15-Byte oder null, wenn das Zeichen nicht im Zeichensatz liegt. */
function iso885915Byte(cp: number): number | null {
  if (cp === 0x20ac) return 0xa4; // €
  if (cp === 0x0160) return 0xa6; // Š
  if (cp === 0x0161) return 0xa8; // š
  if (cp === 0x017d) return 0xb4; // Ž
  if (cp === 0x017e) return 0xb8; // ž
  if (cp === 0x0152) return 0xbc; // Œ
  if (cp === 0x0153) return 0xbd; // œ
  if (cp === 0x0178) return 0xbe; // Ÿ
  if (
    cp === 0xa4 ||
    cp === 0xa6 ||
    cp === 0xa8 ||
    cp === 0xb4 ||
    cp === 0xb8 ||
    cp === 0xbc ||
    cp === 0xbd ||
    cp === 0xbe
  ) {
    return null;
  }
  if (cp <= 0xff) return cp;
  return null;
}

/** XML-Text nach ISO-8859-15; unmögliche Zeichen als dezimale Entities. */
export function encodeIso885915(xml: string): Uint8Array {
  const bytes: number[] = [];
  for (const ch of xml) {
    const cp = ch.codePointAt(0)!;
    const b = iso885915Byte(cp);
    if (b != null) {
      bytes.push(b);
    } else {
      const entity = `&#${cp};`;
      for (let i = 0; i < entity.length; i += 1) {
        bytes.push(entity.charCodeAt(i));
      }
    }
  }
  return Uint8Array.from(bytes);
}

function ymdToElsterDate(ymd: string): string {
  return ymd.replace(/-/g, "");
}

function elsterChild(name: string, value: string): string {
  return `    <${name}>${xmlEscape(value)}</${name}>`;
}

/**
 * Mein-Elster-Upload: nur Nutzdaten `Anmeldungssteuern`.
 * Kz-Reihenfolge wie Schema; leere/0-Kz 81/86/66 weggelassen; Kz 83 immer.
 */
export function serializeUstvaXml(
  datensatz: UstvaDatensatz,
  opts?: { erstellungsdatum?: string },
): { xml: string; bytes: Uint8Array; filename: string } {
  if (!datensatz.xml_download_erlaubt) {
    throw new Error(
      datensatz.xml_blockgrund || "XML-Download nicht möglich.",
    );
  }
  const v = datensatz.voranmeldung;
  if (!v.zeitraum_code) {
    throw new Error("XML-Download nicht möglich.");
  }

  const jahr = v.jahr;
  const erstellt = ymdToElsterDate(
    (opts?.erstellungsdatum ?? todayBerlin()).slice(0, 10),
  );

  const kzWerte = new Map<number, string>();
  for (const z of datensatz.kennzahlen) {
    if (z.status !== "befuellt" || z.eintrag == null) continue;
    const n = Number(z.kz);
    if (!Number.isFinite(n)) continue;
    if (n !== 83 && money(z.eintrag).isZero()) {
      continue;
    }
    kzWerte.set(n, z.eintrag);
  }
  if (!kzWerte.has(83)) {
    kzWerte.set(83, datensatz.kz83);
  }

  const lieferant: string[] = [
    elsterChild("Name", datensatz.firma.name || "Firma"),
  ];
  if (datensatz.firma.strasse) {
    lieferant.push(elsterChild("Strasse", datensatz.firma.strasse));
  }
  if (datensatz.firma.plz) {
    lieferant.push(elsterChild("PLZ", datensatz.firma.plz));
  }
  if (datensatz.firma.ort) {
    lieferant.push(elsterChild("Ort", datensatz.firma.ort));
  }

  const fall: string[] = [
    elsterChild("Jahr", jahr),
    elsterChild("Zeitraum", v.zeitraum_code),
  ];
  if (datensatz.firma.steuernummer) {
    fall.push(elsterChild("Steuernummer", datensatz.firma.steuernummer));
  }
  for (const kz of XML_KZ_ORDER) {
    const wert = kzWerte.get(kz);
    if (wert == null) continue;
    fall.push(elsterChild(`Kz${kz}`, wert));
  }

  const xmlns = `http://finkonsens.de/elster/elsteranmeldung/ustva/v${jahr}`;
  const xml = [
    `<?xml version="1.0" encoding="ISO-8859-15" standalone="no"?>`,
    `<!-- ${USTVA_FORMAT_ID} - Self-File, kein Versand -->`,
    `<Anmeldungssteuern xmlns="${xmlns}" version="${jahr}">`,
    `  <Erstellungsdatum>${erstellt}</Erstellungsdatum>`,
    `  <DatenLieferant>`,
    ...lieferant,
    `  </DatenLieferant>`,
    `  <Steuerfall>`,
    `    <Umsatzsteuervoranmeldung>`,
    ...fall,
    `    </Umsatzsteuervoranmeldung>`,
    `  </Steuerfall>`,
    `</Anmeldungssteuern>`,
    ``,
  ].join("\n");

  return {
    xml,
    bytes: encodeIso885915(xml),
    filename: ustvaXmlFilename(v.jahr, v.art, v.zeitraum_code),
  };
}

export function ustvaXmlFilename(
  jahr: string,
  art: UstvaVoranmeldung["art"],
  zeitraumCode: string,
): string {
  if (art === "quartal") {
    const q = Number(zeitraumCode) - 40;
    return `UStVA_Zettelruhe_${jahr}_Q${q}.xml`;
  }
  return `UStVA_Zettelruhe_${jahr}_${zeitraumCode}.xml`;
}
