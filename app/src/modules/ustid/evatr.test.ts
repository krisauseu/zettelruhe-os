import { describe, expect, it } from "vitest";
import { evatrAbfrage, mapEvatrAntwort, type EvatrFetch } from "./evatr";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("mapEvatrAntwort", () => {
  it("mappt evatr-0000 als gültig zum Anfragezeitpunkt", () => {
    const a = mapEvatrAntwort(
      {
        id: "abc",
        anfrageZeitpunkt: "2026-08-15T10:00:00Z",
        status: "evatr-0000",
      },
      '{"status":"evatr-0000"}',
    );
    expect(a.gueltigZumAnfragezeitpunkt).toBe(true);
    expect(a.statusMeldung).toMatch(/Anfragezeitpunkt gültig/);
    expect(a.id).toBe("abc");
  });

  it("mappt evatr-2001 nicht als gültig", () => {
    const a = mapEvatrAntwort({ status: "evatr-2001" }, "{}");
    expect(a.gueltigZumAnfragezeitpunkt).toBe(false);
    expect(a.statusMeldung).toMatch(/nicht vergeben/);
  });

  it("mappt evatr-2005 als Ablehnung der eigenen Nummer", () => {
    const a = mapEvatrAntwort({ status: "evatr-2005" }, "{}");
    expect(a.gueltigZumAnfragezeitpunkt).toBe(false);
    expect(a.statusMeldung).toMatch(/eigene DE/);
  });
});

describe("evatrAbfrage", () => {
  it("liest fachlichen Status auch bei HTTP 404", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const fetchMock: EvatrFetch = async (url, init) => {
      seen.push({ url, init });
      return jsonResponse({ status: "evatr-2001", id: "x" }, 404);
    };
    const a = await evatrAbfrage(
      { anfragendeUstid: "DE123456789", angefragteUstid: "ATU12345678" },
      { fetch: fetchMock, baseUrl: "https://example.test/app" },
    );
    expect(a.status).toBe("evatr-2001");
    expect(seen[0]?.url).toBe("https://example.test/app/v1/abfrage");
    expect(seen[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(seen[0]?.init.body))).toEqual({
      anfragendeUstid: "DE123456789",
      angefragteUstid: "ATU12345678",
    });
  });

  it("schickt qualifizierte Felder nur mit Name und Ort", async () => {
    let body = "";
    const fetchMock: EvatrFetch = async (_url, init) => {
      body = String(init.body ?? "");
      return jsonResponse(
        { status: "evatr-0000", ergFirmenname: "A", ergOrt: "A" },
        200,
      );
    };
    await evatrAbfrage(
      {
        anfragendeUstid: "DE123456789",
        angefragteUstid: "ATU12345678",
        firmenname: "Musterhaus GmbH & Co KG",
        ort: "Musterort",
        strasse: "Musterstrasse 22",
        plz: "12345",
      },
      { fetch: fetchMock, baseUrl: "https://example.test/app" },
    );
    expect(JSON.parse(body)).toMatchObject({
      firmenname: "Musterhaus GmbH & Co KG",
      ort: "Musterort",
      strasse: "Musterstrasse 22",
      plz: "12345",
    });
  });

  it("wirft bei Antwort ohne Status", async () => {
    const fetchMock: EvatrFetch = async () => jsonResponse({}, 500);
    await expect(
      evatrAbfrage(
        { anfragendeUstid: "DE123456789", angefragteUstid: "ATU12345678" },
        { fetch: fetchMock, baseUrl: "https://example.test/app" },
      ),
    ).rejects.toThrow(/Kein Status/);
  });
});
