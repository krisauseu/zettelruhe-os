import { describe, expect, it } from "vitest";
import { aendereEigenesPasswort } from "./passwort";
import { FALSCHES_ALTES_PASSWORT_ERROR } from "./rechte";

describe("aendereEigenesPasswort", () => {
  const input = {
    userId: "user_1",
    email: "kim@example.de",
    altesPasswort: "altes-passwort",
    neuesPasswort: "neues-passwort",
    neuesPasswortConfirm: "neues-passwort",
  };

  it("schreibt das neue Passwort nach erfolgreicher Prüfung", async () => {
    const gesetzt: { userId: string; password: string }[] = [];
    await aendereEigenesPasswort(input, {
      pruefePasswort: async (email, password) => {
        expect(email).toBe("kim@example.de");
        expect(password).toBe("altes-passwort");
        return { id: "user_1" };
      },
      setzePasswort: async (userId, password) => {
        gesetzt.push({ userId, password });
      },
    });
    expect(gesetzt).toEqual([
      { userId: "user_1", password: "neues-passwort" },
    ]);
  });

  it("lehnt ein falsches altes Passwort ab und schreibt nicht", async () => {
    let geschrieben = false;
    await expect(
      aendereEigenesPasswort(input, {
        pruefePasswort: async () => {
          throw new Error("PocketBase 400");
        },
        setzePasswort: async () => {
          geschrieben = true;
        },
      }),
    ).rejects.toThrow(FALSCHES_ALTES_PASSWORT_ERROR);
    expect(geschrieben).toBe(false);
  });

  it("lehnt eine abweichende Nutzer:in ab", async () => {
    let geschrieben = false;
    await expect(
      aendereEigenesPasswort(input, {
        pruefePasswort: async () => ({ id: "user_fremd" }),
        setzePasswort: async () => {
          geschrieben = true;
        },
      }),
    ).rejects.toThrow(FALSCHES_ALTES_PASSWORT_ERROR);
    expect(geschrieben).toBe(false);
  });
});
