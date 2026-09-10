import { describe, expect, it } from "vitest";
import {
  BEREITS_MITGLIED_ERROR,
  EIGENE_ROLLE_LETZTE_ERROR,
  EIGENES_PASSWORT_HIER_NICHT_ERROR,
  LETZTE_EIGENTUEMERIN_ERROR,
  PASSWOERTER_STIMMEN_NICHT_ERROR,
  PASSWORT_UNVERAENDERT_ERROR,
  assertFremdesPasswortZiel,
  assertKannMitgliedschaftEntfernen,
  hatRecht,
  isMitgliedschaftRolle,
  istInstanzEigentuemer,
  validateEigenesPasswortAendern,
  validateEinladenInput,
  validateNeuesPasswort,
  validateRollenwechsel,
} from "./rechte";

describe("hatRecht", () => {
  it("gibt Lesen allen Rollen", () => {
    expect(hatRecht("lesen", "lesen")).toBe(true);
    expect(hatRecht("bearbeiten", "lesen")).toBe(true);
    expect(hatRecht("eigentuemer", "lesen")).toBe(true);
  });

  it("schreibt nur Bearbeiten und Eigentümer:in", () => {
    expect(hatRecht("lesen", "schreiben")).toBe(false);
    expect(hatRecht("bearbeiten", "schreiben")).toBe(true);
    expect(hatRecht("eigentuemer", "schreiben")).toBe(true);
  });

  it("verwaltet nur Eigentümer:in", () => {
    expect(hatRecht("lesen", "verwalten")).toBe(false);
    expect(hatRecht("bearbeiten", "verwalten")).toBe(false);
    expect(hatRecht("eigentuemer", "verwalten")).toBe(true);
  });
});

describe("istInstanzEigentuemer", () => {
  it("erkennt nur die Setup-Rolle", () => {
    expect(istInstanzEigentuemer("eigentuemer")).toBe(true);
    expect(istInstanzEigentuemer("nutzer")).toBe(false);
    expect(istInstanzEigentuemer("")).toBe(false);
  });
});

describe("isMitgliedschaftRolle", () => {
  it("nimmt nur die drei groben Rollen", () => {
    expect(isMitgliedschaftRolle("eigentuemer")).toBe(true);
    expect(isMitgliedschaftRolle("bearbeiten")).toBe(true);
    expect(isMitgliedschaftRolle("lesen")).toBe(true);
    expect(isMitgliedschaftRolle("admin")).toBe(false);
    expect(isMitgliedschaftRolle("nutzer")).toBe(false);
  });
});

describe("validateEinladenInput", () => {
  const base = {
    name: "  Kim  Beispiel ",
    email: "Kim@Example.DE",
    password: "sicheres-passwort",
    rolle: "bearbeiten",
    bestehendesKonto: false,
  };

  it("normalisiert Name und E-Mail", () => {
    const v = validateEinladenInput(base);
    expect(v.name).toBe("Kim Beispiel");
    expect(v.email).toBe("kim@example.de");
    expect(v.rolle).toBe("bearbeiten");
  });

  it("verlangt ein Startpasswort für neue Konten", () => {
    expect(() =>
      validateEinladenInput({ ...base, password: "kurz" }),
    ).toThrow(/8 Zeichen/);
  });

  it("erlaubt leeres Passwort bei bestehendem Konto", () => {
    const v = validateEinladenInput({
      ...base,
      password: "",
      bestehendesKonto: true,
    });
    expect(v.password).toBe("");
  });

  it("lehnt ungültige Rolle und E-Mail ab", () => {
    expect(() =>
      validateEinladenInput({ ...base, rolle: "admin" }),
    ).toThrow(/Rolle/);
    expect(() =>
      validateEinladenInput({ ...base, email: "ohne-at" }),
    ).toThrow(/E-Mail/);
    expect(() =>
      validateEinladenInput({ ...base, name: "  " }),
    ).toThrow(/Name/);
  });
});

describe("validateRollenwechsel", () => {
  it("lässt Wechsel zwischen Bearbeiten und Lesen zu", () => {
    expect(
      validateRollenwechsel({
        handelndeUserId: "a",
        zielUserId: "b",
        bisherigeRolle: "bearbeiten",
        neueRolle: "lesen",
        eigentuemerAnzahl: 1,
      }),
    ).toBe("lesen");
  });

  it("verhindert das Herabstufen der letzten Eigentümer:in", () => {
    expect(() =>
      validateRollenwechsel({
        handelndeUserId: "a",
        zielUserId: "b",
        bisherigeRolle: "eigentuemer",
        neueRolle: "bearbeiten",
        eigentuemerAnzahl: 1,
      }),
    ).toThrow(LETZTE_EIGENTUEMERIN_ERROR);
  });

  it("verhindert das eigene Herabstufen als letzte Eigentümer:in", () => {
    expect(() =>
      validateRollenwechsel({
        handelndeUserId: "a",
        zielUserId: "a",
        bisherigeRolle: "eigentuemer",
        neueRolle: "lesen",
        eigentuemerAnzahl: 1,
      }),
    ).toThrow(EIGENE_ROLLE_LETZTE_ERROR);
  });

  it("erlaubt Herabstufen wenn eine weitere Eigentümer:in bleibt", () => {
    expect(
      validateRollenwechsel({
        handelndeUserId: "a",
        zielUserId: "b",
        bisherigeRolle: "eigentuemer",
        neueRolle: "bearbeiten",
        eigentuemerAnzahl: 2,
      }),
    ).toBe("bearbeiten");
  });
});

describe("assertKannMitgliedschaftEntfernen", () => {
  it("schützt die letzte Eigentümer:in", () => {
    expect(() =>
      assertKannMitgliedschaftEntfernen({
        handelndeUserId: "a",
        zielUserId: "a",
        zielRolle: "eigentuemer",
        eigentuemerAnzahl: 1,
      }),
    ).toThrow(LETZTE_EIGENTUEMERIN_ERROR);
  });

  it("erlaubt Entfernen von Bearbeiten/Lesen", () => {
    expect(() =>
      assertKannMitgliedschaftEntfernen({
        handelndeUserId: "a",
        zielUserId: "b",
        zielRolle: "lesen",
        eigentuemerAnzahl: 1,
      }),
    ).not.toThrow();
  });
});

describe("validateNeuesPasswort", () => {
  it("verlangt mindestens 8 Zeichen", () => {
    expect(validateNeuesPasswort("abcdefgh")).toBe("abcdefgh");
    expect(() => validateNeuesPasswort("kurz")).toThrow(/8 Zeichen/);
  });
});

describe("assertFremdesPasswortZiel", () => {
  it("verbietet das eigene Konto unter /app/nutzer", () => {
    expect(() => assertFremdesPasswortZiel("u1", "u1")).toThrow(
      EIGENES_PASSWORT_HIER_NICHT_ERROR,
    );
  });

  it("erlaubt ein fremdes Konto", () => {
    expect(() => assertFremdesPasswortZiel("u1", "u2")).not.toThrow();
  });
});

describe("validateEigenesPasswortAendern", () => {
  const base = {
    altesPasswort: "altes-passwort",
    neuesPasswort: "neues-passwort",
    neuesPasswortConfirm: "neues-passwort",
  };

  it("nimmt gültige Eingaben an und trimmt", () => {
    const v = validateEigenesPasswortAendern({
      altesPasswort: "  altes-passwort  ",
      neuesPasswort: "  neues-passwort  ",
      neuesPasswortConfirm: "  neues-passwort  ",
    });
    expect(v.altesPasswort).toBe("altes-passwort");
    expect(v.neuesPasswort).toBe("neues-passwort");
  });

  it("verlangt das alte Passwort", () => {
    expect(() =>
      validateEigenesPasswortAendern({ ...base, altesPasswort: "   " }),
    ).toThrow(/Altes Passwort/);
  });

  it("verlangt mindestens 8 Zeichen für das neue Passwort", () => {
    expect(() =>
      validateEigenesPasswortAendern({
        ...base,
        neuesPasswort: "kurz",
        neuesPasswortConfirm: "kurz",
      }),
    ).toThrow(/8 Zeichen/);
  });

  it("verlangt übereinstimmende Bestätigung", () => {
    expect(() =>
      validateEigenesPasswortAendern({
        ...base,
        neuesPasswortConfirm: "anderes-passwort",
      }),
    ).toThrow(PASSWOERTER_STIMMEN_NICHT_ERROR);
  });

  it("lehnt unverändertes Passwort ab", () => {
    expect(() =>
      validateEigenesPasswortAendern({
        altesPasswort: "gleiches-passwort",
        neuesPasswort: "gleiches-passwort",
        neuesPasswortConfirm: "gleiches-passwort",
      }),
    ).toThrow(PASSWORT_UNVERAENDERT_ERROR);
  });
});

describe("Konstanten", () => {
  it("bleiben de-DE und ohne Admin-Vokabular", () => {
    expect(BEREITS_MITGLIED_ERROR).toMatch(/bereits Mitglied/);
    expect(LETZTE_EIGENTUEMERIN_ERROR).toMatch(/letzte Eigentümer/);
  });
});
