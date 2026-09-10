import { describe, expect, it } from "vitest";
import {
  ANGEBOT_GESENDET_ERROR,
  ANGEBOT_PDF_IMMUTABLE_ERROR,
  PDF_ORIGINAL_NUR_NACH_SENDEN_ERROR,
  PDF_VORSCHAU_NUR_ENTWURF_ERROR,
  ANGEBOT_STATUS_TRANSITIONS,
  assertAngebotEntwurfEditable,
  assertAngebotEntwurfOhneNummer,
  assertAngebotVorschauNurEntwurf,
  assertCanChangeAngebotStatus,
  assertCanPreviewAngebotPdf,
  assertCanServeOriginalAngebotPdf,
  assertCanSenden,
  assertCanUebernehmenInRechnung,
  defaultGueltigBis,
  isAngebotEntwurf,
  isAngebotFinalisiert,
  KLEINUNTERNEHMER_HINWEIS,
  validateAngebotInput,
} from "./invariants";
import type { Angebot, Angebotsposition } from "./types";

function sampleAngebot(over: Partial<Angebot> = {}): Angebot {
  return {
    id: "a1",
    firma: "f1",
    kunde: "k1",
    angebotsdatum: "2026-08-12",
    gueltig_bis: "2026-09-11",
    notiz: "",
    status: "entwurf",
    angebotsnummer: "",
    betrag_netto: "100.00",
    betrag_ust: "19.00",
    betrag_brutto: "119.00",
    steuermodus: "regelbesteuerung_ist",
    pdf: "",
    gesendet_am: "",
    rechnung: null,
    ...over,
  };
}

function samplePos(over: Partial<Angebotsposition> = {}): Angebotsposition {
  return {
    id: "p1",
    firma: "f1",
    angebot: "a1",
    sortierung: 0,
    bezeichnung: "Beratung",
    menge: "2",
    einheit: "h",
    einzelpreis: "50.00",
    steuersatz: "19",
    betrag_netto: "100.00",
    betrag_ust: "19.00",
    betrag_brutto: "119.00",
    katalog_position: null,
    ...over,
  };
}

describe("validateAngebotInput", () => {
  it("validiert Kopf + Positionen und summiert (USt)", () => {
    const v = validateAngebotInput(
      {
        kunde: "k1",
        angebotsdatum: "2026-08-12",
        positionen: [
          {
            bezeichnung: "Arbeit",
            menge: "1",
            einzelpreis: "200,00",
            steuersatz: "19",
          },
        ],
      },
      "regelbesteuerung_ist",
    );
    expect(v.betrag_brutto).toBe("238.00");
    expect(v.positionen).toHaveLength(1);
  });

  it("setzt USt unter Kleinunternehmerregelung auf 0", () => {
    const v = validateAngebotInput(
      {
        angebotsdatum: "2026-08-12",
        positionen: [
          {
            bezeichnung: "Arbeit",
            menge: "1",
            einzelpreis: "100",
            steuersatz: "19",
          },
        ],
      },
      "kleinunternehmer",
    );
    expect(v.betrag_ust).toBe("0.00");
    expect(v.betrag_brutto).toBe("100.00");
    expect(v.positionen[0].steuersatz).toBe("");
  });

  it("lehnt Angebot ohne Position ab", () => {
    expect(() =>
      validateAngebotInput(
        { angebotsdatum: "2026-08-12", positionen: [] },
        "kleinunternehmer",
      ),
    ).toThrow(/Position/);
  });

  it("lehnt Gültig-bis vor Angebotsdatum ab", () => {
    expect(() =>
      validateAngebotInput(
        {
          angebotsdatum: "2026-08-12",
          gueltig_bis: "2026-08-01",
          positionen: [
            { bezeichnung: "X", menge: "1", einzelpreis: "10" },
          ],
        },
        "kleinunternehmer",
      ),
    ).toThrow(/Gültig-bis/);
  });
});

describe("Entwurf vs. Senden — Nummern und Immutability", () => {
  it("erkennt Status", () => {
    expect(isAngebotEntwurf(sampleAngebot())).toBe(true);
    expect(
      isAngebotFinalisiert(sampleAngebot({ status: "gesendet" })),
    ).toBe(true);
  });

  it("blockiert Edit nach Senden", () => {
    expect(() =>
      assertAngebotEntwurfEditable(sampleAngebot({ status: "gesendet" })),
    ).toThrow(ANGEBOT_GESENDET_ERROR);
  });

  it("Entwurf ohne Angebotsnummer", () => {
    expect(() =>
      assertAngebotEntwurfOhneNummer(sampleAngebot({ angebotsnummer: "" })),
    ).not.toThrow();
    expect(() =>
      assertAngebotEntwurfOhneNummer(
        sampleAngebot({ status: "entwurf", angebotsnummer: "A-0001" }),
      ),
    ).toThrow(/keine Angebotsnummer/);
  });

  it("erlaubt Senden nur für Entwurf mit Kund:in und Positionen", () => {
    expect(() =>
      assertCanSenden(sampleAngebot(), [samplePos()]),
    ).not.toThrow();

    expect(() =>
      assertCanSenden(sampleAngebot({ status: "gesendet" }), [samplePos()]),
    ).toThrow(/Nur Entwürfe/);

    expect(() =>
      assertCanSenden(sampleAngebot({ kunde: null }), [samplePos()]),
    ).toThrow(/Kund:in/);

    expect(() =>
      assertCanSenden(sampleAngebot({ angebotsnummer: "A-1" }), [
        samplePos(),
      ]),
    ).toThrow(/Angebotsnummer/);

    expect(() => assertCanSenden(sampleAngebot(), [])).toThrow(/Position/);
  });
});

describe("Status-Übergänge light", () => {
  it("definiert Übergänge ohne entwurf→gesendet (nur über Senden)", () => {
    expect(ANGEBOT_STATUS_TRANSITIONS.entwurf).toEqual([]);
    expect(ANGEBOT_STATUS_TRANSITIONS.gesendet).toContain("angenommen");
    expect(ANGEBOT_STATUS_TRANSITIONS.angenommen).toContain("abgerechnet");
  });

  it("blockiert manuellen Status aus Entwurf", () => {
    expect(() =>
      assertCanChangeAngebotStatus(sampleAngebot(), "gesendet"),
    ).toThrow(/Senden/);
  });

  it("erlaubt gesendet → angenommen", () => {
    expect(() =>
      assertCanChangeAngebotStatus(
        sampleAngebot({ status: "gesendet", angebotsnummer: "A-0001" }),
        "angenommen",
      ),
    ).not.toThrow();
  });

  it("blockiert abgelehnt → angenommen", () => {
    expect(() =>
      assertCanChangeAngebotStatus(
        sampleAngebot({ status: "abgelehnt", angebotsnummer: "A-0001" }),
        "angenommen",
      ),
    ).toThrow(/nicht erlaubt/);
  });
});

describe("Übernahme in Rechnung", () => {
  it("nur angenommen ohne bestehende Rechnung", () => {
    expect(() =>
      assertCanUebernehmenInRechnung(
        sampleAngebot({ status: "angenommen", angebotsnummer: "A-1" }),
      ),
    ).not.toThrow();

    expect(() =>
      assertCanUebernehmenInRechnung(
        sampleAngebot({ status: "gesendet", angebotsnummer: "A-1" }),
      ),
    ).toThrow(/angenommen/);

    expect(() =>
      assertCanUebernehmenInRechnung(
        sampleAngebot({
          status: "angenommen",
          angebotsnummer: "A-1",
          rechnung: "r1",
        }),
      ),
    ).toThrow(/bereits/);
  });
});

describe("defaultGueltigBis", () => {
  it("addiert 30 Tage", () => {
    expect(defaultGueltigBis("2026-08-12")).toBe("2026-09-11");
  });
});

describe("PDF / §-19-Hinweis", () => {
  it("ADR-0012 Immutability-Hinweis für Angebot", () => {
    expect(ANGEBOT_PDF_IMMUTABLE_ERROR).toMatch(/unveränderbar/i);
  });

  it("§-19-Hinweis gemeinsam mit Rechnung", () => {
    expect(KLEINUNTERNEHMER_HINWEIS).toMatch(/§ 19/);
  });
});

describe("Angebots-PDF Vorschau vs. Original", () => {
  it("erlaubt Vorschau nur für sendefähigen Entwurf", () => {
    expect(() =>
      assertCanPreviewAngebotPdf(sampleAngebot(), [samplePos()]),
    ).not.toThrow();
    expect(() =>
      assertCanPreviewAngebotPdf(sampleAngebot({ kunde: null }), [
        samplePos(),
      ]),
    ).toThrow(/Kund:in/);
  });

  it("serviert Original nicht am Entwurf", () => {
    expect(() => assertCanServeOriginalAngebotPdf(sampleAngebot())).toThrow(
      PDF_ORIGINAL_NUR_NACH_SENDEN_ERROR,
    );
    expect(() =>
      assertCanServeOriginalAngebotPdf(
        sampleAngebot({ status: "gesendet", pdf: "A-0001.pdf" }),
      ),
    ).not.toThrow();
  });

  it("blockiert Vorschau nach Senden", () => {
    expect(() =>
      assertAngebotVorschauNurEntwurf(
        sampleAngebot({ status: "gesendet" }),
      ),
    ).toThrow(PDF_VORSCHAU_NUR_ENTWURF_ERROR);
  });
});
