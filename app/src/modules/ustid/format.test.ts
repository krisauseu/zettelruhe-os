import { describe, expect, it } from "vitest";
import {
  eigeneUstIdLage,
  fremdeUstIdLage,
  isBzstAnfragbareUstId,
  isDeutscheUstId,
  isUstIdSyntaxOk,
  normalizeUstId,
} from "./format";

describe("normalizeUstId", () => {
  it("entfernt Leerzeichen, Punkte und Bindestriche", () => {
    expect(normalizeUstId("de 123.456-789")).toBe("DE123456789");
    expect(normalizeUstId(" ATU 123 456 78 ")).toBe("ATU12345678");
  });
});

describe("isUstIdSyntaxOk", () => {
  it("erkennt DE und gängige EU-Formen", () => {
    expect(isUstIdSyntaxOk("DE123456789")).toBe(true);
    expect(isUstIdSyntaxOk("ATU12345678")).toBe(true);
    expect(isUstIdSyntaxOk("FRXX123456789")).toBe(true);
    expect(isUstIdSyntaxOk("EL123456789")).toBe(true);
    expect(isDeutscheUstId("DE123456789")).toBe(true);
  });

  it("lehnt zu kurze oder deutsche Falschformen ab", () => {
    expect(isUstIdSyntaxOk("DE123")).toBe(false);
    expect(isDeutscheUstId("DE12345678")).toBe(false);
    expect(isUstIdSyntaxOk("")).toBe(false);
  });
});

describe("eigeneUstIdLage", () => {
  it("unterscheidet leer, nicht-DE, Syntax und DE-ok", () => {
    expect(eigeneUstIdLage("")).toEqual({ art: "leer" });
    expect(eigeneUstIdLage("ATU12345678").art).toBe("nicht_de");
    expect(eigeneUstIdLage("DE123").art).toBe("syntax_ungueltig");
    expect(eigeneUstIdLage("DE123456789")).toEqual({
      art: "de_syntax_ok",
      normalisiert: "DE123456789",
    });
  });
});

describe("fremdeUstIdLage", () => {
  it("lässt EU ohne DE zu und sperrt DE", () => {
    expect(fremdeUstIdLage("ATU12345678")).toMatchObject({
      art: "eu_ok",
      land: "AT",
    });
    expect(fremdeUstIdLage("DE123456789").art).toBe("de");
    expect(fremdeUstIdLage("US12").art).toBe("nicht_eu");
    expect(fremdeUstIdLage("GR123456789").art).toBe("syntax_ungueltig");
    expect(isBzstAnfragbareUstId("ATU12345678")).toBe(true);
    expect(isBzstAnfragbareUstId("DE123456789")).toBe(false);
  });
});
