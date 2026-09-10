import { describe, expect, it } from "vitest";
import { buildUstUebersicht } from "./aggregate";
import type { JournalEintrag } from "@/modules/journal/types";
import type { RcSnapshot } from "@/modules/expenses/reverse-charge";
import {
  USTVA_FORMAT_ID,
  buildUstvaDatensatz,
  detectUstvaVoranmeldung,
  encodeIso885915,
  firmaToUstvaAngaben,
  roundEuroGanz,
  truncateEuroGanz,
  serializeUstvaXml,
  ustvaXmlFilename,
} from "./ustva";

function je(
  partial: Partial<JournalEintrag> &
    Pick<JournalEintrag, "richtung" | "betrag_brutto">,
): JournalEintrag {
  return {
    rc: partial.rc,
    rc_steuerdatum: partial.rc_steuerdatum,
    rc_vorgang: partial.rc_vorgang,
    id: partial.id ?? "x",
    firma: "f1",
    laufende_nr: partial.laufende_nr ?? 1,
    buchungsdatum: partial.buchungsdatum ?? "2026-08-10",
    belegdatum: partial.belegdatum ?? "2026-08-10",
    buchungstext: partial.buchungstext ?? "Test",
    richtung: partial.richtung,
    betrag_netto: partial.betrag_netto ?? partial.betrag_brutto,
    betrag_ust: partial.betrag_ust ?? "0.00",
    betrag_brutto: partial.betrag_brutto,
    steuersatz: partial.steuersatz ?? "",
    konto: partial.konto ?? "",
    kontakt: null,
    quelle_typ: partial.quelle_typ ?? "manuell",
    quelle_id: partial.quelle_id ?? "",
    storno_von: partial.storno_von ?? null,
    festgeschrieben_am: "2026-08-10T10:00:00.000Z",
  };
}

const MONAT = { von: "2026-08-01", bis: "2026-08-31" };

function rc(partial: Partial<RcSnapshot> = {}): RcSnapshot {
  return {
    version: 1,
    tatbestand: "eu_dienstleistung",
    waehrung: "EUR",
    satz: "19",
    abzug: "voll",
    steuermodus: "regelbesteuerung_ist",
    modus_bestaetigt: true,
    leistung_von: "2026-08-01",
    leistung_bis: "2026-08-31",
    leistungsabschnitt_bestaetigt: true,
    zahlungsstatus: "bezahlt",
    zahlungsdatum: "2026-09-10",
    zahlungsbetrag: "19.33",
    eine_zahlung: true,
    vorgang: "rc-vorgang",
    bereits_erklaert: false,
    nachweis: "Synthetischer Testnachweis",
    grundlage: "19.33",
    schuld: "3.67",
    vorsteuer: "3.67",
    steuerdatum: "2026-08-31",
    zeitregel: "eu_leistung",
    ...partial,
  };
}

describe("roundEuroGanz", () => {
  it("rundet kaufmännisch, Vorzeichen getrennt", () => {
    expect(roundEuroGanz("100.49").toFixed(0)).toBe("100");
    expect(roundEuroGanz("100.50").toFixed(0)).toBe("101");
    expect(roundEuroGanz("-100.50").toFixed(0)).toBe("-101");
    expect(roundEuroGanz("0").toFixed(0)).toBe("0");
  });
});

describe("truncateEuroGanz", () => {
  it("lässt den Centanteil nach der Periodensumme für beide Vorzeichen weg", () => {
    expect(truncateEuroGanz("100.99").toFixed(0)).toBe("100");
    expect(truncateEuroGanz("-100.99").toFixed(0)).toBe("-100");
  });
});

describe("detectUstvaVoranmeldung", () => {
  it("erkennt Kalendermonat", () => {
    const v = detectUstvaVoranmeldung(MONAT);
    expect(v.art).toBe("monat");
    expect(v.jahr).toBe("2026");
    expect(v.zeitraum_code).toBe("08");
    expect(v.label).toMatch(/August 2026/);
  });

  it("erkennt Kalenderquartal", () => {
    const v = detectUstvaVoranmeldung({ von: "2026-07-01", bis: "2026-09-30" });
    expect(v.art).toBe("quartal");
    expect(v.zeitraum_code).toBe("43");
    expect(v.label).toMatch(/3\. Quartal 2026/);
  });

  it("Jahr ist kein Voranmeldungszeitraum", () => {
    const v = detectUstvaVoranmeldung({ von: "2026-01-01", bis: "2026-12-31" });
    expect(v.art).toBe("kein_voranmeldungszeitraum");
    expect(v.zeitraum_code).toBeNull();
  });

  it("unvollständiger Monat ist kein Voranmeldungszeitraum", () => {
    const v = detectUstvaVoranmeldung({ von: "2026-08-01", bis: "2026-08-15" });
    expect(v.art).toBe("kein_voranmeldungszeitraum");
  });
});

describe("buildUstvaDatensatz", () => {
  it("unter Kleinunternehmerregelung nicht verfügbar, kein XML", () => {
    const ust = buildUstUebersicht(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "119.00",
          betrag_netto: "100.00",
          betrag_ust: "19.00",
          steuersatz: "19",
        }),
      ],
      MONAT,
      "kleinunternehmer",
    );
    const d = buildUstvaDatensatz(ust);
    expect(d.verfuegbar).toBe(false);
    expect(d.xml_download_erlaubt).toBe(false);
    expect(d.kennzahlen).toHaveLength(0);
    expect(d.xml_blockgrund).toMatch(/Kleinunternehmerregelung/);
    expect(d.format_id).toBe(USTVA_FORMAT_ID);
  });

  it("füllt Kz 81/86/66/83 aus dem Journal unter Regelbesteuerung", () => {
    const ust = buildUstUebersicht(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "119.00",
          betrag_netto: "100.00",
          betrag_ust: "19.00",
          steuersatz: "19",
          quelle_typ: "zahlung",
        }),
        je({
          richtung: "ausgabe",
          betrag_brutto: "107.00",
          betrag_netto: "100.00",
          betrag_ust: "7.00",
          steuersatz: "7",
          quelle_typ: "beleg",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
    );
    const d = buildUstvaDatensatz(ust, {
      name: "Regel UG Test",
      strasse: "",
      plz: "",
      ort: "",
      steuernummer: "123/456/78901",
    });
    expect(d.verfuegbar).toBe(true);
    expect(d.xml_download_erlaubt).toBe(true);
    expect(d.kennzahlen.find((k) => k.kz === "81")?.eintrag).toBe("100");
    expect(d.kennzahlen.find((k) => k.kz === "86")?.eintrag).toBe("0");
    expect(d.kennzahlen.find((k) => k.kz === "66")?.eintrag).toBe("7.00");
    expect(d.kz83).toBe("12.00");
    expect(d.zahllast_journal).toBe("12.00");
  });

  it("mindert Kz 81 bei Zahlungs-Storno", () => {
    const ust = buildUstUebersicht(
      [
        je({
          id: "1",
          richtung: "einnahme",
          betrag_brutto: "119.00",
          betrag_netto: "100.00",
          betrag_ust: "19.00",
          steuersatz: "19",
          quelle_typ: "zahlung",
        }),
        je({
          id: "2",
          richtung: "ausgabe",
          betrag_brutto: "119.00",
          betrag_netto: "100.00",
          betrag_ust: "19.00",
          steuersatz: "19",
          quelle_typ: "storno",
          storno_von: "1",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
    );
    const d = buildUstvaDatensatz(ust);
    expect(d.kennzahlen.find((k) => k.kz === "81")?.eintrag).toBe("0");
    expect(d.kz83).toBe("0.00");
  });

  it("füllt Kz 81 aus Zahlungs-USt ohne Journal-Satz (M2-01, Zufluss)", () => {
    const ust = buildUstUebersicht(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "113.05",
          betrag_netto: "95.00",
          betrag_ust: "18.05",
          steuersatz: "",
          quelle_typ: "zahlung",
        }),
        je({
          richtung: "ausgabe",
          betrag_brutto: "49.98",
          betrag_netto: "42.00",
          betrag_ust: "7.98",
          steuersatz: "19",
          quelle_typ: "beleg",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
    );
    const d = buildUstvaDatensatz(ust);
    expect(d.kennzahlen.find((k) => k.kz === "81")?.eintrag).toBe("95");
    expect(d.kennzahlen.find((k) => k.kz === "81")?.journal_ust).toBe("18.05");
    expect(d.kennzahlen.find((k) => k.kz === "66")?.eintrag).toBe("7.98");
    expect(d.kz83).toBe("10.07");
    expect(d.zahllast_journal).toBe("10.07");
    expect(d.nicht_gefuehrt.some((n) => n.kz === "0 / ohne")).toBe(false);
  });

  it("ordnet 0 % / ohne Satz nicht einer Kz zu", () => {
    const ust = buildUstUebersicht(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "50.00",
          betrag_netto: "50.00",
          betrag_ust: "0.00",
          steuersatz: "0",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
    );
    const d = buildUstvaDatensatz(ust);
    expect(d.kennzahlen.find((k) => k.kz === "81")?.eintrag).toBe("0");
    expect(d.nicht_gefuehrt.some((n) => n.kz === "0 / ohne")).toBe(true);
    expect(d.nicht_gefuehrt.some((n) => n.kz === "41")).toBe(true);
  });

  it("kürzt die normale Bemessungsgrundlage erst nach der Periodensumme gegen null", () => {
    const ust = buildUstUebersicht(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "119.60",
          betrag_netto: "100.50",
          betrag_ust: "19.10",
          steuersatz: "19",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
    );
    const d = buildUstvaDatensatz(ust);
    expect(d.kennzahlen.find((k) => k.kz === "81")?.eintrag).toBe("100");
    expect(d.kz83).toBe("19.00");
    expect(d.zahllast_journal).toBe("19.10");
    expect(d.kennzahlen.find((k) => k.kz === "83")?.hinweis).toMatch(/weicht/);
  });

  it("füllt EU- und Drittlands-RC, Kz 67 getrennt von Kz 66 und die Zahllast", () => {
    const ust = buildUstUebersicht(
      [
        je({ richtung: "ausgabe", betrag_brutto: "19.33", betrag_netto: "19.33", betrag_ust: "0.00", steuersatz: "0", quelle_typ: "beleg", rc: rc(), rc_steuerdatum: "2026-08-31" }),
        je({ id: "us", richtung: "ausgabe", betrag_brutto: "10.00", betrag_netto: "10.00", betrag_ust: "0.00", steuersatz: "0", quelle_typ: "beleg", rc: rc({ tatbestand: "drittland_dienstleistung", grundlage: "10.00", schuld: "1.90", vorsteuer: "0.00", abzug: "ausgeschlossen", vorgang: "rc-us" }), rc_steuerdatum: "2026-08-20" }),
      ],
      MONAT,
      "regelbesteuerung_ist",
    );
    const d = buildUstvaDatensatz(ust);
    expect(d.kennzahlen.find((k) => k.kz === "46")?.eintrag).toBe("19");
    expect(d.kennzahlen.find((k) => k.kz === "47")?.eintrag).toBe("3.67");
    expect(d.kennzahlen.find((k) => k.kz === "84")?.eintrag).toBe("10");
    expect(d.kennzahlen.find((k) => k.kz === "85")?.eintrag).toBe("1.90");
    expect(d.kennzahlen.find((k) => k.kz === "67")?.eintrag).toBe("3.67");
    expect(d.kennzahlen.find((k) => k.kz === "66")?.eintrag).toBe("0.00");
    expect(d.kz83).toBe("1.90");
    expect(d.nicht_gefuehrt.some((n) => n.kz === "46/47")).toBe(false);
  });

  it("öffnet nur den begrenzten RC-Workflow für Kleinunternehmer", () => {
    const item = je({ richtung: "ausgabe", betrag_brutto: "19.33", rc: rc({ steuermodus: "kleinunternehmer", abzug: "ausgeschlossen", vorsteuer: "0.00" }), rc_steuerdatum: "2026-08-31" });
    const d = buildUstvaDatensatz(buildUstUebersicht([item], MONAT, "kleinunternehmer"));
    expect(d.verfuegbar).toBe(true);
    expect(d.kennzahlen.find((k) => k.kz === "47")?.eintrag).toBe("3.67");
    expect(d.kennzahlen.find((k) => k.kz === "67")?.eintrag).toBe("0.00");
    expect(d.kennzahlen.find((k) => k.kz === "66")?.eintrag).toBe("0.00");
    expect(d.kz83).toBe("3.67");
  });

  it("Jahr: Kennzahlen ja, XML nein", () => {
    const jahr = { von: "2026-01-01", bis: "2026-12-31" };
    const ust = buildUstUebersicht(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "119.00",
          betrag_netto: "100.00",
          betrag_ust: "19.00",
          steuersatz: "19",
        }),
      ],
      jahr,
      "regelbesteuerung_ist",
    );
    const d = buildUstvaDatensatz(ust);
    expect(d.verfuegbar).toBe(true);
    expect(d.xml_download_erlaubt).toBe(false);
    expect(d.kennzahlen.find((k) => k.kz === "81")?.eintrag).toBe("100");
    expect(d.xml_blockgrund).toMatch(/Voranmeldungszeitraum/);
  });
});

describe("serializeUstvaXml", () => {
  const firma = firmaToUstvaAngaben({
    name: "Müller & Söhne UG",
    strasse: "Straße 1",
    plz: "10115",
    ort: "Berlin",
    steuernummer: "21/123/12345",
  });

  function datensatz() {
    const ust = buildUstUebersicht(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "119.00",
          betrag_netto: "100.00",
          betrag_ust: "19.00",
          steuersatz: "19",
        }),
        je({
          richtung: "einnahme",
          betrag_brutto: "107.00",
          betrag_netto: "100.00",
          betrag_ust: "7.00",
          steuersatz: "7",
        }),
        je({
          richtung: "ausgabe",
          betrag_brutto: "11.90",
          betrag_netto: "10.00",
          betrag_ust: "1.90",
          steuersatz: "19",
          quelle_typ: "beleg",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
    );
    return buildUstvaDatensatz(ust, firma);
  }

  it("baut Anmeldungssteuern mit Namespace, Zeitraum und Schema-Reihenfolge", () => {
    const { xml, filename } = serializeUstvaXml(datensatz(), {
      erstellungsdatum: "2026-08-15",
    });
    expect(xml).toContain('encoding="ISO-8859-15"');
    expect(xml).toContain(
      'xmlns="http://finkonsens.de/elster/elsteranmeldung/ustva/v2026"',
    );
    expect(xml).toContain('version="2026"');
    expect(xml).toContain("<Jahr>2026</Jahr>");
    expect(xml).toContain("<Zeitraum>08</Zeitraum>");
    expect(xml).toContain("<Steuernummer>21/123/12345</Steuernummer>");
    expect(xml).toContain("<Kz81>100</Kz81>");
    expect(xml).toContain("<Kz86>100</Kz86>");
    expect(xml).toContain("<Kz66>1.90</Kz66>");
    expect(xml).toContain("<Kz83>24.10</Kz83>");
    expect(xml).toContain(USTVA_FORMAT_ID);
    expect(xml).toContain("<Erstellungsdatum>20260815</Erstellungsdatum>");
    expect(xml).not.toContain("<Kz09>");
    expect(xml.indexOf("<Kz66>")).toBeLessThan(xml.indexOf("<Kz81>"));
    expect(xml.indexOf("<Kz81>")).toBeLessThan(xml.indexOf("<Kz83>"));
    expect(xml.indexOf("<Kz83>")).toBeLessThan(xml.indexOf("<Kz86>"));
    expect(filename).toBe("UStVA_Zettelruhe_2026_08.xml");
  });

  it("serialisiert die unterstützten RC-Kennziffern in Schema-Reihenfolge", () => {
    const item = je({ richtung: "ausgabe", betrag_brutto: "19.33", rc: rc(), rc_steuerdatum: "2026-08-31" });
    const d = buildUstvaDatensatz(buildUstUebersicht([item], MONAT, "regelbesteuerung_ist"), firma);
    const { xml } = serializeUstvaXml(d, { erstellungsdatum: "2026-08-31" });
    expect(xml).toContain("<Kz46>19</Kz46>");
    expect(xml).toContain("<Kz47>3.67</Kz47>");
    expect(xml).toContain("<Kz67>3.67</Kz67>");
    expect(xml.indexOf("<Kz46>")).toBeLessThan(xml.indexOf("<Kz47>"));
    expect(xml.indexOf("<Kz47>")).toBeLessThan(xml.indexOf("<Kz67>"));
  });

  it("lehnt XML für andere Jahre als 2026 ab", () => {
    const zeitraum = { von: "2027-08-01", bis: "2027-08-31" };
    const d = buildUstvaDatensatz(buildUstUebersicht([], zeitraum, "regelbesteuerung_ist"));
    expect(d.xml_download_erlaubt).toBe(false);
    expect(() => serializeUstvaXml(d)).toThrow(/ausschließlich.*2026/);
  });

  it("lässt 0-Kz 81/86/66 weg, behält Kz 83", () => {
    const ust = buildUstUebersicht([], MONAT, "regelbesteuerung_ist");
    const d = buildUstvaDatensatz(ust, firma);
    const { xml } = serializeUstvaXml(d, { erstellungsdatum: "2026-08-15" });
    expect(xml).not.toContain("<Kz81>");
    expect(xml).not.toContain("<Kz66>");
    expect(xml).toContain("<Kz83>0.00</Kz83>");
  });

  it("lehnt Kleinunternehmer und Jahr ab", () => {
    const ku = buildUstvaDatensatz(
      buildUstUebersicht([], MONAT, "kleinunternehmer"),
    );
    expect(() => serializeUstvaXml(ku)).toThrow(/Kleinunternehmerregelung/);

    const jahr = buildUstvaDatensatz(
      buildUstUebersicht(
        [],
        { von: "2026-01-01", bis: "2026-12-31" },
        "regelbesteuerung_ist",
      ),
    );
    expect(() => serializeUstvaXml(jahr)).toThrow(/Voranmeldungszeitraum/);
  });

  it("kodiert Umlaute als ISO-8859-15", () => {
    const { xml, bytes } = serializeUstvaXml(datensatz(), {
      erstellungsdatum: "2026-08-15",
    });
    expect(xml).toContain("Müller");
    const text = Buffer.from(bytes).toString("latin1");
    expect(text).toContain("M");
    // ü / ö / ß in ISO-8859-15 (= Latin-1 an diesen Stellen)
    expect(bytes).toContain(0xfc);
    expect(bytes).toContain(0xf6);
    expect(bytes).toContain(0xdf);
  });

  it("Dateiname Quartal", () => {
    expect(ustvaXmlFilename("2026", "quartal", "43")).toBe(
      "UStVA_Zettelruhe_2026_Q3.xml",
    );
  });
});

describe("encodeIso885915", () => {
  it("lässt ASCII unverändert und mapped Euro", () => {
    const a = encodeIso885915("AB");
    expect(Array.from(a)).toEqual([0x41, 0x42]);
    const euro = encodeIso885915("€");
    expect(Array.from(euro)).toEqual([0xa4]);
  });
});
