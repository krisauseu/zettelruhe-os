import { describe, expect, it } from "vitest";
import { belegDateiHref, belegDateiZeilen } from "./beleg-datei-zeilen";

describe("belegDateiHref", () => {
  it("hängt den Dateinamen als Query an", () => {
    expect(belegDateiHref("abc", "seite-1.jpg")).toBe(
      "/app/belege/abc/datei?name=seite-1.jpg",
    );
  });
});

describe("belegDateiZeilen", () => {
  it("legt je gespeicherte Datei eine Zeile mit eigener Anzeigen-URL an", () => {
    const zeilen = belegDateiZeilen({
      savedNames: ["seite-1.jpg", "  ", "seite-2.pdf"],
      pending: [],
      belegId: "abc",
    });
    expect(zeilen).toEqual([
      {
        key: "saved:seite-1.jpg",
        name: "seite-1.jpg",
        anzeigenHref: "/app/belege/abc/datei?name=seite-1.jpg",
        kind: "saved",
      },
      {
        key: "saved:seite-2.pdf",
        name: "seite-2.pdf",
        anzeigenHref: "/app/belege/abc/datei?name=seite-2.pdf",
        kind: "saved",
      },
    ]);
  });

  it("hängt neue Auswahl an gespeicherte Dateien an", () => {
    const zeilen = belegDateiZeilen({
      savedNames: ["alt.jpg"],
      pending: [{ name: "neu.jpg", previewUrl: "blob:preview" }],
      belegId: "abc",
    });
    expect(zeilen.map((z) => z.kind)).toEqual(["saved", "pending"]);
    expect(zeilen[1]).toEqual({
      key: "pending:0:neu.jpg",
      name: "neu.jpg",
      anzeigenHref: "blob:preview",
      kind: "pending",
      pendingIndex: 0,
    });
  });

  it("ohne Beleg-ID keine Anzeigen-URL für gespeicherte Dateien", () => {
    const zeilen = belegDateiZeilen({
      savedNames: ["x.jpg"],
      pending: [],
    });
    expect(zeilen[0]?.anzeigenHref).toBeNull();
  });
});
