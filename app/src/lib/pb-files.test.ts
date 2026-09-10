import { afterEach, describe, expect, it, vi } from "vitest";

// HTTP-Integration mit echten PB- und Next-Rechten: scripts/test-pocketbase-isolation.sh.
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function setup(fileTokenStatus = 200) {
  vi.stubEnv("PB_URL", "http://pocketbase.test");
  vi.stubEnv("PB_SUPERUSER_EMAIL", "test@example.invalid");
  vi.stubEnv("PB_SUPERUSER_PASSWORD", "synthetic-password");
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ token: "synthetic-auth" }))
    .mockResolvedValueOnce(Response.json(
      fileTokenStatus === 200 ? { token: "synthetic-file-token" } : { message: "Forbidden" },
      { status: fileTokenStatus },
    ))
    .mockResolvedValueOnce(new Response("file-bytes"));
  vi.stubGlobal("fetch", fetchMock);
  const { fetchRecordFile } = await import("./pb");
  return { fetchMock, fetchRecordFile };
}

describe("fetchRecordFile protected files", () => {
  it("holt den Dateitoken serverseitig und liefert die geschützte Datei", async () => {
    const { fetchMock, fetchRecordFile } = await setup();
    const response = await fetchRecordFile("belege", "record", "beleg 1.png");
    expect(await response.text()).toBe("file-bytes");
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[1];
    expect(tokenUrl).toBe("http://pocketbase.test/api/files/token");
    expect(tokenInit.method).toBe("POST");
    expect(tokenInit.headers.get("Authorization")).toBe("synthetic-auth");
    const [fileUrl, fileInit] = fetchMock.mock.calls[2];
    expect(fileUrl).toBe("http://pocketbase.test/api/files/belege/record/beleg%201.png?token=synthetic-file-token");
    expect(fileInit.cache).toBe("no-store");
    expect(fileInit.headers.has("Authorization")).toBe(false);
    expect(response.headers.has("Location")).toBe(false);
  });

  it("bricht ab, wenn kein Dateitoken erhältlich ist", async () => {
    const { fetchMock, fetchRecordFile } = await setup(403);
    await expect(fetchRecordFile("belege", "record", "file.png")).rejects.toThrow("PocketBase 403");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
