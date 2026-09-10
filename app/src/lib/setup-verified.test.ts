import { describe, expect, it } from "vitest";
import { eigentuemerCreateBody } from "./setup-verified";

describe("eigentuemerCreateBody", () => {
  const body = eigentuemerCreateBody({
    email: "alex@example.de",
    password: "sicheres-passwort",
    name: "Alex Beispiel",
    firmaId: "firma_xyz",
  });

  it("verifiziert die Eigentümer:in beim Anlegen", () => {
    expect(body.verified).toBe(true);
    expect(body.role).toBe("eigentuemer");
  });

  it("setzt keine SMTP- oder Bestätigungsfelder", () => {
    expect(body).not.toHaveProperty("verification");
    expect(body).not.toHaveProperty("emailVisibility", false);
    expect(Object.keys(body)).not.toContain("tokenKey");
  });

  it("übernimmt Stammdaten und bestätigt das Passwort", () => {
    expect(body.email).toBe("alex@example.de");
    expect(body.name).toBe("Alex Beispiel");
    expect(body.firma).toBe("firma_xyz");
    expect(body.passwordConfirm).toBe(body.password);
    expect(body.emailVisibility).toBe(true);
  });
});
