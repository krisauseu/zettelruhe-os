import { describe, expect, it } from "vitest";
import { baueEinladungMail } from "./einladung-mail";

describe("baueEinladungMail", () => {
  const mail = baueEinladungMail({
    empfaengerName: "Kim Beispiel",
    firmaName: "Beispiel GmbH",
    rolleLabel: "Bearbeiten",
    einladendeName: "Alex Beispiel",
    loginUrl: "https://app.zettelruhe.de/login",
  });

  it("nennt Firma, Rolle und Anmeldeseite", () => {
    expect(mail.subject).toMatch(/Beispiel GmbH/);
    expect(mail.text).toMatch(/Kim Beispiel/);
    expect(mail.text).toMatch(/Alex Beispiel/);
    expect(mail.text).toMatch(/Bearbeiten/);
    expect(mail.text).toMatch("https://app.zettelruhe.de/login");
  });

  it("enthält kein Passwort-Feld", () => {
    expect(mail.text.toLowerCase()).not.toMatch(/passwort:.+/);
    expect(mail.text).toMatch(/steht nicht in dieser Mail/);
  });
});
