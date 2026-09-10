import { describe, expect, it } from "vitest";
import { buildGirocodePayload } from "./girocode";
import { renderGirocodeDataUri } from "./girocode-qr";

describe("buildGirocodePayload", () => {
  it("baut EPC 002 mit Betrag und Verwendungszweck", () => {
    const payload = buildGirocodePayload({
      empfaenger: "TechCraft Digital GmbH",
      iban: "DE89 3704 0044 0532 0130 00",
      bic: "COBADEFFXXX",
      betrag: "3105.90",
      verwendungszweck: "R-0001",
    });
    expect(payload).toBe(
      [
        "BCD",
        "002",
        "1",
        "SCT",
        "COBADEFFXXX",
        "TechCraft Digital GmbH",
        "DE89370400440532013000",
        "EUR3105.90",
        "",
        "R-0001",
        "",
      ].join("\n"),
    );
  });

  it("lehnt fehlende IBAN oder fehlenden Namen ab", () => {
    expect(
      buildGirocodePayload({
        empfaenger: "Firma",
        iban: "",
        betrag: "10.00",
      }),
    ).toBeNull();
    expect(
      buildGirocodePayload({
        empfaenger: "   ",
        iban: "DE89370400440532013000",
      }),
    ).toBeNull();
    expect(
      buildGirocodePayload({
        empfaenger: "Firma",
        iban: "XX00",
      }),
    ).toBeNull();
  });

  it("lässt Betrag 0 und überlange Namen weg bzw. kürzt", () => {
    const payload = buildGirocodePayload({
      empfaenger: "A".repeat(80),
      iban: "DE89370400440532013000",
      betrag: "0.00",
      verwendungszweck: "B".repeat(200),
    });
    expect(payload).toContain("\n" + "A".repeat(70) + "\n");
    expect(payload).toContain("\n\n" + "B".repeat(140) + "\n");
    expect(payload).not.toContain("EUR0");
  });
});

describe("renderGirocodeDataUri", () => {
  it("liefert ein PNG", async () => {
    const payload = buildGirocodePayload({
      empfaenger: "Zettelruhe",
      iban: "DE89370400440532013000",
      betrag: "12.50",
      verwendungszweck: "R-0001",
    });
    expect(payload).toBeTruthy();
    const uri = await renderGirocodeDataUri(payload!);
    expect(uri?.startsWith("data:image/png;base64,")).toBe(true);
    expect((uri ?? "").length).toBeGreaterThan(100);
  });
});
