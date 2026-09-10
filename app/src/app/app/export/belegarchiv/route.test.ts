import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exportBelegArchivZip: vi.fn(),
  getSession: vi.fn(),
  requireFirmaSession: vi.fn(),
  zeitraumFromSearchParams: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: mocks.getSession,
  requireFirmaSession: mocks.requireFirmaSession,
}));

vi.mock("@/modules/reporting", () => ({
  exportBelegArchivZip: mocks.exportBelegArchivZip,
  zeitraumFromSearchParams: mocks.zeitraumFromSearchParams,
}));

import { GET } from "./route";

describe("Belegarchiv-Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ userId: "user-1" });
    mocks.requireFirmaSession.mockResolvedValue({ firmaId: "firma-1" });
    mocks.zeitraumFromSearchParams.mockReturnValue({
      von: "2026-01-01",
      bis: "2026-12-31",
    });
  });

  it("liefert bei einem unvollständigen Archiv keinen irreführenden Download", async () => {
    const message =
      'Belegarchiv unvollständig: Datei "original.pdf" von Beleg B-0001 konnte nicht geladen werden.';
    mocks.exportBelegArchivZip.mockRejectedValue(new Error(message));

    const response = await GET(
      new Request(
        "http://localhost/app/export/belegarchiv?von=2026-01-01&bis=2026-12-31",
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe(message);
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(response.headers.get("Content-Type")).not.toBe("application/zip");
  });
});
