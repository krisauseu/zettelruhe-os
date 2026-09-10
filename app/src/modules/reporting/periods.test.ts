import { describe, expect, it } from "vitest";
import {
  addDaysYmd,
  daysBetweenYmd,
  isDateInZeitraum,
  lastDayOfMonth,
  monthsInZeitraum,
  DEFAULT_AUSWERTUNG_PRESET,
  normalizeZeitraumPreset,
  periodFromPreset,
  periodLastNMonths,
  periodMonth,
  periodQuarter,
  periodYear,
  quarterOfMonth,
  validateZeitraum,
  zeitraumFromSearchParams,
  ymd,
} from "./periods";

describe("lastDayOfMonth / quarter", () => {
  it("kennt Feb/Schaltjahr und 30/31-Tage", () => {
    expect(lastDayOfMonth(2024, 2)).toBe(29);
    expect(lastDayOfMonth(2025, 2)).toBe(28);
    expect(lastDayOfMonth(2026, 4)).toBe(30);
    expect(lastDayOfMonth(2026, 1)).toBe(31);
  });

  it("ordnet Monate Quartalen zu", () => {
    expect(quarterOfMonth(1)).toBe(1);
    expect(quarterOfMonth(3)).toBe(1);
    expect(quarterOfMonth(4)).toBe(2);
    expect(quarterOfMonth(12)).toBe(4);
  });
});

describe("period presets Europe/Berlin-Kalendertag", () => {
  it("Monat August 2026", () => {
    expect(periodMonth("2026-08-12")).toEqual({
      von: "2026-08-01",
      bis: "2026-08-31",
    });
  });

  it("Quartal Q3 2026", () => {
    expect(periodQuarter("2026-08-12")).toEqual({
      von: "2026-07-01",
      bis: "2026-09-30",
    });
  });

  it("Jahr 2026", () => {
    expect(periodYear("2026-08-12")).toEqual({
      von: "2026-01-01",
      bis: "2026-12-31",
    });
  });

  it("periodFromPreset custom", () => {
    expect(
      periodFromPreset("custom", undefined, {
        von: "2026-01-15",
        bis: "2026-02-10",
      }),
    ).toEqual({ von: "2026-01-15", bis: "2026-02-10" });
  });
});

describe("validateZeitraum", () => {
  it("akzeptiert inklusiven Bereich", () => {
    expect(validateZeitraum({ von: "2026-01-01", bis: "2026-01-01" })).toEqual({
      von: "2026-01-01",
      bis: "2026-01-01",
    });
  });

  it("lehnt von > bis ab", () => {
    expect(() =>
      validateZeitraum({ von: "2026-02-01", bis: "2026-01-01" }),
    ).toThrow(/von/i);
  });

  it("lehnt ungültige Daten ab", () => {
    expect(() =>
      validateZeitraum({ von: "2026-13-01", bis: "2026-13-02" }),
    ).toThrow();
  });
});

describe("zeitraumFromSearchParams", () => {
  it("Default Monat", () => {
    const z = zeitraumFromSearchParams({ ref: "2026-03-15" });
    expect(z).toEqual({ von: "2026-03-01", bis: "2026-03-31" });
  });

  it("Default Kalenderjahr für Auswertungen", () => {
    expect(DEFAULT_AUSWERTUNG_PRESET).toBe("jahr");
    const z = zeitraumFromSearchParams(
      { ref: "2026-03-15" },
      DEFAULT_AUSWERTUNG_PRESET,
    );
    expect(z).toEqual({ von: "2026-01-01", bis: "2026-12-31" });
  });

  it("explizites Monat bleibt Monat, auch wenn Default Jahr ist", () => {
    const z = zeitraumFromSearchParams(
      { preset: "monat", ref: "2026-03-15" },
      DEFAULT_AUSWERTUNG_PRESET,
    );
    expect(z).toEqual({ von: "2026-03-01", bis: "2026-03-31" });
  });

  it("unbekanntes Preset fällt auf den Default zurück", () => {
    expect(normalizeZeitraumPreset("nein", "jahr")).toBe("jahr");
    const z = zeitraumFromSearchParams(
      { preset: "nein", ref: "2026-08-12" },
      "jahr",
    );
    expect(z).toEqual({ von: "2026-01-01", bis: "2026-12-31" });
  });

  it("custom mit von/bis", () => {
    const z = zeitraumFromSearchParams({
      preset: "custom",
      von: "2026-01-01",
      bis: "2026-06-30",
    });
    expect(z.von).toBe("2026-01-01");
    expect(z.bis).toBe("2026-06-30");
  });
});

describe("isDateInZeitraum", () => {
  it("inklusiv an Grenzen", () => {
    const z = { von: "2026-08-01", bis: "2026-08-31" };
    expect(isDateInZeitraum("2026-08-01", z)).toBe(true);
    expect(isDateInZeitraum("2026-08-31", z)).toBe(true);
    expect(isDateInZeitraum("2026-07-31", z)).toBe(false);
    expect(isDateInZeitraum("2026-09-01", z)).toBe(false);
  });
});

describe("ymd", () => {
  it("padded", () => {
    expect(ymd(2026, 8, 5)).toBe("2026-08-05");
  });
});

describe("Kalenderarithmetik", () => {
  it("addDaysYmd über Monats- und Jahresgrenzen", () => {
    expect(addDaysYmd("2026-08-17", 14)).toBe("2026-08-31");
    expect(addDaysYmd("2026-08-20", 14)).toBe("2026-09-03");
    expect(addDaysYmd("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("daysBetweenYmd zählt ganze Kalendertage", () => {
    expect(daysBetweenYmd("2026-08-01", "2026-08-17")).toBe(16);
    expect(daysBetweenYmd("2026-08-17", "2026-08-17")).toBe(0);
  });

  it("periodLastNMonths: 12 Monate bis August 2026", () => {
    expect(periodLastNMonths(12, "2026-08-17")).toEqual({
      von: "2025-09-01",
      bis: "2026-08-31",
    });
    expect(periodLastNMonths(6, "2026-08-17")).toEqual({
      von: "2026-03-01",
      bis: "2026-08-31",
    });
  });

  it("monthsInZeitraum listet Kalendermonate", () => {
    const m = monthsInZeitraum({ von: "2026-01-15", bis: "2026-03-02" });
    expect(m.map((x) => x.key)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });
});
