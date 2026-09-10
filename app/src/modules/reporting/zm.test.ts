import { describe, expect, it } from "vitest";
import type { JournalEintrag } from "@/modules/journal/types";
import type { ZmKontaktBlick } from "./types";
import {
  ZM_FORMAT_ID,
  buildZmUebersicht,
  detectZmMeldezeitraum,
  extractUstIdAusNotiz,
  landGruppe,
  serializeZmCsv,
  zmCsvFilename,
} from "./zm";

function je(
  partial: Partial<JournalEintrag> &
    Pick<JournalEintrag, "richtung" | "betrag_brutto">,
): JournalEintrag {
  return {
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
    kontakt: partial.kontakt ?? null,
    quelle_typ: partial.quelle_typ ?? "zahlung",
    quelle_id: partial.quelle_id ?? "",
    storno_von: partial.storno_von ?? null,
    festgeschrieben_am: "2026-08-10T10:00:00.000Z",
  };
}

function k(
  partial: Partial<ZmKontaktBlick> & Pick<ZmKontaktBlick, "id">,
): ZmKontaktBlick {
  return {
    id: partial.id,
    name: partial.name ?? "Kontakt",
    land: partial.land ?? "DE",
    notiz: partial.notiz ?? "",
    ust_id: partial.ust_id ?? "",
    letzte_pruefung: partial.letzte_pruefung,
  };
}

const MONAT = { von: "2026-08-01", bis: "2026-08-31" };

function kontakte(...items: ZmKontaktBlick[]): Map<string, ZmKontaktBlick> {
  return new Map(items.map((item) => [item.id, item]));
}

describe("landGruppe", () => {
  it("ordnet ISO-2 ehrlich zu", () => {
    expect(landGruppe("FR")).toBe("eu_ohne_de");
    expect(landGruppe("de")).toBe("de");
    expect(landGruppe("US")).toBe("drittland");
    expect(landGruppe("GB")).toBe("drittland");
    expect(landGruppe("")).toBe("unbekannt");
    expect(landGruppe("Frankreich")).toBe("unbekannt");
  });

  it("nimmt GR, EL und XI als übriges Gemeinschaftsgebiet", () => {
    expect(landGruppe("GR")).toBe("eu_ohne_de");
    expect(landGruppe("EL")).toBe("eu_ohne_de");
    expect(landGruppe("XI")).toBe("eu_ohne_de");
  });
});

describe("extractUstIdAusNotiz", () => {
  it("liest nur explizit beschriftete Id", () => {
    expect(extractUstIdAusNotiz("USt-IdNr.: FR12345678901")).toBe(
      "FR12345678901",
    );
    expect(extractUstIdAusNotiz("VAT ID IT01234567890")).toBe("IT01234567890");
    expect(extractUstIdAusNotiz("irgendwas FR12345678901 ohne Label")).toBe("");
    expect(extractUstIdAusNotiz("")).toBe("");
  });
});

describe("detectZmMeldezeitraum", () => {
  it("erkennt Kalendermonat", () => {
    const v = detectZmMeldezeitraum(MONAT);
    expect(v.art).toBe("monat");
    expect(v.jahr).toBe("2026");
    expect(v.label).toMatch(/August 2026/);
  });

  it("erkennt Kalenderquartal", () => {
    const v = detectZmMeldezeitraum({ von: "2026-07-01", bis: "2026-09-30" });
    expect(v.art).toBe("quartal");
    expect(v.label).toMatch(/3\. Quartal 2026/);
  });

  it("Jahr ist kein typischer Meldezeitraum", () => {
    const v = detectZmMeldezeitraum({ von: "2026-01-01", bis: "2026-12-31" });
    expect(v.art).toBe("kein_meldezeitraum");
  });
});

describe("buildZmUebersicht", () => {
  it("unter Kleinunternehmerregelung nicht verfügbar", () => {
    const zm = buildZmUebersicht(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "100.00",
          kontakt: "fr1",
        }),
      ],
      MONAT,
      "kleinunternehmer",
      kontakte(k({ id: "fr1", land: "FR", name: "Paris SARL" })),
    );
    expect(zm.verfuegbar).toBe(false);
    expect(zm.csv_download_erlaubt).toBe(false);
    expect(zm.kandidaten).toHaveLength(0);
    expect(zm.csv_blockgrund).toMatch(/Kleinunternehmerregelung/);
    expect(zm.format_id).toBe(ZM_FORMAT_ID);
  });

  it("nimmt 0-USt-Zahlung an FR-Kontakt als Kandidat, ohne Art", () => {
    const zm = buildZmUebersicht(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "250.00",
          betrag_netto: "250.00",
          betrag_ust: "0.00",
          steuersatz: "",
          kontakt: "fr1",
          quelle_typ: "zahlung",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
      kontakte(k({ id: "fr1", land: "FR", name: "Paris SARL" })),
    );
    expect(zm.verfuegbar).toBe(true);
    expect(zm.kandidaten).toHaveLength(1);
    expect(zm.kandidaten[0]?.kontakt_name).toBe("Paris SARL");
    expect(zm.kandidaten[0]?.land).toBe("FR");
    expect(zm.kandidaten[0]?.journal_netto).toBe("250.00");
    expect(zm.kandidaten[0]?.eintrag_euro_ganz).toBe("250");
    expect(zm.kandidaten[0]?.ust_id_status).toBe("nicht_gefuehrt");
    expect(zm.nicht_gefuehrt.some((n) => n.feld === "Art")).toBe(true);
    expect(zm.andere_nullust).toHaveLength(0);
  });

  it("nimmt 0-USt-Forderungsbuchung der Rechnung nicht als Kandidat", () => {
    const zm = buildZmUebersicht(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "250.00",
          betrag_netto: "250.00",
          betrag_ust: "0.00",
          kontakt: "fr1",
          quelle_typ: "rechnung",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
      kontakte(k({ id: "fr1", land: "FR", name: "Paris SARL" })),
    );
    expect(zm.kandidaten).toHaveLength(0);
    expect(zm.andere_nullust).toHaveLength(0);
  });

  it("ordnet 19-%-Umsatz an EU-Kontakt nicht der ZM zu", () => {
    const zm = buildZmUebersicht(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "119.00",
          betrag_netto: "100.00",
          betrag_ust: "19.00",
          steuersatz: "",
          kontakt: "fr1",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
      kontakte(k({ id: "fr1", land: "FR" })),
    );
    expect(zm.kandidaten).toHaveLength(0);
    expect(zm.andere_nullust).toHaveLength(0);
  });

  it("führt 0-USt an DE- und US-Kontakt sowie ohne Kontakt als andere", () => {
    const zm = buildZmUebersicht(
      [
        je({
          id: "1",
          laufende_nr: 1,
          richtung: "einnahme",
          betrag_brutto: "10.00",
          kontakt: "de1",
        }),
        je({
          id: "2",
          laufende_nr: 2,
          richtung: "einnahme",
          betrag_brutto: "20.00",
          kontakt: "us1",
        }),
        je({
          id: "3",
          laufende_nr: 3,
          richtung: "einnahme",
          betrag_brutto: "30.00",
          kontakt: null,
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
      kontakte(
        k({ id: "de1", land: "DE", name: "Berlin GmbH" }),
        k({ id: "us1", land: "US", name: "NY Inc" }),
      ),
    );
    expect(zm.kandidaten).toHaveLength(0);
    expect(zm.andere_nullust).toHaveLength(3);
    expect(zm.andere_nullust.map((z) => z.land_gruppe)).toEqual([
      "de",
      "drittland",
      "unbekannt",
    ]);
    expect(zm.summe_andere_netto).toBe("60.00");
  });

  it("nimmt Ausgabe an EU-Lieferant:in nicht auf", () => {
    const zm = buildZmUebersicht(
      [
        je({
          richtung: "ausgabe",
          betrag_brutto: "80.00",
          betrag_ust: "0.00",
          kontakt: "nl1",
          quelle_typ: "beleg",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
      kontakte(k({ id: "nl1", land: "NL" })),
    );
    expect(zm.kandidaten).toHaveLength(0);
    expect(zm.andere_nullust).toHaveLength(0);
  });

  it("nimmt Satz 19 bei USt 0 nicht als steuerfrei", () => {
    const zm = buildZmUebersicht(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "100.00",
          betrag_ust: "0.00",
          steuersatz: "19",
          kontakt: "fr1",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
      kontakte(k({ id: "fr1", land: "FR" })),
    );
    expect(zm.kandidaten).toHaveLength(0);
  });

  it("mindert Kandidaten bei Zahlungs-Storno", () => {
    const zm = buildZmUebersicht(
      [
        je({
          id: "1",
          laufende_nr: 1,
          richtung: "einnahme",
          betrag_brutto: "400.00",
          kontakt: "it1",
        }),
        je({
          id: "2",
          laufende_nr: 2,
          richtung: "ausgabe",
          betrag_brutto: "400.00",
          kontakt: "it1",
          quelle_typ: "storno",
          storno_von: "1",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
      kontakte(k({ id: "it1", land: "IT", name: "Roma SRL" })),
    );
    expect(zm.kandidaten).toHaveLength(1);
    expect(zm.kandidaten[0]?.journal_netto).toBe("0.00");
    expect(zm.kandidaten[0]?.anzahl_buchungen).toBe(2);
    expect(zm.kandidaten_zeilen[1]?.ist_storno).toBe(true);
  });

  it("summiert zwei Buchungen eines Kontakts", () => {
    const zm = buildZmUebersicht(
      [
        je({
          id: "1",
          laufende_nr: 1,
          richtung: "einnahme",
          betrag_brutto: "100.40",
          kontakt: "es1",
        }),
        je({
          id: "2",
          laufende_nr: 2,
          richtung: "einnahme",
          betrag_brutto: "50.10",
          kontakt: "es1",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
      kontakte(k({ id: "es1", land: "ES", name: "Madrid SL" })),
    );
    expect(zm.kandidaten[0]?.journal_netto).toBe("150.50");
    expect(zm.kandidaten[0]?.eintrag_euro_ganz).toBe("151");
    expect(zm.summe_kandidaten_euro_ganz).toBe("151");
  });

  it("bevorzugt Stamm-USt-Id vor der Notiz", () => {
    const zm = buildZmUebersicht(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "90.00",
          kontakt: "at1",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
      kontakte(
        k({
          id: "at1",
          land: "AT",
          name: "Wien GmbH",
          ust_id: "ATU12345678",
          notiz: "USt-IdNr.: ATU99999999",
        }),
      ),
    );
    expect(zm.kandidaten[0]?.ust_id).toBe("ATU12345678");
    expect(zm.kandidaten[0]?.ust_id_status).toBe("stamm_ungeprueft");
    expect(zm.kandidaten[0]?.ust_id_notiz).toBe("ATU99999999");
  });

  it("zeigt BZSt-Schnappschuss ohne Dauer-gültig", () => {
    const zm = buildZmUebersicht(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "90.00",
          kontakt: "at1",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
      kontakte(
        k({
          id: "at1",
          land: "AT",
          name: "Wien GmbH",
          ust_id: "ATU12345678",
          letzte_pruefung: {
            anfrage_zeitpunkt: "2026-08-15T10:00:00.000Z",
            status: "evatr-0000",
            status_meldung: "gültig zum Anfragezeitpunkt",
            abgefragte_ust_id: "ATU12345678",
          },
        }),
      ),
    );
    expect(zm.kandidaten[0]?.ust_id_status).toBe("pruefung_snapshot");
    expect(zm.kandidaten[0]?.ust_id_pruefung_status).toBe("evatr-0000");
    expect(zm.nicht_gefuehrt.some((n) => n.feld === "Gültigkeit zum Umsatz")).toBe(
      true,
    );
  });

  it("zeigt USt-Id aus Notiz als ungeprüft", () => {
    const zm = buildZmUebersicht(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "90.00",
          kontakt: "at1",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
      kontakte(
        k({
          id: "at1",
          land: "AT",
          name: "Wien GmbH",
          notiz: "USt-IdNr.: ATU12345678",
        }),
      ),
    );
    expect(zm.kandidaten[0]?.ust_id_notiz).toBe("ATU12345678");
    expect(zm.kandidaten[0]?.ust_id_status).toBe("notiz_ungeprueft");
  });

  it("behandelt fehlenden Kontakt als andere, nicht als Kandidat", () => {
    const zm = buildZmUebersicht(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "70.00",
          kontakt: "gone",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
      kontakte(),
    );
    expect(zm.kandidaten).toHaveLength(0);
    expect(zm.andere_nullust[0]?.kontakt_name).toBe("Kontakt nicht gefunden");
    expect(zm.andere_nullust[0]?.land_gruppe).toBe("unbekannt");
  });

  it("Jahr: Übersicht ja, Meldezeitraum nein, CSV ja", () => {
    const jahr = { von: "2026-01-01", bis: "2026-12-31" };
    const zm = buildZmUebersicht(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "80.00",
          kontakt: "pl1",
        }),
      ],
      jahr,
      "regelbesteuerung_ist",
      kontakte(k({ id: "pl1", land: "PL" })),
    );
    expect(zm.verfuegbar).toBe(true);
    expect(zm.meldezeitraum.art).toBe("kein_meldezeitraum");
    expect(zm.csv_download_erlaubt).toBe(true);
    expect(zm.kandidaten).toHaveLength(1);
  });
});

describe("serializeZmCsv", () => {
  it("schreibt Kandidaten und andere, lehnt Kleinunternehmer ab", () => {
    const zm = buildZmUebersicht(
      [
        je({
          id: "a",
          laufende_nr: 1,
          richtung: "einnahme",
          betrag_brutto: "100.00",
          kontakt: "fr1",
          buchungstext: "Rechnung R-0001",
        }),
        je({
          id: "b",
          laufende_nr: 2,
          richtung: "einnahme",
          betrag_brutto: "40.00",
          kontakt: "de1",
        }),
      ],
      MONAT,
      "regelbesteuerung_ist",
      kontakte(
        k({ id: "fr1", land: "FR", name: "Paris SARL" }),
        k({ id: "de1", land: "DE", name: "Berlin GmbH" }),
      ),
    );
    const { csv, filename } = serializeZmCsv(zm, { bom: false });
    expect(filename).toBe("ZM_Zettelruhe_2026_08.csv");
    expect(csv).toContain("kontakt;kandidat;Paris SARL;FR");
    expect(csv).toContain("zeile;kandidat;Paris SARL;FR");
    expect(csv).toContain("andere_nullust;Berlin GmbH;DE");
    expect(csv).toContain("nicht_gefuehrt");
    expect(csv).toContain("100,00");

    const ku = buildZmUebersicht([], MONAT, "kleinunternehmer");
    expect(() => serializeZmCsv(ku)).toThrow(/Kleinunternehmerregelung/);
  });

  it("Dateiname Quartal und Jahr", () => {
    expect(
      zmCsvFilename({
        zeitraum: { von: "2026-07-01", bis: "2026-09-30" },
        meldezeitraum: {
          art: "quartal",
          jahr: "2026",
          label: "",
        },
      }),
    ).toBe("ZM_Zettelruhe_2026_Q3.csv");
    expect(
      zmCsvFilename({
        zeitraum: { von: "2026-01-01", bis: "2026-12-31" },
        meldezeitraum: {
          art: "kein_meldezeitraum",
          jahr: "2026",
          label: "",
        },
      }),
    ).toBe("ZM_Zettelruhe_2026-01-01_2026-12-31.csv");
  });
});
